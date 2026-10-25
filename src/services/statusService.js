/**
 * TrashDrop Collector Status Management Service
 * Provides Uber-like online/offline functionality for drivers
 */

import { supabase } from './supabase';
import { logger } from '../utils/logger';

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
    label: 'On-Duty',
    description: 'Available for new requests'
  },
  [COLLECTOR_STATUS.OFFLINE]: {
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    label: 'Off-Duty',
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

// While On-Duty the app checks in this often (collector_profiles.last_active)
export const HEARTBEAT_INTERVAL_MS = 60 * 1000;
// Set once the collector picks a status; cleared when the app is opened again
const STATUS_CHOICE_KEY = 'collector_status_chosen';

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
    this.profileErrorLogged = false; // Prevent console spam for missing profile
    // Only collectors with a complete, active profile may go On-Duty.
    // AuthContext sets this once the profile has loaded.
    this.onlineEligible = false;
    // Bumped on every status change, so a slow backend sync can't undo one
    this.statusVersion = 0;
    this.defaultOnDutyPromise = null;
    this.heartbeatTimer = null;

    if (typeof window !== 'undefined') {
      // Back online: retry the default On-Duty, and check in straight away
      window.addEventListener('online', () => {
        this.goOnDutyByDefault();
        if (this.currentStatus === COLLECTOR_STATUS.ONLINE) this.sendHeartbeat();
      });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.currentStatus === COLLECTOR_STATUS.ONLINE) {
          this.sendHeartbeat();
        }
      });
    }
    
    // Initialize from localStorage
    this.initializeStatus();
  }

  /** Whether the collector picked a status themselves since the app opened */
  hasChosenStatus() {
    try {
      return sessionStorage.getItem(STATUS_CHOICE_KEY) === '1';
    } catch {
      return false;
    }
  }

  setChosenStatus(chosen) {
    try {
      if (chosen) sessionStorage.setItem(STATUS_CHOICE_KEY, '1');
      else sessionStorage.removeItem(STATUS_CHOICE_KEY);
    } catch {
      // Private mode without storage: the choice lasts until the next reload
    }
  }

  /**
   * The app opens On-Duty: once the profile is complete, go On-Duty unless the
   * collector already picked a status since the app opened. If the server
   * can't be reached, stay Off-Duty and try again when the connection returns.
   */
  goOnDutyByDefault() {
    if (!this.onlineEligible || this.hasChosenStatus() || this.defaultOnDutyPromise
      || this.currentStatus === COLLECTOR_STATUS.ONLINE) {
      return this.defaultOnDutyPromise || Promise.resolve();
    }
    this.defaultOnDutyPromise = this.setStatus(COLLECTOR_STATUS.ONLINE, { reason: 'app opened', byDefault: true })
      .catch((error) => {
        logger.warn('⚠️ Could not go On-Duty when the app opened:', error?.message);
      })
      .finally(() => {
        this.defaultOnDutyPromise = null;
      });
    return this.defaultOnDutyPromise;
  }

  /**
   * Initialize status from localStorage and sync with backend
   */
  async initializeStatus() {
    try {
      // Get saved status from localStorage
      const savedStatus = localStorage.getItem('collector_status');
      const savedSessionStart = localStorage.getItem('collector_session_start');
      
      if (savedStatus && Object.values(COLLECTOR_STATUS).includes(savedStatus) && this.onlineEligible && !this.statusVersion) {
        this.currentStatus = savedStatus;
      }
      
      if (savedSessionStart) {
        this.sessionStart = new Date(savedSessionStart);
      }

      // Sync with backend
      await this.syncStatusWithBackend();
      
      logger.debug(`✅ Status initialized: ${this.currentStatus}`);
    } catch (error) {
      logger.error('❌ Error initializing status:', error);
      this.currentStatus = COLLECTOR_STATUS.OFFLINE;
    }
  }

  /**
   * Change collector status
   */
  async setStatus(newStatus, options = {}) {
    const { reason = '', silent = false, byDefault = false } = options;
    
    if (!Object.values(COLLECTOR_STATUS).includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    if (newStatus !== COLLECTOR_STATUS.OFFLINE && !this.onlineEligible) {
      throw new Error('Finish your sign-up before going On-Duty.');
    }

    // Anything but the app's own default is the collector's choice, and stays
    // until the app is opened again
    if (!byDefault) this.setChosenStatus(true);

    // The database only lets On-Duty collectors accept requests, so record
    // the switch there first; never show On-Duty if the server didn't get it
    const serverDuty = await this.setServerDuty(newStatus === COLLECTOR_STATUS.ONLINE);
    if (!serverDuty.ok && newStatus === COLLECTOR_STATUS.ONLINE) {
      throw new Error('Could not go On-Duty. Check your connection and try again.');
    }

    // The collector picked a status while the default On-Duty was saving:
    // theirs wins, and the server must not stay On-Duty because of ours
    if (byDefault && this.hasChosenStatus()) {
      if (this.currentStatus !== COLLECTOR_STATUS.ONLINE) await this.setServerDuty(false);
      return { success: false, previousStatus: this.currentStatus, currentStatus: this.currentStatus, timestamp: new Date() };
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
      this.statusVersion += 1;
      if (newStatus === COLLECTOR_STATUS.ONLINE) this.startHeartbeat();
      else this.stopHeartbeat();

      // Persist to localStorage
      localStorage.setItem('collector_status', newStatus);
      
      // Sync with backend
      await this.updateBackendStatus(newStatus, reason, timestamp);
      
      // Notify listeners
      if (!silent) {
        this.notifyStatusListeners(newStatus, previousStatus);
      }

      logger.info(`📡 Status changed: ${previousStatus} → ${newStatus}${reason ? ` (${reason})` : ''}`);
      
      return {
        success: true,
        previousStatus,
        currentStatus: newStatus,
        timestamp
      };

    } catch (error) {
      logger.error('❌ Error setting status:', error);
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
   * Allow or forbid going On-Duty. Forbidding also drops a collector who is
   * currently On-Duty back to Off-Duty.
   */
  setOnlineEligibility(eligible) {
    this.onlineEligible = !!eligible;
    if (!this.onlineEligible && this.currentStatus !== COLLECTOR_STATUS.OFFLINE) {
      this.forceOffline();
    }
    if (this.onlineEligible && this.currentStatus !== COLLECTOR_STATUS.ONLINE) {
      if (this.hasChosenStatus()) {
        // The collector chose another status: make sure the server isn't left
        // On-Duty from an earlier session while this screen shows otherwise
        this.setServerDuty(false);
      } else {
        this.goOnDutyByDefault();
      }
    }
  }

  /**
   * Record On-/Off-Duty on the collector's profile (collector_profiles.on_duty).
   * Returns { ok }. A database without the on_duty column yet counts as ok, so
   * the app keeps working before the migration is applied.
   */
  async setServerDuty(onDuty) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return { ok: false };
      const { error } = await supabase
        .from('collector_profiles')
        .update({ on_duty: onDuty, on_duty_changed_at: new Date().toISOString() })
        .eq('user_id', userData.user.id);
      if (error) {
        if (/on_duty/.test(error.message || '')) return { ok: true };
        logger.warn('⚠️ Could not save duty status:', error.message);
        return { ok: false, error };
      }
      return { ok: true };
    } catch (error) {
      logger.warn('⚠️ Could not save duty status:', error?.message);
      return { ok: false, error };
    }
  }

  /**
   * Tell the server the app is open and reachable (collector_profiles.last_active).
   * The admin site only shows an On-Duty collector as online while these keep
   * coming; on_duty alone stays true when the phone goes offline.
   */
  async sendHeartbeat() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      const { error } = await supabase
        .from('collector_profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('user_id', userData.user.id);
      if (error) logger.warn('⚠️ Heartbeat failed:', error.message);
    } catch (error) {
      logger.warn('⚠️ Heartbeat failed:', error?.message);
    }
  }

  /** Check in now and every minute while On-Duty */
  startHeartbeat() {
    this.stopHeartbeat();
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Reset to Off-Duty without touching the backend. Used on login and logout so
   * one collector's On-Duty state never carries over to the next session; the
   * next session opens On-Duty again (see goOnDutyByDefault).
   */
  forceOffline() {
    const previousStatus = this.currentStatus;
    this.currentStatus = COLLECTOR_STATUS.OFFLINE;
    this.statusVersion += 1;
    this.stopHeartbeat();
    this.setChosenStatus(false);
    this.sessionStart = null;
    localStorage.removeItem('collector_status');
    localStorage.removeItem('collector_session_start');
    if (previousStatus !== COLLECTOR_STATUS.OFFLINE) {
      this.notifyStatusListeners(COLLECTOR_STATUS.OFFLINE, previousStatus);
    }
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

    logger.info('🟢 Online session started');
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
      
      logger.info(`🔴 Online session ended (Duration: ${Math.round(sessionDuration / 1000 / 60)} minutes)`);
    }
  }

  /**
   * Update backend status
   */
  async updateBackendStatus(status, reason, timestamp) {
    try {
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
        // Foreign key constraint error - collector_profiles record missing
        if (error.code === '23503' && error.message?.includes('collector_profiles')) {
          if (!this.profileErrorLogged) {
            logger.warn('⚠️ Collector profile not found. Status tracking will be available after completing signup.');
            this.profileErrorLogged = true;
          }
          // Don't throw - allow app to continue functioning
          return;
        }
        logger.error('❌ Error updating backend status:', error);
      }
    } catch (error) {
      logger.error('❌ Error in backend status update:', error);
    }
  }

  /**
   * Sync status with backend
   */
  async syncStatusWithBackend() {
    const version = this.statusVersion;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('collector_sessions')
        .select('status, last_status_change, is_active')
        .eq('collector_id', userData.user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('❌ Error syncing status:', error);
        return;
      }

      // Never undo a status set while this was loading
      if (version !== this.statusVersion) return;

      if (data && data.status && (this.onlineEligible || data.status === COLLECTOR_STATUS.OFFLINE)) {
        this.currentStatus = data.status;
        localStorage.setItem('collector_status', data.status);
        if (data.status === COLLECTOR_STATUS.ONLINE) this.startHeartbeat();
      }
    } catch (error) {
      logger.error('❌ Error syncing with backend:', error);
    }
  }

  /**
   * Save session data to backend
   */
  async saveSessionToBackend(startTime, endTime, duration) {
    try {
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
        logger.error('❌ Error saving session:', error);
      }
    } catch (error) {
      logger.error('❌ Error in session save:', error);
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
        logger.error('❌ Error in status listener:', error);
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
    this.stopHeartbeat();
    if (this.currentStatus === COLLECTOR_STATUS.ONLINE) {
      this.endOnlineSession();
    }
    this.statusListeners = [];
  }
}

// Lazy singleton instance - only created when first accessed
let _statusServiceInstance = null;

function getStatusService() {
  if (!_statusServiceInstance) {
    _statusServiceInstance = new CollectorStatusService();
    
    // Auto-cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        _statusServiceInstance?.cleanup();
      });
    }
  }
  return _statusServiceInstance;
}

// Use Proxy to delay initialization until first property access
export const statusService = new Proxy({}, {
  get(target, prop) {
    const instance = getStatusService();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  set(target, prop, value) {
    const instance = getStatusService();
    instance[prop] = value;
    return true;
  }
});

export default statusService;
