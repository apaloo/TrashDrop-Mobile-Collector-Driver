/**
 * Navigation Persistence Hook
 * Handles saving and restoring navigation state for PWA crash/idle recovery
 */

import { useCallback } from 'react';
import { statePersistence } from '../services/statePersistence';
import { logger } from '../utils/logger';

export const useNavigationPersistence = () => {
  /**
   * Save navigation state for recovery
   * @param {Object} state - Navigation state to save
   */
  const saveNavigationState = useCallback(async (state) => {
    if (!state) return;
    
    try {
      const navState = {
        destination: state.destination,
        destinationName: state.destinationName || null,
        userLocation: state.userLocation || null,
        currentStepIndex: state.currentStepIndex || 0,
        isNavigating: state.isNavigating || false,
        requestId: state.requestId || null,
        wasteType: state.wasteType || null,
        sourceType: state.sourceType || null,
        timestamp: Date.now()
      };
      
      await statePersistence.saveState(
        statePersistence.KEYS.NAVIGATION_STATE,
        navState,
        true // immediate save for navigation
      );
      
      logger.debug('📍 Navigation state saved');
    } catch (error) {
      logger.error('Failed to save navigation state:', error);
    }
  }, []);

  /**
   * Restore navigation state after recovery
   * @returns {Promise<Object|null>} - Restored navigation state or null
   */
  const restoreNavigationState = useCallback(async () => {
    try {
      const state = await statePersistence.loadState(
        statePersistence.KEYS.NAVIGATION_STATE
      );
      
      if (state && state.isNavigating && state.destination) {
        // Check if state is recent (within 2 hours)
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        if (Date.now() - state.timestamp < TWO_HOURS_MS) {
          logger.info('🔄 Restoring navigation state...');
          return state;
        } else {
          logger.info('⏰ Navigation state expired, clearing...');
          await clearNavigationState();
        }
      }
      return null;
    } catch (error) {
      logger.error('Failed to restore navigation state:', error);
      return null;
    }
  }, []);

  /**
   * Clear saved navigation state
   */
  const clearNavigationState = useCallback(async () => {
    try {
      await statePersistence.clearState(statePersistence.KEYS.NAVIGATION_STATE);
      logger.debug('🗑️ Navigation state cleared');
    } catch (error) {
      logger.error('Failed to clear navigation state:', error);
    }
  }, []);

  /**
   * Check if there's a saved navigation state
   * @returns {Promise<boolean>}
   */
  const hasNavigationState = useCallback(async () => {
    try {
      return await statePersistence.hasState(statePersistence.KEYS.NAVIGATION_STATE);
    } catch (error) {
      return false;
    }
  }, []);

  return {
    saveNavigationState,
    restoreNavigationState,
    clearNavigationState,
    hasNavigationState
  };
};

export default useNavigationPersistence;
