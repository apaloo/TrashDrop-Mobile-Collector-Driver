import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Request Management Service
 * Handles the complete lifecycle of pickup requests including:
 * - Request acceptance and assignment (with the household's notice)
 * - Giving back accepted requests whose assignment expired
 */
export class RequestManagementService {
  constructor() {
    this.ASSIGNMENT_DURATION = 10 * 60 * 60 * 1000; // 10 hours in ms
    this.EXCLUSION_DURATION = 5 * 60 * 1000; // 5 minutes in ms
    this.CLEANUP_INTERVAL = 60 * 1000; // 1 minute in ms
    
    this.cleanupTimer = null;
    this.isInitialized = false;
    this.collectorId = null;
    this.initializationPromise = null;
  }

  /**
   * Start the service for the signed-in collector (again, if another
   * collector was signed in before on this phone)
   */
  async initialize(collectorId) {
    // A different collector signed in on this phone: start over for them
    if (this.collectorId && collectorId && this.collectorId !== collectorId) {
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.isInitialized = false;
      this.initializationPromise = null;
    }

    // IMMEDIATE: Skip initialization if already initialized with same collector
    if (this.isInitialized && this.collectorId === collectorId) {
      // Debug only - service already initialized
      logger.debug('⚡ RequestManagementService already initialized for collector:', collectorId);
      return Promise.resolve(this); // Return immediately for already initialized
    }
    
    // IMMEDIATE: If initialization is in progress, return existing promise
    if (this.initializationPromise) {
      logger.debug('⏳ Reusing existing initialization promise...');
      return this.initializationPromise;
    }
    
    // Create initialization promise to prevent race conditions
    this.initializationPromise = (async () => {
      try {
        this.collectorId = collectorId;
        logger.info('Initializing RequestManagementService for collector:', collectorId);
      
      // The phone's only background job: every minute, give back accepted
      // pickup requests whose assignment has expired (the database allows
      // that only after assignment_expires_at). Realtime subscriptions, a
      // heartbeat and reservations were never switched on and were removed
      // on 2026-11-13.
      this.startCleanupTimer();

      this.isInitialized = true;
      logger.info('🎉 RequestManagementService initialized successfully');
      
      return this;
      } catch (error) {
        logger.error('💥 Critical failure initializing RequestManagementService:', error);
        this.initializationPromise = null; // Reset promise on failure
        throw error;
      }
    })();
    
    return this.initializationPromise;
  }
  /**
   * Accept a request and move it to the Accepted tab
   * @param {string} requestId - The ID of the request to accept
   * @param {string} collectorId - The ID of the collector accepting the request
   */
  async acceptRequest(requestId, collectorId = null) {
    // The collector signed in now. Never the one the service was first
    // started for: on a shared phone that was the previous collector, and the
    // database refuses to give a request to someone else.
    const effectiveCollectorId = collectorId || this.collectorId;
    
    // Check if service is initialized
    if (!this.isInitialized) {
      logger.warn('RequestManagementService not initialized');
      return { 
        success: false, 
        error: 'Service not initialized. Please wait and try again.' 
      };
    }
    
    // Check for temporary IDs
    if (requestId && requestId.startsWith('temp-')) {
      logger.warn('Attempted to accept request with temporary ID:', requestId);
      return { 
        success: false, 
        error: 'Cannot accept temporary requests. Please wait for the data to sync.' 
      };
    }
    
    // Validate UUID format (8-4-4-4-12 hexadecimal digits with hyphens)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (requestId && !uuidRegex.test(requestId)) {
      logger.warn('Attempted to accept request with invalid UUID format:', requestId);
      return { 
        success: false, 
        error: 'Invalid request ID format. This may be test data or an incomplete request.' 
      };
    }
    
    // Check authentication
    if (!effectiveCollectorId) {
      logger.warn('No collector ID provided for request acceptance');
      return { 
        success: false, 
        error: 'Authentication required. Please log in and try again.' 
      };
    }

    try {
      const currentTime = new Date().toISOString();
      const assignmentExpiry = new Date(Date.now() + this.ASSIGNMENT_DURATION).toISOString();
      
      // First check if the request exists and is available
      const { data: existingRequest, error: checkError } = await supabase
        .from('pickup_requests')
        .select('id, status, collector_id')
        .eq('id', requestId)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          throw new Error('Request not found in database - it may have been removed or is test data');
        }
        throw checkError;
      }

      if (!existingRequest) {
        throw new Error('Request not found in database');
      }

      if (existingRequest.status !== 'pending') {
        throw new Error(`Request is no longer available - current status: ${existingRequest.status}`);
      }

      if (existingRequest.collector_id && existingRequest.collector_id !== effectiveCollectorId) {
        throw new Error('Request has already been accepted by another collector');
      }

      // No payout is worked out here (TD34, owner's decision 2026-11-13). A
      // pickup request is prepaid bags: the database pays the collector 100%
      // of the scanned bags' prices plus tips when it is disposed
      // (finalize_pickup_request_payout → td_apply_prepaid_bag_payout). The
      // digital-bin formula this used to run never applied, and was never stored.

      // Now try to accept the request with detailed logging
      logger.info('🔄 Attempting to accept request:', {
        requestId,
        collectorId: effectiveCollectorId,
        currentStatus: existingRequest.status
      });
      
      logger.info(`📊 DIAGNOSTIC: Setting collector_id in database to: ${effectiveCollectorId}`);

      // Try simple update first (without RLS restrictions)
      // NOTE: pickup_requests table doesn't have payment calculation columns
      const { data, error } = await supabase
        .from('pickup_requests')
        .update({
          status: 'accepted',
          collector_id: effectiveCollectorId,
          accepted_at: currentTime,
          assignment_expires_at: assignmentExpiry
        })
        .eq('id', requestId)
        .select();

      logger.debug('📊 Update query result:', { data, error, requestId });

      if (error) throw error;

      if (!data || data.length === 0) {
        // Get current status to debug why update failed
        const { data: currentData } = await supabase
          .from('pickup_requests')
          .select('id, status, collector_id')
          .eq('id', requestId)
          .single();
        
        logger.warn('🔍 Request status after failed update:', currentData);
        throw new Error(`Request could not be accepted - current status: ${currentData?.status || 'not found'}, collector: ${currentData?.collector_id || 'none'}`);
      }

      // Update session's reserved requests (optional - may not exist)
      try {
        const { data: session } = await supabase
          .from('collector_sessions')
          .select('reserved_requests')
          .eq('collector_id', effectiveCollectorId)
          .maybeSingle(); // no session yet is normal: null, not a 406 in the logs

        if (session) {
          const updatedReserved = (session.reserved_requests || [])
            .filter(id => id !== requestId);
          
          await supabase
            .from('collector_sessions')
            .update({
              reserved_requests: updatedReserved,
              last_activity: currentTime
            })
            .eq('collector_id', effectiveCollectorId);
        }
      } catch (sessionError) {
        // Session table may not exist or no session found - this is not critical
        logger.warn('Could not update collector session:', sessionError.message);
      }

      logger.info('Request accepted successfully:', data[0]);
      
      // Notify the user about request acceptance
      await this.notifyUserOfAcceptance(data[0], effectiveCollectorId);
      
      return { success: true, request: data[0] };
    } catch (error) {
      logger.error('Error accepting request:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.code === 'PGRST116') {
        errorMessage = 'Request not found or no longer available';
      } else if (error.message.includes('duplicate key')) {
        errorMessage = 'Request has already been accepted';
      } else if (error.message.includes('violates row-level security')) {
        errorMessage = 'Access denied - authentication issue';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Notify user when their request is accepted
   */
  async notifyUserOfAcceptance(acceptedRequest, collectorId = this.collectorId) {
    try {
      // Skip if no user_id (shouldn't happen but safety check)
      if (!acceptedRequest.user_id) {
        logger.warn('No user_id found for request:', acceptedRequest.id);
        return;
      }

      // Get collector profile for notification details
      const { data: collectorProfile } = await supabase
        .from('collector_profiles')
        .select('first_name, last_name, phone, vehicle_type, license_plate')
        .eq('user_id', collectorId)
        .maybeSingle();

      const collectorName = collectorProfile 
        ? `${collectorProfile.first_name} ${collectorProfile.last_name}`
        : 'A collector';

      // Create notification for the user
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: acceptedRequest.user_id,
          title: 'Pickup Request Accepted! 🎉',
          message: `${collectorName} has accepted your ${acceptedRequest.waste_type || 'waste'} pickup request and will arrive soon. Track their progress in the app.`,
          type: 'pickup_accepted',
          read: false
        });

      if (notificationError) {
        logger.error('Failed to create user notification:', notificationError);
      } else {
        logger.debug('✅ User notification created for request:', acceptedRequest.id);
      }

      // TODO: Send push notification via external service (Firebase, OneSignal, etc.)
      // await sendPushNotification(acceptedRequest.user_id, {
      //   title: 'Pickup Request Accepted',
      //   body: `${collectorName} will collect your waste soon.`
      // });

    } catch (error) {
      logger.error('Error notifying user of acceptance:', error);
      // Don't throw - notification failure shouldn't block request acceptance
    }
  }

  /**
   * Cleanup expired assignments
   */
  async cleanupExpiredAssignments() {
    if (import.meta.env.DEV) {
      // Reduce logging frequency - only log every 10th cleanup
      this.assignmentCleanupCount = (this.assignmentCleanupCount || 0) + 1;
      if (this.assignmentCleanupCount % 10 === 0) {
        logger.debug(`[DEV MODE] Simulating cleanup of expired assignments (${this.assignmentCleanupCount})`);
      }
      return { success: true, cleaned: 0 };
    }

    try {
      // Find accepted requests whose assignment has expired. Only these can go
      // back to the pool: the database's status flow allows accepted ->
      // pending but refuses en_route/arrived -> pending (the collector is on
      // the way or there). Including those made the whole batch update fail,
      // every minute, so expired accepted requests were never released either.
      const { data: expiredAssignments, error } = await supabase
        .from('pickup_requests')
        .select('id')
        .eq('status', 'accepted')
        .lt('assignment_expires_at', new Date().toISOString());

      if (error) {
        if (import.meta.env.DEV) {
          logger.debug('[DEV MODE] Error cleaning up assignments:', error);
          return { success: true, cleaned: 0 };
        }
        throw error;
      }

      if (!expiredAssignments || expiredAssignments.length === 0) {
        return { success: true, cleaned: 0 };
      }

      // Reset expired assignments to available
      const { error: updateError } = await supabase
        .from('pickup_requests')
        .update({
          status: 'pending',
          collector_id: null,
          accepted_at: null,
          assignment_expires_at: null
        })
        .in('id', expiredAssignments.map(a => a.id))
        .eq('status', 'accepted'); // skip any that moved on since the select

      if (updateError) {
        if (import.meta.env.DEV) {
          logger.debug('[DEV MODE] Error updating expired assignments:', updateError);
          return { success: true, cleaned: 0 };
        }
        throw updateError;
      }

      return { success: true, cleaned: expiredAssignments.length };
    } catch (error) {
      logger.error('Error cleaning up expired assignments:', error);
      throw error;
    }
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer); // one timer, also after a new sign-in
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredAssignments();
      } catch {
        // already logged; try again next minute
      }
    }, this.CLEANUP_INTERVAL);
  }


}

// Lazy singleton instance - only created when first accessed
let _requestManagerInstance = null;

function getRequestManager() {
  if (!_requestManagerInstance) {
    _requestManagerInstance = new RequestManagementService();
  }
  return _requestManagerInstance;
}

// Use Proxy to delay initialization until first property access
export const requestManager = new Proxy({}, {
  get(target, prop) {
    const instance = getRequestManager();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  set(target, prop, value) {
    const instance = getRequestManager();
    instance[prop] = value;
    return true;
  }
});
