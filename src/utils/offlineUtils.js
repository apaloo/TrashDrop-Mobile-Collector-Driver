/**
 * Utility functions for offline support in the TrashDrop Mobile Collector Driver app
 */

// Check if the device is online
export const isOnline = () => {
  return navigator.onLine;
};

// Queue for storing actions to be performed when back online
let offlineQueue = [];

// Load queue from localStorage on initialization
try {
  const savedQueue = localStorage.getItem('offlineQueue');
  if (savedQueue) {
    offlineQueue = JSON.parse(savedQueue);
  }
} catch (error) {
  console.error('Error loading offline queue from localStorage:', error);
}

// Save queue to localStorage
const saveQueue = () => {
  try {
    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
  } catch (error) {
    console.error('Error saving offline queue to localStorage:', error);
  }
};

/**
 * Add an action to the offline queue
 * @param {string} actionType - Type of action (e.g., 'completePickup', 'disposeBag')
 * @param {object} payload - Data needed to perform the action when back online
 */
export const addToOfflineQueue = (actionType, payload) => {
  const queueItem = {
    id: Date.now().toString(),
    actionType,
    payload,
    timestamp: new Date().toISOString()
  };
  
  offlineQueue.push(queueItem);
  saveQueue();
  
  return queueItem.id;
};

/**
 * Remove an action from the offline queue
 * @param {string} id - ID of the action to remove
 */
export const removeFromOfflineQueue = (id) => {
  offlineQueue = offlineQueue.filter(item => item.id !== id);
  saveQueue();
};

/**
 * Get all items in the offline queue
 * @returns {Array} - Array of queue items
 */
export const getOfflineQueue = () => {
  return [...offlineQueue];
};

/**
 * Process the offline queue when back online
 * @param {Function} processAction - Function to process each action
 * @returns {Promise} - Promise that resolves when all actions are processed
 */
export const processOfflineQueue = async (processAction) => {
  if (offlineQueue.length === 0) {
    return Promise.resolve([]);
  }
  
  const results = [];
  const currentQueue = [...offlineQueue];
  
  for (const item of currentQueue) {
    try {
      const result = await processAction(item.actionType, item.payload);
      results.push({ id: item.id, success: true, result });
      removeFromOfflineQueue(item.id);
    } catch (error) {
      results.push({ id: item.id, success: false, error: error.message });
    }
  }
  
  return results;
};

/**
 * Clear the entire offline queue
 */
export const clearOfflineQueue = () => {
  offlineQueue = [];
  saveQueue();
};

/**
 * Register online/offline event listeners
 * @param {Function} onOnline - Callback when device goes online
 * @param {Function} onOffline - Callback when device goes offline
 */
export const registerConnectivityListeners = (onOnline, onOffline) => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};
