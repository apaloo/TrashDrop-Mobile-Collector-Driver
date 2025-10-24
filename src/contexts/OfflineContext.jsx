import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  isOnline, 
  addToOfflineQueue, 
  removeFromOfflineQueue, 
  getOfflineQueue, 
  processOfflineQueue, 
  clearOfflineQueue,
  registerConnectivityListeners
} from '../utils/offlineUtils';
import { logger } from '../utils/logger';

// Create context
export const OfflineContext = createContext();

/**
 * Provider component for offline functionality
 */
export const OfflineProvider = ({ children }) => {
  const [online, setOnline] = useState(isOnline());
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  
  // Initialize offline queue and set up event listeners
  useEffect(() => {
    // Update queue state from storage
    setOfflineQueue(getOfflineQueue());
    
    // Handle online event
    const handleOnline = () => {
      setOnline(true);
      syncOfflineActions();
    };
    
    // Handle offline event
    const handleOffline = () => {
      setOnline(false);
    };
    
    // Register event listeners
    const cleanup = registerConnectivityListeners(handleOnline, handleOffline);
    
    // Clean up event listeners on unmount
    return cleanup;
  }, []);
  
  // Sync offline actions when back online
  const syncOfflineActions = async () => {
    if (!online || syncing || offlineQueue.length === 0) return;
    
    setSyncing(true);
    
    try {
      // Process each action in the queue
      await processOfflineQueue(async (actionType, payload) => {
        // Implement action processing based on action type
        switch (actionType) {
          case 'completePickup':
            // Call API to complete pickup
            logger.info('Processing offline pickup completion:', payload);
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { success: true };
            
          case 'disposeBag':
            // Call API to dispose bag
            logger.info('Processing offline bag disposal:', payload);
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { success: true };
            
          default:
            logger.warn('Unknown action type:', actionType);
            return { success: false };
        }
      });
      
      // Update queue state after processing
      setOfflineQueue(getOfflineQueue());
      
    } catch (error) {
      logger.error('Error syncing offline actions:', error);
    } finally {
      setSyncing(false);
    }
  };
  
  // Add an action to the offline queue
  const queueOfflineAction = (actionType, payload) => {
    const id = addToOfflineQueue(actionType, payload);
    setOfflineQueue(getOfflineQueue());
    return id;
  };
  
  // Remove an action from the offline queue
  const removeOfflineAction = (id) => {
    removeFromOfflineQueue(id);
    setOfflineQueue(getOfflineQueue());
  };
  
  // Clear the entire offline queue
  const clearQueue = () => {
    clearOfflineQueue();
    setOfflineQueue([]);
  };
  
  // Context value
  const value = {
    online,
    offlineQueue,
    syncing,
    queueOfflineAction,
    removeOfflineAction,
    clearQueue,
    syncOfflineActions
  };
  
  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

// Custom hook for using offline context
export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
