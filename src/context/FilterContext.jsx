import { createContext, useState, useContext, useEffect, useCallback } from 'react';

const FilterContext = createContext();

export const FilterProvider = ({ children }) => {
  // Default filter values
  const [filters, setFilters] = useState(() => {
    // Force update radius to 15km minimum
    try {
      const savedFilters = localStorage.getItem('collectorFilters');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        // Force searchRadius to be at least 15km
        const updatedRadius = Math.max(parsed.searchRadius || 15, 15);
        const updatedFilters = {
          searchRadius: updatedRadius, // Force minimum 15km
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
      searchRadius: 15, // in km
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
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
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
      updateFilteredRequests 
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
