/**
 * Simple Route Caching Utility
 * Caches Google Maps route calculations in sessionStorage for better performance
 */

import { logger } from './logger';

const CACHE_PREFIX = 'route_cache_';
const MAX_CACHE_SIZE = 50; // Maximum number of cached routes

/**
 * Generate cache key from coordinates
 */
const generateCacheKey = (start, end) => {
  const startStr = Array.isArray(start) ? start.join(',') : `${start.lat},${start.lng}`;
  const endStr = Array.isArray(end) ? end.join(',') : `${end.lat},${end.lng}`;
  return `${CACHE_PREFIX}${startStr}_to_${endStr}`;
};

/**
 * Get cached route
 */
export const getCachedRoute = (start, end) => {
  try {
    const key = generateCacheKey(start, end);
    const cached = sessionStorage.getItem(key);
    
    if (cached) {
      const data = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is still fresh (24 hours)
      if (now - data.timestamp < 24 * 60 * 60 * 1000) {
        logger.debug('⚡ Using cached route');
        return data.route;
      } else {
        // Remove expired cache
        sessionStorage.removeItem(key);
      }
    }
  } catch (error) {
    logger.warn('Failed to retrieve cached route:', error);
  }
  
  return null;
};

/**
 * Cache route data
 */
export const setCachedRoute = (start, end, route) => {
  try {
    const key = generateCacheKey(start, end);
    const data = {
      route,
      timestamp: Date.now()
    };
    
    // Check cache size and clean up if needed
    cleanupCache();
    
    sessionStorage.setItem(key, JSON.stringify(data));
    logger.debug('💾 Route cached for future use');
    
    return true;
  } catch (error) {
    logger.warn('Failed to cache route:', error);
    
    // If storage is full, try to make space
    if (error.name === 'QuotaExceededError') {
      clearOldRoutes();
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (retryError) {
        logger.warn('Failed to cache route after cleanup:', retryError);
      }
    }
    
    return false;
  }
};

/**
 * Clean up old cached routes if we have too many
 */
const cleanupCache = () => {
  try {
    const keys = Object.keys(sessionStorage)
      .filter(key => key.startsWith(CACHE_PREFIX));
    
    if (keys.length >= MAX_CACHE_SIZE) {
      // Get cache with timestamps
      const cacheItems = keys.map(key => {
        try {
          const data = JSON.parse(sessionStorage.getItem(key));
          return { key, timestamp: data.timestamp || 0 };
        } catch (e) {
          return { key, timestamp: 0 };
        }
      });
      
      // Sort by timestamp (oldest first)
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);
      
      // Remove oldest 25% of cached routes
      const toRemove = Math.floor(cacheItems.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        sessionStorage.removeItem(cacheItems[i].key);
      }
      
      logger.debug(`🧹 Cleaned up ${toRemove} old cached routes`);
    }
  } catch (error) {
    logger.warn('Failed to cleanup cache:', error);
  }
};

/**
 * Clear all old routes (emergency cleanup)
 */
const clearOldRoutes = () => {
  try {
    const keys = Object.keys(sessionStorage)
      .filter(key => key.startsWith(CACHE_PREFIX));
    
    // Clear half the cache
    const toRemove = Math.ceil(keys.length / 2);
    for (let i = 0; i < toRemove; i++) {
      sessionStorage.removeItem(keys[i]);
    }
    
    logger.debug(`🧹 Emergency cleanup: removed ${toRemove} cached routes`);
  } catch (error) {
    logger.warn('Failed to clear old routes:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  try {
    const keys = Object.keys(sessionStorage)
      .filter(key => key.startsWith(CACHE_PREFIX));
    
    return {
      count: keys.length,
      maxSize: MAX_CACHE_SIZE,
      usage: `${Math.round((keys.length / MAX_CACHE_SIZE) * 100)}%`
    };
  } catch (error) {
    return { count: 0, maxSize: MAX_CACHE_SIZE, usage: '0%' };
  }
};

/**
 * Clear all cached routes
 */
export const clearAllRoutes = () => {
  try {
    const keys = Object.keys(sessionStorage)
      .filter(key => key.startsWith(CACHE_PREFIX));
    
    keys.forEach(key => sessionStorage.removeItem(key));
    logger.debug(`🧹 Cleared ${keys.length} cached routes`);
    
    return keys.length;
  } catch (error) {
    logger.warn('Failed to clear all routes:', error);
    return 0;
  }
};
