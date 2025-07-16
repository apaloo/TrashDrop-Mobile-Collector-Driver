/**
 * Cache utilities for offline support
 */

// Cache keys
export const CACHE_KEYS = {
  PICKUP_REQUESTS: 'trashdrop_pickup_requests',
  USER_LOCATION: 'trashdrop_user_location',
  LAST_UPDATED: 'trashdrop_last_updated',
};

/**
 * Save data to local storage cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} expiry - Expiration time in milliseconds (default: 1 hour)
 */
export const saveToCache = (key, data, expiry = 3600000) => {
  try {
    const cacheItem = {
      data,
      expiry: Date.now() + expiry,
    };
    localStorage.setItem(key, JSON.stringify(cacheItem));
    return true;
  } catch (error) {
    console.error('Error saving to cache:', error);
    return false;
  }
};

/**
 * Get data from local storage cache
 * @param {string} key - Cache key
 * @returns {any|null} - Cached data or null if expired/not found
 */
export const getFromCache = (key) => {
  try {
    const cacheItem = localStorage.getItem(key);
    if (!cacheItem) return null;
    
    const { data, expiry } = JSON.parse(cacheItem);
    
    // Return null if cache is expired
    if (Date.now() > expiry) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error retrieving from cache:', error);
    return null;
  }
};

/**
 * Clear specific cache item
 * @param {string} key - Cache key to clear
 */
export const clearCache = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
};

/**
 * Check if the device is currently online
 * @returns {boolean}
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Register online/offline event listeners
 * @param {Function} onOnline - Callback when device comes online
 * @param {Function} onOffline - Callback when device goes offline
 * @returns {Function} - Function to remove event listeners
 */
export const registerConnectivityListeners = (onOnline, onOffline) => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  
  // Return function to remove listeners
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};
