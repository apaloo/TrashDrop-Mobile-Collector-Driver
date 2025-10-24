import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

const FilterContext = createContext();

export const FilterProvider = ({ children }) => {
  // Temporary radius extension state
  const [tempRadiusExtension, setTempRadiusExtension] = useState(() => {
    const saved = localStorage.getItem('tempRadiusExtension');
    if (saved) {
      const data = JSON.parse(saved);
      // Check if still valid (not expired)
      if (data.expiresAt > Date.now()) {
        return data;
      } else {
        localStorage.removeItem('tempRadiusExtension');
      }
    }
    return null;
  });

  // Get current max radius (10km standard, 10km when extension is active)
  const getMaxRadius = () => {
    return tempRadiusExtension ? 10 : 10;
  };

  // Start 30-minute temporary radius extension
  const startTemporaryRadiusExtension = () => {
    const expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes from now
    const extension = {
      startedAt: Date.now(),
      expiresAt: expiresAt,
      originalMaxRadius: 10,
      newMaxRadius: 10
    };
    
    setTempRadiusExtension(extension);
    localStorage.setItem('tempRadiusExtension', JSON.stringify(extension));
    
    logger.info('🚀 TEMPORARY RADIUS EXTENSION ACTIVATED: 10km for 30 minutes');
    logger.info('⏰ Extension expires at:', new Date(expiresAt).toLocaleTimeString());
    
    // Set timer to auto-revert after 30 minutes
    setTimeout(() => {
      setTempRadiusExtension(null);
      localStorage.removeItem('tempRadiusExtension');
      logger.info('⏰ RADIUS EXTENSION EXPIRED: Reverted to standard 10km');
      
      // Also update current filters if they exceed the new limit
      setFilters(prev => ({
        ...prev,
        searchRadius: Math.min(prev.searchRadius, 10)
      }));
    }, 30 * 60 * 1000);
  };

  // Make extension function globally available for console access
  useEffect(() => {
    window.startRadiusExtension = startTemporaryRadiusExtension;
    window.getMaxRadius = getMaxRadius;
    window.getCurrentRadiusExtension = () => tempRadiusExtension;
    
    return () => {
      delete window.startRadiusExtension;
      delete window.getMaxRadius;
      delete window.getCurrentRadiusExtension;
    };
  }, [tempRadiusExtension]);

  // Auto-start the temporary extension as requested
  useEffect(() => {
    // Check if extension is not already active
    if (!tempRadiusExtension) {
      logger.debug('🎯 AUTO-STARTING temporary radius extension as requested...');
      startTemporaryRadiusExtension();
    }
  }, []); // Run only once on mount

  // Default filter values - IMMEDIATE startup, defer localStorage
  const [filters, setFilters] = useState(() => {
    // IMMEDIATE: Start with safe defaults to avoid blocking
    logger.debug('[Filters] ⚡ Starting with default filters immediately');
    return {
      searchRadius: 5, // in km - reasonable default for efficiency
      wasteTypes: ['All Types'],
      minPayment: 0,
      priority: 'all',
      activeFilter: 'all', // Default to 'all' types
    };
  });
  
  // Store filtered requests in context
  const [filteredRequests, setFilteredRequests] = useState({
    available: [],
    accepted: [],
    picked_up: []
  });

  // Load filters and filtered requests from localStorage - NON-BLOCKING approach
  useEffect(() => {
    // BACKGROUND: Load saved data without blocking startup
    const loadDataAsync = () => {
      // Use requestIdleCallback for non-blocking localStorage access
      const loadWhenIdle = () => {
        try {
          logger.debug('[Filters] 🔍 Loading saved data in background...');
          
          // Load filters
          const savedFilters = localStorage.getItem('collectorFilters');
          if (savedFilters) {
            const parsed = JSON.parse(savedFilters);
            // Get current max radius (accounting for any active extension)
            const maxRadius = getMaxRadius();
            
            // Cap searchRadius to current maximum and validate data
            const updatedFilters = {
              searchRadius: Math.min(Math.max(parsed.searchRadius || 5, 1), maxRadius),
              wasteTypes: Array.isArray(parsed.wasteTypes) && parsed.wasteTypes.length > 0 
                ? parsed.wasteTypes 
                : ['All Types'],
              minPayment: typeof parsed.minPayment === 'number' ? parsed.minPayment : 0,
              priority: parsed.priority || 'all',
              activeFilter: parsed.activeFilter || 'all',
            };
            
            logger.debug('[Filters] 📁 Loaded saved filters:', updatedFilters);
            setFilters(updatedFilters);
            
            // Update localStorage with validated data
            localStorage.setItem('collectorFilters', JSON.stringify(updatedFilters));
          } else {
            logger.debug('[Filters] 📄 No saved filters found, keeping defaults');
          }
          
          // Load filtered requests
          const savedRequests = localStorage.getItem('filteredRequests');
          if (savedRequests) {
            const parsed = JSON.parse(savedRequests);
            logger.debug('[Filters] 📁 Loaded saved requests');
            setFilteredRequests(parsed);
          } else {
            logger.debug('[Filters] 📄 No saved requests found, keeping defaults');
          }
        } catch (e) {
          logger.error('[Filters] ❌ Failed to load saved data:', e);
          // Keep using defaults if loading fails
        }
      };

      // Use requestIdleCallback if available, otherwise setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(loadWhenIdle, { timeout: 1000 });
      } else {
        setTimeout(loadWhenIdle, 100); // Small delay to not block initial render
      }
    };
    
    loadDataAsync();
  }, [tempRadiusExtension]); // Include tempRadiusExtension to get current max radius

  // Save filters to localStorage whenever they change - NON-BLOCKING
  useEffect(() => {
    // Use requestIdleCallback to defer localStorage writes
    const saveFilters = () => {
      try {
        localStorage.setItem('collectorFilters', JSON.stringify(filters));
        logger.debug('[Filters] 💾 Saved filters to localStorage');
      } catch (e) {
        logger.error('[Filters] ❌ Failed to save filters:', e);
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(saveFilters, { timeout: 500 });
    } else {
      setTimeout(saveFilters, 50); // Small delay to not block UI updates
    }
  }, [filters]);
  
  // Save filtered requests to localStorage whenever they change - NON-BLOCKING
  useEffect(() => {
    // Use requestIdleCallback to defer localStorage writes
    const saveRequests = () => {
      try {
        localStorage.setItem('filteredRequests', JSON.stringify(filteredRequests));
        logger.debug('[Filters] 💾 Saved requests to localStorage');
      } catch (e) {
        logger.error('[Filters] ❌ Failed to save requests:', e);
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(saveRequests, { timeout: 500 });
    } else {
      setTimeout(saveRequests, 50); // Small delay to not block UI updates
    }
  }, [filteredRequests]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      // Cap radius to current max (respecting temporary extension)
      if (updated.searchRadius) {
        updated.searchRadius = Math.min(updated.searchRadius, getMaxRadius());
      }
      return updated;
    });
  }, [tempRadiusExtension]);
  
  const updateFilteredRequests = useCallback((newRequests) => {
    setFilteredRequests(prev => ({
      ...prev,
      ...newRequests
    }));
  }, []);

  return (
    <FilterContext.Provider value={{ 
      filters, 
      updateFilters, 
      filteredRequests, 
      updateFilteredRequests,
      tempRadiusExtension,
      getMaxRadius,
      startTemporaryRadiusExtension
    }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};
