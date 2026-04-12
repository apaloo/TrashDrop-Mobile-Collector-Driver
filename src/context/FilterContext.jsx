import { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

const FilterContext = createContext();

const MAX_RADIUS = 10; // Maximum search radius in km

export const FilterProvider = ({ children }) => {
  const getMaxRadius = () => MAX_RADIUS;

  // Default filter values - IMMEDIATE startup, defer localStorage
  const [filters, setFilters] = useState(() => {
    logger.debug('[Filters] ⚡ Starting with default filters immediately');
    return {
      searchRadius: MAX_RADIUS, // Default to max radius
      wasteTypes: ['All Types'],
      minPayment: 0,
      priority: 'all',
      activeFilter: 'all',
    };
  });
  
  // Store filtered requests in context (derived data — NOT persisted to localStorage)
  // Initialize as null to distinguish "not yet filtered" from "filtered with 0 results"
  const [filteredRequests, setFilteredRequests] = useState({
    available: null,
    accepted: null,
    picked_up: null
  });

  // Load saved filter preferences from localStorage once on mount
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem('collectorFilters');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        const updatedFilters = {
          searchRadius: Math.min(Math.max(parsed.searchRadius || MAX_RADIUS, 1), MAX_RADIUS),
          wasteTypes: Array.isArray(parsed.wasteTypes) && parsed.wasteTypes.length > 0 
            ? parsed.wasteTypes 
            : ['All Types'],
          minPayment: typeof parsed.minPayment === 'number' ? parsed.minPayment : 0,
          priority: parsed.priority || 'all',
          activeFilter: parsed.activeFilter || 'all',
        };
        logger.debug('[Filters] 📁 Loaded saved filters:', updatedFilters);
        setFilters(updatedFilters);
      }
    } catch (e) {
      logger.error('[Filters] ❌ Failed to load saved data:', e);
    }
  }, []);

  // Debounced save of filter preferences to localStorage (2s debounce)
  const filterSaveTimerRef = useRef(null);
  useEffect(() => {
    if (filterSaveTimerRef.current) clearTimeout(filterSaveTimerRef.current);
    filterSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem('collectorFilters', JSON.stringify(filters));
        logger.debug('[Filters] 💾 Saved filters to localStorage');
      } catch (e) {
        logger.error('[Filters] ❌ Failed to save filters:', e);
      }
    }, 2000);
    return () => { if (filterSaveTimerRef.current) clearTimeout(filterSaveTimerRef.current); };
  }, [filters]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => {
      const updated = { ...prev, ...newFilters };
      if (updated.searchRadius) {
        updated.searchRadius = Math.min(updated.searchRadius, MAX_RADIUS);
      }
      return updated;
    });
  }, []);
  
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
      getMaxRadius
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
