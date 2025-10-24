import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';
// Simple online check since cacheUtils was removed
const isOnline = () => navigator.onLine;

/**
 * Enhanced offline support hook with intelligent caching and sync management
 */
export const useOfflineSupport = (options = {}) => {
  const {
    locationCacheDuration = 300000, // 5 minutes
    locationWatchOptions = { 
      enableHighAccuracy: true, 
      timeout: 10000, 
      maximumAge: 30000 
    },
    enableLocationCaching = true,
    enableActionQueuing = true
  } = options;
  
  const [isOffline, setIsOffline] = useState(!isOnline());
  const [lastKnownLocation, setLastKnownLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [syncInProgress, setSyncInProgress] = useState(false);
  
  const watchId = useRef(null);
  const syncQueue = useRef([]);
  const locationCache = useRef(null);

  // Enhanced connectivity detection
  const checkConnectivity = useCallback(async () => {
    try {
      // Try to fetch a small resource to verify actual connectivity
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // Handle online/offline status changes
  useEffect(() => {
    const handleOnline = async () => {
      // Verify actual connectivity, not just browser status
      const actuallyOnline = await checkConnectivity();
      setIsOffline(!actuallyOnline);
      
      if (actuallyOnline) {
        setLastSyncTime(new Date());
        // Trigger sync of pending actions
        if (pendingActions.length > 0) {
          processPendingActions();
        }
      }
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };

    // Initial connectivity check
    checkConnectivity().then(online => setIsOffline(!online));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic connectivity check when online
    const connectivityInterval = setInterval(async () => {
      if (navigator.onLine) {
        const actuallyOnline = await checkConnectivity();
        if (!actuallyOnline && !isOffline) {
          setIsOffline(true);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(connectivityInterval);
    };
  }, [checkConnectivity, isOffline, pendingActions]);

  // Enhanced location caching with multiple fallback strategies
  useEffect(() => {
    if (!enableLocationCaching || !navigator.geolocation) {
      setLocationError(new Error('Geolocation is not supported by this browser'));
      return;
    }
    
    // Load cached location immediately if available
    const loadCachedLocation = () => {
      try {
        const cachedLocationJSON = localStorage.getItem('lastKnownLocation');
        if (cachedLocationJSON) {
          const cachedLocation = JSON.parse(cachedLocationJSON);
          const age = Date.now() - cachedLocation.timestamp;
          
          if (age < locationCacheDuration) {
            setLastKnownLocation(cachedLocation.coords);
            locationCache.current = cachedLocation;
            logger.debug(`📍 Using cached location (${Math.round(age / 1000)}s old)`);
          }
        }
      } catch (err) {
        logger.error('Error loading cached location:', err);
        localStorage.removeItem('lastKnownLocation');
      }
    };
    
    // Load cached location immediately
    loadCachedLocation();
    
    // Start location watching
    const startLocationWatch = () => {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = [
            position.coords.latitude,
            position.coords.longitude
          ];
          
          setLastKnownLocation(newLocation);
          setLocationError(null);
          
          const locationData = {
            coords: newLocation,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading
          };
          
          locationCache.current = locationData;
          
          // Cache to localStorage with enhanced data
          try {
            localStorage.setItem('lastKnownLocation', JSON.stringify(locationData));
            logger.debug(`📍 Location updated (accuracy: ${Math.round(position.coords.accuracy)}m)`);
          } catch (err) {
            logger.error('Error caching location:', err);
          }
        },
        (err) => {
          setLocationError(err);
          logger.warn('Location error:', err.message);
          
          // Use cached location as fallback
          if (locationCache.current) {
            const age = Date.now() - locationCache.current.timestamp;
            if (age < locationCacheDuration * 2) { // Allow older cache when GPS fails
              logger.debug('📍 Using cached location due to GPS error');
              setLastKnownLocation(locationCache.current.coords);
            }
          }
        },
        locationWatchOptions
      );
    };
    
    // Start watching after a short delay to allow cached location to load first
    setTimeout(startLocationWatch, 100);

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [locationCacheDuration, locationWatchOptions, enableLocationCaching]);

  // Enhanced action queuing with deduplication and prioritization
  const addPendingAction = useCallback((action) => {
    if (!enableActionQueuing) return;

    const actionWithMetadata = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      priority: action.priority || 'normal' // high, normal, low
    };
    
    setPendingActions(prev => {
      // Deduplication: remove similar actions
      const filtered = prev.filter(existingAction => {
        // Don't duplicate the same type of action on the same resource
        if (existingAction.type === action.type && 
            existingAction.resourceId === action.resourceId) {
          return false;
        }
        return true;
      });
      
      const updated = [...filtered, actionWithMetadata];
      
      // Sort by priority and timestamp
      updated.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 2;
        const bPriority = priorityOrder[b.priority] || 2;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // High priority first
        }
        
        return a.timestamp - b.timestamp; // Older first within same priority
      });
      
      return updated;
    });
    
    // Save to localStorage
    try {
      localStorage.setItem('pendingOfflineActions', JSON.stringify(pendingActions));
      logger.debug(`📦 Queued offline action: ${action.type}`);
    } catch (err) {
      logger.error('Error saving pending actions:', err);
    }
  }, [pendingActions, enableActionQueuing]);

  // Process pending actions when back online
  const processPendingActions = useCallback(async () => {
    if (isOffline || pendingActions.length === 0 || syncInProgress) {
      return;
    }
    
    setSyncInProgress(true);
    logger.info(`🔄 Processing ${pendingActions.length} pending actions`);
    
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };
    
    // Process actions in batches to avoid overwhelming the server
    const BATCH_SIZE = 3;
    const batches = [];
    
    for (let i = 0; i < pendingActions.length; i += BATCH_SIZE) {
      batches.push(pendingActions.slice(i, i + BATCH_SIZE));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (action) => {
        try {
          // Simulate action processing - replace with actual API calls
          logger.debug(`Processing action: ${action.type} for ${action.resourceId}`);
          
          // Add delay to prevent overwhelming server
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Mock success - in real implementation, call appropriate API
          results.successful++;
          return { success: true, actionId: action.id };
          
        } catch (error) {
          logger.error(`Failed to process action ${action.id}:`, error);
          results.failed++;
          results.errors.push({ actionId: action.id, error: error.message });
          return { success: false, actionId: action.id, error };
        }
      });
      
      // Wait for current batch to complete before proceeding
      await Promise.allSettled(batchPromises);
    }
    
    // Clear successfully processed actions
    if (results.successful > 0) {
      setPendingActions([]);
      localStorage.removeItem('pendingOfflineActions');
    }
    
    setSyncInProgress(false);
    logger.info(`✅ Sync completed: ${results.successful} successful, ${results.failed} failed`);
    
    return results;
  }, [isOffline, pendingActions, syncInProgress]);

  // Force sync trigger
  const triggerSync = useCallback(async () => {
    if (!isOffline) {
      return await processPendingActions();
    }
    return null;
  }, [isOffline, processPendingActions]);

  // Get location with fallback strategies
  const getLocationWithFallback = useCallback(async (options = {}) => {
    const { allowCached = true, maxAge = locationCacheDuration } = options;
    
    try {
      // Try to get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          ...locationWatchOptions,
          timeout: 5000
        });
      });
      
      const coords = [position.coords.latitude, position.coords.longitude];
      return { coords, accuracy: position.coords.accuracy, fromCache: false };
      
    } catch (error) {
      logger.warn('Failed to get current location:', error.message);
      
      // Fallback to cached location if allowed
      if (allowCached && locationCache.current) {
        const age = Date.now() - locationCache.current.timestamp;
        if (age < maxAge) {
          logger.debug(`📍 Using cached location (${Math.round(age / 1000)}s old)`);
          return { 
            coords: locationCache.current.coords, 
            accuracy: locationCache.current.accuracy,
            fromCache: true,
            age
          };
        }
      }
      
      throw new Error('No location available');
    }
  }, [locationWatchOptions, locationCacheDuration]);

  // Load pending actions from localStorage on init
  useEffect(() => {
    try {
      const savedActions = localStorage.getItem('pendingOfflineActions');
      if (savedActions) {
        const actions = JSON.parse(savedActions);
        if (Array.isArray(actions) && actions.length > 0) {
          setPendingActions(actions);
          logger.debug(`📦 Loaded ${actions.length} pending actions from storage`);
        }
      }
    } catch (err) {
      logger.error('Error loading pending actions:', err);
      localStorage.removeItem('pendingOfflineActions');
    }
  }, []);

  return {
    // Status
    isOffline,
    lastKnownLocation,
    hasLocationCache: !!lastKnownLocation,
    locationError,
    lastSyncTime,
    
    // Actions
    pendingActions,
    pendingActionsCount: pendingActions.length,
    syncInProgress,
    
    // Functions
    addPendingAction,
    triggerSync,
    getLocationWithFallback,
    
    // Stats
    stats: {
      cacheAge: locationCache.current ? Date.now() - locationCache.current.timestamp : null,
      locationAccuracy: locationCache.current?.accuracy || null,
      pendingHighPriority: pendingActions.filter(a => a.priority === 'high').length
    }
  };
};

// Hook for offline-aware data fetching
export const useOfflineData = (key, fetchFunction, options = {}) => {
  const { 
    cacheDuration = 300000, // 5 minutes
    enableOfflineCache = true 
  } = options;
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  
  const { isOffline } = useOfflineSupport();
  
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Try cache first if offline or not forcing refresh
      if (enableOfflineCache && (isOffline || !forceRefresh)) {
        try {
          const cached = localStorage.getItem(`offline_cache_${key}`);
          if (cached) {
            const { data: cachedData, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            
            if (age < cacheDuration || isOffline) {
              setData(cachedData);
              setFromCache(true);
              setLoading(false);
              
              if (isOffline) {
                return cachedData;
              }
            }
          }
        } catch (cacheError) {
          logger.warn('Cache read error:', cacheError);
        }
      }
      
      // Fetch fresh data if online
      if (!isOffline) {
        const freshData = await fetchFunction();
        setData(freshData);
        setFromCache(false);
        
        // Cache the fresh data
        if (enableOfflineCache) {
          try {
            localStorage.setItem(`offline_cache_${key}`, JSON.stringify({
              data: freshData,
              timestamp: Date.now()
            }));
          } catch (cacheError) {
            logger.warn('Cache write error:', cacheError);
          }
        }
        
        return freshData;
      }
      
      // If we reach here, we're offline and have no cache
      throw new Error('No data available offline');
      
    } catch (err) {
      setError(err);
      logger.error(`Data fetch error for ${key}:`, err);
    } finally {
      setLoading(false);
    }
  }, [key, fetchFunction, isOffline, enableOfflineCache, cacheDuration]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return {
    data,
    loading,
    error,
    fromCache,
    refresh: () => fetchData(true),
    refetch: fetchData
  };
};
