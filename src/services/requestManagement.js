import { supabase } from './supabase.js';

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
  }

  /**
   * Initialize the service with session management and cleanup timers
   */
  async initialize(collectorId) {
    this.collectorId = collectorId;
    await this.startSession();
    this.startHeartbeat();
    this.startCleanupTimer();
    this.setupRealtimeSubscriptions();
  }

  /**
   * Start or resume a collector session
   */
  async startSession() {
    try {
      const currentTime = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('collector_sessions')
        .upsert({
          collector_id: this.collectorId,
          session_start: currentTime,
          last_activity: currentTime,
          is_active: true
        }, { 
          onConflict: 'collector_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log('Session started:', data);
      return { success: true, session: data };
    } catch (error) {
      console.error('Error starting session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Filter and reserve available requests based on criteria
   */
  async filterAndReserveRequests(filterCriteria = {}) {
    try {
      const currentTime = new Date().toISOString();
      const reservationExpiry = new Date(Date.now() + this.RESERVATION_DURATION).toISOString();
      
      // First, clean up any expired reservations
      await this.cleanupExpiredReservations();
      
      // Build filter query
      let query = supabase
        .from('pickup_requests')
        .select('*')
        .eq('status', 'available')
        .is('reserved_by', null)
        .or(`exclusion_until.is.null,exclusion_until.lt.${currentTime}`);

      // Apply filters
      if (filterCriteria.waste_type) {
        query = query.eq('waste_type', filterCriteria.waste_type);
      }
      if (filterCriteria.max_distance) {
        // Note: This requires PostGIS for proper distance calculation
        // For now, we'll fetch all and filter client-side
      }
      if (filterCriteria.min_fee) {
        query = query.gte('fee', filterCriteria.min_fee);
      }

      const { data: availableRequests, error } = await query
        .order('created_at', { ascending: true })
        .limit(20);

      if (error) throw error;

      if (availableRequests.length === 0) {
        return { success: true, requests: [] };
      }

      // Reserve the requests for this collector
      const requestIds = availableRequests.map(r => r.id);
      
      const { data: reservedRequests, error: reserveError } = await supabase
        .from('pickup_requests')
        .update({
          reserved_by: this.collectorId,
          reserved_at: currentTime,
          reserved_until: reservationExpiry
        })
        .in('id', requestIds)
        .is('reserved_by', null) // Prevent race conditions
        .select();

      if (reserveError) throw reserveError;

      // Update session with reserved requests
      await supabase
        .from('collector_sessions')
        .update({
          filter_criteria: filterCriteria,
          reserved_requests: requestIds,
          last_activity: currentTime
        })
        .eq('collector_id', this.collectorId);

      console.log(`Reserved ${reservedRequests.length} requests for collector`);
      
      return { success: true, requests: reservedRequests };
    } catch (error) {
      console.error('Error filtering and reserving requests:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Accept a request and move it to the Accepted tab
   */
  async acceptRequest(requestId) {
    try {
      const currentTime = new Date().toISOString();
      const assignmentExpiry = new Date(Date.now() + this.ASSIGNMENT_DURATION).toISOString();
      
      // Optimistic locking - only accept if still reserved by this collector
      const { data, error } = await supabase
        .from('pickup_requests')
        .update({
          status: 'accepted',
          collector_id: this.collectorId,
          accepted_at: currentTime,
          assignment_expires_at: assignmentExpiry,
          reserved_by: null,
          reserved_at: null,
          reserved_until: null
        })
        .eq('id', requestId)
        .eq('reserved_by', this.collectorId)
        .gt('reserved_until', currentTime)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Request is no longer available or reservation has expired');
      }

      // Update session to remove from reserved requests
      const { data: session } = await supabase
        .from('collector_sessions')
        .select('reserved_requests')
        .eq('collector_id', this.collectorId)
        .single();

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

      console.log('Request accepted successfully:', data);
      
      return { success: true, request: data };
    } catch (error) {
      console.error('Error accepting request:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all requests for a collector by status
   */
  async getRequestsByStatus(status) {
    try {
      let query;
      
      switch (status) {
        case 'available':
          // Get reserved requests for this collector
          query = supabase
            .from('pickup_requests')
            .select('*')
            .eq('reserved_by', this.collectorId)
            .gt('reserved_until', new Date().toISOString());
          break;
        
        case 'accepted':
          query = supabase
            .from('pickup_requests')
            .select('*')
            .eq('status', 'accepted')
            .eq('collector_id', this.collectorId);
          break;
        
        case 'completed':
          query = supabase
            .from('pickup_requests')
            .select('*')
            .in('status', ['picked_up', 'disposed'])
            .eq('collector_id', this.collectorId);
          break;
        
        default:
          throw new Error('Invalid status');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      return { success: true, requests: data || [] };
    } catch (error) {
      console.error('Error getting requests by status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update request status (for pickup and disposal)
   */
  async updateRequestStatus(requestId, status, additionalData = {}) {
    try {
      const currentTime = new Date().toISOString();
      
      const updateData = {
        status,
        updated_at: currentTime,
        ...additionalData
      };

      // Add timestamp fields based on status
      if (status === 'picked_up') {
        updateData.picked_up_at = currentTime;
      } else if (status === 'disposed') {
        updateData.disposed_at = currentTime;
      }

      const { data, error } = await supabase
        .from('pickup_requests')
        .update(updateData)
        .eq('id', requestId)
        .eq('collector_id', this.collectorId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, request: data };
    } catch (error) {
      console.error('Error updating request status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get collector notifications
   */
  async getNotifications(unreadOnly = false) {
    try {
      let query = supabase
        .from('request_notifications')
        .select('*')
        .eq('collector_id', this.collectorId);
      
      if (unreadOnly) {
        query = query.is('read_at', null);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return { success: true, notifications: data || [] };
    } catch (error) {
      console.error('Error getting notifications:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId) {
    try {
      const { data, error } = await supabase
        .from('request_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('collector_id', this.collectorId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, notification: data };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup expired reservations
   */
  async cleanupExpiredReservations() {
    try {
      const { error } = await supabase.rpc('cleanup_expired_reservations');
      if (error) throw error;
    } catch (error) {
      console.error('Error cleaning up expired reservations:', error);
    }
  }

  /**
   * Cleanup expired assignments
   */
  async cleanupExpiredAssignments() {
    try {
      const { error } = await supabase.rpc('cleanup_expired_assignments');
      if (error) throw error;
    } catch (error) {
      console.error('Error cleaning up expired assignments:', error);
    }
  }

  /**
   * Send heartbeat to keep session active
   */
  async sendHeartbeat() {
    try {
      await supabase
        .from('collector_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('collector_id', this.collectorId);
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }

  /**
   * Start periodic heartbeat
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
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
   * Setup real-time subscriptions for notifications
   */
  setupRealtimeSubscriptions() {
    // Subscribe to request changes
    const requestSubscription = supabase
      .channel('request_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pickup_requests'
      }, (payload) => {
        this.handleRequestUpdate(payload);
      })
      .subscribe();

    // Subscribe to notifications
    const notificationSubscription = supabase
      .channel('collector_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'request_notifications',
        filter: `collector_id=eq.${this.collectorId}`
      }, (payload) => {
        this.handleNotification(payload);
      })
      .subscribe();

    this.subscriptions.push(requestSubscription, notificationSubscription);
  }

  /**
   * Handle real-time request updates
   */
  handleRequestUpdate(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Dispatch custom events that components can listen to
    if (eventType === 'UPDATE' && newRecord.status === 'accepted' && 
        oldRecord.status !== 'accepted' && newRecord.collector_id !== this.collectorId) {
      
      window.dispatchEvent(new CustomEvent('requestUnavailable', {
        detail: { requestId: newRecord.id, message: 'Request accepted by another collector' }
      }));
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
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Unsubscribe from real-time channels
    this.subscriptions.forEach(subscription => {
      supabase.removeChannel(subscription);
    });

    // Mark session as inactive
    if (this.collectorId) {
      supabase
        .from('collector_sessions')
        .update({ is_active: false })
        .eq('collector_id', this.collectorId)
        .then(() => console.log('Session marked as inactive'));
    }
  }
}

// Export singleton instance
export const requestManager = new RequestManagementService();
