import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { AssignmentStatus, WasteType } from '../utils/types';
import { CACHE_KEYS, saveToCache, getFromCache, isOnline, registerConnectivityListeners } from '../utils/cacheUtils';
import { requestMarkerIcon, assignmentMarkerIcon, startMarkerIcon } from '../utils/markerIcons';

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

// Function to get the appropriate icon based on request status
const getRequestIcon = (status) => {
  switch (status) {
    case 'completed':
      return startMarkerIcon; // Green for completed
    case 'accepted':
      return assignmentMarkerIcon; // Blue for accepted
    default:
      return requestMarkerIcon; // Red for available/requested
  }
};

// Custom marker icons
const createCustomIcon = (color) => {
  return L.divIcon({
    html: `<div class="w-4 h-4 rounded-full bg-${color} border-2 border-white flex items-center justify-center shadow-lg"></div>`,
    className: 'custom-marker-icon',
    iconSize: [20, 20],
  });
};

// Location update component
const LocationUpdater = ({ position, setPosition, shouldCenter, setShouldCenter }) => {
  const map = useMap();

  useEffect(() => {
    if (position && shouldCenter) {
      map.setView(position, map.getZoom());
      setShouldCenter(false);
    }
  }, [position, map, shouldCenter, setShouldCenter]);

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
const FilterCard = ({ filters, setFilters, applyFilters }) => {
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
    
    setFilters({
      ...filters,
      wasteTypes: selectedTypes,
      activeFilter: category
    });
    
    // Apply filters immediately
    applyFilters();
  };
  
  return (
    <div className="absolute bottom-24 left-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[2000] pointer-events-auto overflow-hidden" style={{ position: 'fixed', touchAction: 'none' }}>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium" style={{ color: '#0a0a0a' }}>Radius:</span>
          <span className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
            {filters.maxDistance}
          </span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="10" 
          step="0.5"
          value={filters.maxDistance} 
          onChange={(e) => {
            const newDistance = parseFloat(e.target.value);
            setFilters({...filters, maxDistance: newDistance});
            applyFilters();
          }} 
          className="w-full accent-green-500"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(wasteTypeCategories).map(([category, label]) => (
          <button
            key={category}
            onClick={() => handleCategorySelect(category)}
            className={`py-2 px-4 rounded-md text-center ${filters.activeFilter === category ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Original Filter panel component (keep this for advanced filtering)
const FilterPanel = ({ isOpen, onClose, filters, setFilters, applyFilters }) => {
  if (!isOpen) return null;
  
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
            value={filters.maxDistance} 
            onChange={(e) => setFilters({...filters, maxDistance: parseFloat(e.target.value)})} 
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
                checked={filters.wasteTypes.includes(type)}
                onChange={(e) => {
                  const newTypes = e.target.checked
                    ? [...filters.wasteTypes, type]
                    : filters.wasteTypes.filter(t => t !== type);
                  setFilters({...filters, wasteTypes: newTypes});
                }}
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
          value={filters.minPayment}
          onChange={(e) => setFilters({...filters, minPayment: parseInt(e.target.value || 0)})}
          className="w-full p-2 border rounded"
        />
      </div>
      
      {/* Priority filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
        <select 
          value={filters.priority}
          onChange={(e) => setFilters({...filters, priority: e.target.value})}
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
  const [map, setMap] = useState(null);
  const [position, setPosition] = useState([5.6037, -0.1870]); // Default: Accra, Ghana
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
  const [isCollectorOnline, setIsCollectorOnline] = useState(true); // New state for collector online status
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [filters, setFilters] = useState({
    maxDistance: 5, // 5km
    wasteTypes: Object.values(WasteType), // All waste types
    minPayment: 0,
    priority: 'all',
    activeFilter: 'all' // 'all', 'recyclable', 'general', 'hazardous'
  });
  
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
    // Default location (Accra, Ghana)
    const defaultLocation = [5.6037, -0.1870];
    
    // Initialize with default location immediately
    setPosition(defaultLocation);
    setLastUpdated(new Date());
    
    // Display a simple message
    setError('Using default location in Accra');
    
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
      return 'Unknown';
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
    
    if (distance < 1) {
      // Show in meters if less than 1km
      return `${Math.round(distance * 1000)}m`;
    }
    
    return `${distance.toFixed(1)}km`;
  };
  
  // Refresh data handler
  const refreshData = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      await fetchAssignments();
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto refresh every 2 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshData();
    }, 120000); // 2 minutes

    return () => clearInterval(intervalId);
  }, []);

  // Apply filters to requests
  const applyFilters = () => {
    if (!allRequests || allRequests.length === 0) return;
    
    // Convert distance strings to numbers for comparison
    const getDistanceNumber = (distStr) => {
      if (typeof distStr === 'string') {
        if (distStr.endsWith('m')) {
          // Convert meters to km
          return parseFloat(distStr.replace('m', '')) / 1000;
        } else if (distStr.endsWith('km')) {
          return parseFloat(distStr.replace('km', ''));
        }
      }
      return 999; // Default large value for unknown distances
    };
    
    const filteredRequests = allRequests.filter(req => {
      // Distance filter
      const distNumber = getDistanceNumber(req.distance);
      if (distNumber > filters.maxDistance) return false;
      
      // Waste type filter
      if (!filters.wasteTypes.includes(req.type)) return false;
      
      // Payment filter
      if (req.fee < filters.minPayment) return false;
      
      // Priority filter
      if (filters.priority !== 'all' && req.priority !== filters.priority) return false;
      
      return true;
    });
    
    setRequests(filteredRequests);
  };
  
  // Effect to apply filters when filter criteria change
  useEffect(() => {
    applyFilters();
  }, [filters]);
  
  // Fetch assignments from Supabase
  const fetchAssignments = async () => {
    try {
      // Check network status first
      if (!isOnlineStatus) {
        // Use cached data if offline
        const cachedRequests = getFromCache(CACHE_KEYS.PICKUP_REQUESTS);
        const cachedTimestamp = getFromCache(CACHE_KEYS.LAST_UPDATED);
        
        if (cachedRequests) {
          // Update distances based on current position
          const updatedRequests = cachedRequests.map(item => ({
            ...item,
            distance: calculateDistance(position, item.coordinates)
          }));
          
          setAllRequests(updatedRequests);
          applyFilters();
          
          if (cachedTimestamp) {
            setLastUpdated(new Date(cachedTimestamp));
          }
          
          showToast('Showing cached pickup requests', 'offline');
          setIsLoading(false);
          return;
        }
      }
      
      // Online or no cache available - fetch from Supabase
      const { data, error } = await supabase
        .from('authority_assignments')
        .select('*')
        .eq('status', AssignmentStatus.AVAILABLE)
        .order('created_at', { ascending: false });
      
      let transformedData;
      
      if (error) {
        // Check for network-related errors
        if (!navigator.onLine || error.message?.includes('network') || error.message?.includes('connection')) {
          // Network issue - mark as offline and try to use cache
          setIsOnlineStatus(false);
          const cachedRequests = getFromCache(CACHE_KEYS.PICKUP_REQUESTS);
          
          if (cachedRequests) {
            setAllRequests(cachedRequests);
            applyFilters();
            showToast('Network issue - using cached data', 'warning');
            setIsLoading(false);
            return;
          } else {
            throw new Error('Unable to connect to server and no cached data available');
          }
        } else {
          // Other Supabase error
          throw error;
        }
      }
      
      if (!data || data.length === 0) {
        // If no real data, use sample data for development
        const sampleData = [
          {
            id: '1',
            type: 'plastic',
            coordinates: { lat: position[0] + 0.01, lng: position[1] - 0.01 },
            location: '123 Main St',
            payment: 15,
            status: 'available',
            priority: 'medium',
            estimated_time: '30 mins'
          },
          {
            id: '2',
            type: 'glass',
            coordinates: { lat: position[0] - 0.005, lng: position[1] + 0.005 },
            location: '456 Beach Rd',
            payment: 20,
            status: 'available',
            priority: 'high',
            estimated_time: '45 mins'
          },
          {
            id: '3',
            type: 'paper',
            coordinates: { lat: position[0] - 0.01, lng: position[1] - 0.01 },
            location: '789 Market Ave',
            payment: 10,
            status: 'available',
            priority: 'low',
            estimated_time: '20 mins'
          }
        ];
        
        // Transform sample data
        transformedData = sampleData.map(item => ({
          id: item.id,
          type: item.type || 'general',
          coordinates: item.coordinates ? [item.coordinates.lat, item.coordinates.lng] : position,
          location: item.location || 'Unknown location',
          fee: item.payment || 0,
          status: item.status,
          priority: item.priority || 'medium',
          estimated_time: item.estimated_time || 'Unknown',
          distance: calculateDistance(position, item.coordinates ? [item.coordinates.lat, item.coordinates.lng] : position)
        }));
        
        // Show toast for sample data
        showToast('No pickup requests found - showing sample data', 'info');
      } else {
        // Transform real data for map display
        transformedData = data.map(item => ({
          id: item.id,
          type: item.type || 'general',
          coordinates: item.coordinates ? [item.coordinates.lat, item.coordinates.lng] : position,
          location: item.location || 'Unknown location',
          fee: item.payment || 0,
          status: item.status,
          priority: item.priority || 'medium',
          estimated_time: item.estimated_time || 'Unknown',
          distance: calculateDistance(position, item.coordinates ? [item.coordinates.lat, item.coordinates.lng] : position)
        }));
      }
      
      // Cache the transformed data
      saveToCache(CACHE_KEYS.PICKUP_REQUESTS, transformedData);
      saveToCache(CACHE_KEYS.LAST_UPDATED, new Date().toISOString());
      
      // Update all requests state
      setAllRequests(transformedData);
      
      // Apply filters to set the filtered requests
      applyFilters();
      
      // Update last updated timestamp
      const now = new Date();
      setLastUpdated(now);
      
      if (transformedData.length > 0 && isOnlineStatus) {
        showToast(`${transformedData.length} pickup requests found`, 'success');
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError(err.message || 'Failed to load assignments. Please try again later.');
      showToast('Failed to load pickup requests', 'error');
      
      // Try to use cached data as last resort
      const cachedRequests = getFromCache(CACHE_KEYS.PICKUP_REQUESTS);
      if (cachedRequests) {
        setAllRequests(cachedRequests);
        applyFilters();
        showToast('Using last cached data due to error', 'warning', 5000);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Set up Supabase real-time subscription for assignments
  useEffect(() => {
    if (!isOnlineStatus) return;
    
    let subscription;
    
    const setupRealtimeSubscription = async () => {
      try {
        // First fetch initial data
        await fetchAssignments();
        
        // Then set up real-time subscription
        subscription = supabase
          .channel('authority_assignments_changes')
          .on('postgres_changes', {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'authority_assignments'
          }, (payload) => {
            // Handle different event types
            const { eventType, new: newRecord, old: oldRecord } = payload;
            
            switch (eventType) {
              case 'INSERT': {
                if (newRecord.status === AssignmentStatus.AVAILABLE) {
                  // Transform the new record
                  const transformedRequest = {
                    id: newRecord.id,
                    type: newRecord.type || 'general',
                    coordinates: newRecord.coordinates ? [newRecord.coordinates.lat, newRecord.coordinates.lng] : position,
                    location: newRecord.location || 'Unknown location',
                    fee: newRecord.payment || 0,
                    status: newRecord.status,
                    priority: newRecord.priority || 'medium',
                    estimated_time: newRecord.estimated_time || 'Unknown',
                    distance: calculateDistance(position, newRecord.coordinates ? [newRecord.coordinates.lat, newRecord.coordinates.lng] : position)
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
                if (oldRecord.status === AssignmentStatus.AVAILABLE && 
                    newRecord.status !== AssignmentStatus.AVAILABLE) {
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
              console.log('Subscribed to authority_assignments table');
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
      
      // Update assignment in Supabase
      const { data, error } = await supabase
        .from('authority_assignments')
        .update({ 
          status: AssignmentStatus.ASSIGNED,
          collector_id: user?.id,
          accepted_at: new Date().toISOString()
        })
        .eq('id', requestId);
      
      if (error) throw error;
      
      // Show success toast
      showToast(`Successfully accepted ${request.type} pickup!`, 'success');
      
      // Remove the accepted request from the list
      const newRequests = allRequests.filter(r => r.id !== requestId);
      setAllRequests(newRequests);
      
      // Apply filters to update display
      applyFilters();
      
      // Update cache
      saveToCache(CACHE_KEYS.PICKUP_REQUESTS, newRequests);
    } catch (err) {
      console.error('Error accepting assignment:', err);
      showToast('Failed to accept request. Please try again.', 'error');
    }
  };

  // Get color for waste type
  const getWasteTypeColor = (type) => {
    const colors = {
      plastic: '#3b82f6', // blue-500
      paper: '#eab308',   // yellow-500
      metal: '#6b7280',   // gray-500
      glass: '#93c5fd',   // blue-300
      organic: '#22c55e', // green-500
      general: '#ef4444', // red-500
      recycling: '#86efac' // green-300
    };
    return colors[type] || '#6b7280'; // default to gray-500
  };

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
  
  // Initial data fetch
  useEffect(() => {
    fetchAssignments();
  }, []);

  // getWasteTypeColor is already defined above

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
      
      {/* Offline indicator */}
      {!isOnlineStatus && (
        <div className="absolute top-16 w-full bg-gray-800 text-white py-1 text-center text-sm z-40">
          You are currently offline. Limited functionality available.
        </div>
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
              setFilters={setFilters} 
              applyFilters={applyFilters} 
            />
            
            {/* Waste type legend - moved outside map container */}
            <WasteLegend />
            
            {/* Request count display - perfect circle */}
            <div className="absolute top-16 left-2 z-[2000] pointer-events-auto">
              <div className="bg-green-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-lg shadow-md">
                {requests.length}
              </div>
            </div>
            
            {/* Online/Offline toggle button - centered horizontally */}
            <div className="absolute top-2 right-0 flex justify-center z-[2000] pointer-events-auto" style={{ color: '#0a0a0a', marginRight: '0.4rem' }}>
              <div className="bg-white p-2 rounded-md shadow">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Status:</span>
                  <button 
                    onClick={() => setIsCollectorOnline(!isCollectorOnline)}
                    className={`px-3 py-1 rounded-full text-white text-xs ${isCollectorOnline ? 'bg-green-500' : 'bg-gray-500'}`}
                  >
                    {isCollectorOnline ? 'Online' : 'Offline'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="relative h-full">
              <MapContainer
                center={position}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                ref={setMap}
              >
                {/* Error notification overlay removed - now outside MapContainer */}
                
                {/* OpenStreetMap TileLayer */}
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Custom zoom controls removed - now outside MapContainer */}
                
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
                
                {/* Collection radius circle */}
                <Circle 
                  center={position} 
                  radius={filters.maxDistance * 1000} // Convert km to meters for radius
                  pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.1, weight: 2, zIndex: 400 }} 
                />
                
                {/* Request markers */}
                {requests.map(request => {
                  // Skip rendering markers with invalid coordinates
                  if (!request.coordinates || 
                      !Array.isArray(request.coordinates) || 
                      request.coordinates.length !== 2 ||
                      request.coordinates[0] === undefined || 
                      request.coordinates[1] === undefined) {
                    console.log('Skipping marker with invalid coordinates:', request.id);
                    return null;
                  }
                  
                  return (
                    <Marker 
                      key={request.id}
                      position={request.coordinates}
                      icon={getRequestIcon(request.status)}
                    >
                      <Popup>
                        <div className="popup-content">
                          <h3 className="font-medium">{request.type.toUpperCase()}</h3>
                          <p>{request.location}</p>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{request.distance}</span>
                            <span>{request.estimated_time}</span>
                          </div>
                          <p className="text-green-600 font-medium mt-2">₵{request.fee}</p>
                          <button 
                            onClick={() => handleAcceptAssignment(request.id)}
                            className="bg-primary text-white text-sm px-3 py-1 rounded mt-2 w-full"
                          >
                            Accept
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
                  
                <LocationUpdater 
                  position={position} 
                  setPosition={setPosition} 
                  shouldCenter={shouldCenter} 
                  setShouldCenter={setShouldCenter} 
                />
                
                {/* Recenter button */}
                <RecenterButton onClick={handleRecenter} />
                
                {/* Advanced Filter button */}
                {/* <div className="absolute z-10 top-4 right-4">
                  <button
                    onClick={() => setShowFilters(true)}
                    className="bg-white p-2 rounded-full shadow-md flex items-center justify-center"
                    aria-label="Advanced filters"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>
                  {(filters.wasteTypes.length < Object.values(WasteType).length || 
                   filters.minPayment > 0 || 
                   filters.priority !== 'all') && (
                    <span className="absolute -top-2 -right-2 bg-primary text-white w-5 h-5 flex items-center justify-center rounded-full text-xs">
                      !
                    </span>
                  )}
                </div> */}
                
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
                        {requests.length} pickup requests available
                      </div>
                    </div>
                  )}
                </MapContainer>

              {/* Filter panel */}
              <FilterPanel 
                isOpen={showFilters} 
                onClose={() => setShowFilters(false)} 
                filters={filters} 
                setFilters={setFilters} 
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
