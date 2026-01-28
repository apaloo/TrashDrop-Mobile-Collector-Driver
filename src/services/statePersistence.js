/**
 * State Persistence Service
 * Handles saving and restoring app state to prevent PWA reset on idle/crash
 * Uses localforage for better performance than localStorage
 */

import localforage from 'localforage';
import { logger } from '../utils/logger';

// Configure localforage store
localforage.config({
  name: 'TrashDropCarter',
  storeName: 'app_state',
  description: 'TrashDrop Carter PWA state persistence'
});

class StatePersistenceService {
  constructor() {
    this.SAVE_DEBOUNCE_MS = 1000;
    this.saveTimeouts = {};
    this.STATE_VERSION = 1;
    this.MAX_STATE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
    this.initialized = false;
  }

  // Keys for different state types
  KEYS = {
    APP_STATE: 'app_state',
    NAVIGATION_STATE: 'navigation_state',
    ACTIVE_TASK: 'active_task',
    FORM_STATE: 'form_state',
    UI_STATE: 'ui_state'
  };

  /**
   * Initialize the persistence service
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Test localforage is working
      await localforage.ready();
      this.initialized = true;
      logger.debug('✅ State persistence service initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize state persistence:', error);
      // Fall back to memory-only operation
      this.initialized = true;
    }
  }

  /**
   * Save state with optional debouncing
   * @param {string} key - Storage key
   * @param {any} state - State to save
   * @param {boolean} immediate - Skip debouncing for critical saves
   */
  async saveState(key, state, immediate = false) {
    const saveOperation = async () => {
      try {
        const wrappedState = {
          version: this.STATE_VERSION,
          timestamp: Date.now(),
          data: state
        };
        await localforage.setItem(key, wrappedState);
        logger.debug(`💾 State saved: ${key}`);
      } catch (error) {
        logger.error(`Failed to save state ${key}:`, error);
        // Fallback to localStorage for critical state
        try {
          localStorage.setItem(`fallback_${key}`, JSON.stringify(state));
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    };

    if (immediate) {
      await saveOperation();
    } else {
      // Debounce saves to avoid excessive writes
      if (this.saveTimeouts[key]) {
        clearTimeout(this.saveTimeouts[key]);
      }
      this.saveTimeouts[key] = setTimeout(saveOperation, this.SAVE_DEBOUNCE_MS);
    }
  }

  /**
   * Load state with validation
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if state not found
   * @returns {Promise<any>} - Loaded state or default value
   */
  async loadState(key, defaultValue = null) {
    try {
      const wrappedState = await localforage.getItem(key);
      
      if (!wrappedState) {
        // Try localStorage fallback
        const fallback = localStorage.getItem(`fallback_${key}`);
        if (fallback) {
          try {
            return JSON.parse(fallback);
          } catch (e) {
            return defaultValue;
          }
        }
        return defaultValue;
      }

      // Check version compatibility
      if (wrappedState.version !== this.STATE_VERSION) {
        logger.warn(`State version mismatch for ${key}, using default`);
        return defaultValue;
      }

      // Check if state is too old
      if (Date.now() - wrappedState.timestamp > this.MAX_STATE_AGE_MS) {
        logger.warn(`State expired for ${key}, using default`);
        await this.clearState(key);
        return defaultValue;
      }

      return wrappedState.data;
    } catch (error) {
      logger.error(`Failed to load state ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Clear specific state
   * @param {string} key - Storage key to clear
   */
  async clearState(key) {
    try {
      await localforage.removeItem(key);
      localStorage.removeItem(`fallback_${key}`);
      logger.debug(`🗑️ State cleared: ${key}`);
    } catch (error) {
      logger.error(`Failed to clear state ${key}:`, error);
    }
  }

  /**
   * Clear all persisted state
   */
  async clearAllState() {
    try {
      await localforage.clear();
      // Clear fallback keys
      Object.values(this.KEYS).forEach(key => {
        localStorage.removeItem(`fallback_${key}`);
      });
      logger.info('🗑️ All persisted state cleared');
    } catch (error) {
      logger.error('Failed to clear all state:', error);
    }
  }

  /**
   * Save critical state immediately (for crash/background recovery)
   * @param {any} state - State to save
   */
  async saveEmergencyState(state) {
    await this.saveState(this.KEYS.APP_STATE, state, true);
  }

  /**
   * Check if state exists for a key
   * @param {string} key - Storage key
   * @returns {Promise<boolean>}
   */
  async hasState(key) {
    try {
      const state = await localforage.getItem(key);
      return state !== null;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const statePersistence = new StatePersistenceService();
