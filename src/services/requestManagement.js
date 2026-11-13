import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

// Mock data for development mode - initialized with real data from Supabase

/**
 * Request Management Service
 * Handles the complete lifecycle of pickup requests including:
 * - Filtering and reserving requests
 * - Request acceptance and assignment
 * - Time-based cleanup and expiration
 * - Real-time notifications and concurrency control
 */
export class RequestManagementService {
  constructor() {
    this.RESERVATION_DURATION = 5 * 60 * 1000; // 5 minutes in ms
    this.ASSIGNMENT_DURATION = 10 * 60 * 60 * 1000; // 10 hours in ms
    this.EXCLUSION_DURATION = 5 * 60 * 1000; // 5 minutes in ms
    this.HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds in ms
    this.CLEANUP_INTERVAL = 60 * 1000; // 1 minute in ms
    
    this.heartbeatTimer = null;
    this.cleanupTimer = null;
    this.subscriptions = [];
    this.isInitialized = false;
    this.collectorId = null;
    this.initializationPromise = null;
  }

  /**
   * Initialize the service with session management and cleanup timers
   */
  async initialize(collectorId) {
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
      
      // Start session with error handling
      try {
        await this.startSession();
        logger.debug('✅ Session started successfully');
      } catch (error) {
        logger.error('❌ Failed to start session:', error);
        if (!import.meta.env.DEV) throw error; // In production, fail fast
      }
      
      // Skip heartbeat for now to avoid RLS issues
      logger.debug('⏭️ Skipping heartbeat to avoid RLS complications');
      
      // Start cleanup timer with error handling
      try {
        this.startCleanupTimer();
        logger.debug('✅ Cleanup timer started successfully');
      } catch (error) {
        logger.error('❌ Failed to start cleanup timer:', error);
        // Continue even if cleanup fails
      }
      
      // Skip realtime subscriptions for now to avoid WebSocket issues
      logger.debug('⏭️ Skipping realtime subscriptions to avoid WebSocket complications');

      
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
   * Start or resume a collector session
   */
  async startSession() {
    try {
      // Simplified session - just log for now to avoid RLS issues
      logger.debug('✅ Session started for collector:', this.collectorId);
      return { 
        success: true,
        session: {
          id: 'session-' + Math.random().toString(36).substr(2, 9),
          collector_id: this.collectorId,
          is_active: true,
          last_activity: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Session error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Accept a request and move it to the Accepted tab
   * @param {string} requestId - The ID of the request to accept
   * @param {string} collectorId - The ID of the collector accepting the request
   */
  async acceptRequest(requestId, collectorId = null) {
    // Set the collector ID for this operation
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

      if (existingRequest.collector_id && existingRequest.collector_id !== this.collectorId) {
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
        collectorId: this.collectorId,
        passedCollectorId: effectiveCollectorId,
        currentStatus: existingRequest.status
      });
      
      logger.info(`📊 DIAGNOSTIC: Setting collector_id in database to: ${this.collectorId}`);

      // Try simple update first (without RLS restrictions)
      // NOTE: pickup_requests table doesn't have payment calculation columns
      const { data, error } = await supabase
        .from('pickup_requests')
        .update({
          status: 'accepted',
          collector_id: this.collectorId,
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
          .eq('collector_id', this.collectorId)
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
            .eq('collector_id', this.collectorId);
        }
      } catch (sessionError) {
        // Session table may not exist or no session found - this is not critical
        logger.warn('Could not update collector session:', sessionError.message);
      }

      logger.info('Request accepted successfully:', data[0]);
      
      // Notify the user about request acceptance
      await this.notifyUserOfAcceptance(data[0]);
      
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
  async notifyUserOfAcceptance(acceptedRequest) {
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
        .eq('user_id', this.collectorId)
        .single();

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
   * Cleanup expired reservations
   */
  async cleanupExpiredReservations() {
    if (import.meta.env.DEV) {
      // Reduce logging frequency - only log every 10th cleanup
      this.reservationCleanupCount = (this.reservationCleanupCount || 0) + 1;
      if (this.reservationCleanupCount % 10 === 0) {
        logger.debug(`[DEV MODE] Simulating cleanup of expired reservations (${this.reservationCleanupCount})`);
      }
      return { success: true, cleaned: 0 };
    }

    try {
      const currentTime = new Date().toISOString();
      
      // Find reservations that have expired
      const { data: expiredReservations, error } = await supabase
        .from('pickup_requests')
        .select('id')
        .eq('status', 'pending')
        .not('reserved_by', 'is', null)
        .lt('reserved_until', currentTime);

      if (error) {
        if (import.meta.env.DEV) {
          logger.debug('[DEV MODE] Error cleaning up reservations:', error);
          return { success: true, cleaned: 0 };
        }
        throw error;
      }

      if (!expiredReservations || expiredReservations.length === 0) {
        return { success: true, cleaned: 0 };
      }

      // Clear expired reservations
      const { error: updateError } = await supabase
        .from('pickup_requests')
        .update({
          reserved_by: null,
          reserved_at: null,
          reserved_until: null
        })
        .in('id', expiredReservations.map(r => r.id));

      if (updateError) {
        if (import.meta.env.DEV) {
          logger.debug('[DEV MODE] Error updating expired reservations:', updateError);
          return { success: true, cleaned: 0 };
        }
        throw updateError;
      }

      logger.info(`Cleaned up ${expiredReservations.length} expired reservations`);
      return { success: true, cleaned: expiredReservations.length };
    } catch (error) {
      logger.error('Error cleaning up expired reservations:', error);
      throw error;
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
   * Start heartbeat timer to keep session alive
   */
  startHeartbeat() {
    logger.debug('Starting heartbeat timer');

    this.heartbeatTimer = setInterval(async () => {
      if (this.collectorId) {
        try {
          // Update last_activity timestamp to keep session alive
          const { error } = await supabase
            .from('collector_sessions')
            .update({
              last_activity: new Date().toISOString()
            })
            .eq('collector_id', this.collectorId)
            .eq('is_active', true);

          if (error) {
            logger.error('Heartbeat error:', error);
          }
        } catch (error) {
          logger.error('Heartbeat failed:', error);
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpiredReservations();
      await this.cleanupExpiredAssignments();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Setup real-time subscriptions with error handling and reconnection logic
   */
  setupRealtimeSubscriptions() {
    try {
      console.log('Setting up real-time subscriptions with error handling');
      
      // Track connection state
      this.realtimeConnected = false;
      this.reconnectAttempts = 0;
      this.MAX_RECONNECT_ATTEMPTS = 5;
      this.RECONNECT_DELAY = 5000; // 5 seconds initial delay
      
      // Setup connection status handler
      supabase.channel('system').on(
        'system',
        { event: 'connection_status' },
        (payload) => {
          const { status } = payload;
          console.log(`Realtime connection status: ${status}`);
          
          if (status === 'connected') {
            this.realtimeConnected = true;
            this.reconnectAttempts = 0;
            console.log('✅ Supabase realtime connected successfully');
          } else if (status === 'disconnected' && this.realtimeConnected) {
            this.realtimeConnected = false;
            console.warn('⚠️ Supabase realtime disconnected, will attempt reconnection');
            this.setupReconnectTimer();
          }
        }
      );

      // Real Supabase subscriptions for production with error handling
      const requestChannel = supabase.channel('request_updates', {
        config: {
          broadcast: { self: true },
          presence: { key: this.collectorId || 'anonymous' }
        }
      });

      const requestSubscription = requestChannel
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pickup_requests'
        }, (payload) => {
          try {
            this.handleRequestUpdate(payload);
          } catch (err) {
            console.error('Error handling request update:', err);
          }
        })
        .on('error', (error) => {
          console.error('Error on request channel:', error);
          this.handleChannelError('request_updates');
        })
        .subscribe((status) => {
          console.log(`Request channel subscription status: ${status}`);
        });

      // Subscribe to notifications with error handling
      const notificationChannel = supabase.channel('collector_notifications', {
        config: {
          broadcast: { self: true },
          presence: { key: this.collectorId || 'anonymous' }
        }
      });

      const notificationSubscription = notificationChannel
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'request_notifications',
          filter: `collector_id=eq.${this.collectorId || '00000000-0000-0000-0000-000000000000'}`
        }, (payload) => {
          try {
            this.handleNotification(payload);
          } catch (err) {
            console.error('Error handling notification:', err);
          }
        })
        .on('error', (error) => {
          console.error('Error on notification channel:', error);
          this.handleChannelError('collector_notifications');
        })
        .subscribe((status) => {
          console.log(`Notification channel subscription status: ${status}`);
        });

      this.subscriptions.push(requestSubscription, notificationSubscription);
    } catch (error) {
      console.error('Failed to setup realtime subscriptions:', error);
      // Don't re-throw to prevent app crash, but show warning to user
      window.dispatchEvent(new CustomEvent('realtimeError', {
        detail: { message: 'Real-time updates temporarily unavailable' }
      }));
    }
  }

  /**
   * Handle real-time request updates
   */
  handleRequestUpdate(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Dispatch custom events that components can listen to
    if (eventType === 'UPDATE') {
      // Request became unavailable
      if (newRecord.status === 'accepted' && oldRecord.status !== 'accepted' && 
          newRecord.collector_id !== this.collectorId) {
        window.dispatchEvent(new CustomEvent('requestUnavailable', {
          detail: { requestId: newRecord.id, message: 'Request accepted by another collector' }
        }));
      }
      
      // Request became available again
      if (newRecord.status === 'pending' && oldRecord.status !== 'pending') {
        window.dispatchEvent(new CustomEvent('requestAvailable', {
          detail: { requestId: newRecord.id, message: 'Request is now available' }
        }));
      }
    }
  }

  /**
   * Handle real-time notifications
   */
  handleNotification(payload) {
    const { new: notification } = payload;
    
    // Dispatch notification event
    window.dispatchEvent(new CustomEvent('newNotification', {
      detail: notification
    }));
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Clean up reconnect timer if it exists
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clean up subscriptions
    this.cleanupSubscriptions();

    // Mark session as inactive
    if (this.collectorId && !import.meta.env.DEV) {
      supabase
        .from('collector_sessions')
        .update({ is_active: false })
        .eq('collector_id', this.collectorId)
        .then(() => console.log('Session marked as inactive'))
        .catch(err => console.warn('Failed to mark session inactive:', err));
    } else if (import.meta.env.DEV) {
      console.log('[DEV MODE] Skipping session deactivation');
    }
  }
  
  /**
   * Cleanup subscriptions on destroy
   */
  cleanupSubscriptions() {
    // Clear any mock subscription timers
    if (this.mockSubscriptionTimer) {
      clearInterval(this.mockSubscriptionTimer);
      this.mockSubscriptionTimer = null;
    }

    // Clean up all subscriptions
    this.subscriptions.forEach(subscription => {
      try {
        if (subscription && subscription.unsubscribe) {
          subscription.unsubscribe();
        }
      } catch (e) {
        console.warn('Error unsubscribing:', e);
      }
    });

    this.subscriptions = [];
  }
  
  /**
   * Set up a timer to attempt reconnection with exponential backoff
   */
  setupReconnectTimer() {
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.warn(`Maximum reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached. Giving up automatic reconnection.`);
      window.dispatchEvent(new CustomEvent('realtimeError', {
        detail: { message: 'Could not reconnect to real-time updates. Please reload the app.' }
      }));
      return;
    }
    
    // Calculate delay with exponential backoff
    const delay = this.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    console.log(`Attempting to reconnect in ${delay/1000} seconds... (attempt ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.attemptReconnect();
    }, delay);
  }
  
  /**
   * Attempt to reconnect to Supabase realtime
   */
  attemptReconnect() {
    console.log('Attempting to reconnect to Supabase realtime...');
    
    // Clean up existing subscriptions
    this.cleanupSubscriptions();
    
    // Try to set up subscriptions again
    this.setupRealtimeSubscriptions();
  }
  
  /**
   * Handle channel-specific errors
   * @param {string} channelName - The name of the channel with error
   */
  handleChannelError(channelName) {
    console.warn(`Channel error on ${channelName}, will attempt to recreate the subscription`);
    
    // Refresh the problematic subscription
    const affectedSubscriptions = this.subscriptions.filter(sub => 
      sub && sub.topic && sub.topic.includes(channelName)
    );
    
    affectedSubscriptions.forEach(sub => {
      try {
        if (sub && sub.unsubscribe) {
          sub.unsubscribe();
          // Remove from subscriptions array
          const index = this.subscriptions.indexOf(sub);
          if (index > -1) {
            this.subscriptions.splice(index, 1);
          }
        }
      } catch (e) {
        console.warn(`Error unsubscribing from ${channelName}:`, e);
      }
    });
    
    // Schedule a reconnection attempt for this specific channel
    setTimeout(() => {
      console.log(`Attempting to recreate ${channelName} subscription...`);
      this.setupRealtimeSubscriptions();
    }, 3000);
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
