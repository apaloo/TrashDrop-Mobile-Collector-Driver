/**
 * TrashDrop Collector Status Management Service
 * Provides Uber-like online/offline functionality for drivers
 */

import { supabase, DEV_MODE } from './supabase';

// Status constants
export const COLLECTOR_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  BUSY: 'busy',
  BREAK: 'break'
};

// Status colors and UI configuration
export const STATUS_CONFIG = {
  [COLLECTOR_STATUS.ONLINE]: {
    color: 'bg-green-500',
    textColor: 'text-green-600',
    label: 'Online',
    description: 'Available for new requests'
  },
  [COLLECTOR_STATUS.OFFLINE]: {
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    label: 'Offline',
    description: 'Not accepting requests'
  },
  [COLLECTOR_STATUS.BUSY]: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    label: 'Busy',
    description: 'Currently handling requests'
  },
  [COLLECTOR_STATUS.BREAK]: {
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    label: 'On Break',
    description: 'Taking a break'
  }
};

class CollectorStatusService {
  constructor() {
    this.currentStatus = COLLECTOR_STATUS.OFFLINE;
    this.statusListeners = [];
    this.sessionStart = null;
    this.sessionStats = {
      totalOnlineTime: 0,
      requestsAccepted: 0,
      requestsCompleted: 0
    };
    
    // Initialize from localStorage
    this.initializeStatus();
  }

  /**
   * Initialize status from localStorage and sync with backend
   */
  async initializeStatus() {
    try {
      // Get saved status from localStorage
      const savedStatus = localStorage.getItem('collector_status');
      const savedSessionStart = localStorage.getItem('collector_session_start');
      
      if (savedStatus && Object.values(COLLECTOR_STATUS).includes(savedStatus)) {
        this.currentStatus = savedStatus;
      }
      
      if (savedSessionStart) {
        this.sessionStart = new Date(savedSessionStart);
      }

      // Sync with backend
      await this.syncStatusWithBackend();
      
      console.log(`✅ Status initialized: ${this.currentStatus}`);
    } catch (error) {
      console.error('❌ Error initializing status:', error);
      this.currentStatus = COLLECTOR_STATUS.OFFLINE;
    }
  }

  /**
   * Change collector status
   */
  async setStatus(newStatus, options = {}) {
    const { reason = '', silent = false } = options;
    
    if (!Object.values(COLLECTOR_STATUS).includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const previousStatus = this.currentStatus;
    const timestamp = new Date();

    try {
      // Handle session management
      if (newStatus === COLLECTOR_STATUS.ONLINE && previousStatus !== COLLECTOR_STATUS.ONLINE) {
        await this.startOnlineSession();
      } else if (newStatus !== COLLECTOR_STATUS.ONLINE && previousStatus === COLLECTOR_STATUS.ONLINE) {
        await this.endOnlineSession();
      }

      this.currentStatus = newStatus;

      // Persist to localStorage
      localStorage.setItem('collector_status', newStatus);
      
      // Sync with backend
      await this.updateBackendStatus(newStatus, reason, timestamp);
      
      // Notify listeners
      if (!silent) {
        this.notifyStatusListeners(newStatus, previousStatus);
      }

      console.log(`📡 Status changed: ${previousStatus} → ${newStatus}${reason ? ` (${reason})` : ''}`);
      
      return {
        success: true,
        previousStatus,
        currentStatus: newStatus,
        timestamp
      };

    } catch (error) {
      console.error('❌ Error setting status:', error);
      // Revert on error
      this.currentStatus = previousStatus;
      throw error;
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      status: this.currentStatus,
      config: STATUS_CONFIG[this.currentStatus],
      isOnline: this.currentStatus === COLLECTOR_STATUS.ONLINE,
      sessionStart: this.sessionStart,
      sessionStats: this.sessionStats
    };
  }

  /**
   * Toggle between online and offline
   */
  async toggleStatus() {
    const newStatus = this.currentStatus === COLLECTOR_STATUS.ONLINE 
      ? COLLECTOR_STATUS.OFFLINE 
      : COLLECTOR_STATUS.ONLINE;
    
    return await this.setStatus(newStatus);
  }

  /**
   * Start online session
   */
  async startOnlineSession() {
    this.sessionStart = new Date();
    localStorage.setItem('collector_session_start', this.sessionStart.toISOString());
    
    // Reset session stats
    this.sessionStats = {
      totalOnlineTime: 0,
      requestsAccepted: 0,
      requestsCompleted: 0
    };

    console.log('🟢 Online session started');
  }

  /**
   * End online session
   */
  async endOnlineSession() {
    if (this.sessionStart) {
      const sessionEnd = new Date();
      const sessionDuration = sessionEnd - this.sessionStart;
      
      this.sessionStats.totalOnlineTime = sessionDuration;
      
      // Save session to backend
      await this.saveSessionToBackend(this.sessionStart, sessionEnd, sessionDuration);
      
      this.sessionStart = null;
      localStorage.removeItem('collector_session_start');
      
      console.log(`🔴 Online session ended (Duration: ${Math.round(sessionDuration / 1000 / 60)} minutes)`);
    }
  }

  /**
   * Update backend status
   */
  async updateBackendStatus(status, reason, timestamp) {
    try {
      if (DEV_MODE) {
        console.log('[DEV MODE] Simulating backend status update:', {
          status,
          reason,
          timestamp
        });
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from('collector_sessions')
        .upsert({
          collector_id: userData.user.id,
          status: status,
          status_reason: reason,
          last_status_change: timestamp.toISOString(),
          is_active: status === COLLECTOR_STATUS.ONLINE,
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Error updating backend status:', error);
      }
    } catch (error) {
      console.error('❌ Error in backend status update:', error);
    }
  }

  /**
   * Sync status with backend
   */
  async syncStatusWithBackend() {
    try {
      if (DEV_MODE) {
        console.log('[DEV MODE] Simulating status sync with backend');
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('collector_sessions')
        .select('status, last_status_change, is_active')
        .eq('collector_id', userData.user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Error syncing status:', error);
        return;
      }

      if (data && data.status) {
        this.currentStatus = data.status;
        localStorage.setItem('collector_status', data.status);
      }
    } catch (error) {
      console.error('❌ Error syncing with backend:', error);
    }
  }

  /**
   * Save session data to backend
   */
  async saveSessionToBackend(startTime, endTime, duration) {
    try {
      if (DEV_MODE) {
        console.log('[DEV MODE] Simulating session save:', {
          startTime,
          endTime,
          duration,
          stats: this.sessionStats
        });
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from('collector_status_history')
        .insert({
          collector_id: userData.user.id,
          status: COLLECTOR_STATUS.ONLINE,
          session_start: startTime.toISOString(),
          session_end: endTime.toISOString(),
          session_duration: Math.round(duration / 1000), // in seconds
          requests_accepted: this.sessionStats.requestsAccepted,
          requests_completed: this.sessionStats.requestsCompleted,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Error saving session:', error);
      }
    } catch (error) {
      console.error('❌ Error in session save:', error);
    }
  }

  /**
   * Add status change listener
   */
  addStatusListener(callback) {
    this.statusListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.statusListeners = this.statusListeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Notify all status listeners
   */
  notifyStatusListeners(newStatus, previousStatus) {
    this.statusListeners.forEach(callback => {
      try {
        callback({
          status: newStatus,
          previousStatus,
          config: STATUS_CONFIG[newStatus],
          timestamp: new Date()
        });
      } catch (error) {
        console.error('❌ Error in status listener:', error);
      }
    });
  }

  /**
   * Record request activity
   */
  recordRequestActivity(type) {
    if (type === 'accepted') {
      this.sessionStats.requestsAccepted++;
    } else if (type === 'completed') {
      this.sessionStats.requestsCompleted++;
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const currentOnlineTime = this.sessionStart 
      ? new Date() - this.sessionStart 
      : 0;

    return {
      ...this.sessionStats,
      currentOnlineTime,
      isOnline: this.currentStatus === COLLECTOR_STATUS.ONLINE
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.currentStatus === COLLECTOR_STATUS.ONLINE) {
      this.endOnlineSession();
    }
    this.statusListeners = [];
  }
}

// Create singleton instance
export const statusService = new CollectorStatusService();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    statusService.cleanup();
  });
}

export default statusService;
