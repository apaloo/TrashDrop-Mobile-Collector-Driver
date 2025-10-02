import { createContext, useState, useContext, useEffect, useCallback } from 'react';

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
    
    console.log('🚀 TEMPORARY RADIUS EXTENSION ACTIVATED: 10km for 30 minutes');
    console.log('⏰ Extension expires at:', new Date(expiresAt).toLocaleTimeString());
    
    // Set timer to auto-revert after 30 minutes
    setTimeout(() => {
      setTempRadiusExtension(null);
      localStorage.removeItem('tempRadiusExtension');
      console.log('⏰ RADIUS EXTENSION EXPIRED: Reverted to standard 10km');
      
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
      console.log('🎯 AUTO-STARTING temporary radius extension as requested...');
      startTemporaryRadiusExtension();
    }
  }, []); // Run only once on mount

  // Default filter values
  const [filters, setFilters] = useState(() => {
    // Get current max radius (accounting for any active extension)
    const maxRadius = getMaxRadius();
    
    try {
      const savedFilters = localStorage.getItem('collectorFilters');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        // Cap searchRadius to current maximum
        const updatedRadius = Math.min(Math.max(parsed.searchRadius || 5, 1), maxRadius);
        const updatedFilters = {
          searchRadius: updatedRadius,
          wasteTypes: Array.isArray(parsed.wasteTypes) && parsed.wasteTypes.length > 0 
            ? parsed.wasteTypes 
            : ['All Types'],
          minPayment: typeof parsed.minPayment === 'number' ? parsed.minPayment : 0,
          priority: parsed.priority || 'all',
          activeFilter: parsed.activeFilter || 'all', // Default to 'all' types
        };
        // Update localStorage with new radius
        localStorage.setItem('collectorFilters', JSON.stringify(updatedFilters));
        return updatedFilters;
      }
    } catch (e) {
      console.error('Error loading saved filters:', e);
    }
    
    // Default values if nothing in localStorage
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

  // Load filters and filtered requests from localStorage on initial load
  useEffect(() => {
    const loadData = () => {
      try {
        // Load filters
        const savedFilters = localStorage.getItem('collectorFilters');
        if (savedFilters) {
          setFilters(JSON.parse(savedFilters));
        }
        
        // Load filtered requests
        const savedRequests = localStorage.getItem('filteredRequests');
        if (savedRequests) {
          setFilteredRequests(JSON.parse(savedRequests));
        }
      } catch (e) {
        console.error('Failed to load saved data', e);
      }
    };
    
    loadData();
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('collectorFilters', JSON.stringify(filters));
  }, [filters]);
  
  // Save filtered requests to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('filteredRequests', JSON.stringify(filteredRequests));
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
