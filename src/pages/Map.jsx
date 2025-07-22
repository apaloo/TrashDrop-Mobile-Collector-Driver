import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useFilters } from '../context/FilterContext';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import Toast from '../components/Toast';
import StatusButton from '../components/StatusButton';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { AssignmentStatus, WasteType } from '../utils/types';
import { CACHE_KEYS, saveToCache, getFromCache, isOnline, registerConnectivityListeners } from '../utils/cacheUtils';
import { requestMarkerIcon } from '../utils/markerIcons';
import { statusService, COLLECTOR_STATUS } from '../services/statusService';

// Fix for default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Function to create a custom user location marker icon (tricycle)
const createUserLocationIcon = () => {
  return L.divIcon({
    html: `
    <div style="position: relative; width: 60px; height: 60px; filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.3));">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="60" height="36" style="transform: scale(1.5); transform-origin: center;">
        <!-- Shadow effect -->
        <ellipse cx="50" cy="55" rx="30" ry="5" fill="rgba(0,0,0,0.2)" filter="url(#shadow)"/>
        
        <!-- Glow effect -->
        <defs>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <filter id="shadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
            <feOffset in="blur" dx="0" dy="2" result="offsetBlur"/>
            <feComponentTransfer in="offsetBlur" result="shadow">
              <feFuncA type="linear" slope="0.2"/>
            </feComponentTransfer>
            <feComposite in="SourceGraphic" in2="shadow" operator="over"/>
          </filter>
        </defs>
        
        <!-- Main tricycle -->
        <g filter="url(#glow)">
          <!-- Cargo area with 3D effect -->
          <path d="M65,40 L90,40 Q95,40 95,35 L95,30 Q95,25 90,25 L65,25 Q60,25 60,30 L60,35 Q60,40 65,40 Z" 
                fill="#1d4ed8" stroke="#1e40af" stroke-width="1.5" stroke-linejoin="round"/>
          <!-- Side panel for 3D effect -->
          <path d="M90,40 L95,35 L95,30 L90,25 L90,40 Z" fill="#1e40af" stroke="#1e40af" stroke-width="1"/>
          
          <!-- Wheels with highlights -->
          <!-- Front wheel -->
          <circle cx="20" cy="45" r="12" fill="#1f2937" stroke="#111827" stroke-width="2.5"/>
          <circle cx="20" cy="45" r="10" fill="none" stroke="#4b5563" stroke-width="1" stroke-dasharray="1,3"/>
          
          <!-- Back wheel -->
          <circle cx="80" cy="45" r="10" fill="#1f2937" stroke="#111827" stroke-width="2.5"/>
          <circle cx="80" cy="45" r="8" fill="none" stroke="#4b5563" stroke-width="1" stroke-dasharray="1,3"/>
          
          <!-- Frame -->
          <path d="M30,25 L40,40 L60,40" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
          
          <!-- Handlebar -->
          <path d="M20,25 L20,35 Q20,20 30,25 L35,25" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
          
          <!-- Seat -->
          <rect x="40" y="25" width="10" height="5" rx="1" fill="#1f2937" stroke="#111827" stroke-width="1"/>
          
          <!-- Driver indicator with pulse effect -->
          <g style="animation: pulse 2s infinite;">
            <circle cx="45" cy="20" r="6" fill="#22c55e" stroke="#fff" stroke-width="1.5"/>
            <circle cx="45" cy="20" r="3" fill="#fff"/>
          </g>
        </g>
        
        <style>
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }
        </style>
      </svg>
    </div>`,
    className: 'user-location-marker z-[1000]',
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    popupAnchor: [0, -30]
  });
};

// Function to get color based on waste type
const getWasteTypeColor = (type) => {
  const colors = {
    'plastic': '#3b82f6', // blue-500
    'paper': '#eab308',   // yellow-500
    'metal': '#6b7280',   // gray-500
    'glass': '#93c5fd',   // blue-300
    'organic': '#22c55e', // green-500
    'general': '#ef4444', // red-500
    'recycling': '#86efac', // green-300
    'recyclable': '#2196F3', // blue
    'hazardous': '#F44336', // red
    'e-waste': '#9C27B0' // purple
  };
  return colors[type?.toLowerCase()] || '#6b7280'; // default to gray-500
};

// Function to create a custom marker icon based on waste type
const createWasteTypeIcon = (type) => {
  const color = getWasteTypeColor(type);
  return createCustomIcon(color);
};

// Custom marker icons
const createCustomIcon = (color) => {
  return L.divIcon({
    html: `<div class="w-4 h-4 rounded-full bg-${color} border-2 border-white flex items-center justify-center shadow-lg"></div>`,
    className: 'custom-marker-icon',
    iconSize: [20, 20],
  });
};

// Dustbin icon SVG (base64 encoded)
const dustbinIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H8v2h1v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9h1V7zm-10-2h4v2h-4V5zm7 20H11V9h10v14z" fill="#3b82f6"/>
      <path d="M13 11h2v12h-2zM17 11h2v12h-2z" fill="#fff"/>
    </svg>
  `)}`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Location update component with improved error handling and fallbacks
const LocationUpdater = ({ position, setPosition, shouldCenter, setShouldCenter, onLocationError }) => {
  const map = useMap();
  const watchId = useRef(null);
  const defaultPosition = [5.6037, -0.1870]; // Default to Accra, Ghana
  const positionRef = useRef(position || defaultPosition);
  const errorCount = useRef(0);
  const MAX_RETRIES = 3;
  const isMounted = useRef(true);
  const hasTriedGeolocation = useRef(false);

  // Update position ref when position changes
  useEffect(() => {
    if (position) {
      positionRef.current = position;
    }
  }, [position]);

  // Set default position if no position is set
  useEffect(() => {
    if (!position) {
      setPosition(defaultPosition);
      map.setView(defaultPosition, 13);
    }
  }, [map, position, setPosition]);

  // Handle successful geolocation
  const handleSuccess = useCallback((pos) => {
    if (!isMounted.current) return;
    
    errorCount.current = 0; // Reset error count on success
    const { latitude, longitude, accuracy } = pos.coords;
    
    console.log('Geolocation success:', { latitude, longitude, accuracy });
    
    // Accept positions with accuracy up to 2000m
    if (accuracy > 2000) {
      console.warn('Low accuracy position received, but using it as fallback', { accuracy });
    }

    const newPosition = [latitude, longitude];
    positionRef.current = newPosition;
    setPosition(newPosition);
    
    if (shouldCenter) {
      map.setView(newPosition, 15);
      setShouldCenter(false);
    }
  }, [map, setPosition, setShouldCenter, shouldCenter]);

  // Handle geolocation errors
  const handleError = useCallback((error) => {
    if (!isMounted.current) return;
    
    console.warn('Geolocation error:', {
      code: error.code,
      message: error.message,
      errorCount: errorCount.current
    });
    
    errorCount.current++;
    
    // Only trigger error callback on first error or if we've given up
    if (errorCount.current === 1 || errorCount.current >= MAX_RETRIES) {
      if (onLocationError) {
        onLocationError(error);
      }
    }
    
    // Fallback to default position if we keep getting errors
    if (errorCount.current >= MAX_RETRIES) {
      console.log('Falling back to default position after', MAX_RETRIES, 'errors');
      positionRef.current = defaultPosition;
      setPosition(defaultPosition);
      if (shouldCenter) {
        map.setView(defaultPosition, 13);
        setShouldCenter(false);
      }
    }
  }, [defaultPosition, map, onLocationError, setPosition, setShouldCenter, shouldCenter]);

  // Set up geolocation watcher
  useEffect(() => {
    isMounted.current = true;
    
    const initGeolocation = () => {
      // Prevent multiple geolocation attempts
      if (hasTriedGeolocation.current) {
        return;
      }
      
      hasTriedGeolocation.current = true;
      
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser');
        handleError({ code: 0, message: 'Geolocation is not supported' });
        return;
      }

      // Single attempt with reasonable timeout
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (error) => {
          console.warn('Geolocation failed, using default location:', error);
          handleError(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2 * 60 * 1000, // Accept 2-minute old position
          timeout: 8000 // 8 seconds timeout
        }
      );

      // Only set up watch position if we haven't exceeded retries
      if (errorCount.current < MAX_RETRIES) {
        watchId.current = navigator.geolocation.watchPosition(
          handleSuccess,
          (error) => {
            // Don't spam errors from watch position
            if (errorCount.current < MAX_RETRIES) {
              handleError(error);
            }
          },
          {
            enableHighAccuracy: false,
            maximumAge: 5 * 60 * 1000, // 5 minutes
            timeout: 8000, // 8 seconds
          }
        );
      }
    };

    // Initial setup with a small delay to avoid blocking the UI
    const timeoutId = setTimeout(initGeolocation, 100);

    // Cleanup function
    return () => {
      isMounted.current = false;
      clearTimeout(timeoutId);
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [handleSuccess, handleError]);

  // Handle map centering when position or shouldCenter changes
  useEffect(() => {
    if (position && shouldCenter) {
      map.setView(position, map.getZoom());
      setShouldCenter(false);
    }
  }, [position, shouldCenter, map, setShouldCenter]);

  return null;
};

// Recenter map button component
const RecenterButton = ({ onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="absolute z-10 bottom-28 right-4 bg-white p-2 rounded-full shadow-md"
      aria-label="Recenter map"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
      </svg>
    </button>
  );
};

// New Filter Card component that appears at the bottom of the map
const FilterCard = ({ filters = {}, updateFilters, applyFilters }) => {
  // Ensure filters has all required properties with defaults
  const safeFilters = {
    searchRadius: typeof filters.searchRadius === 'number' ? filters.searchRadius : 5,
    wasteTypes: Array.isArray(filters.wasteTypes) ? filters.wasteTypes : [],
    minPayment: typeof filters.minPayment === 'number' ? filters.minPayment : 0,
    priority: ['all', 'high', 'medium', 'low'].includes(filters.priority) ? filters.priority : 'all',
    activeFilter: filters.activeFilter || 'all' // Add activeFilter to safeFilters
  };
  
  // Handle filter changes
  const handleFilterChange = (updates) => {
    updateFilters(updates);
    applyFilters();
  };
  // Group waste types into categories
  const wasteTypeCategories = {
    all: 'All Types',
    recyclable: 'Recyclable',
    general: 'General',
    hazardous: 'Hazardous'
  };
  
  // Map waste types to categories
  const categoryMapping = {
    recyclable: [WasteType.PLASTIC, WasteType.PAPER, WasteType.GLASS, WasteType.METAL, WasteType.RECYCLING],
    general: [WasteType.GENERAL, WasteType.ORGANIC],
    hazardous: [] // Add hazardous waste types if available
  };
  
  // Handle category selection
  const handleCategorySelect = (category) => {
    let selectedTypes;
    
    if (category === 'all') {
      selectedTypes = Object.values(WasteType);
    } else {
      selectedTypes = categoryMapping[category] || [];
    }
    
    handleFilterChange({
      wasteTypes: selectedTypes,
      activeFilter: category
    });
  };
  
  return (
    <div className="absolute bottom-24 left-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[2000] pointer-events-auto overflow-hidden" style={{ position: 'fixed', touchAction: 'none' }}>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium" style={{ color: '#0a0a0a' }}>Radius: {safeFilters.searchRadius} km</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="10" 
          step="1"
          value={safeFilters.searchRadius} 
          onChange={(e) => {
            const newDistance = parseFloat(e.target.value) || 5;
            handleFilterChange({ searchRadius: newDistance });
          }} 
          className="w-full accent-green-500"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(wasteTypeCategories).map(([category, label]) => (
          <button
            key={category}
            onClick={() => handleCategorySelect(category)}
            className={`py-2 px-4 rounded-md text-center ${safeFilters.activeFilter === category ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Original Filter panel component (keep this for advanced filtering)
const FilterPanel = ({ isOpen, onClose, filters, updateFilters, applyFilters }) => {
  if (!isOpen) return null;
  
  // Ensure filters have default values
  const safeFilters = {
    maxDistance: typeof filters.maxDistance === 'number' ? filters.maxDistance : 5,
    wasteTypes: Array.isArray(filters.wasteTypes) ? [...filters.wasteTypes] : [],
    minPayment: typeof filters.minPayment === 'number' ? filters.minPayment : 0,
    priority: ['all', 'high', 'medium', 'low'].includes(filters.priority) ? filters.priority : 'all'
  };
  
  // Handle waste type toggle
  const toggleWasteType = (type) => {
    const newTypes = safeFilters.wasteTypes.includes(type)
      ? safeFilters.wasteTypes.filter(t => t !== type)
      : [...safeFilters.wasteTypes, type];
    updateFilters({ wasteTypes: newTypes });
  };
  
  return (
    <div className="absolute top-0 left-0 z-20 w-full h-full bg-white bg-opacity-95 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Filter Requests</h3>
        <button onClick={onClose} className="text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Distance filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Max Distance</label>
        <div className="flex items-center">
          <input 
            type="range" 
            min="1" 
            max="10" 
            step="0.5"
            value={safeFilters.maxDistance} 
            onChange={(e) => updateFilters({ maxDistance: parseFloat(e.target.value) })} 
            className="w-full"
          />
          <span className="ml-2 text-sm">{filters.maxDistance} km</span>
        </div>
      </div>
      
      {/* Waste type filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Waste Types</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(WasteType).map((type) => (
            <div key={type} className="flex items-center">
              <input 
                type="checkbox"
                id={`type-${type}`}
                checked={safeFilters.wasteTypes.includes(type)}
                onChange={() => toggleWasteType(type)}
                className="mr-2"
              />
              <label htmlFor={`type-${type}`} className="text-sm capitalize">{type}</label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Payment filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Min Payment (₵)</label>
        <input 
          type="number" 
          min="0"
          value={safeFilters.minPayment}
          onChange={(e) => updateFilters({ minPayment: parseInt(e.target.value || 0) })}
          className="w-full p-2 border rounded"
        />
      </div>
      
      {/* Priority filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
        <select 
          value={safeFilters.priority}
          onChange={(e) => updateFilters({ priority: e.target.value })}
          className="w-full p-2 border rounded"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      
      <button 
        onClick={() => {
          applyFilters();
          onClose();
        }}
        className="bg-primary text-white py-2 px-4 rounded w-full mt-auto"
      >
        Apply Filters
      </button>
    </div>
  );
};

const MapPage = () => {
  const { user } = useAuth();
  const { filters, updateFilters, updateFilteredRequests } = useFilters();
  const [map, setMap] = useState(null);
  const [position, setPosition] = useState([5.6037, -0.1870]); // Default to Accra, Ghana
  const [error, setError] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [locationAttempted, setLocationAttempted] = useState(false);
  const [allRequests, setAllRequests] = useState([]); // All fetched requests
  const [requests, setRequests] = useState([]); // Filtered requests for display
  const [isLoading, setIsLoading] = useState(true);
  const [shouldCenter, setShouldCenter] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isOnlineStatus, setIsOnlineStatus] = useState(isOnline());
  // Status management is now handled by StatusButton component and statusService
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  
  // Refs for error handling
  const lastErrorRef = useRef(null);
  const errorToastShownRef = useRef(false);
  const positionRef = useRef(position);
  
  // Update position ref when position changes
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  
  // Show toast notification
  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ show: true, message, type, duration });
  };
  
  // Hide toast notification
  const hideToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };
  
  // Handle online status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnlineStatus(true);
      showToast('You are back online!', 'success');
      // Refresh data when coming back online
      refreshData();
    };
    
    const handleOffline = () => {
      setIsOnlineStatus(false);
      showToast('You are offline. Using cached data.', 'offline', 5000);
    };
    
    // Register connectivity listeners
    const cleanup = registerConnectivityListeners(handleOnline, handleOffline);
    
    // Initial check
    setIsOnlineStatus(isOnline());
    
    return cleanup;
  }, []);

  // Use default location instead of attempting geolocation
  useEffect(() => {
    // Use the same coordinates we set in the state
    const defaultLocation = [5.672524779099469, -0.2808150610819718];
    
    // Initialize with default location immediately
    setPosition(defaultLocation);
    setLastUpdated(new Date());
    
    // Clear any previous error
    setError(null);
    
    // If there's a watchId from before, clean it up
    if (watchId) {
      try {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      } catch (e) {
        console.error('Error cleaning up watchId:', e);
      }
    }
    
    return () => {}; // No cleanup needed
  }, []); // Empty dependency array - run once

  // Recenter map handler
  const handleRecenter = () => {
    setShouldCenter(true);
  };

  // Calculate distance between two coordinates in km
  const calculateDistance = (start, end) => {
    if (!start || !end || start.length !== 2 || end.length !== 2) {
      return Infinity; // Return large number for invalid coordinates
    }
    
    // Haversine formula to calculate distance between two points on Earth
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    
    const dLat = toRad(end[0] - start[0]);
    const dLon = toRad(end[1] - start[1]);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(start[0])) * Math.cos(toRad(end[0])) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    // Return numeric distance in km for filtering
    return distance;
  };
  
  // Format distance for display
  const formatDistance = (distanceKm) => {
    if (typeof distanceKm !== 'number' || distanceKm === Infinity) {
      return 'Unknown';
    }
    
    if (distanceKm < 1) {
      // Show in meters if less than 1km
      return `${Math.round(distanceKm * 1000)}m`;
    }
    
    return `${distanceKm.toFixed(1)}km`;
  };
  
  // Fetch requests from Supabase
  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if we're online
      const online = await isOnline();
      setIsOnlineStatus(online);
      
      if (online) {
        console.log('Fetching pickup requests from Supabase...');
        
        // Log Supabase configuration
        console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
        
        // Fetch available pickup requests
        const { data, error, count } = await supabase
          .from('pickup_requests')
          .select('*', { count: 'exact' })
          .eq('status', 'available')
          .order('created_at', { ascending: false });
        
        console.log('Supabase query results:', { data, error, count });
        
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
        
        // Transform the data to match our expected format
        const transformedData = data
          .map(item => {
            try {
              if (!item) return null;
              
              const coords = parseCoordinates(item.coordinates);
              
              // Skip items with invalid coordinates
              if (!Array.isArray(coords) || coords.length !== 2 || 
                  typeof coords[0] !== 'number' || typeof coords[1] !== 'number' ||
                  isNaN(coords[0]) || isNaN(coords[1])) {
                console.warn('Skipping item with invalid coordinates:', item.id, item.coordinates);
                return null;
              }
              
              return {
                id: item.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
                type: item.waste_type || 'general',
                coordinates: coords,
                location: item.location || 'Unknown location',
                fee: Number(item.fee) || 0,
                status: item.status || 'available',
                priority: item.priority || 'medium',
                bag_count: Number(item.bag_count) || 1,
                special_instructions: item.special_instructions || '',
                created_at: item.created_at || new Date().toISOString(),
                updated_at: item.updated_at || new Date().toISOString(),
                distance: formatDistance(calculateDistance(
                  [position[0], position[1]],
                  coords
                )),
                distanceValue: calculateDistance(
                  [position[0], position[1]],
                  coords
                ),
                estimated_time: item.estimated_time || 'Unknown',
              };
            } catch (error) {
              console.error('Error processing request:', item?.id, error);
              return null;
            }
          })
          .filter(Boolean); // Remove any null entries
        
        // Update state and cache
        setAllRequests(transformedData);
        // Don't set requests here - let applyFilters handle the filtered data
        setLastUpdated(new Date());
        saveToCache(CACHE_KEYS.PICKUP_REQUESTS, transformedData);
        
        if (transformedData.length > 0) {
          showToast(`${transformedData.length} pickup requests found`, 'success');
        } else {
          showToast('No pickup requests found', 'info');
        }
        
        // Apply filters to populate the requests state with filtered data
        setTimeout(() => applyFilters(), 0);
      } else {
        // Try to load from cache if offline
        const cachedData = await getFromCache(CACHE_KEYS.PICKUP_REQUESTS);
        if (cachedData) {
          setAllRequests(cachedData);
          // Don't set requests here - let applyFilters handle the filtered data
          setLastUpdated(new Date());
          showToast('Showing cached data', 'info');
          
          // Apply filters to populate the requests state with filtered data
          setTimeout(() => applyFilters(), 0);
        } else {
          showToast('No cached data available', 'warning');
        }
      }
    } catch (error) {
      console.error('Error fetching pickup requests:', error);
      showToast('Failed to load pickup requests', 'error');
      
      // Try to load from cache on error
      const cachedData = await getFromCache(CACHE_KEYS.PICKUP_REQUESTS);
      if (cachedData) {
        setAllRequests(cachedData);
        // Don't set requests here - let applyFilters handle the filtered data
        showToast('Showing cached data', 'info');
        
        // Apply filters to populate the requests state with filtered data
        setTimeout(() => applyFilters(), 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [position]);

  // Refresh data
  const refreshData = useCallback(async () => {
    if (!isOnlineStatus) {
      showToast('Cannot refresh while offline', 'error');
      return;
    }
    
    setIsRefreshing(true);
    try {
      await fetchRequests();
      showToast('Data refreshed', 'success');
    } catch (error) {
      console.error('Error refreshing data:', error);
      showToast('Failed to refresh data', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [isOnlineStatus, fetchRequests]);

  // Auto refresh every 2 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshData();
    }, 120000); // 2 minutes

    return () => clearInterval(intervalId);
  }, []);

  // Helper function to extract number from distance string
  const getDistanceNumber = (distanceStr) => {
    if (!distanceStr) return 0;
    // Extract the first number from the string (e.g., "2.5 km away" -> 2.5)
    const match = distanceStr.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[0]) : 0;
  };

  // Apply filters to requests
  const applyFilters = useCallback(async () => {
    console.log('🔍 Applying filters...', { filters, allRequestsCount: allRequests.length, position });
    
    // Return empty if position is not available
    if (!position || !position[0] || !position[1]) {
      console.log('⚠️ Position not available, returning empty results');
      setRequests([]);
      updateFilteredRequests([]);
      return;
    }

    // Check collector status - only show requests if online (Uber-like behavior)
    const statusInfo = statusService.getStatus();
    if (!statusInfo.isOnline) {
      console.log('👤 Collector is offline - hiding all requests (Uber-style)');
      setRequests([]);
      updateFilteredRequests([]);
      return;
    }

    const safeFilters = filters || {};
    const activeFilter = safeFilters.activeFilter || 'all';
    const radiusKm = parseFloat(safeFilters.radius) || 1;
    
    console.log('🎯 Filter criteria:', { activeFilter, radiusKm, collectorStatus: statusInfo.status });
    console.log('DEBUG: Sample requests:', allRequests.slice(0, 2));
    
    const searchRadius = filters.searchRadius || filters.maxDistance || 10; // Use searchRadius with fallback to maxDistance
    
    const filteredRequests = allRequests.filter(req => {
      // Skip if request is invalid
      if (!req || !req.coordinates) {
        return false;
      }
      
      // Filter by status - only show available requests
      if (req.status !== 'available') {
        return false;
      }
      
      // Filter by distance
      if (position && position[0] && position[1]) {
        try {
          const distance = calculateDistance(
            [position[0], position[1]],
            req.coordinates
          );
          
          if (distance > searchRadius) {
            return false;
          }
          
          // Add distance to request for sorting
          req.distance = distance;
        } catch (error) {
          console.error('Error calculating distance:', error);
          return false;
        }
      }
      
      // Filter by waste type
      if (filters.wasteTypes?.length > 0 && !filters.wasteTypes.includes('All Types')) {
        if (!filters.wasteTypes.includes(req.type)) {
          return false;
        }
      }
      
      // Filter by minimum payment
      const minPayment = parseFloat(filters.minPayment) || 0;
      if (minPayment > 0 && (parseFloat(req.fee) || 0) < minPayment) {
        return false;
      }
      
      // Filter by priority
      if (filters.priority && filters.priority !== 'all' && req.priority !== filters.priority) {
        return false;
      }
      
      return true;
    });
    
    // Sort by distance if we have a position
    if (position && position[0] && position[1]) {
      filteredRequests.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    
    console.log('Filtered requests:', filteredRequests.length, 'out of', allRequests.length);
    setRequests(filteredRequests);
    
    // DEBUG: Log what we're sharing with Request page
    console.log('DEBUG: Sharing filtered requests with Request page:', {
      available: filteredRequests,
      count: filteredRequests.length,
      firstRequest: filteredRequests[0] || 'none'
    });
    
    // Update filtered requests in context
    updateFilteredRequests({ available: filteredRequests });
  }, [allRequests, filters, position, updateFilteredRequests]);

  // Effect to apply filters when filter criteria OR position changes
  useEffect(() => {
    applyFilters();
  }, [filters]);
  
  // Effect to reapply filters when position becomes available
  useEffect(() => {
    if (position && position[0] && position[1] && allRequests.length > 0) {
      console.log('DEBUG: Position loaded, reapplying filters');
      setTimeout(() => applyFilters(), 100); // Small delay to ensure state is updated
    }
  }, [position, allRequests]);
  
  // Helper function to parse PostGIS POINT string to [lat, lng] array
  const parseCoordinates = (pointString) => {
    // Return default position if no coordinates
    if (!pointString) {
      console.warn('No coordinates provided, using default position');
      return position;
    }
    
    // If it's already in the correct format [lat, lng]
    if (Array.isArray(pointString) && pointString.length === 2) {
      return pointString;
    }
    
    // Handle string format (WKT or JSON)
    if (typeof pointString === 'string') {
      // Check for WKT format (e.g., "POINT(lng lat)" or "SRID=4326;POINT(lng lat)")
      const wktMatch = pointString.match(/(?:SRID=\d+;)?POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (wktMatch) {
        const lng = parseFloat(wktMatch[1]);
        const lat = parseFloat(wktMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          return [lat, lng];
        }
      }
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(pointString);
        if (parsed && (parsed.lat !== undefined || parsed.latitude !== undefined)) {
          return [
            parsed.lat !== undefined ? parsed.lat : parsed.latitude,
            parsed.lng !== undefined ? parsed.lng : parsed.longitude
          ];
        }
      } catch (e) {
        // Not a JSON string, continue to other formats
      }
      
      // Try to parse as comma-separated string
      const coords = pointString.split(',').map(coord => parseFloat(coord.trim()));
      if (coords.length >= 2 && !coords.some(isNaN)) {
        return [coords[0], coords[1]];
      }
    }
    
    // Handle object format
    if (typeof pointString === 'object') {
      if (pointString.lat !== undefined && pointString.lng !== undefined) {
        return [pointString.lat, pointString.lng];
      }
      if (pointString.latitude !== undefined && pointString.longitude !== undefined) {
        return [pointString.latitude, pointString.longitude];
      }
      if (Array.isArray(pointString) && pointString.length >= 2) {
        return [pointString[0], pointString[1]];
      }
    }
    
    // Handle PostGIS binary format (0101000020E6100000...)
    if (typeof pointString === 'string' && pointString.startsWith('0101000020E6100000')) {
      try {
        // Extract the hex part after the SRID (first 8 bytes)
        const hex = pointString.substring(18);
        // Convert hex to bytes and then to double (little endian)
        const lngBytes = hex.substring(0, 16);
        const latBytes = hex.substring(16, 32);
        const lng = new DataView(new Uint8Array(lngBytes.match(/.{2}/g).map(b => parseInt(b, 16))).buffer).getFloat64(0, true);
        const lat = new DataView(new Uint8Array(latBytes.match(/.{2}/g).map(b => parseInt(b, 16))).buffer).getFloat64(0, true);
        if (!isNaN(lat) && !isNaN(lng)) {
          return [lat, lng];
        }
      } catch (e) {
        console.error('Error parsing PostGIS binary format:', e);
      }
    }
    
    console.warn('Using default position, could not parse coordinates:', pointString);
    return position; // Fallback to default position
  };



  // Set up Supabase real-time subscription for assignments
  useEffect(() => {
    if (!isOnlineStatus) return;
    
    let subscription;
    
    const setupRealtimeSubscription = async () => {
      try {
        // First fetch initial data
        await fetchRequests();
        
        // Then set up real-time subscription
        subscription = supabase
          .channel('pickup_requests_changes')
          .on('postgres_changes', {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'pickup_requests',
            filter: 'status=eq.available' // Only listen to available requests
          }, (payload) => {
            // Handle different event types
            const { eventType, new: newRecord, old: oldRecord } = payload;
            
            switch (eventType) {
              case 'INSERT': {
                if (newRecord.status === 'available') {
                  const coords = parseCoordinates(newRecord.coordinates);
                  // Transform the new record
                  const transformedRequest = {
                    id: newRecord.id,
                    type: newRecord.waste_type || 'general',
                    coordinates: coords,
                    location: newRecord.location || 'Unknown location',
                    fee: newRecord.fee || 0,
                    status: newRecord.status,
                    priority: newRecord.priority || 'medium',
                    bag_count: newRecord.bag_count || 1,
                    special_instructions: newRecord.special_instructions || '',
                    created_at: newRecord.created_at,
                    updated_at: newRecord.updated_at,
                    distance: formatDistance(calculateDistance(position, coords)),
                    estimated_time: newRecord.estimated_time || 'Unknown'
                  };
                  
                  // Add to the current requests
                  setAllRequests(prev => {
                    const updated = [...prev, transformedRequest];
                    // Update cache
                    saveToCache(CACHE_KEYS.PICKUP_REQUESTS, updated);
                    return updated;
                  });
                  
                  // Show notification for new request
                  showToast('New pickup request available!', 'success');
                }
                break;
              }
              
              case 'UPDATE': {
                if (oldRecord.status === 'available' && 
                    newRecord.status !== 'available') {
                  // Request was assigned or cancelled
                  setAllRequests(prev => {
                    const updated = prev.filter(r => r.id !== newRecord.id);
                    // Update cache
                    saveToCache(CACHE_KEYS.PICKUP_REQUESTS, updated);
                    return updated;
                  });
                  
                  // Only show toast if it was assigned to someone else (not by current user's action)
                  if (newRecord.collector_id !== user?.id) {
                    showToast('A pickup request was claimed by another collector', 'info');
                  }
                } else if (newRecord.status === 'available' && 
                          oldRecord.status !== 'available') {
                  // Request became available again
                  const coords = parseCoordinates(newRecord.coordinates);
                  const transformedRequest = {
                    id: newRecord.id,
                    type: newRecord.waste_type || 'general',
                    coordinates: coords,
                    location: newRecord.location || 'Unknown location',
                    fee: newRecord.fee || 0,
                    status: newRecord.status,
                    priority: newRecord.priority || 'medium',
                    bag_count: newRecord.bag_count || 1,
                    special_instructions: newRecord.special_instructions || '',
                    created_at: newRecord.created_at,
                    updated_at: newRecord.updated_at,
                    distance: formatDistance(calculateDistance(position, coords)),
                    estimated_time: newRecord.estimated_time || 'Unknown'
                  };
                  
                  setAllRequests(prev => {
                    const exists = prev.some(r => r.id === newRecord.id);
                    if (exists) return prev;
                    
                    const updated = [...prev, transformedRequest];
                    saveToCache(CACHE_KEYS.PICKUP_REQUESTS, updated);
                    return updated;
                  });
                }
                break;
              }
              
              case 'DELETE': {
                // Handle request deletion
                setAllRequests(prev => {
                  const updated = prev.filter(r => r.id !== oldRecord.id);
                  // Update cache
                  saveToCache(CACHE_KEYS.PICKUP_REQUESTS, updated);
                  return updated;
                });
                showToast('A pickup request was removed', 'info');
                break;
              }
            }
            
            // Apply filters after any changes
            applyFilters();
            
            // Update last updated timestamp
            setLastUpdated(new Date());
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscribed to pickup_requests table');
              showToast('Live updates enabled', 'success', 2000);
            }
          });
      } catch (error) {
        console.error('Error setting up real-time subscription:', error);
        // Fall back to interval-based updates
        const intervalId = setInterval(() => {
          refreshData();
        }, 120000); // 2 minutes
        
        return () => clearInterval(intervalId);
      }
    };
    
    setupRealtimeSubscription();
    
    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [isOnlineStatus, user?.id]);

  // Handle accepting an assignment
  const handleAcceptAssignment = async (requestId) => {
    if (!isOnlineStatus) {
      showToast('Cannot accept requests while offline', 'error');
      return;
    }
    
    try {
      // Find the request by ID
      const request = requests.find(r => r.id === requestId);
      if (!request) {
        showToast('Request not found', 'error');
        return;
      }
      
      // Show processing toast
      showToast('Processing your request...', 'info');
      
      // Update request in Supabase
      const { data, error } = await supabase
        .from('pickup_requests')
        .update({ 
          status: 'accepted',
          collector_id: user?.id,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select();
      
      if (error) throw error;
      
      // Remove the accepted request from the available requests
      setAllRequests(prev => {
        const updated = prev.filter(r => r.id !== requestId);
        saveToCache(CACHE_KEYS.PICKUP_REQUESTS, updated);
        return updated;
      });
      
      // Show success message
      showToast('Pickup request accepted!', 'success');
      
      // Refresh the data to ensure consistency
      await fetchAssignments();
    } catch (err) {
      console.error('Error accepting assignment:', err);
      showToast('Failed to accept request. Please try again.', 'error');
    }
  };

  // Get color for waste type
  // Using the getWasteTypeColor function defined at the top of the file

  // Get priority badge color
  const getPriorityBadgeColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  // Loading overlay component
  const LoadingOverlay = ({ show, message = 'Loading...' }) => {
    if (!show) return null;
    
    return (
      <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
        <div className="bg-white p-4 rounded-md shadow-lg flex items-center">
          <svg className="animate-spin h-5 w-5 text-primary mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{message}</span>
        </div>
      </div>
    );
  };
  
  
  // Auto refresh every 2 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshData();
    }, 120000); // 2 minutes
    
    return () => clearInterval(intervalId);
  }, []);
  
  // This is the end of the previous function and useEffect
  
  // The applyFilters function already exists above, so we're not redeclaring it here
  // We need to ensure that filters work properly when called
  
  
  // Effect to apply filters when filter criteria change
  useEffect(() => {
    applyFilters();
  }, [filters]);
  
  // Effect to handle online/offline status changes
  useEffect(() => {
    // Register connectivity listeners
    const cleanup = registerConnectivityListeners(
      // Online callback
      () => {
        setIsOnlineStatus(true);
        showToast('Back online', 'success');
        refreshData(); // Refresh data when coming back online
      },
      // Offline callback
      () => {
        setIsOnlineStatus(false);
        showToast('You are offline', 'offline', 0); // 0 duration means it stays until dismissed
      }
    );
    
    // Initial online status check
    setIsOnlineStatus(isOnline());
    
    return cleanup;
  }, []);
  
  // Waste type legend component
  const WasteLegend = () => {
    return null;
  };
  
  // Handle location errors with more context and recovery options
  const handleLocationError = useCallback((error) => {
    console.warn('Location warning:', error);
    
    // Don't show repeated errors to avoid spamming the user
    const now = Date.now();
    if (lastErrorRef.current && (now - lastErrorRef.current.timestamp < 30000)) {
      console.log('Suppressing duplicate location error');
      return;
    }
    
    let errorMessage = 'Using default location. ';
    let showRecovery = false;
    
    switch(error.code) {
      case 1: // PERMISSION_DENIED
        errorMessage += 'Location access was denied. Please enable location services in your browser settings.';
        showRecovery = true;
        break;
      case 2: // POSITION_UNAVAILABLE
        errorMessage += 'Location information is currently unavailable. Using default location.';
        break;
      case 3: // TIMEOUT
        errorMessage += 'Location request timed out. Using default location.';
        showRecovery = true;
        break;
      default:
        errorMessage += 'Using default location due to an unknown error.';
    }
    
    // Store this error to prevent duplicates
    lastErrorRef.current = {
      code: error.code,
      message: error.message,
      timestamp: now
    };
    
    // Only show toast if we haven't shown one recently for this error
    if (!errorToastShownRef.current) {
      errorToastShownRef.current = true;
      showToast(
        <div>
          <p className="font-medium">{errorMessage}</p>
          {showRecovery && (
            <button 
              onClick={() => {
                // Force a refresh of the page to retry geolocation
                window.location.reload();
              }}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Retry
            </button>
          )}
        </div>, 
        'warning',
        10000 // Show for 10 seconds
      );
      
      // Reset the error toast flag after some time
      setTimeout(() => {
        errorToastShownRef.current = false;
      }, 30000);
    }
  }, [showToast]);

  // Initial data fetch
  useEffect(() => {
    fetchRequests();
  }, []);

  // Using the getWasteTypeColor function defined at the top of the file

  // Return the component UI
  return (
    <div className="flex flex-col h-screen">
      <TopNavBar user={user || { first_name: 'Driver' }} />
      
      {/* Toast notification */}
      {toast.show && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          duration={toast.duration} 
          onClose={hideToast} 
        />
      )}
      
      
      <div className="flex-grow mt-14 mb-16 relative">
        {/* Always show the map, regardless of error state */}
        {isLoading && !requests.length ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Loading pickup requests...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Error notification removed as requested */}
            
            {/* Custom zoom controls - moved outside map container */}
            <div className="absolute bottom-24 right-4 z-[1000] flex flex-col space-y-2">
              <button onClick={() => map?.zoomIn()} className="bg-white w-8 h-8 flex items-center justify-center rounded-md shadow text-xl">
                +
              </button>
              <button onClick={() => map?.zoomOut()} className="bg-white w-8 h-8 flex items-center justify-center rounded-md shadow text-xl">
                -
              </button>
            </div>
            
            {/* Filter card - moved outside map container */}
            <FilterCard 
              filters={filters} 
              updateFilters={updateFilters} 
              applyFilters={applyFilters} 
            />
            
            {/* Waste type legend - moved outside map container */}
            <WasteLegend />
            
            {/* Request count display - shows filtered requests count */}
            <div className="absolute top-16 left-2 z-[2000] pointer-events-auto">
              <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-lg shadow-md">
                {(() => {
                  // Use the filtered requests from state instead of refiltering
                  if (!requests || !Array.isArray(requests)) {
                    console.log('No filtered requests available');
                    return '0';
                  }
                  
                  // Only show count if we have a valid position
                  if (!position || position[0] === undefined || position[1] === undefined) {
                    console.log('No valid position, showing ?');
                    return '?';
                  }
                  
                  // Log the current state for debugging
                  console.log('Request count display:', {
                    totalRequests: allRequests?.length || 0,
                    filteredRequests: requests.length,
                    position,
                    filters: {
                      searchRadius: filters.searchRadius,
                      maxDistance: filters.maxDistance,
                      wasteTypes: filters.wasteTypes,
                      minPayment: filters.minPayment,
                      priority: filters.priority
                    }
                  });
                  
                  return requests.length;
                })()}
              </div>
            </div>
            
            {/* Enhanced Online/Offline Status Button */}
            <div className="absolute top-2 right-0 flex justify-center z-[2000] pointer-events-auto" style={{ marginRight: '0.4rem' }}>
              <StatusButton 
                showSessionInfo={true}
                className="transition-all duration-300 hover:scale-105"
              />
            </div>
            
            <div className="relative h-full">
              <MapContainer
                center={position}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                ref={setMap}
              >
                {/* Enhanced LocationUpdater with error handling */}
                <LocationUpdater 
                  position={position}
                  setPosition={setPosition}
                  shouldCenter={shouldCenter}
                  setShouldCenter={setShouldCenter}
                  onLocationError={handleLocationError}
                />
                
                {/* OpenStreetMap TileLayer */}
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* User location marker */}
                <Marker 
                  position={position} 
                  icon={createUserLocationIcon()}
                >
                  <Popup>
                    <div>
                      <p className="font-medium">Your location</p>
                    </div>
                  </Popup>
                </Marker>
                
                {/* Collection radius circle - uses searchRadius from filters */}
                {position && position[0] && position[1] && (filters.searchRadius || filters.maxDistance) && (
                  <Circle 
                    center={position} 
                    radius={(filters.searchRadius || filters.maxDistance || 5) * 1000} // Convert km to meters
                    pathOptions={{ 
                      color: '#3b82f6', 
                      fillColor: '#3b82f6', 
                      fillOpacity: 0.1, 
                      weight: 2, 
                      zIndex: 400 
                    }}
                    eventHandlers={{
                      add: () => {
                        console.log('Circle rendered with radius:', (filters.searchRadius || filters.maxDistance || 5) * 1000, 'meters');
                      }
                    }}
                  />
                )}
                
                {/* Request markers */}
                {(() => {
                  console.log('DEBUG: Rendering markers. requests.length:', requests?.length || 0);
                  console.log('DEBUG: allRequests.length:', allRequests?.length || 0);
                  console.log('DEBUG: First few requests:', requests?.slice(0, 3));
                  
                  return requests
                    .filter(request => {
                      // Filter out requests with invalid coordinates
                      const isValid = request && 
                                   request.id && 
                                   request.coordinates && 
                                   Array.isArray(request.coordinates) && 
                                   request.coordinates.length === 2 &&
                                   typeof request.coordinates[0] === 'number' &&
                                   typeof request.coordinates[1] === 'number' &&
                                   !isNaN(request.coordinates[0]) && 
                                   !isNaN(request.coordinates[1]);
                      
                      if (!isValid) {
                        console.warn('Skipping invalid request:', request?.id, 'with coordinates:', request?.coordinates);
                        return false;
                      }
                      console.log('DEBUG: Valid request for marker:', request.id, request.coordinates);
                      return true;
                    });
                })().slice(0, 50) // Limit to 50 markers for performance
                  .map(request => (
                    <Marker 
                      key={`marker-${request.id}-${request.coordinates[0]}-${request.coordinates[1]}`}
                      position={request.coordinates}
                      icon={dustbinIcon}
                    >
                      <Popup>
                        <div className="popup-content p-2">
                          <h3 className="font-medium text-sm">{request.type?.toUpperCase() || 'PICKUP'}</h3>
                          <p className="text-xs">{request.location || 'Location not specified'}</p>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{request.distance ? `${request.distance} km` : 'Distance unknown'}</span>
                            <span>{request.estimated_time || ''}</span>
                          </div>
                          <p className="text-green-600 font-medium mt-1">₵{request.fee || '0'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                
                {/* Filter card and waste type legend removed - now outside MapContainer */}
                
                {/* Refresh indicator */}
                {lastUpdated && (
                  <div className="absolute z-10 top-2 left-2 bg-white bg-opacity-80 px-2 py-1 text-xs rounded-md" style={{ color: '#0a0a0a' }}>
                    <div className="flex items-center">
                        <span className="mr-2">Last updated: {lastUpdated.toLocaleTimeString()}</span>
                        <button 
                          onClick={refreshData}
                          className="text-blue-600 flex items-center" 
                          disabled={isRefreshing}
                        >
                          {isRefreshing ? (
                            <>
                              <div className="animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full mr-1"></div>
                              <span>Refreshing</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>Refresh</span>
                            </>
                      )}
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {allRequests?.length || 0} pickup requests available
                      </div>
                    </div>
                  )}
                </MapContainer>

              {/* Filter panel */}
              <FilterPanel 
                isOpen={showFilters} 
                onClose={() => setShowFilters(false)} 
                filters={filters} 
                updateFilters={updateFilters} 
                applyFilters={applyFilters}
              />
              
              {/* Loading overlay for refresh operations */}
              <LoadingOverlay 
                show={isRefreshing && requests.length > 0} 
                message="Refreshing requests..."
              />
            </div>
          </>
        )}
      </div>
      
      <BottomNavBar />
    </div>
  );
};

export default MapPage;
