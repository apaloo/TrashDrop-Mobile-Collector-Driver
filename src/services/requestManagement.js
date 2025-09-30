import { supabase } from './supabase.js';

// Mock data for development mode - initialized with real data from Supabase
let mockPickupRequests = [
  {
    id: '74faaadc-73aa-4830-aca9-fb0aad5b9e8c',
    waste_type: 'recyclable',
    status: 'available',
    coordinates: [5.617959595507786, -0.19255473872904202],
    location: 'East Legon, Accra',
    fee: 150,
    bag_count: 2,
    created_at: new Date().toISOString(),
    collector_id: null,
    accepted_at: null,
    assignment_expires_at: null
  },
  {
    id: 'b6f0317b-8264-47a9-a2df-f5a4b325d14f',
    waste_type: 'general',
    status: 'available', 
    coordinates: [5.620000, -0.190000],
    location: 'Osu, Accra',
    fee: 120,
    bag_count: 1,
    created_at: new Date().toISOString(),
    collector_id: null,
    accepted_at: null,
    assignment_expires_at: null
  },
  {
    id: '85d1795b-834c-44ca-bfa5-551ecbcdfa49',
    waste_type: 'hazardous',
    status: 'available',
    coordinates: [5.615000, -0.195000], 
    location: 'Adabraka, Accra',
    fee: 200,
    bag_count: 3,
    created_at: new Date().toISOString(),
    collector_id: null,
    accepted_at: null,
    assignment_expires_at: null
  },
  {
    id: '3193e0ee-7eb1-4483-85db-76fd004a8567',
    waste_type: 'recyclable',
    status: 'available',
    coordinates: [5.625000, -0.185000],
    location: 'Labadi, Accra', 
    fee: 175,
    bag_count: 2,
    created_at: new Date().toISOString(),
    collector_id: null,
    accepted_at: null,
    assignment_expires_at: null
  }
];

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
    try {
      this.collectorId = collectorId;
      console.log(`[${import.meta.env.DEV ? 'DEV MODE' : 'PROD'}] Initializing RequestManagementService for collector:`, collectorId);
      
      // Start session with error handling
      try {
        await this.startSession();
        console.log('✅ Session started successfully');
      } catch (error) {
        console.error('❌ Failed to start session:', error);
        if (!import.meta.env.DEV) throw error; // In production, fail fast
      }
      
      // Start heartbeat with error handling
      try {
        this.startHeartbeat();
        console.log('✅ Heartbeat started successfully');
      } catch (error) {
        console.error('❌ Failed to start heartbeat:', error);
        // Continue even if heartbeat fails
      }
      
      // Start cleanup timer with error handling
      try {
        this.startCleanupTimer();
        console.log('✅ Cleanup timer started successfully');
      } catch (error) {
        console.error('❌ Failed to start cleanup timer:', error);
        // Continue even if cleanup fails
      }
      
      // Setup realtime subscriptions with error handling
      try {
        this.setupRealtimeSubscriptions();
        console.log('✅ Realtime subscriptions setup successfully');
      } catch (error) {
        console.error('❌ Failed to setup realtime subscriptions:', error);
        // Continue even if realtime fails
      }

      // Sync mock data with real Supabase data in DEV mode
      if (import.meta.env.DEV) {
        try {
          await this.syncMockData();
          console.log('✅ Mock data synchronized with Supabase');
        } catch (error) {
          console.error('❌ Failed to sync mock data:', error);
          // Continue even if sync fails
        }
      }
      
      console.log('🎉 RequestManagementService initialized successfully');
    } catch (error) {
      console.error('💥 Critical failure initializing RequestManagementService:', error);
      throw error;
    }
  }

  /**
   * Start or resume a collector session
   */
  async startSession() {
    try {
      // In dev mode, immediately use mock session without Supabase calls
      if (import.meta.env.DEV) {
        console.log('[DEV MODE] Creating mock collector session for:', this.collectorId);
        const mockSession = {
          id: 'dev-session-' + Math.random().toString(36).substr(2, 9),
          collector_id: this.collectorId,
          is_active: true,
          reserved_requests: [],
          last_activity: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return mockSession;
      }
      
      // For production, continue with Supabase API calls
      const { data: sessions, error } = await supabase
        .from('collector_sessions')
        .select('*')
        .eq('collector_id', this.collectorId);

      if (error) {
        throw error;
      }

      if (sessions && sessions.length > 0) {
        // Update existing session
        const session = sessions[0];
        const { error: updateError } = await supabase
          .from('collector_sessions')
          .update({
            is_active: true,
            last_activity: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);

        if (updateError && !import.meta.env.DEV) throw updateError;
        return session;
      } else {
        // Create new session
        const { data: newSession, error: insertError } = await supabase
          .from('collector_sessions')
          .insert({
            collector_id: this.collectorId,
            is_active: true,
            reserved_requests: [],
            last_activity: new Date().toISOString()
          })
          .select();

        if (insertError) {
          if (import.meta.env.DEV) {
            // In dev mode, return a mock session
            return {
              id: 'dev-session-' + Math.random().toString(36).substr(2, 9),
              collector_id: this.collectorId,
              is_active: true,
              reserved_requests: [],
              last_activity: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
          }
          throw insertError;
        }
        return newSession[0];
      }
    } catch (error) {
      console.error('Error starting session:', error);
      if (import.meta.env.DEV) {
        // In dev mode, return a mock session even on error
        return {
          id: 'dev-session-' + Math.random().toString(36).substr(2, 9),
          collector_id: this.collectorId,
          is_active: true,
          reserved_requests: [],
          last_activity: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      throw error;
    }
  }

  /**
   * Sync mock data with real Supabase data in DEV mode
   */
  async syncMockData() {
    try {
      const { data: supabaseData, error } = await supabase
        .from('pickup_requests')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[DEV MODE] Failed to fetch Supabase data for sync:', error);
        return;
      }

      if (supabaseData && supabaseData.length > 0) {
        // Update mock data with real data from Supabase
        mockPickupRequests.length = 0; // Clear existing mock data
        mockPickupRequests.push(...supabaseData); // Add real data
        console.log(`[DEV MODE] Synced ${supabaseData.length} requests from Supabase to mock data`);
      }
    } catch (error) {
      console.warn('[DEV MODE] Error syncing mock data:', error);
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
          reservation_expires_at: reservationExpiry
        })
        .in('id', requestIds)
        .is('reserved_by', null) // Prevent race conditions
        .select();

      if (reserveError) throw reserveError;

      // Update session with reserved requests
      if (!import.meta.env.DEV) {
        await supabase
          .from('collector_sessions')
          .update({
            filter_criteria: filterCriteria,
            reserved_requests: requestIds,
            last_activity: currentTime
          })
          .eq('collector_id', this.collectorId);
      } else {
        console.log('[DEV MODE] Skipping session update for reserved requests');
      }

      console.log(`Reserved ${reservedRequests.length} requests for collector`);
      
      return { success: true, requests: reservedRequests };
    } catch (error) {
      console.error('Error filtering and reserving requests:', error);
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
    
    // Check for temporary IDs
    if (requestId && requestId.startsWith('temp-')) {
      console.warn('Attempted to accept request with temporary ID:', requestId);
      return { 
        success: false, 
        error: 'Cannot accept temporary requests. Please wait for the data to sync.' 
      };
    }
    
    // Validate UUID format (8-4-4-4-12 hexadecimal digits with hyphens)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (requestId && !uuidRegex.test(requestId)) {
      console.warn('Attempted to accept request with invalid UUID format:', requestId);
      return { 
        success: false, 
        error: 'Invalid request ID format. This may be test data or an incomplete request.' 
      };
    }
    
    if (import.meta.env.DEV) {
      console.log('[DEV MODE] Accepting mock request:', requestId);
      try {
        // Find and update mock request
        const requestIndex = mockPickupRequests.findIndex(req => req.id === requestId);
        if (requestIndex === -1) {
          console.warn('[DEV MODE] Request not found in mock data:', requestId);
          return { success: false, error: 'Request not found in the database' };
        }
        
        if (mockPickupRequests[requestIndex].status !== 'available') {
          return { success: false, error: 'Request is no longer available' };
        }
        
        mockPickupRequests[requestIndex] = {
          ...mockPickupRequests[requestIndex],
          status: 'accepted',
          collector_id: effectiveCollectorId,
          accepted_at: new Date().toISOString(),
          assignment_expires_at: new Date(Date.now() + this.ASSIGNMENT_DURATION).toISOString()
        };
        
        return { success: true, request: mockPickupRequests[requestIndex] };
      } catch (error) {
        console.error('[DEV MODE] Error accepting mock request:', error);
        return { success: false, error: error.message || 'Failed to process request' };
      }
    }

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
          reservation_expires_at: null
        })
        .eq('id', requestId)
        .eq('reserved_by', this.collectorId)
        .gt('reservation_expires_at', currentTime)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Request is no longer available or reservation has expired');
      }

      // Update session's reserved requests
      if (!import.meta.env.DEV) {
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
      } else {
        console.log('[DEV MODE] Skipping session update for accepted request');
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
    if (import.meta.env.DEV) {
      console.log('[DEV MODE] Using mock requests for collector:', this.collectorId);
      // Filter mock requests by status
      switch (status) {
        case 'available':
          return mockPickupRequests.filter(req => req.status === 'available');
        case 'accepted':
          return mockPickupRequests.filter(req => req.status === 'accepted' && req.collector_id === this.collectorId);
        case 'completed':
          return mockPickupRequests.filter(req => req.status === 'picked_up' || req.status === 'disposed');
        default:
          throw new Error('Invalid status');
      }
    }

    try {
      let query;
      
      switch (status) {
        case 'available':
          // Get reserved requests for this collector
          query = supabase
            .from('pickup_requests')
            .select('*')
            .eq('reserved_by', this.collectorId)
            .gt('reservation_expires_at', new Date().toISOString());
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
    if (import.meta.env.DEV) {
      console.log('[DEV MODE] Updating mock request status:', requestId, status);
      // Find and update mock request
      const requestIndex = mockPickupRequests.findIndex(req => req.id === requestId);
      if (requestIndex === -1) {
        throw new Error('Request not found');
      }
      mockPickupRequests[requestIndex] = {
        ...mockPickupRequests[requestIndex],
        status,
        updated_at: new Date().toISOString(),
        ...additionalData
      };
      return { success: true };
    }
  }

  /**
   * Get collector notifications
   */
  async getNotifications(unreadOnly = false) {
    if (import.meta.env.DEV) {
      console.log('[DEV MODE] Using mock notifications');
      return mockNotifications;
    }

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
      if (import.meta.env.DEV) {
        console.log('[DEV MODE] Error fetching notifications, using mock data:', error);
        return mockNotifications;
      }
      console.error('Error getting notifications:', error);
      throw error;
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
        console.log(`[DEV MODE] Simulating cleanup of expired reservations (${this.reservationCleanupCount})`);
      }
      return { success: true, cleaned: 0 };
    }

    try {
      const currentTime = new Date().toISOString();
      
      // Find reservations that have expired
      const { data: expiredReservations, error } = await supabase
        .from('pickup_requests')
        .select('id')
        .eq('status', 'available')
        .not('reserved_by', 'is', null)
        .lt('reserved_until', currentTime);

      if (error) {
        if (import.meta.env.DEV) {
          console.log('[DEV MODE] Error cleaning up reservations:', error);
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
          console.log('[DEV MODE] Error updating expired reservations:', updateError);
          return { success: true, cleaned: 0 };
        }
        throw updateError;
      }

      console.log(`Cleaned up ${expiredReservations.length} expired reservations`);
      return { success: true, cleaned: expiredReservations.length };
    } catch (error) {
      console.error('Error cleaning up expired reservations:', error);
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
        console.log(`[DEV MODE] Simulating cleanup of expired assignments (${this.assignmentCleanupCount})`);
      }
      return { success: true, cleaned: 0 };
    }

    try {
      // Find assignments that have expired
      const { data: expiredAssignments, error } = await supabase
        .from('pickup_requests')
        .select('id')
        .eq('status', 'accepted')
        .lt('assignment_expires_at', new Date().toISOString());

      if (error) {
        if (import.meta.env.DEV) {
          console.log('[DEV MODE] Error cleaning up assignments:', error);
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
          status: 'available',
          collector_id: null,
          accepted_at: null,
          assignment_expires_at: null
        })
        .in('id', expiredAssignments.map(a => a.id));

      if (updateError) {
        if (import.meta.env.DEV) {
          console.log('[DEV MODE] Error updating expired assignments:', updateError);
          return { success: true, cleaned: 0 };
        }
        throw updateError;
      }

      return { success: true, cleaned: expiredAssignments.length };
    } catch (error) {
      console.error('Error cleaning up expired assignments:', error);
      throw error;
    }
  }

  /**
   * Start heartbeat timer to keep session alive
   */
  startHeartbeat() {
    if (import.meta.env.DEV) {
      console.log('[DEV MODE] Starting heartbeat timer');
      // In dev mode, just log heartbeat activity occasionally
      let heartbeatCount = 0;
      this.heartbeatTimer = setInterval(() => {
        heartbeatCount++;
        // Only log every 5th heartbeat to reduce console spam
        if (heartbeatCount % 5 === 0) {
          console.log(`[DEV MODE] Heartbeat - session active (${heartbeatCount})`);
        }
      }, this.HEARTBEAT_INTERVAL);
      return;
    }

    this.heartbeatTimer = setInterval(async () => {
      if (this.collectorId) {
        try {
          // Update last_activity timestamp to keep session alive
          const { error } = await supabase
            .from('collector_sessions')
            .update({
              last_activity: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('collector_id', this.collectorId)
            .eq('is_active', true);

          if (error) {
            console.error('Heartbeat error:', error);
          }
        } catch (error) {
          console.error('Heartbeat failed:', error);
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
    if (import.meta.env.DEV) {
      console.log('[DEV MODE] Setting up mock real-time subscriptions');
      // In dev mode, we'll simulate real-time updates using intervals
      this.mockSubscriptionTimer = setInterval(() => {
        // Simulate request updates
        mockPickupRequests.forEach(req => {
          if (req.status === 'accepted' && req.assignment_expires_at && new Date(req.assignment_expires_at) < new Date()) {
            // Simulate expired assignment
            const oldRecord = { ...req };
            req.status = 'available';
            req.collector_id = null;
            req.accepted_at = null;
            req.assignment_expires_at = null;
            this.handleRequestUpdate({
              eventType: 'UPDATE',
              new: req,
              old: oldRecord
            });
          }
        });
      }, 10000); // Check every 10 seconds
      return;
    }

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
          const { event, status } = payload;
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
      if (newRecord.status === 'available' && oldRecord.status !== 'available') {
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

// Export singleton instance
export const requestManager = new RequestManagementService();
