/**
 * Cache utilities for offline support
 */

// Cache keys
export const CACHE_KEYS = {
  PICKUP_REQUESTS: 'trashdrop_pickup_requests',
  USER_LOCATION: 'trashdrop_user_location',
  LAST_UPDATED: 'trashdrop_last_updated',
  ALL_REQUESTS: 'trashdrop_all_requests',
  REQUEST_SCANNED_BAGS: 'trashdrop_request_scanned_bags',
};

/**
 * Validate request IDs to filter out temporary IDs
 * @param {Object|Array} data - Data to validate
 * @returns {Object|Array} - Validated data with temp IDs filtered out
 */
export const validateCacheData = (data) => {
  if (!data) return data;
  
  // Handle arrays of requests
  if (Array.isArray(data)) {
    return data.filter(item => !item?.id?.startsWith('temp-'));
  }
  
  // Handle request collections (available, accepted, picked_up)
  if (typeof data === 'object' && data !== null) {
    // Handle the structure used in ALL_REQUESTS cache
    if (data.available || data.accepted || data.picked_up) {
      return {
        available: Array.isArray(data.available) ? data.available.filter(item => !item?.id?.startsWith('temp-')) : [],
        accepted: Array.isArray(data.accepted) ? data.accepted.filter(item => !item?.id?.startsWith('temp-')) : [],
        picked_up: Array.isArray(data.picked_up) ? data.picked_up.filter(item => !item?.id?.startsWith('temp-')) : []
      };
    }
  }
  
  return data;
};

/**
 * Save data to local storage cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} expiry - Expiration time in milliseconds (default: 1 hour)
 */
export const saveToCache = (key, data, expiry = 3600000) => {
  try {
    // Validate data to remove temp IDs for request-related caches
    let sanitizedData = data;
    
    if (key === CACHE_KEYS.PICKUP_REQUESTS || key === CACHE_KEYS.ALL_REQUESTS || 
        key.startsWith(CACHE_KEYS.REQUEST_SCANNED_BAGS)) {
      sanitizedData = validateCacheData(data);
      
      if (JSON.stringify(sanitizedData) !== JSON.stringify(data)) {
        console.log(' Cleaned cache data by removing temp IDs before saving:', key);
      }
    }
    
    const cacheItem = {
      data: sanitizedData,
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
    
    // Additional validation for request-related caches
    if (key === CACHE_KEYS.PICKUP_REQUESTS || key === CACHE_KEYS.ALL_REQUESTS || 
        key.startsWith(CACHE_KEYS.REQUEST_SCANNED_BAGS)) {
      const sanitizedData = validateCacheData(data);
      
      // If temp IDs were found and removed, update the cache with clean data
      if (JSON.stringify(sanitizedData) !== JSON.stringify(data)) {
        console.log(' Cleaned cache data by removing temp IDs on retrieval:', key);
        saveToCache(key, sanitizedData, expiry - Date.now()); // Preserve original expiry time
        return sanitizedData;
      }
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
 * @returns {Function} - Function to remove listeners
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
