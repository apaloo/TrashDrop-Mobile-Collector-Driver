import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Scanner } from '@yudiel/react-qr-scanner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import RequestCard from '../components/RequestCard';
import NavigationQRModal from '../components/NavigationQRModal';
import Toast from '../components/Toast';

import { PickupRequestStatus, WasteType, AssignmentStatus } from '../utils/types';
import { transformRequestsData } from '../utils/requestUtils';
import { getCurrentLocation, getLocationWithRetry, isWithinRadius } from '../utils/geoUtils';
import { registerConnectivityListeners } from '../utils/offlineUtils';
import { supabase, DEV_MODE } from '../services/supabase';
import usePhotoCapture from '../hooks/usePhotoCapture';

// OPTIMIZATION: Memoize RequestCard for better performance
import { requestManager } from '../services/requestManagement';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// OPTIMIZATION: Memoize RequestCard for better performance
const MemoizedRequestCard = memo(RequestCard);

const RequestPage = () => {
  const { id: requestId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { filters, filteredRequests = [], updateFilteredRequests } = useFilters() || {};
  
  // Photo capture management
  const {
    photos,
    isInitialized: isPhotoCaptureInitialized,
    error: photoError,
    capturePhoto,
    removePhoto,
    clearPhotos,
    getPhotoCount,
    hasPhotos
  } = usePhotoCapture(requestId);
  
  const [activeTab, setActiveTab] = useState('available');
  const [requests, setRequests] = useState({
    available: [],
    accepted: [],
    picked_up: []
  });
  const [isLoading, setIsLoading] = useState(true);
  // OPTIMIZATION: Separate loading states for better UX
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [isOnlineStatus, setIsOnlineStatus] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentReport, setCurrentReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [navigationDestination, setNavigationDestination] = useState(null);
  const [navigationRequestId, setNavigationRequestId] = useState(null);

  // Show toast notification
  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ show: true, message, type, duration });
  };
  
  // Hide toast notification
  const hideToast = () => {
    setToast({ ...toast, show: false });
  };
  
  // Show toast for photo-related errors
  useEffect(() => {
    if (photoError) {
      setToast({
        show: true,
        message: photoError,
        type: 'error',
        duration: 5000
      });
    }
  }, [photoError]);
  
  // OPTIMIZATION: Cache for transformed request data to avoid recalculation
  const [requestCache, setRequestCache] = useState({
    available: { data: [], timestamp: 0 },
    accepted: { data: [], timestamp: 0 },
    completed: { data: [], timestamp: 0 }
  });

  // Error boundary state
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);

  // Error boundary handler
  const handleError = (error, info) => {
    console.error('RequestPage Error:', error);
    setHasError(true);
    setErrorInfo(info);
    showToast('An error occurred. Please try refreshing the page.', 'error', 5000);
  };
  
  // Fetch requests from Supabase
  const fetchRequests = useCallback(async () => {
    try {
      // SUPER-FAST: Show cached data immediately, then update in background
      if (requestCache.available.data.length > 0) {
        // Only log instant cache occasionally to reduce console spam
        if (Math.random() < 0.05) { // 5% chance of logging
          console.log('⚡ INSTANT: Showing cached data immediately');
        }
        setRequests(prev => ({
          ...prev,
          available: requestCache.available.data
        }));
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      
      setError(null);
      
      // OPTIMIZATION: Extended cache for aggressive performance (2 minutes)
      const cacheTimestamp = requestCache.available.timestamp;
      const cacheAge = Date.now() - cacheTimestamp;
      const CACHE_DURATION = 120000; // 2 minutes for super-fast experience
      
      if (cacheAge < CACHE_DURATION && requestCache.available.data.length > 0) {
        // Only log cache hits occasionally to reduce console spam
        if (Math.random() < 0.1) { // 10% chance of logging
          console.log('⚡ CACHE HIT: Using extended cache, skipping API call');
        }
        setIsLoading(false);
        return;
      }
      
      // Get user location with retry and fallback
      try {
        const location = await getLocationWithRetry(2, 1000);
        setUserLocation({
          latitude: location.lat,
          longitude: location.lng,
          accuracy: location.accuracy,
          isFallback: location.isFallback
        });
        
        // Only log fallback location usage occasionally to reduce console spam
        if (location.isFallback && (!window.lastFallbackLog || Date.now() - window.lastFallbackLog > 300000)) {
          console.warn('[Location] Using fallback location due to GPS unavailability');
          window.lastFallbackLog = Date.now();
        }
      } catch (error) {
        console.error('Error getting location:', error);
        // Set default location if location fails
        setUserLocation({
          latitude: 5.6037,
          longitude: -0.1870,
          isFallback: true
        });
      }
      
      // Check if we're online
      const online = navigator.onLine;
      setIsOnlineStatus(online);
      
      if (online || DEV_MODE) {
        let availableResult, acceptedResult, pickedUpResult;
        
        if (DEV_MODE) {
          console.log('[DEV MODE] Using mock request data...');
          
          // Mock data for development
          availableResult = {
            data: [
              {
                id: '00000000-0000-4000-a000-000000000001',
                waste_type: 'plastic',
                coordinates: [5.672505, -0.280669],
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
                id: '00000000-0000-4000-a000-000000000002',
                waste_type: 'organic',
                coordinates: [5.6801, -0.2874],
                location: 'Osu, Accra',
                fee: 30,
                status: 'available',
                priority: 'high',
                bag_count: 1,
                special_instructions: 'Food waste and organic materials',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ]
          };
          
          acceptedResult = {
            data: [
              {
                id: '00000000-0000-4000-a000-000000000003',
                waste_type: 'paper',
                coordinates: [5.6644, -0.2656],
                location: 'Adabraka, Accra',
                fee: 25,
                status: 'accepted',
                priority: 'low',
                bag_count: 3,
                special_instructions: 'Old newspapers and cardboard',
                collector_id: user?.id,
                accepted_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
                updated_at: new Date().toISOString()
              }
            ]
          };
          
          pickedUpResult = { data: [] };
        } else {
          // OPTIMIZATION: Parallelize all Supabase queries for faster loading
          const [
            availableRes,
            acceptedRes, 
            pickedUpRes
          ] = await Promise.all([
            // PERFORMANCE: Skip available requests query if we have filtered data from Map
            filteredRequests.available && filteredRequests.available.length > 0 
              ? { data: filteredRequests.available } 
              : supabase
                .from('pickup_requests')
                .select('*')
                .eq('status', PickupRequestStatus.AVAILABLE)
                .order('created_at', { ascending: false }),
                
            // Get accepted requests
            supabase
              .from('pickup_requests')
              .select('*')
              .eq('collector_id', user?.id)
              .eq('status', PickupRequestStatus.ACCEPTED)
              .order('accepted_at', { ascending: false }),
              
            // Get picked up requests
            supabase
              .from('pickup_requests')
              .select('*')
              .eq('collector_id', user?.id)
              .eq('status', PickupRequestStatus.PICKED_UP)
              .order('accepted_at', { ascending: false })
          ]);
          
          availableResult = availableRes;
          acceptedResult = acceptedRes;
          pickedUpResult = pickedUpRes;
        }
        
        // Process results with TURBO mode
        console.log('⚡ TURBO: Processing request data');
        let availableRequests = [];
        let acceptedRequests = [];
        let pickedUpRequests = [];
        
        if (availableResult?.data) {
          // OPTIMIZATION: Use filtered data from Map if available
          if (filteredRequests.available && filteredRequests.available.length > 0) {
            console.log('⚡ TURBO: Using pre-filtered requests');
            availableRequests = filteredRequests.available;
          } else {
            availableRequests = transformRequestsData(availableResult.data);
          }
          
          // Update request cache for snappy UX
          requestAnimationFrame(() => {
            setRequestCache(prev => ({
              ...prev,
              available: {
                data: availableRequests,
                timestamp: Date.now()
              }
            }));
          });
        }
        
        if (acceptedResult?.data) {
          acceptedRequests = transformRequestsData(acceptedResult.data);
          // Update accepted requests cache
          requestAnimationFrame(() => {
            setRequestCache(prev => ({
              ...prev,
              accepted: {
                data: acceptedRequests,
                timestamp: Date.now()
              }
            }));
          });
        }
        
        if (pickedUpResult?.data) {
          pickedUpRequests = transformRequestsData(pickedUpResult.data);
          // Update picked-up requests cache
          requestAnimationFrame(() => {
            setRequestCache(prev => ({
              ...prev,
              completed: {
                data: pickedUpRequests,
                timestamp: Date.now()
              }
            }));
          });
        }

        // OPTIMIZATION: Batch state updates for better performance
        requestAnimationFrame(() => {
          setRequests({
            available: availableRequests,
            accepted: acceptedRequests,
            picked_up: pickedUpRequests
          });
          
          setIsLoading(false);
          setIsInitialLoading(false);
          setIsRefreshing(false);
          setLastUpdated(new Date());
          
          console.log('⚡ INSTANT: Request page data loaded');
        });
        
        // Cache removed - using direct database only
        // Update timestamp
        setLastUpdated(new Date());
      } else {
        // Offline: show error message
        setError('No internet connection. Please connect to the internet.');
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      setError('Failed to fetch requests. Please try again.');
      // Cache removed - no fallback available
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, [user?.id, filteredRequests, requestCache]);

  // Handle file upload for photo capture
  const handleFileChange = useCallback(async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file');
      }
      
      // Check file size (max 5MB)
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('Image size must be less than 5MB');
      }
      
      // Capture the photo
      await capturePhoto(file);
      
      setToast({
        show: true,
        message: 'Photo captured successfully',
        type: 'success',
        duration: 3000
      });
      
      // Reset file input to allow selecting the same file again
      event.target.value = '';
      
    } catch (error) {
      console.error('Error capturing photo:', error);
      setToast({
        show: true,
        message: error.message || 'Failed to capture photo',
        type: 'error',
        duration: 5000
      });
    }
  }, [capturePhoto]);
  
  // Handle photo removal
  const handleRemovePhoto = useCallback((photoId) => {
    try {
      removePhoto(photoId);
      setToast({
        show: true,
        message: 'Photo removed',
        type: 'info',
        duration: 3000
      });
    } catch (error) {
      console.error('Error removing photo:', error);
      setToast({
        show: true,
        message: 'Failed to remove photo',
        type: 'error',
        duration: 5000
      });
    }
  }, [removePhoto]);
  
  // Cleanup on component unmount or when requestId changes
  useEffect(() => {
    return () => {
      // Cleanup blob URLs when component unmounts or requestId changes
      // The actual cleanup is handled by the usePhotoCapture hook
      if (process.env.NODE_ENV === 'development') {
        console.log('🧹 Cleaning up photo resources in Request component');
      }
    };
  }, [requestId]);
  
  // Handle request acceptance with smart request type detection
  const handleAcceptRequest = useCallback(async (requestId, showToasts = true) => {
    try {
      // Find the request in the available list
      const requestToAccept = requests.available.find(req => req.id === requestId);
      
      if (!requestToAccept) {
        showToast('Request not found', 'error');
        return;
      }

      // Check if this is a temporary ID
      if (requestId.startsWith('temp-')) {
        showToast('Cannot accept temporary requests. Please wait for the data to sync.', 'error');
        return;
      }

      // Determine if this is a pickup request or authority assignment
      const isPickupRequest = !requestToAccept.authority_id;

      // Special handling for DEV_MODE mock requests
      if (DEV_MODE && isPickupRequest) {
        console.log('🔧 DEV_MODE: Handling mock request acceptance locally');
        
        // Handle mock acceptance in DEV_MODE without database operations
        const updatedRequest = {
          ...requestToAccept,
          status: PickupRequestStatus.ACCEPTED,
          accepted_at: new Date().toISOString(),
          collector_id: user?.id
        };
        
        // Update local state only
        const newAvailable = requests.available.filter(req => req.id !== requestId);
        const newAccepted = [...requests.accepted, updatedRequest];
        
        setRequests({
          ...requests,
          available: newAvailable,
          accepted: newAccepted
        });
        
        // Update cache for offline support
        saveToCache(CACHE_KEYS.ALL_REQUESTS, {
          ...requests,
          available: newAvailable,
          accepted: newAccepted
        });
        
        if (showToasts) {
          showToast(`Successfully accepted ${requestToAccept.waste_type || requestToAccept.type} pickup in DEV_MODE!`, 'success');
          setActiveTab('accepted');
        }
        return;
      }
      
      // Normal database operations for non-DEV_MODE or authority assignments
      let result;
      if (isPickupRequest) {
        // Use requestManager for pickup requests
        result = await requestManager.acceptRequest(requestId, user?.id);
      } else {
        // Direct Supabase call for authority assignments
        result = await supabase
          .from('authority_assignments')
          .update({ 
            status: AssignmentStatus.ACCEPTED,
            collector_id: user?.id,
            accepted_at: new Date().toISOString()
          })
          .eq('id', requestId);
      }

      if (result?.error) {
        // Handle specific error cases
        if (result.error.code === '22P02') {
          console.error('UUID validation error:', result.error);
          showToast('Invalid request ID format. This request may be test data.', 'error');
          
          // Force a cache reset to ensure no problematic IDs persist
          localStorage.setItem('force_cache_reset', 'true');
          
          // Refresh the list to show current state after a short delay
          setTimeout(() => {
            fetchRequests();
          }, 1000);
          
          return;
        }
        throw result.error;
      }
      
      // Update the status
      const updatedRequest = {
        ...requestToAccept,
        status: isPickupRequest ? PickupRequestStatus.ACCEPTED : AssignmentStatus.ACCEPTED,
        accepted_at: new Date().toISOString(),
        collector_id: user?.id
      };
      
      // Remove from available list
      const newAvailable = requests.available.filter(req => req.id !== requestId);
      
      // Add to accepted list
      const newAccepted = [...requests.accepted, updatedRequest];
      
      // Update state
      const updatedRequests = {
        ...requests,
        available: newAvailable,
        accepted: newAccepted
      };
      
      setRequests(updatedRequests);
      
      // Update cache
      saveToCache(CACHE_KEYS.ALL_REQUESTS, updatedRequests);
      
      // Show success toast and switch tab only if showToasts is true
      if (showToasts) {
        showToast(`Successfully accepted ${requestToAccept.type || requestToAccept.waste_type} ${isPickupRequest ? 'pickup' : 'assignment'}!`, 'success');
        // Switch to accepted tab
        setActiveTab('accepted');
      }
    } catch (err) {
      console.error('Error accepting request:', err);
      if (err?.message?.includes('already accepted') || err?.message?.includes('reservation expired')) {
        showToast(err.message, 'error');
        // Refresh the list to show current state
        fetchRequests();
      } else {
        showToast('Failed to accept request. Please try again.', 'error');
      }
    }
  }, [requests, user?.id, showToast, setActiveTab, fetchRequests]);
  
  // Filters and filtered requests are now declared at the top of the component

  // Format date to show in the format shown in screenshots
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Format date to show in the format shown in screenshots

  // Default disposal center coordinates
  const DISPOSAL_CENTER = {
    lat: -1.2921, // Example coordinates for Accra Recycling Center
    lng: 36.8219
  };

  // OPTIMIZATION: Memoized distance calculator to avoid redundant calculations
  const calculateDistance = useCallback((coord1, coord2) => {
    if (!coord1 || !coord2 || !coord1.lat || !coord1.lng || !coord2.lat || !coord2.lng) {
      return 999999; // Return large number for invalid coordinates
    }
    
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  }, []); // Empty dependency array since calculation is pure



  // OPTIMIZATION: Handle tab change with memoization to avoid unnecessary operations
  const handleTabChange = useCallback((tab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      // Only track tab changes, don't refetch data unnecessarily
      console.log('Tab changed to:', tab);
    }
  }, [activeTab]);

  // OPTIMIZATION: Handle refresh with loading state management
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchRequests().finally(() => setIsRefreshing(false));
  }, [fetchRequests]);

  // Format last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    
    const now = new Date();
    const diff = Math.floor((now - lastUpdated) / 1000); // difference in seconds
    
    if (diff < 60) {
      return `${diff} seconds ago`;
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} minutes ago`;
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} hours ago`;
    } else {
      return `${Math.floor(diff / 86400)} days ago`;
    }
  };

  // Initial data fetch
  useEffect(() => {
    // Initialize requestManager with current user ID
    if (user?.id) {
      requestManager.initialize(user.id)
        .then(() => console.log('RequestManager initialized successfully'))
        .catch(err => console.error('Failed to initialize RequestManager:', err));
    }
    
    // This runs when the component mounts
    // Get requests and set up listeners
    fetchRequests();
    
    // Add real-time subscription for assignments and connectivity listeners
    let subscription = null;
    let unregister = null;

    const setupSubscription = async () => {
      try {
        // Set up connectivity listeners
        const connectivityListeners = await registerConnectivityListeners((isOnline) => {
          setIsOnlineStatus(isOnline);
          if (isOnline) {
            fetchRequests();
          }
        });
        unregister = connectivityListeners?.unregister || null;

        // Skip real-time subscription in DEV_MODE to avoid API errors
        if (DEV_MODE) {
          console.log('[DEV MODE] Skipping real-time subscription setup');
          return;
        }

        // Set up real-time subscription
        subscription = supabase
          .channel('pickup_requests_changes')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'pickup_requests'
          }, async (payload) => {
            if (!payload) {
              console.error('Received empty payload in real-time subscription');
              return;
            }

            const { eventType, new: newRecord } = payload;
            if (!eventType || !newRecord) {
              console.error('Invalid payload structure in real-time subscription', { eventType, newRecord });
              return;
            }

            // Refresh requests when changes occur
            await fetchRequests();
          })
          .subscribe();
      } catch (error) {
        console.error('Error setting up subscription:', error);
        showToast('Failed to set up real-time updates', 'error');
      }
    };

    // Set up subscription when component mounts
    setupSubscription();

    // Cleanup function
    return () => {
      // Clean up subscription if it exists
      if (subscription) {
        try {
          supabase.removeChannel(subscription);
        } catch (error) {
          console.error('Error removing subscription channel:', error);
        }
      }

      // Clean up connectivity listeners if unregister function exists
      if (unregister && typeof unregister === 'function') {
        try {
          unregister();
        } catch (error) {
          console.error('Error unregistering connectivity listeners:', error);
        }
      }
    };
  }, [user?.id, fetchRequests]);

  // Handle opening directions with in-app navigation
  const handleOpenDirections = (requestId, location) => {
    // Find the request to get GPS coordinates
    let request = null;
    
    // Search in all request arrays
    if (requests.available) {
      request = requests.available.find(req => req && req.id === requestId);
    }
    if (!request && requests.accepted) {
      request = requests.accepted.find(req => req && req.id === requestId);
    }
    if (!request && requests.picked_up) {
      request = requests.picked_up.find(req => req && req.id === requestId);
    }
    
    if (request && request.coordinates) {
      // Parse coordinates from various formats
      let lat, lng;
      
      // Handle array format [lat, lng]
      if (Array.isArray(request.coordinates) && request.coordinates.length >= 2) {
        lat = request.coordinates[0];
        lng = request.coordinates[1];
      }
      // Handle object format {lat: x, lng: y} or {latitude: x, longitude: y}
      else if (typeof request.coordinates === 'object' && request.coordinates !== null) {
        lat = request.coordinates.lat || request.coordinates.latitude;
        lng = request.coordinates.lng || request.coordinates.longitude;
      }
      // Handle PostGIS POINT format "POINT(lng lat)"
      else if (typeof request.coordinates === 'string') {
        const pointMatch = request.coordinates.match(/POINT\(([+-]?\d+\.?\d*) ([+-]?\d+\.?\d*)\)/);
        if (pointMatch) {
          lng = parseFloat(pointMatch[1]); // longitude first in PostGIS
          lat = parseFloat(pointMatch[2]);  // latitude second
        }
      }
      
      // If we have valid coordinates, open in-app navigation
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        setNavigationDestination([lat, lng]);
        setNavigationRequestId(requestId);
        setShowNavigationModal(true);
        showToast(`Opening in-app navigation to pickup location`, 'info');
      } else {
        // Fallback to external navigation if coordinates are invalid
        const fallbackUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(location || 'pickup location')}`;
        window.open(fallbackUrl, '_blank');
        showToast(`Opening directions to ${location || 'pickup location'}`, 'info');
      }
    } else {
      // Fallback to external navigation if no request found or no coordinates
      const fallbackUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(location || 'pickup location')}`;
      window.open(fallbackUrl, '_blank');
      showToast(`Opening directions to ${location || 'pickup location'}`, 'info');
    }
  };

  // Handle QR scan - Optimized for better performance
  const handleScanQR = async (requestId, scannedBags) => {
    const startTime = performance.now();
    
    try {
      // Fast validation with early returns
      if (!requestId) {
        showToast('Invalid request ID', 'error');
        return;
      }
      
      if (!scannedBags || !Array.isArray(scannedBags) || scannedBags.length === 0) {
        showToast('No valid scan data found', 'error');
        return;
      }

      // Fast array validation
      if (!requests.accepted?.length) {
        showToast('No accepted requests found', 'error');
        return;
      }
      
      // Use findIndex for single pass lookup
      const requestIndex = requests.accepted.findIndex(req => req?.id === requestId);
      if (requestIndex === -1) {
        showToast('Request not found in accepted list', 'error');
        return;
      }
      
      // Get the current request reference
      const currentRequest = requests.accepted[requestIndex];
      
      // Fast calculation using reduce with optimized access
      const { totalPoints, totalFee } = scannedBags.reduce(
        (acc, bag) => {
          acc.totalPoints += bag?.points || 0;
          acc.totalFee += bag?.fee || 0;
          return acc;
        },
        { totalPoints: 0, totalFee: 0 }
      );
      
      // Optimized state update using functional update pattern
      setRequests(prevRequests => {
        const newAccepted = [...prevRequests.accepted];
        newAccepted[requestIndex] = {
          ...currentRequest,
          scanned_bags: scannedBags,
          points: totalPoints,
          fee: totalFee.toFixed(2)
        };
        
        return {
          ...prevRequests,
          accepted: newAccepted
        };
      });
      
      // Async cache operations (don't block UI)
      Promise.resolve().then(() => {
        try {
          // Cache the scanned bags
          saveToCache(`${CACHE_KEYS.REQUEST_SCANNED_BAGS}_${requestId}`, scannedBags);
          
          // Process earnings transaction asynchronously
          const latestBag = scannedBags[scannedBags.length - 1];
          if (latestBag && user?.id) {
            const transaction = {
              user_id: user.id,
              type: 'pickup_request',
              amount: latestBag.fee || 0,
              points: latestBag.points || 0,
              date: new Date().toISOString(),
              note: `${latestBag.type || 'Unknown'} waste (${latestBag.weight || 0} kg)`,
              request_id: requestId,
              bag_id: latestBag.id
            };
            
            // Batch localStorage operations
            const updates = [];
            
            // Update transactions
            try {
              const existingTransactions = JSON.parse(localStorage.getItem('earnings_transactions') || '[]');
              existingTransactions.push(transaction);
              updates.push(['earnings_transactions', JSON.stringify(existingTransactions)]);
            } catch (e) {
              console.warn('Failed to update earnings transactions:', e);
            }
            
            // Update user stats
            try {
              const statsKey = `user_stats_${user.id}`;
              const existingStats = JSON.parse(localStorage.getItem(statsKey) || JSON.stringify({
                user_id: user.id,
                today_earnings: 0,
                today_points: 0,
                total_earnings: 0,
                total_points: 0,
                last_updated: new Date().toISOString()
              }));
              
              existingStats.today_earnings = (existingStats.today_earnings || 0) + (latestBag.fee || 0);
              existingStats.today_points = (existingStats.today_points || 0) + (latestBag.points || 0);
              existingStats.total_earnings = (existingStats.total_earnings || 0) + (latestBag.fee || 0);
              existingStats.total_points = (existingStats.total_points || 0) + (latestBag.points || 0);
              existingStats.last_updated = new Date().toISOString();
              
              updates.push([statsKey, JSON.stringify(existingStats)]);
            } catch (e) {
              console.warn('Failed to update user stats:', e);
            }
            
            // Batch write to localStorage
            updates.forEach(([key, value]) => {
              try {
                localStorage.setItem(key, value);
              } catch (e) {
                console.warn(`Failed to write ${key} to localStorage:`, e);
              }
            });
          }
        } catch (error) {
          console.warn('Background processing failed:', error);
        }
      });
      
      const processingTime = performance.now() - startTime;
      console.log(`⚡ QR scan processed in ${processingTime.toFixed(2)}ms`);
      
      showToast(
        `✅ Scanned ${scannedBags.length} bag${scannedBags.length > 1 ? 's' : ''} • ${totalPoints} points • $${totalFee.toFixed(2)}`, 
        'success'
      );
    } catch (err) {
      console.error('Error updating scanned bags:', err);
      showToast('Failed to update scanned bags. Please try again.', 'error');
    }
  };

  // Handle complete pickup
  const handleCompletePickup = async (requestId, scannedBags) => {
    try {
      // Find the request
      const requestToComplete = requests.accepted.find(req => req.id === requestId);
      
      if (!requestToComplete) {
        showToast('Request not found', 'error');
        return;
      }
      
      // Show processing toast
      showToast('Processing your request...', 'info');
      
      // Calculate environmental impact
      const environmentalImpact = {
        plastic_saved: Math.floor(Math.random() * 5) + 1,
        co2_reduced: (Math.random() * 10 + 5).toFixed(2),
        water_saved: Math.floor(Math.random() * 100) + 50
      };
      
      // Calculate completion bonus (10% of total bag fees)
      const totalBagFees = scannedBags.reduce((sum, bag) => sum + bag.fee, 0);
      const completionBonus = totalBagFees * 0.1;
      const totalEarnings = totalBagFees + completionBonus;
      
      // Check if the request ID is a valid UUID (for Supabase) or a custom format (for demo/local data)
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId);
      
      if (isValidUuid) {
        // Update assignment in Supabase only if it's a valid UUID
        const { error: assignmentError } = await supabase
          .from('pickup_requests')
          .update({ 
            status: PickupRequestStatus.PICKED_UP,
            picked_up_at: new Date().toISOString()
            // Removed non-existent columns: scanned_bags, environmental_impact, completion_bonus, total_earnings
          })
          .eq('id', requestId);
        
        if (assignmentError) throw assignmentError;
      } else {
        // For non-UUID IDs (like A-42861), we'll only update the local state
        // This is for demo/test data that doesn't exist in the database
        console.log(`Skipping database update for non-UUID request ID: ${requestId} (using local state only)`); 
      }
      
      // Store additional data in localStorage since they don't exist in the schema
      try {
        const pickupData = JSON.parse(localStorage.getItem(`pickup_data_${requestId}`) || '{}');
        pickupData.scanned_bags = scannedBags;
        pickupData.environmental_impact = environmentalImpact;
        pickupData.completion_bonus = completionBonus;
        pickupData.total_earnings = totalEarnings;
        localStorage.setItem(`pickup_data_${requestId}`, JSON.stringify(pickupData));
      } catch (localStorageError) {
        console.error('Error storing pickup data in localStorage:', localStorageError);
      }
      
      // Create completion bonus transaction
      const bonusTransaction = {
        user_id: user?.id,
        type: 'completion_bonus',
        amount: completionBonus,
        points: Math.floor(completionBonus * 5), // 5 points per cedi as bonus
        date: new Date().toISOString(),
        note: `Completion bonus for pickup #${requestId}`,
        request_id: requestId
      };
      
      // Note: The earnings_transactions table doesn't exist in the schema
      // Instead of trying to insert into a non-existent table, we'll store bonus transaction locally
      // Log the bonus transaction for debugging purposes
      console.log('Bonus transaction (not saved to DB):', bonusTransaction);
      
      // Store transaction in localStorage for persistence across sessions
      try {
        // Get existing transactions or initialize empty array
        const existingTransactions = JSON.parse(localStorage.getItem('earnings_transactions') || '[]');
        // Add new bonus transaction
        existingTransactions.push(bonusTransaction);
        // Save back to localStorage
        localStorage.setItem('earnings_transactions', JSON.stringify(existingTransactions));
      } catch (localStorageError) {
        console.error('Error storing bonus transaction in localStorage:', localStorageError);
      }
      
      // Note: The user_stats table exists but doesn't have the columns we're trying to update
      // Instead of trying to update non-existent columns, we'll store stats locally
      
      // Store user stats in localStorage for persistence across sessions
      try {
        // Get existing stats or initialize with defaults
        const existingStats = JSON.parse(localStorage.getItem(`user_stats_${user?.id}`) || JSON.stringify({
          user_id: user?.id,
          today_earnings: 0,
          today_points: 0,
          total_earnings: 0,
          total_points: 0,
          last_updated: new Date().toISOString()
        }));
        
        // Update stats with completion bonus
        existingStats.today_earnings = (existingStats.today_earnings || 0) + completionBonus;
        existingStats.today_points = (existingStats.today_points || 0) + Math.floor(completionBonus * 5);
        existingStats.total_earnings = (existingStats.total_earnings || 0) + completionBonus;
        existingStats.total_points = (existingStats.total_points || 0) + Math.floor(completionBonus * 5);
        existingStats.last_updated = new Date().toISOString();
        
        // Save back to localStorage
        localStorage.setItem(`user_stats_${user?.id}`, JSON.stringify(existingStats));
        
        // Log the updated stats for debugging
        console.log('Updated user stats with bonus (stored in localStorage):', existingStats);
      } catch (statsError) {
        console.error('Error updating user stats with bonus in localStorage:', statsError);
      }
      
      // Update the status
      const updatedRequest = {
        ...requestToComplete,
        status: PickupRequestStatus.PICKED_UP,
        picked_up_at: new Date().toISOString(),
        scanned_bags: scannedBags,
        environmental_impact: environmentalImpact,
        completion_bonus: completionBonus,
        total_earnings: totalEarnings
      };
      
      // Remove from accepted list
      const newAccepted = requests.accepted.filter(req => req.id !== requestId);
      
      // Add to picked up list
      const newPickedUp = [...requests.picked_up, updatedRequest];
      
      // Update state
      const updatedRequests = {
        ...requests,
        accepted: newAccepted,
        picked_up: newPickedUp
      };
      
      setRequests(updatedRequests);
      
      // Update cache
      saveToCache(CACHE_KEYS.ALL_REQUESTS, updatedRequests);
      
      // Show success toast with bonus info
      showToast(
        `Successfully completed pickup! Earned ₵${completionBonus.toFixed(2)} bonus for ${scannedBags.length} bags.`,
        'success'
      );
      
      // Switch to picked up tab
      setActiveTab('picked_up');
    } catch (err) {
      console.error('Error completing pickup:', err);
      showToast('Failed to complete pickup. Please try again.', 'error');
    }
  };

// Geofence Error Modal Component
const GeofenceErrorModal = ({ 
  isOpen, 
  onClose, 
  onRetry, 
  onBypass, 
  locationError,
  onLocateSite
}) => {
  if (!isOpen) return null;
  
  // Handle retry location
  const handleRetry = () => {
    if (onRetry) onRetry();
  };
  
  // Handle bypass for testing
  const handleBypass = () => {
    if (onBypass) onBypass();
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-red-600">Location Restriction</h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center justify-center mb-4 text-red-500">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          
          <p className="text-center text-lg font-medium mb-2">Location Restriction</p>
          <p className="text-center mb-4">You must be within 50 meters of the disposal center to dispose bags.</p>
          
          {locationError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-sm text-red-600 font-medium">Error: {locationError}</p>
              <p className="text-sm text-gray-600 mt-1">Please enable location services in your browser settings.</p>
              
              {locationError.includes('timeout') && (
                <div className="mt-2 pt-2 border-t border-red-100">
                  <p className="text-sm text-gray-700">Location request timed out. This could be due to:</p>
                  <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                    <li>Poor GPS signal</li>
                    <li>Browser location permissions not granted</li>
                    <li>Device location services disabled</li>
                  </ul>
                </div>
              )}
              
              <button 
                onClick={handleRetry}
                className="w-full mt-2 bg-red-100 hover:bg-red-200 text-red-700 py-1 px-2 rounded text-sm"
              >
                Retry Location Detection
              </button>
            </div>
          )}
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-600">Please move closer to the disposal center and try again.</p>
            <p className="text-sm text-gray-600 mt-1">The disposal center is located at: <strong>Accra Recycling Center, Ring Road</strong></p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-end gap-2">
          {onLocateSite && (
            <button 
              onClick={onLocateSite}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md"
            >
              Get Directions
            </button>
          )}
          
          <button 
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md"
          >
            Close
          </button>
          
          {onBypass && (
            <button 
              onClick={handleBypass}
              className="w-full mt-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 py-1 px-2 rounded text-xs border border-yellow-300"
            >
              Bypass Location Check (Testing Only)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Handle locate site
const handleLocateSite = (requestId) => {
  // Find the request
  const request = requests.picked_up.find(req => req.id === requestId);
  
  if (!request) {
    showToast('Request not found', 'error');
    return;
  }
  
  // In a real app, this would locate the nearest disposal site
  // For this simulation, we'll just show a toast and simulate opening Google Maps
  const disposalSite = 'Accra Recycling Center, Ring Road';
  
  showToast(`Locating nearest disposal site: ${disposalSite}`, 'info');
  
  // Get the scanned bags from the request
  const scannedBags = request.scanned_bags || [];
  
  // Calculate completion bonus (10% of total bag fees)
  const totalBagFees = scannedBags.reduce((sum, bag) => sum + (bag.fee || 0), 0);
  const completionBonus = totalBagFees * 0.1;
  const totalEarnings = totalBagFees + completionBonus;
  
  // State for location handling
  const [bypassLocationCheck, setBypassLocationCheck] = useState(false);
  const [locationFetchInProgress, setLocationFetchInProgress] = useState(false);
  const [locationFetchAttempts, setLocationFetchAttempts] = useState(0);
  const [locationError, setLocationError] = useState(null);
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);

  // Check if user is within range of disposal center
  const isWithinDisposalRange = (userCoords) => {
    // If bypass is enabled, always return true (for testing)
    if (bypassLocationCheck) return true;
    
    if (!userCoords) return false;
    const distance = calculateDistance(userCoords, DISPOSAL_CENTER);
    // Convert km to meters (50m = 0.05km)
    return distance <= 0.05;
  };

  // Update user location with improved error handling
  const updateUserLocation = () => {
    // Don't start another location request if one is already in progress
    if (locationFetchInProgress) return;
    
    if (navigator.geolocation) {
      setLocationFetchInProgress(true);
      setLocationFetchAttempts(prev => prev + 1);
      
      // Use a less aggressive timeout for better success rate
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(userCoords);
          setLocationError(null);
          setLocationFetchInProgress(false);
          setLocationFetchAttempts(0); // Reset attempts on success
          
          // Check if we're in range after getting location
          if (isWithinDisposalRange(userCoords)) {
            setShowGeofenceModal(false);
          } else {
            setShowGeofenceModal(true);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationError(error.message || 'Unable to get your location');
          setLocationFetchInProgress(false);
          setShowGeofenceModal(true);
          
          // Only show toast on first few errors to avoid spamming
          if (locationFetchAttempts <= 2) {
            let errorMsg = 'Unable to get your location.';
            
            if (error.code === 1) { // PERMISSION_DENIED
              errorMsg = 'Location permission denied. Please enable location services.';
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
              errorMsg = 'Location information is unavailable. Please try again later.';
            } else if (error.code === 3) { // TIMEOUT
              errorMsg = 'Location request timed out. Please try again or check your connection.';
            }
            
            showToast(errorMsg, 'error', 8000);
          }
        },
        { 
          enableHighAccuracy: locationFetchAttempts < 2, // Try high accuracy first, then fall back
          timeout: locationFetchAttempts > 2 ? 60000 : 15000, // Increase timeout after multiple attempts
          maximumAge: locationFetchAttempts > 1 ? 60000 : 0 // Allow cached positions after first attempt
        }
      );
    } else {
      setLocationError('Geolocation is not supported by this browser');
      showToast('Geolocation is not supported by this browser.', 'error', 8000);
      setShowGeofenceModal(true);
    }
  };

  // Update location periodically
  useEffect(() => {
    // Get location immediately on component mount
    updateUserLocation();
    
    // Then update every 30 seconds
    const locationInterval = setInterval(updateUserLocation, 30000);
    
    return () => clearInterval(locationInterval);
  }, []);
  
  // Handle retry location
  const handleRetryLocation = () => {
    // Reset location fetch attempts to start fresh
    setLocationFetchAttempts(0);
    setLocationFetchInProgress(false);
    // Try to get location again
    updateUserLocation();
  };
  
  // Handle bypass for testing
  const handleBypassForTesting = () => {
    setBypassLocationCheck(true);
    setShowGeofenceModal(false);
    showToast('Location check bypassed for testing', 'success');
  };
  
  // Handle open directions in maps
  const handleOpenDirections = () => {
    // Open Google Maps with directions to disposal site
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${DISPOSAL_CENTER.lat},${DISPOSAL_CENTER.lng}&travelmode=driving`;
    window.open(mapsUrl, '_blank');
  };

  return (
    <GeofenceErrorModal 
      isOpen={showGeofenceModal}
      onClose={() => setShowGeofenceModal(false)}
      onRetry={handleRetryLocation}
      onBypass={handleBypassForTesting}
      locationError={locationError}
      onLocateSite={handleOpenDirections}
    />
  );
};

  // Handle dispose bag
  const handleDisposeBag = async (requestId) => {
    // Check if user is within range of disposal center
    if (!isWithinDisposalRange(userLocation)) {
      // Show modal instead of toast for better visibility
      setGeofenceModalOpen(true);
      return;
    }
    try {
      // Validate input
      if (!requestId) {
        console.error('Invalid requestId in handleDisposeBag:', requestId);
        showToast('Invalid request data', 'error');
        return;
      }

      // Ensure requests.picked_up exists and is an array
      if (!requests.picked_up || !Array.isArray(requests.picked_up)) {
        console.error('requests.picked_up is not an array:', requests.picked_up);
        showToast('Error accessing request data. Please refresh the page.', 'error');
        return;
      }
      
      // Find the request
      const requestIndex = requests.picked_up.findIndex(req => req && req.id === requestId);
      
      if (requestIndex === -1) {
        showToast('Request not found', 'error');
        return;
      }
      
      // Show processing toast
      showToast('Processing disposal...', 'info');
      
      // Generate disposal details
      const disposalSite = 'Accra Recycling Center, Ring Road';
      const disposalTimestamp = new Date().toISOString();
      
      // Get the request with safe access
      const request = requests.picked_up[requestIndex];
      if (!request) {
        console.error('Request at index not found:', requestIndex);
        showToast('Error processing request. Please try again.', 'error');
        return;
      }
      
      // Update environmental impact with safe access
      const existingImpact = request.environmental_impact || {};
      const environmentalImpact = {
        ...existingImpact,
        trees_saved: Math.floor(Math.random() * 3) + 1,
        landfill_reduced: Math.floor(Math.random() * 20) + 5
      };
      
      // Check if the request ID is a valid UUID (for Supabase) or a custom format (for demo/local data)
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId);
      
      if (isValidUuid) {
        // Update Supabase only if it's a valid UUID
        try {
          const { error } = await supabase
            .from('pickup_requests') // Use pickup_requests table instead of authority_assignments
            .update({ 
              // Only include fields that exist in the schema
              disposal_site: disposalSite,
              disposal_timestamp: disposalTimestamp
              // Removed non-existent columns: disposal_complete, environmental_impact
            })
            .eq('id', requestId);
          
          if (error) {
            console.error('Error updating disposal details:', error);
            showToast('Failed to update disposal details. Please try again.', 'error');
            return;
          }
        } catch (updateError) {
          console.error('Error updating disposal details:', updateError);
          showToast('Failed to update disposal details. Please try again.', 'error');
          return;
        }
      } else {
        // For non-UUID IDs (like A-42861), we'll only update the local state
        // This is for demo/test data that doesn't exist in the database
        console.log(`Skipping database update for non-UUID request ID: ${requestId} (using local state only for disposal)`); 
      }
      
      // Update request
      const updatedRequest = {
        ...requests.picked_up[requestIndex],
        disposal_complete: true,
        disposal_site: disposalSite,
        disposal_timestamp: disposalTimestamp,
        environmental_impact: environmentalImpact
      };
      
      // Update state
      const newPickedUp = [...requests.picked_up];
      newPickedUp[requestIndex] = updatedRequest;
      
      const updatedRequests = {
        ...requests,
        picked_up: newPickedUp
      };
      
      setRequests(updatedRequests);
      
      // Update cache
      saveToCache(CACHE_KEYS.ALL_REQUESTS, updatedRequests);
      
      // Show success toast
      showToast('Successfully disposed bags!', 'success');
    } catch (err) {
      console.error('Error disposing bags:', err);
      showToast('Failed to dispose bags. Please try again.', 'error');
    }
  };

  // Handle view report
  const handleViewReport = async (requestId) => {
    try {
      // Find the request
      const requestIndex = requests.picked_up.findIndex(req => req.id === requestId);
      
      if (requestIndex === -1) {
        showToast('Request not found', 'error');
        return;
      }
      
      // Show the request details modal with the report tab active
      const request = requests.picked_up[requestIndex];
      setDetailModalData(request);
      
      showToast('Viewing disposal report', 'success');
    } catch (err) {
      console.error('Error viewing report:', err);
      showToast('Failed to view report', 'error');
    }
  };

  // View details functionality removed as per requirements
  
  // State for geofence modal
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);

  // Add real-time subscription for assignments and connectivity listeners
  useEffect(() => {
    if (!user?.id) return;

    let subscription = null;
    let unregister = null;
    const setupSubscription = async () => {
      try {
        // Set up connectivity listeners
        const connectivityListeners = await registerConnectivityListeners((isOnline) => {
          setIsOnlineStatus(isOnline);
          if (isOnline) {
            fetchRequests();
          }
        });
        unregister = connectivityListeners?.unregister || null;

        // Set up real-time subscription
        subscription = supabase
          .channel('pickup_requests_changes')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'pickup_requests'
          }, async (payload) => {
            try {
              if (!payload) {
                console.error('Received empty payload in real-time subscription');
                return;
              }
              
              const { eventType, new: newRecord, old: oldRecord } = payload;
              
              if (!eventType || !newRecord) {
                console.error('Invalid payload structure in real-time subscription', { eventType, newRecord });
                return;
              }
              
              // Handle different event types
              switch (eventType) {
                case 'INSERT':
                  if (newRecord.status === AssignmentStatus.AVAILABLE) {
                    // New available assignment
                    const newRequest = transformRequestsData([newRecord])[0];
                    setRequests(prev => ({
                      ...prev,
                      available: [...prev.available, newRequest]
                    }));
                    showToast('New pickup request available!', 'success');
                  }
                  break;
              
                case 'UPDATE':
                  // Handle status changes
                  if (oldRecord && newRecord) {
                    if (oldRecord.status === AssignmentStatus.AVAILABLE && 
                        newRecord.status === AssignmentStatus.ASSIGNED) {
                      
                      if (newRecord.collector_id === user?.id) {
                        // Current user accepted this request - already handled by handleAccept
                        // Nothing additional to do here
                      } else {
                        // Another user accepted this request - remove from available
                        setRequests(prev => ({
                          ...prev,
                          available: prev.available.filter(req => req.id !== newRecord.id)
                        }));
                        showToast('A pickup request was claimed by another collector', 'info');
                      }
                    }
                    
                    // Status changed from ASSIGNED to PICKED_UP
                    if (oldRecord.status === AssignmentStatus.ASSIGNED && 
                        newRecord.status === AssignmentStatus.PICKED_UP && 
                        newRecord.collector_id === user?.id) {
                      
                      // Move from accepted to picked_up list
                      const updatedRequest = transformRequestsData([newRecord])[0];
                      setRequests(prev => ({
                        ...prev,
                        accepted: prev.accepted.filter(req => req.id !== newRecord.id),
                        picked_up: [...prev.picked_up, updatedRequest]
                      }));
                    }
                  }
                  break;
                
                default:
                  console.log(`Unhandled event type: ${eventType}`);
                  break;
              }
            } catch (error) {
              console.error('Error handling subscription payload:', error);
              showToast('Error processing real-time update', 'error');
            }
          })
          .subscribe();
      } catch (error) {
        console.error('Error setting up subscription:', error);
        showToast('Failed to set up real-time updates', 'error');
      }
    };

    // Initial data fetch and subscription setup
    fetchRequests();
    setupSubscription();

    // Cleanup function
    return () => {
      if (subscription) {
        try {
          supabase.removeChannel(subscription);
        } catch (error) {
          console.error('Error removing subscription channel:', error);
        }
      }

      if (unregister && typeof unregister === 'function') {
        try {
          unregister();
        } catch (error) {
          console.error('Error unregistering connectivity listeners:', error);
        }
      }
    };
  }, [user?.id, fetchRequests]);

  return (
    <div className="app-container bg-gray-100 min-h-screen flex flex-col">
      <TopNavBar title="" />
      
      {/* Fixed Header Section */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md pt-16 pb-0">
        {/* Page Title */}
        <div className="px-4 pb-2">
          <h1 className="text-3xl font-bold text-black">Requests</h1>
        </div>
        
        {/* Tab Navigation - Fixed */}
        <div className="flex border-b bg-white text-black">
          <button 
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'available' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveTab('available')}
          >
            Available
          </button>
          <button 
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'accepted' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveTab('accepted')}
          >
            Accepted
          </button>
          <button 
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'picked_up' ? 'text-green-600 border-b-2 border-green-500' : 'text-gray-600'}`}
            onClick={() => setActiveTab('picked_up')}
          >
            Picked Up
          </button>
        </div>
        
        {/* Last Updated Info */}
        {lastUpdated && (
          <div className="text-xs text-gray-500 text-center py-2 bg-white">
            Last updated: {new Date(lastUpdated).toLocaleString()}
            <button 
              onClick={fetchRequests} 
              className="ml-2 text-green-600"
              disabled={isLoading}
            >
              ↻
            </button>
          </div>
        )}
      </div>
      
      {/* Scrollable Content Area - with padding to account for fixed header and tabs */}
      <main className="flex-1 overflow-y-auto pt-40 pb-20 px-4" style={{paddingTop: '13rem'}}>
        
        {/* Radius Filter and Multi-select controls removed - using Map page's radius setting instead */}
        
        {/* Toast notification */}
        {toast.show && (
          <div className={`fixed bottom-20 left-0 right-0 mx-auto w-5/6 p-4 rounded-md shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white text-center z-50`}>
            {toast.message}
            <button 
              onClick={hideToast}
              className="absolute top-1 right-1 text-white"
            >
              ×
            </button>
          </div>
        )}
        
        {/* Geofence Error Modal */}
        <GeofenceErrorModal 
          isOpen={geofenceModalOpen} 
          onClose={() => setGeofenceModalOpen(false)} 
        />
        
        {/* Requests List */}
        <div className="requests-container">
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="animate-spin h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full"></div>
                  <div className="animate-ping absolute inset-0 h-12 w-12 rounded-full border-2 border-green-400 opacity-30"></div>
                </div>
                <span className="text-gray-600 mt-4 font-medium">Loading requests...</span>
                <div className="mt-2 text-xs text-gray-500">{isOnlineStatus ? 'Fetching latest data' : 'Using cached data'}</div>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="text-red-500 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-1">Error loading requests</h3>
              <p className="text-gray-600 mb-4">{error.message}</p>
              <button 
                onClick={fetchRequests}
                className="px-4 py-2 bg-green-500 text-white rounded-md"
              >
                Try Again
              </button>
            </div>
          ) : activeTab === 'available' && requests.available.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No available requests at the moment.</p>
            </div>
          ) : activeTab === 'accepted' && requests.accepted.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">You haven't accepted any requests yet.</p>
            </div>
          ) : activeTab === 'picked_up' && requests.picked_up.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">You haven't picked up any requests yet.</p>
            </div>
          ) : (
            <>
              {activeTab === 'available' && (
                <div>
                  {/* Use filtered requests from Map page context */}
                  {Array.isArray(filteredRequests?.available) && filteredRequests.available.length > 0 ? (
                    filteredRequests.available.map(request => (
                      request && (
                        <MemoizedRequestCard 
                          key={`available-${request.id}`} 
                          request={request} 
                          onAccept={handleAcceptRequest}
                          onOpenDirections={handleOpenDirections}
                          selectable={false}
                          selected={false}
                          onSelect={() => {}}
                        />
                      )
                    ))
                  ) : filteredRequests?.available && filteredRequests.available.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <div className="mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                        </svg>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-1">No requests in your area</h3>
                      <p className="text-sm text-gray-500">Try adjusting the search radius or check back later</p>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      <div className="animate-pulse">Loading filtered requests...</div>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'accepted' && (
                <div>
                  {Array.isArray(requests.accepted) && requests.accepted.length > 0 ? (
                    requests.accepted.map(request => (
                      request && (
                        <RequestCard 
                          key={request.id || Math.random().toString()} 
                          request={request} 
                          onAccept={handleAcceptRequest}
                          onOpenDirections={handleOpenDirections}
                          onScanQR={handleScanQR}
                          onCompletePickup={handleCompletePickup}
                          onLocateSite={handleLocateSite}
                          onDisposeBag={handleDisposeBag}
                          onViewReport={handleViewReport}
                        />
                      )
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No accepted requests found
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'picked_up' && (
                <div>
                  {Array.isArray(requests.picked_up) && requests.picked_up.length > 0 ? (
                    requests.picked_up.map(request => (
                      request && (
                        <RequestCard 
                          key={request.id || Math.random().toString()} 
                          request={request} 
                          onAccept={handleAcceptRequest}
                          onOpenDirections={handleOpenDirections}
                          onScanQR={handleScanQR}
                          onCompletePickup={handleCompletePickup}
                          onLocateSite={handleLocateSite}
                          onDisposeBag={handleDisposeBag}
                          onViewReport={handleViewReport}
                        />
                      )
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No picked up requests found
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      <BottomNavBar activeTab="request" />
      
      {/* Toast Notification */}
      {toast.show && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />
      )}
      
      {/* Navigation Modal */}
      {showNavigationModal && navigationDestination && (
        <NavigationQRModal
          isOpen={showNavigationModal}
          onClose={() => setShowNavigationModal(false)}
          destination={navigationDestination}
          requestId={navigationRequestId}
          onQRScanned={(scannedValues) => {
            // Handle multiple scanned QR codes
            if (Array.isArray(scannedValues) && scannedValues.length > 0) {
              // Process all scanned items
              console.log(`Received ${scannedValues.length} scanned items:`, scannedValues);
              
              // Update the request with scanned items
              if (navigationRequestId) {
                // Here we would typically update the request with the scanned items
                // For now, we just show a success message
                showToast(`Successfully scanned ${scannedValues.length} items!`, 'success');
                
                // Find the request and update its state if needed
                let request = null;
                if (requests.accepted) {
                  request = requests.accepted.find(req => req && req.id === navigationRequestId);
                }
                
                if (request) {
                  // Here you could update the request with the scanned items
                  // For example: request.scannedItems = scannedValues;
                }
                
                // Close the modal
                setShowNavigationModal(false);
              } else {
                showToast('Error: No request ID associated with scan.', 'error');
              }
            } else {
              showToast('No items were scanned. Please try again.', 'warning');
            }
          }}
          expectedQRValue={navigationRequestId}
        />
      )}
      
      {/* Report Modal will be implemented separately */}
    </div>
  );
};

export default RequestPage;
