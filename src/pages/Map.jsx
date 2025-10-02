import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFilters } from '../context/FilterContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import MapControls from '../components/MapControls';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import Toast from '../components/Toast';
import StatusButton from '../components/StatusButton';
import { useAuth } from '../context/AuthContext';
import { supabase, DEV_MODE } from '../services/supabase';
import { AssignmentStatus, WasteType } from '../utils/types';
import { requestMarkerIcon, assignmentMarkerIcon, tricycleIcon, getStopIcon } from '../utils/markerIcons';
import { statusService, COLLECTOR_STATUS } from '../services/statusService';

// Simple online status check
const isOnline = () => navigator.onLine;

// Simple connectivity listeners
const registerConnectivityListeners = (onOnline, onOffline) => {
  const handleOnline = () => onOnline();
  const handleOffline = () => onOffline();
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

// Fix default marker icon issues with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create waste type icon using imported marker icons
const createWasteTypeIcon = (type) => {
  // Map waste types to appropriate dustbin icon colors
  const typeColorMap = {
    recyclable: 'request',    // Red dustbin for recyclables  
    organic: 'assignment',    // Blue dustbin for organic
    hazardous: 'request',     // Red dustbin for hazardous
    electronic: 'assignment', // Blue dustbin for electronic
    general: 'assignment',    // Blue dustbin for general
    plastic: 'request',       // Red dustbin for plastic
    paper: 'assignment',      // Blue dustbin for paper
    metal: 'request',         // Red dustbin for metal
    glass: 'assignment'       // Blue dustbin for glass
  };
  
  const iconType = typeColorMap[type?.toLowerCase()] || 'assignment';
  return iconType === 'request' ? requestMarkerIcon : assignmentMarkerIcon;
};

// Map component for location updates
const LocationUpdater = ({ position, setMap }) => {
  const map = useMap();
  
  useEffect(() => {
    setMap(map);
  }, [map, setMap]);
  
  useEffect(() => {
    if (position && map) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  
  return null;
};

// Distance calculation
const calculateDistance = (pos1, pos2) => {
  if (!pos1 || !pos2 || pos1.length < 2 || pos2.length < 2) return 999;
  
  const [lat1, lon1] = pos1;
  const [lat2, lon2] = pos2;
  
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const formatDistance = (distance) => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
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
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Ensure filters has all required properties with defaults (capped for efficiency)
  const safeFilters = {
    searchRadius: typeof filters.searchRadius === 'number' ? Math.min(filters.searchRadius, 10) : 5,
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
    <div className="absolute bottom-24 left-4 right-4 bg-white rounded-lg shadow-lg z-[2000] pointer-events-auto overflow-hidden" style={{ position: 'fixed', touchAction: 'none' }}>
      {/* Header Section - Always Visible */}
      <div className="p-4 pb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium" style={{ color: '#0a0a0a' }}>Radius: {safeFilters.searchRadius} km</span>
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
            aria-label={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
          >
            <svg 
              className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${filtersExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        {/* Radius Slider - Always Visible (Capped at 10km for operational efficiency) */}
        <input 
          type="range" 
          min="1" 
          max="10" 
          step="1"
          value={Math.min(safeFilters.searchRadius, 10)} 
          onChange={(e) => {
            const newDistance = parseFloat(e.target.value) || 5;
            handleFilterChange({ searchRadius: newDistance });
          }} 
          className="w-full accent-green-500"
        />
      </div>
      
      {/* Collapsible Filter Options */}
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          filtersExpanded 
            ? 'max-h-32 opacity-100' 
            : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(wasteTypeCategories).map(([category, label]) => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                className={`py-2 px-4 rounded-md text-center transition-colors duration-200 ${
                  safeFilters.activeFilter === category 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { filters, updateFilters, updateFilteredRequests } = useFilters();
  const [map, setMap] = useState(null);
  // Default fallback location (Accra, Ghana) for immediate map load
  const DEFAULT_POSITION = [5.6037, -0.1870]; // Accra coordinates
  
  const [position, setPosition] = useState(DEFAULT_POSITION); // Start with fallback, update with real location
  const [isUsingCachedLocation, setIsUsingCachedLocation] = useState(false); // Track if using cached location
  const [isUsingFallbackLocation, setIsUsingFallbackLocation] = useState(true); // Track if using default fallback
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
  
  // Enhanced geolocation with cached position and real-time updates
  useEffect(() => {
    // Load cached position immediately
    const loadCachedPosition = () => {
      try {
        const cached = localStorage.getItem('userLastPosition');
        if (cached) {
          const cachedPos = JSON.parse(cached);
          console.log('📍 Using cached position temporarily while fetching GPS:', cachedPos);
          setPosition(cachedPos);
          setIsUsingCachedLocation(true); // Mark as using cached location
          setIsUsingFallbackLocation(false); // No longer using fallback
          return true;
        }
      } catch (e) {
        console.warn('Failed to load cached position:', e);
      }
      console.log('🗺️ Using default location (Accra, Ghana) to load map immediately');
      return false;
    };
    // Save position to cache
    const savePositionToCache = (pos) => {
      try {
        localStorage.setItem('userLastPosition', JSON.stringify(pos));
        console.log('💾 Position cached for next time');
      } catch (e) {
        console.warn('Failed to cache position:', e);
      }
    };

  // Location service setup and management
  useEffect(() => {
    let locationInterval;
    let errorRetryInterval;
    let watchId;

    const getLocation = async () => {
      // Try to load cached position first
      const hasCachedPosition = loadCachedPosition();
      
      if (!navigator.geolocation) {
        setError('Geolocation not supported');
        setLocationAttempted(true);
        return;
      }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    const onSuccess = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const newPos = [latitude, longitude];
      
      // Only switch from cached/fallback to live GPS if accuracy is better than 50m
      const isAccurateEnough = accuracy <= 50;
      
      // Check if this is a significant location update
      if (isUsingCachedLocation) {
        if (isAccurateEnough) {
          console.log('🎯 GPS location acquired! Updating from cached to real position:', newPos, `±${Math.round(accuracy)}m`);
          setIsUsingCachedLocation(false); // Mark as no longer using cached location
        } else {
          // Reduce low accuracy GPS logging to prevent spam
          if (Math.random() < 0.02) {
            console.log('📍 GPS reading too inaccurate, keeping cached location:', `±${Math.round(accuracy)}m (need <50m)`);
          }
          return; // Don't update position if accuracy is poor
        }
      } else if (isUsingFallbackLocation) {
        if (isAccurateEnough) {
          // Reduce GPS location logging to 5% frequency to prevent spam
          if (Math.random() < 0.05) {
            console.log('🎯 GPS location acquired! Updating from default to real position:', newPos, `±${Math.round(accuracy)}m`);
            console.log('💾 Position cached for next time');
          }
          setIsUsingFallbackLocation(false); // Mark as no longer using fallback
        } else {
          // Reduce low accuracy GPS logging to prevent spam  
          if (Math.random() < 0.02) {
            console.log('📍 GPS reading too inaccurate, keeping fallback location:', `±${Math.round(accuracy)}m (need <50m)`);
          }
          return; // Don't update position if accuracy is poor
        }
      } else {
        // For live GPS updates, always update but log based on accuracy
        if (isAccurateEnough) {
          // Reduce regular GPS update logging to 2% frequency
          if (Math.random() < 0.02) {
            console.log('📍 GPS location updated:', newPos, `±${Math.round(accuracy)}m`);
          }
        } else {
          // Reduce low accuracy update logging
          if (Math.random() < 0.01) {
            console.log('📍 GPS location updated (low accuracy):', newPos, `±${Math.round(accuracy)}m`);
          }
        }
      }
      
      setPosition(newPos);
      savePositionToCache(newPos); // Cache for next time
      setError(null);
      setLocationAttempted(true);
      setLastUpdated(new Date().toLocaleTimeString());
    };

    const onError = (err) => {
      // Reduce geolocation error logging frequency - only 10% of the time
      if (Math.random() < 0.1) {
        console.error('❌ Location error:', err);
      }
      setLocationAttempted(true);
      
      // If GPS fails, we're no longer "acquiring" GPS even though we might still be using cached location
      if (isUsingCachedLocation) {
        console.log('⚠️ GPS acquisition failed, keeping cached location');
        // Keep isUsingCachedLocation as true to show user we're still using cached data
      }
      
      switch (err.code) {
        case err.PERMISSION_DENIED:
          setError('Location access denied. Please enable location permissions.');
          showToast('Enable location access for accurate results', 'warning', 5000);
          break;
        case err.POSITION_UNAVAILABLE:
          // Clear error and try network location instead of showing error immediately
          setError(null);
          setTimeout(() => {
            const fallbackOptions = {
              enableHighAccuracy: false,
              timeout: 25000,
              maximumAge: 60000
            };
            navigator.geolocation.getCurrentPosition(onSuccess, () => {
              setError('Location services unavailable');
              showToast('Please enable GPS and refresh', 'error', 6000);
            }, fallbackOptions);
          }, 2000);
          break;
        case err.TIMEOUT:
          // Clear error and retry instead of showing error immediately
          setError(null);
          setTimeout(() => {
            navigator.geolocation.getCurrentPosition(onSuccess, onError, {
              ...options,
              timeout: 25000
            });
          }, 2000);
          break;
        default:
          setError(`Location error: ${err.message}`);
      }
    };

      // Get initial position
      navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
      
      // Watch for real-time updates
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, options);
      setWatchId(watchId);
    };

    getLocation();

    return () => {
      if (locationInterval) clearInterval(locationInterval);
      if (errorRetryInterval) clearInterval(errorRetryInterval);
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

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

  // REMOVED: Old hardcoded default location useEffect - now using real geolocation only

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
  
  // Fetch requests from Supabase or use mock data in DEV_MODE
  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if we're online
      const online = await isOnline();
      setIsOnlineStatus(online);
      
      let data = [];
      
      // Use mock data in DEV_MODE to avoid API calls
      if (DEV_MODE) {
        console.log('[DEV MODE] Using mock pickup requests data...');
        
        // Mock data for development
        data = [
          {
            id: 'mock-1',
            waste_type: 'plastic',
            coordinates: [5.672505, -0.280669], // Near Accra
            location: 'East Legon, Accra',
            fee: 50,
            status: 'available',
            priority: 'medium',
            bag_count: 2,
            special_instructions: 'Plastic bottles and containers',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'mock-2',
            waste_type: 'organic',
            coordinates: [5.6801, -0.2874], // Accra area
            location: 'Osu, Accra',
            fee: 30,
            status: 'available',
            priority: 'high',
            bag_count: 1,
            special_instructions: 'Food waste and organic materials',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'mock-3',
            waste_type: 'paper',
            coordinates: [5.6644, -0.2656], // Accra central
            location: 'Adabraka, Accra',
            fee: 25,
            status: 'available',
            priority: 'low',
            bag_count: 3,
            special_instructions: 'Old newspapers and cardboard',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
      } else if (online) {
        console.log('Fetching pickup requests from Supabase...');
        
        // Log Supabase configuration
        console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
        
        // Fetch available pickup requests
        const { data: supabaseData, error, count } = await supabase
          .from('pickup_requests')
          .select('*', { count: 'exact' })
          .eq('status', 'available')
          .order('created_at', { ascending: false });
        
        console.log('Supabase query results:', { data: supabaseData, error, count });
        
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
        
        data = supabaseData || [];
      } else {
        // Offline - no cache available
        showToast('No internet connection. Please connect to view pickup requests.', 'error');
        return;
      }
      
      // Transform the data to match our expected format (for DEV_MODE and online cases)
      const transformedData = data
          .map(item => {
              if (!item) return null;
              
              const coords = parseCoordinates(item.coordinates);
              
              // Skip items with invalid coordinates
              if (!Array.isArray(coords) || coords.length !== 2 || 
                  typeof coords[0] !== 'number' || typeof coords[1] !== 'number' ||
                  isNaN(coords[0]) || isNaN(coords[1])) {
                console.warn('Skipping item with invalid coordinates:', item.id, item.coordinates);
                return null;
              }
              
              // Skip items with missing IDs (prevents 'Cannot accept temporary requests' error)
              if (!item.id) {
                console.warn('Skipping item with missing ID:', item);
                return null;
              }
              
              // Handle individual item processing errors gracefully  
              const safeProcessItem = () => {
                try {
                  // Safe position handling - use cached position if main position unavailable
                  let currentPosition = position;
                  
                  // If position is null, try to get cached position
                  if (!currentPosition) {
                    try {
                      const cached = localStorage.getItem('userLastPosition');
                      if (cached) {
                        currentPosition = JSON.parse(cached);
                        // Reduced logging frequency - only log occasionally
                        if (Math.random() < 0.1) {
                          console.log('🔧 Using cached position for processing:', currentPosition);
                        }
                      }
                    } catch (e) {
                      console.warn('Failed to load cached position for processing:', e);
                    }
                  }
                  
                  // If still no position, skip processing
                  if (!currentPosition || !Array.isArray(currentPosition) || currentPosition.length !== 2) {
                    console.warn('⚠️ No valid position available, skipping item processing');
                    return null;
                  }
                  
                  return {
                    id: item.id,
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
                      currentPosition,
                      coords
                    )),
                    distanceValue: calculateDistance(
                      currentPosition,
                      coords
                    ),
                    estimated_time: item.estimated_time || 'Unknown',
                  };
                } catch (error) {
                  console.error('Error processing item:', error);
                  return null;
                }
              };
              
              // Process item safely without nested try-catch
              const processedItem = safeProcessItem();
              return processedItem;
          })
          .filter(Boolean); // Remove any null entries
        
        // Update state and cache
        setAllRequests(transformedData);
        // Don't set requests here - let applyFilters handle the filtered data
        setLastUpdated(new Date());
        // Data loaded successfully
        
        if (transformedData.length > 0) {
          showToast(`${transformedData.length} pickup requests found`, 'success');
        } else {
          showToast('No pickup requests found', 'info');
        }
        
        // Apply filters to populate the requests state with filtered data
        setTimeout(() => applyFilters(), 0);
    } catch (error) {
      console.error('Error fetching pickup requests:', error);
      showToast('Failed to load pickup requests', 'error');
      
      // No cache available - show error
      // Apply filters to populate the requests state with filtered data
      setTimeout(() => applyFilters(), 0);
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
    // Reduce console spam - only log 5% of filter applications
    if (Math.random() < 0.05) {
      console.log('🔍 Applying filters...', { filters, allRequestsCount: allRequests.length, position });
    }
    
    // Position should always be available now (fallback location ensures this)
    if (!position || !position[0] || !position[1]) {
      // This should rarely happen now that we have fallback location
      console.warn('⚠️ Position not available even with fallback - this should not happen');
      setRequests([]);
      updateFilteredRequests([]);
      return;
    }

    // Check collector status - only show requests if online (Uber-like behavior)
    const statusInfo = statusService.getStatus();
    if (!statusInfo.isOnline) {
      // Reduce offline logging to 1% frequency to prevent spam
      if (Math.random() < 0.01) {
        console.log('👤 Collector is offline - hiding all requests (Uber-style)');
      }
      setRequests([]);
      updateFilteredRequests([]);
      return;
    }

    const safeFilters = filters || {};
    const activeFilter = safeFilters.activeFilter || 'all';
    const radiusKm = parseFloat(safeFilters.searchRadius) || 5;
    
    // Reduce filter criteria logging to 1% frequency to prevent spam
    if (Math.random() < 0.01) {
      console.log('🎯 Filter criteria:', { activeFilter, radiusKm, collectorStatus: statusInfo.status });
      console.log('DEBUG: Sample requests:', allRequests.slice(0, 2));
      console.log('🗂️ Waste types in requests:', allRequests.map(r => r.waste_type || r.type).filter(Boolean));
    }
    
    const searchRadius = filters.searchRadius || filters.maxDistance || 5; // Use searchRadius with fallback to maxDistance
    
    const filteredRequests = allRequests.filter(req => {
      // Skip if request is invalid  
      if (!req || !req.coordinates) {
        console.log('❌ Filtered out - invalid request or no coordinates:', req?.id);
        return false;
      }
      
      // Filter by status - only show available requests
      if (req.status !== 'available') {
        console.log('❌ Filtered out - status not available:', req.id, 'status:', req.status);
        return false;
      }
      
      // Filter by distance (only apply strict filtering if using real GPS location)
      if (position && position[0] && position[1]) {
        try {
          const distance = calculateDistance(
            [position[0], position[1]],
            req.coordinates
          );
          
          // Apply distance filtering properly
          if (distance > radiusKm) {
            // Reduce console spam - only log 1% of filtered out requests
            if (Math.random() < 0.01) {
              console.log('❌ Filtered out - distance too far:', req.id, 'distance:', distance.toFixed(2) + 'km', 'limit:', radiusKm + 'km');
            }
            return false;
          }
          
          // Add distance to request for sorting
          req.distance = distance;
          
          // Reduce console spam - only log 1% of passed requests
          if (Math.random() < 0.01) {
            if (isUsingFallbackLocation) {
              console.log('📍 Request passed filter (fallback location):', req.id, 'distance:', distance.toFixed(2) + 'km');
            } else {
              console.log('✅ Passed distance filter:', req.id, 'distance:', distance.toFixed(2) + 'km');
            }
          }
        } catch (error) {
          console.error('❌ Filtered out - distance calculation error:', error);
          return false;
        }
      }
      
      // Filter by waste type using activeFilter
      if (activeFilter && activeFilter !== 'all') {
        const requestWasteType = req.waste_type || req.type;
        if (requestWasteType !== activeFilter) {
          console.log('❌ Filtered out - waste type mismatch:', req.id, 'request type:', requestWasteType, 'filter:', activeFilter);
          return false;
        }
      }
      
      // Also filter by waste types array (if provided)
      if (filters.wasteTypes?.length > 0 && !filters.wasteTypes.includes('All Types')) {
        const requestWasteType = req.waste_type || req.type;
        if (!filters.wasteTypes.includes(requestWasteType)) {
          console.log('❌ Filtered out - not in wasteTypes array:', req.id, 'request type:', requestWasteType, 'allowed types:', filters.wasteTypes);
          return false;
        }
      }
      
      // Filter by minimum payment
      const minPayment = parseFloat(filters.minPayment) || 0;
      if (minPayment > 0 && (parseFloat(req.fee) || 0) < minPayment) {
        console.log('❌ Filtered out - payment too low:', req.id, 'fee:', req.fee, 'minimum:', minPayment);
        return false;
      }
      
      // Filter by priority
      if (filters.priority && filters.priority !== 'all' && req.priority !== filters.priority) {
        console.log('❌ Filtered out - priority mismatch:', req.id, 'request priority:', req.priority, 'filter:', filters.priority);
        return false;
      }
      
      console.log('✅ Request passed all filters:', req.id, 'type:', req.waste_type || req.type, 'distance:', req.distance?.toFixed(2) + 'km');
      return true;
    });
    
    // Sort by distance if we have a position
    if (position && position[0] && position[1]) {
      filteredRequests.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    
    // Reduce filtered results logging to 1% frequency
    if (Math.random() < 0.01) {
      console.log('Filtered requests:', filteredRequests.length, 'out of', allRequests.length);
    }
    setRequests(filteredRequests);
    
    // DEBUG: Log what we're sharing with Request page
    // Reduce logging frequency for debug sharing - only 1% of the time
    if (Math.random() < 0.01) {
      console.log('DEBUG: Sharing filtered requests with Request page:', {
        available: filteredRequests,
        count: filteredRequests.length,
        firstRequest: filteredRequests[0] || 'none'
      });
    }
    
    // Update filtered requests in context
    updateFilteredRequests({ available: filteredRequests });
  }, [allRequests, filters, position, isUsingFallbackLocation, updateFilteredRequests]);

  // Effect to apply filters when filter criteria OR position changes
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);
  
  // Effect to reapply filters when position becomes available
  useEffect(() => {
    if (position && position[0] && position[1] && allRequests.length > 0) {
      // Reduce position reload logging to 1% frequency to prevent spam
      if (Math.random() < 0.01) {
        console.log('DEBUG: Position loaded, reapplying filters');
      }
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
                    // Data updated
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
                    // Data updated
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
                    // Data updated
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
        // Data updated
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
                  
                  // Show count even with fallback position (position should always be available now)
                  if (!position || position[0] === undefined || position[1] === undefined) {
                    console.log('No valid position, showing ? - this should not happen with fallback');
                    return '?';
                  }
                  
                  // Log the current state for debugging - reduced frequency to 1%
                  if (Math.random() < 0.01) {
                    console.log('Request count display:', {
                      totalRequests: allRequests?.length || 0,
                      filteredRequests: requests.length,
                      position,
                      filters: {
                        searchRadius: filters.searchRadius,
                        maxDistance: filters.maxDistance,
                        wasteTypes: filters.wasteTypes,
                        minPayment: filters.minPayment,
                        maxPickupTime: filters.maxPickupTime,
                        priority: filters.priority,
                        activeFilter: filters.activeFilter,
                        radiusKm: filters.radiusKm
                      }
                    });
                  }
                  
                  return requests.length;
                })()}
              </div>
            </div>
            
            {/* Enhanced Online/Offline Status Button */}
            <div className="absolute top-2 right-0 flex flex-col items-end gap-1 z-[2000] pointer-events-auto" style={{ marginRight: '0.4rem' }}>
              <StatusButton 
                showSessionInfo={true}
                className="transition-all duration-300 hover:scale-105"
              />
              
              {/* GPS Status Indicator */}
              {(isUsingCachedLocation || isUsingFallbackLocation || error) && (
                <div className={`text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                  error ? 'bg-red-500' : 'bg-orange-500 animate-pulse'
                }`}>
                  <div className={`w-2 h-2 bg-white rounded-full ${error ? '' : 'animate-spin'}`}></div>
                  {error 
                    ? 'Using Cached' 
                    : 'Getting GPS...'
                  }
                </div>
              )}
            </div>
            
            <div className="relative h-full">
              {/* Leaflet Map Container */}
              {position ? (
                <MapContainer
                  center={position}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                  zoomControl={false}
                >
                  <LocationUpdater position={position} setMap={setMap} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* User location marker */}
                  <Marker position={position} icon={tricycleIcon}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-medium text-blue-600">Your Location</p>
                        <p className="text-sm text-gray-600">
                          {isUsingFallbackLocation 
                            ? 'Default Location (Acquiring GPS...)'
                            : isUsingCachedLocation 
                              ? 'Cached Position (Updating...)' 
                              : 'Live GPS Position'
                          }
                        </p>
                        {lastUpdated && !isUsingCachedLocation && !isUsingFallbackLocation && (
                          <p className="text-xs text-green-600">Updated: {lastUpdated}</p>
                        )}
                        {(isUsingCachedLocation || isUsingFallbackLocation) && (
                          <p className="text-xs text-orange-600">🔄 Acquiring GPS...</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                  
                  {/* Radius circle */}
                  {(filters.searchRadius || filters.maxDistance) && (
                    <Circle
                      center={position}
                      radius={(filters.searchRadius || filters.maxDistance) * 1000}
                      pathOptions={{
                        fillColor: '#22c55e',
                        fillOpacity: 0.1,
                        color: '#22c55e',
                        weight: 2,
                        opacity: 0.8
                      }}
                    />
                  )}
                  
                  {/* Request markers */}
                  {requests && requests.map((request, index) => {
                    if (!request.coordinates || !Array.isArray(request.coordinates)) return null;
                    
                    // Handle stacked markers with circular spreading pattern
                    const baseCoords = request.coordinates;
                    const totalMarkers = requests.length;
                    
                    // Circular distribution - spread markers in a circle around original point
                    const angle = (index * 360) / totalMarkers; // Distribute evenly in circle
                    const radiusKm = 0.002; // ~220 meters radius - clearly visible
                    
                    const adjustedCoords = [
                      baseCoords[0] + (radiusKm * Math.sin(angle * Math.PI / 180)),
                      baseCoords[1] + (radiusKm * Math.cos(angle * Math.PI / 180))
                    ];
                    
                    // Add visual differentiation with different waste types
                    const wasteTypes = ['plastic', 'organic', 'general', 'recyclable', 'paper', 'metal'];
                    const assignedWasteType = request.waste_type || wasteTypes[index % wasteTypes.length];
                    
                    // Debug: Log marker coordinates and waste type
                    // Reduced logging frequency for marker rendering - only 5% of the time
                    if (Math.random() < 0.05) {
                      console.log('🗺️ Rendering marker:', {
                        id: request.id,
                        original: request.coordinates,
                        adjusted: adjustedCoords,
                        angle: angle,
                        radius: radiusKm,
                        wasteType: request.waste_type
                      });
                    }
                    
                    return (
                      <Marker
                        key={request.id}
                        position={adjustedCoords}
                        icon={createWasteTypeIcon(assignedWasteType)}
                        eventHandlers={{
                          click: () => {
                            navigate('/request', { state: { scrollToRequest: request.id } });
                          }
                        }}
                      >
                        <Popup>
                          <div className="text-center max-w-xs">
                            <h3 className="font-medium text-gray-900 mb-1">
                              {assignedWasteType?.charAt(0).toUpperCase() + assignedWasteType?.slice(1)} Waste
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">{request.location}</p>
                            <p className="text-sm text-gray-600 mb-2">
                              Distance: {formatDistance(calculateDistance(position, request.coordinates))}
                            </p>
                            <p className="text-lg font-bold text-green-600 mb-2">₵{request.fee}</p>
                            <button
                              onClick={() => navigate('/request', { state: { scrollToRequest: request.id } })}
                              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                              Get
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Loading map...</p>
                    <p className="text-xs text-gray-500 mt-1">This should not take long</p>
                  </div>
                </div>
              )}
              
              {/* MapControls overlay - positioned relative to the map container */}
              <MapControls 
                lastUpdated={lastUpdated}
                isRefreshing={isRefreshing}
                refreshData={refreshData}
                requestCount={allRequests?.length || 0}
              />
            </div>
            
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
          </>
        )}
      </div>
      
      <BottomNavBar />
    </div>
  );
};

export default MapPage;
