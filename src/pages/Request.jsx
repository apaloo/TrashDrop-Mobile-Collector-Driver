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
import DisposalModal from '../components/DisposalModal';
import DigitalBinPaymentModal from '../components/DigitalBinPaymentModal';
import Toast from '../components/Toast';

import { PickupRequestStatus, WasteType, AssignmentStatus } from '../utils/types';
import { transformRequestsData } from '../utils/requestUtils';
import { getCurrentLocation, getLocationWithRetry, isWithinRadius } from '../utils/geoUtils';
import { registerConnectivityListeners } from '../utils/offlineUtils';
import { supabase, authService } from '../services/supabase';
import usePhotoCapture from '../hooks/usePhotoCapture';
import { logger } from '../utils/logger';
import { initiateCollection } from '../services/paymentService';
import { disposeDigitalBin } from '../services/disposalService';

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

// CRITICAL: Navigation modal state persistence keys
const NAV_MODAL_STATE_KEY = 'trashdrop_nav_modal_state';
const NAV_MODAL_TIME_KEY = 'trashdrop_nav_modal_time';
const NAV_MODAL_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

// Helper: Save navigation modal state synchronously
const saveNavModalState = (state) => {
  try {
    if (state && state.isOpen) {
      localStorage.setItem(NAV_MODAL_STATE_KEY, JSON.stringify(state));
      localStorage.setItem(NAV_MODAL_TIME_KEY, Date.now().toString());
    } else {
      localStorage.removeItem(NAV_MODAL_STATE_KEY);
      localStorage.removeItem(NAV_MODAL_TIME_KEY);
    }
  } catch (e) {
    // localStorage might be full, ignore
  }
};

// Helper: Load navigation modal state synchronously
const loadNavModalState = () => {
  try {
    const stateStr = localStorage.getItem(NAV_MODAL_STATE_KEY);
    const timeStr = localStorage.getItem(NAV_MODAL_TIME_KEY);
    
    if (!stateStr || !timeStr) return null;
    
    // Check expiry (2 hours)
    const savedTime = parseInt(timeStr, 10);
    if (Date.now() - savedTime > NAV_MODAL_EXPIRY_MS) {
      localStorage.removeItem(NAV_MODAL_STATE_KEY);
      localStorage.removeItem(NAV_MODAL_TIME_KEY);
      return null;
    }
    
    return JSON.parse(stateStr);
  } catch (e) {
    return null;
  }
};

const RequestPage = () => {
  const { id: requestId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  
  // Access filter context - hooks must be called unconditionally
  const filterContext = useFilters();
  const { 
    filters = { searchRadius: 5, wasteTypes: ['All Types'], minPayment: 0, priority: 'all', activeFilter: 'all' }, 
    filteredRequests = { available: [], accepted: [], picked_up: [] }, 
    updateFilteredRequests = () => {} 
  } = filterContext || {};
  
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
  // CRITICAL: Initialize navigation modal state from localStorage (for app switch persistence)
  const savedNavState = useMemo(() => loadNavModalState(), []);
  const [showNavigationModal, setShowNavigationModal] = useState(savedNavState?.isOpen || false);
  const [navigationDestination, setNavigationDestination] = useState(savedNavState?.destination || null);
  const [navigationRequestId, setNavigationRequestId] = useState(savedNavState?.requestId || null);
  const [navigationWasteType, setNavigationWasteType] = useState(savedNavState?.wasteType || 'general');
  const [navigationSourceType, setNavigationSourceType] = useState(savedNavState?.sourceType || 'pickup_request');
  
  // Log restoration for debugging
  if (savedNavState?.isOpen) {
    logger.info('🔄 Restored navigation modal state:', savedNavState);
  }
  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [selectedDisposalCenter, setSelectedDisposalCenter] = useState(null);
  const [currentDisposalRequestId, setCurrentDisposalRequestId] = useState(null);
  
  // Visual guidance state for low-literacy users
  const [locatedSiteRequests, setLocatedSiteRequests] = useState(new Set()); // Track which requests have had sites located
  const [highlightRequestId, setHighlightRequestId] = useState(null); // Which request needs "Locate Site" highlight
  const [navigationStartedRequests, setNavigationStartedRequests] = useState(new Set()); // Track which requests have started navigation
  const [highlightDirectionsId, setHighlightDirectionsId] = useState(null); // Which request needs "Directions" highlight
  
  // Track requests where user has arrived at destination (for external QR scan button)
  const [arrivedRequests, setArrivedRequests] = useState(new Set());
  
  // Payment modal state (for digital bin client collection)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentPaymentBinId, setCurrentPaymentBinId] = useState(null);

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
  
  // CRITICAL: Save navigation modal state on visibility change (app backgrounding)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && showNavigationModal && navigationDestination) {
        // Save current navigation state when app goes to background
        saveNavModalState({
          isOpen: true,
          destination: navigationDestination,
          requestId: navigationRequestId,
          wasteType: navigationWasteType,
          sourceType: navigationSourceType
        });
        logger.debug('📱 Navigation modal state saved on background');
      }
    };
    
    const handlePageHide = () => {
      if (showNavigationModal && navigationDestination) {
        saveNavModalState({
          isOpen: true,
          destination: navigationDestination,
          requestId: navigationRequestId,
          wasteType: navigationWasteType,
          sourceType: navigationSourceType
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [showNavigationModal, navigationDestination, navigationRequestId, navigationWasteType, navigationSourceType]);
  
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
    logger.error('RequestPage Error:', error);
    setHasError(true);
    setErrorInfo(info);
    showToast('An error occurred. Please try refreshing the page.', 'error', 5000);
  };
  
  // Fetch requests from Supabase
  const fetchRequests = useCallback(async () => {
    try {
      // Clear cache if force reset flag is set (for debugging request issues)
      if (localStorage.getItem('force_cache_reset')) {
        localStorage.removeItem('force_cache_reset');
        setRequestCache({
          available: { data: [], timestamp: 0 },
          accepted: { data: [], timestamp: 0 },
          picked_up: { data: [], timestamp: 0 }
        });
        logger.debug('🔄 Cache reset due to force flag');
      }
      
      // SUPER-FAST: Show cached data immediately, then update in background
      if (requestCache.available.data.length > 0) {
        // Check if cached data contains valid request IDs (not temp or invalid)
        const validCachedData = requestCache.available.data.filter(req => 
          req.id && 
          !req.id.startsWith('temp-') && 
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.id)
        );
        
        if (validCachedData.length > 0) {
          logger.debug('⚡ INSTANT: Showing cached data immediately');
          setRequests(prev => ({
            ...prev,
            available: validCachedData
          }));
          setIsLoading(false);
        } else {
          logger.debug('🗑️ Clearing invalid cached data');
          setIsLoading(true);
        }
      } else {
        setIsLoading(true);
      }
      
      setError(null);
      
      // OPTIMIZATION: Extended cache for aggressive performance (2 minutes)
      const cacheTimestamp = requestCache.available.timestamp;
      const cacheAge = Date.now() - cacheTimestamp;
      const CACHE_DURATION = 120000; // 2 minutes for super-fast experience
      
      if (cacheAge < CACHE_DURATION && requestCache.available.data.length > 0) {
        logger.debug('⚡ CACHE HIT: Using extended cache, skipping API call');
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
        
        // Log fallback location usage
        if (location.isFallback && (!window.lastFallbackLog || Date.now() - window.lastFallbackLog > 300000)) {
          logger.warn('[Location] Using fallback location due to GPS unavailability');
          window.lastFallbackLog = Date.now();
        }
      } catch (error) {
        logger.error('Error getting location:', error);
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
      
      if (online) {
        let availableResult, acceptedResult, pickedUpResult;
        
        try {
          // Check if user is authenticated before making queries
          if (!user?.id) {
            logger.warn('User not authenticated, using empty data');
            availableResult = { data: [] };
            acceptedResult = { data: [] };
            pickedUpResult = { data: [] };
          } else {
            // OPTIMIZATION: Parallelize all Supabase queries for faster loading
            const [
              availableRes,
              acceptedRes, 
              pickedUpRes
            ] = await Promise.all([
              // TEMPORARY FIX: Always fetch from database to debug pickup request issue
              // TODO: Re-enable Map filtering optimization after fixing root cause
              Promise.all([
                    // Fetch pickup requests
                    supabase
                      .from('pickup_requests')
                      .select('*')
                      .eq('status', PickupRequestStatus.AVAILABLE)
                      .order('created_at', { ascending: false }),
                    // Fetch available digital bins only
                    supabase
                      .from('digital_bins')
                      .select(`
                        *,
                        bin_locations!location_id(
                          coordinates,
                          location_name
                        )
                      `)
                      .eq('status', 'available')
                      .order('created_at', { ascending: false })
                  ]).then(([pickupResult, binsResult]) => {
                    if (pickupResult.error) {
                      logger.warn('Pickup requests query failed:', pickupResult.error);
                    }
                    if (binsResult.error) {
                      logger.warn('Digital bins query failed:', binsResult.error);
                    }
                    
                    // DEBUG: Log raw data from database
                    logger.info('📊 DATABASE FETCH RESULTS:', {
                      pickupRequestsCount: pickupResult.data?.length || 0,
                      digitalBinsCount: binsResult.data?.length || 0,
                      pickupRequestsSample: pickupResult.data?.[0] || 'none',
                      digitalBinsSample: binsResult.data?.[0] || 'none'
                    });
                    
                    // Combine data and add source type identification
                    const pickupRequests = (pickupResult.data || []).map(item => ({
                      ...item,
                      source_type: 'pickup_request'
                    }));
                    
                    const digitalBins = (binsResult.data || []).map(item => ({
                      ...item,
                      source_type: 'digital_bin',
                      // Ensure digital bins have required fields for compatibility
                      status: item.status || 'available', // Use actual status from database
                      waste_type: item.waste_type || 'general', // Default waste type if not specified
                      fee: item.fee || 0, // Default fee if not specified
                      location: item.bin_locations?.location_name || 'Digital Bin Station' // Get location from joined table
                    }));
                    
                    logger.info('📦 PROCESSED DATA FOR REQUEST PAGE:', {
                      pickupRequestsCount: pickupRequests.length,
                      digitalBinsCount: digitalBins.length,
                      totalAvailable: pickupRequests.length + digitalBins.length
                    });
                    
                    return { data: [...pickupRequests, ...digitalBins] };
                  }),
                  
              // Get accepted requests (including digital bins)
              Promise.all([
                supabase
                  .from('pickup_requests')
                  .select('*')
                  .eq('collector_id', user?.id)
                  .eq('status', PickupRequestStatus.ACCEPTED)
                  .order('accepted_at', { ascending: false }),
                supabase
                  .from('digital_bins')
                  .select(`
                    *,
                    bin_locations!location_id(
                      coordinates,
                      location_name
                    )
                  `)
                  .eq('collector_id', user?.id)
                  .eq('status', 'accepted')
                  .order('created_at', { ascending: false })
              ]).then(([pickupResult, binsResult]) => {
                if (pickupResult.error) {
                  logger.warn('Accepted pickup requests query failed:', pickupResult.error);
                }
                if (binsResult.error) {
                  logger.warn('Accepted digital bins query failed:', binsResult.error);
                }
                
                const pickupRequests = (pickupResult.data || []).map(item => ({
                  ...item,
                  source_type: 'pickup_request'
                }));
                
                const digitalBins = (binsResult.data || []).map(item => ({
                  ...item,
                  source_type: 'digital_bin',
                  waste_type: item.waste_type || 'general',
                  fee: item.fee || 0,
                  location: item.bin_locations?.location_name || 'Digital Bin Station' // Get location from joined table
                }));
                
                return { data: [...pickupRequests, ...digitalBins] };
              }),
                
              // Get picked up requests (including digital bins)
              Promise.all([
                supabase
                  .from('pickup_requests')
                  .select('*')
                  .eq('collector_id', user?.id)
                  .eq('status', PickupRequestStatus.PICKED_UP)
                  .order('accepted_at', { ascending: false }),
                supabase
                  .from('digital_bins')
                  .select(`
                    *,
                    bin_locations!location_id(
                      coordinates,
                      location_name
                    )
                  `)
                  .eq('collector_id', user?.id)
                  .eq('status', 'picked_up')
                  .order('created_at', { ascending: false })
              ]).then(([pickupResult, binsResult]) => {
                if (pickupResult.error) {
                  logger.warn('Picked up pickup requests query failed:', pickupResult.error);
                }
                if (binsResult.error) {
                  logger.warn('Picked up digital bins query failed:', binsResult.error);
                }
                
                const pickupRequests = (pickupResult.data || []).map(item => ({
                  ...item,
                  source_type: 'pickup_request'
                }));
                
                const digitalBins = (binsResult.data || []).map(item => ({
                  ...item,
                  source_type: 'digital_bin',
                  waste_type: item.waste_type || 'general',
                  fee: item.fee || 0,
                  location: item.bin_locations?.location_name || 'Digital Bin Station' // Get location from joined table
                }));
                
                return { data: [...pickupRequests, ...digitalBins] };
              })
            ]);
            
            availableResult = availableRes;
            acceptedResult = acceptedRes;
            pickedUpResult = pickedUpRes;
          }
        } catch (error) {
          logger.error('Database query error:', error);
          showToast('Unable to load requests. Using offline mode.', 'error');
          
          // Fallback to empty data
          availableResult = { data: [] };
          acceptedResult = { data: [] };
          pickedUpResult = { data: [] };
        }
        
        // Process results with TURBO mode
        logger.debug('⚡ TURBO: Processing request data');
        let availableRequests = [];
        let acceptedRequests = [];
        let pickedUpRequests = [];
        
        if (availableResult?.data) {
          logger.debug('📊 Database query result:', {
            availableCount: availableResult.data.length,
            sampleData: availableResult.data.slice(0, 2),
            filteredCount: filteredRequests.available?.length || 0
          });
          
          // OPTIMIZATION: Use filtered data from Map if available
          if (filteredRequests.available && filteredRequests.available.length > 0) {
            logger.debug('⚡ TURBO: Using pre-filtered requests');
            availableRequests = filteredRequests.available;
          } else {
            availableRequests = transformRequestsData(availableResult.data);
          }
          
          logger.debug('📋 Final available requests to display:', availableRequests.length);
          
          // Update request cache for snappy UX - immediate update
          setRequestCache(prev => ({
            ...prev,
            available: {
              data: availableRequests,
              timestamp: Date.now()
            }
          }));
        }
        
        if (acceptedResult?.data) {
          acceptedRequests = transformRequestsData(acceptedResult.data);
          // Update accepted requests cache - immediate update
          setRequestCache(prev => ({
            ...prev,
            accepted: {
              data: acceptedRequests,
              timestamp: Date.now()
            }
          }));
        }
        
        if (pickedUpResult?.data) {
          pickedUpRequests = transformRequestsData(pickedUpResult.data);
          // Update picked-up requests cache - immediate update
          setRequestCache(prev => ({
            ...prev,
            completed: {
              data: pickedUpRequests,
              timestamp: Date.now()
            }
          }));
        }

        // Update all state immediately to prevent race conditions
        setRequests({
          available: availableRequests,
          accepted: acceptedRequests,
          picked_up: pickedUpRequests
        });
        
        setIsLoading(false);
        setIsInitialLoading(false);
        setIsRefreshing(false);
        setLastUpdated(new Date());
        
        logger.debug('⚡ INSTANT: Request page data loaded');
      } else {
        // Offline: show error message
        setError('No internet connection. Please connect to the internet.');
      }
      
      setIsLoading(false);
      setIsInitialLoading(false);
      setIsRefreshing(false);
    } catch (error) {
      logger.error('Error fetching requests:', error);
      setError('Failed to fetch requests. Please try again.');
      setIsLoading(false);
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

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
      logger.error('Error capturing photo:', error);
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
      logger.error('Error removing photo:', error);
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
        logger.debug('🧹 Cleaning up photo resources in Request component');
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

      // Determine request type: pickup_request, digital_bin, or authority_assignment
      const sourceType = requestToAccept.source_type;
      const isPickupRequest = sourceType === 'pickup_request' || (!sourceType && !requestToAccept.authority_id);
      const isDigitalBin = sourceType === 'digital_bin';
      const isAuthorityAssignment = requestToAccept.authority_id;

      
      // Database operations for different request types
      let result;
      
      logger.info(`🔄 Accepting request ${requestId} as ${isPickupRequest ? 'pickup_request' : isDigitalBin ? 'digital_bin' : 'authority_assignment'}`);
      logger.info(`👤 DIAGNOSTIC: Collector ID from Request page: ${user?.id}`);
      logger.info(`👤 DIAGNOSTIC: User object:`, {
        id: user?.id,
        email: user?.email,
        phone: user?.phone
      });
      
      if (isDigitalBin) {
        // Handle digital bin acceptance - update digital_bins table to 'accepted' status
        logger.info('📦 Updating digital_bins table for request:', requestId);
        
        // DUPLICATE CHECK: Verify bin is not already accepted by any collector
        const { data: existingBin, error: checkError } = await supabase
          .from('digital_bins')
          .select('id, status, collector_id')
          .eq('id', requestId)
          .single();
        
        if (checkError) {
          logger.error('❌ Error checking bin status:', checkError);
          throw new Error('Failed to verify bin availability');
        }
        
        // Check if bin is already accepted or picked up
        if (existingBin.status === 'accepted' || existingBin.status === 'picked_up') {
          logger.warn('⚠️ Digital bin already accepted/picked up:', {
            binId: requestId,
            status: existingBin.status,
            collectorId: existingBin.collector_id,
            currentUser: user?.id,
            isSameCollector: existingBin.collector_id === user?.id
          });
          
          if (existingBin.collector_id === user?.id) {
            showToast('You have already accepted this bin.', 'warning');
          } else {
            showToast('This bin has already been accepted by another collector.', 'error');
          }
          
          // Force refresh to sync UI with actual database state
          localStorage.setItem('force_cache_reset', 'true');
          await fetchRequests();
          return;
        }
        
        // NOTE: digital_bins table doesn't have accepted_at column - only status and collector_id
        const updateData = {
          status: 'accepted',
          collector_id: user?.id
        };
        
        logger.info('📦 Update payload:', updateData);
        
        const { data, error } = await supabase
          .from('digital_bins')
          .update(updateData)
          .eq('id', requestId)
          .select(); // CRITICAL: Must add .select() to get updated data back
          
        logger.info('📊 Digital bin update response:', { data, error, hasData: !!data, dataLength: data?.length });
          
        // Check for database errors
        if (error) {
          logger.error('❌ Digital bin acceptance failed:', error);
          logger.error('❌ Error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          throw new Error(error.message || 'Failed to accept digital bin');
        }
        
        // Verify the update actually affected a row
        if (!data || data.length === 0) {
          logger.error('❌ Digital bin not found or already accepted:', requestId);
          logger.error('❌ Possible causes: RLS policy blocking update, bin already accepted, or bin does not exist');
          throw new Error('Digital bin not found or already accepted by another collector');
        }
        
        logger.info('✅ Digital bin accepted in database:', data[0]);
        result = { success: true, data: data[0] }; // Normalize response format
      } else if (isPickupRequest) {
        // Ensure requestManager is initialized
        if (!requestManager.isInitialized) {
          logger.info('🔄 Initializing requestManager before accepting request...');
          await requestManager.initialize(user?.id);
        }
        
        // Use requestManager for pickup requests
        logger.debug('📦 Using requestManager.acceptRequest()...');
        result = await requestManager.acceptRequest(requestId, user?.id);
        
        logger.debug('📊 RequestManager result:', { success: result?.success, error: result?.error });
      } else if (isAuthorityAssignment) {
        // Direct Supabase call for authority assignments
        logger.debug('📦 Updating authority_assignments table...');
        result = await supabase
          .from('authority_assignments')
          .update({ 
            status: AssignmentStatus.ACCEPTED,
            collector_id: user?.id,
            accepted_at: new Date().toISOString()
          })
          .eq('id', requestId);
          
        logger.debug('✅ Authority assignment accepted in database');
      }

      // Check for both success flag and error
      if (!result?.success || result?.error) {
        logger.error('Request acceptance failed:', result);
        
        // Handle specific error cases
        if (result?.error?.code === '22P02') {
          logger.error('UUID validation error:', result.error);
          showToast('Invalid request ID format. This request may be test data.', 'error');
          
          // Force a cache reset to ensure no problematic IDs persist
          localStorage.setItem('force_cache_reset', 'true');
          
          // Refresh the list to show current state after a short delay
          setTimeout(() => {
            fetchRequests();
          }, 1000);
          
          return;
        }
        
        // Show the specific error message
        const errorMessage = result?.error || result?.message || 'Failed to accept request. Please try again.';
        showToast(errorMessage, 'error');
        return;
      }
      
      // Remove from available list for all types
      const newAvailable = requests.available.filter(req => req.id !== requestId);
      
      // Update the status for all request types (including digital bins)
      const updatedRequest = {
        ...requestToAccept,
        status: isPickupRequest ? PickupRequestStatus.ACCEPTED : 
                isDigitalBin ? 'accepted' : 
                AssignmentStatus.ACCEPTED,
        accepted_at: new Date().toISOString(),
        collector_id: user?.id
      };
      
      // Add to accepted list
      const newAccepted = [...requests.accepted, updatedRequest];
      
      // Update state - same workflow for all request types
      const updatedRequests = {
        ...requests,
        available: newAvailable,
        accepted: newAccepted
      };
      
      setRequests(updatedRequests);
      
      // CRITICAL: Update cache to prevent accepted request from reappearing as available
      setRequestCache(prev => ({
        ...prev,
        available: {
          data: newAvailable,
          timestamp: Date.now()
        },
        accepted: {
          data: newAccepted,
          timestamp: Date.now()
        }
      }));
      
      // Show success toast and switch tab
      if (showToasts) {
        const requestType = isDigitalBin ? 'digital bin' : 
                           isPickupRequest ? 'pickup' : 
                           'assignment';
        showToast(`Successfully accepted ${requestType}!`, 'success');
        // Switch to accepted tab for all request types
        setActiveTab('accepted');
      }
    } catch (err) {
      logger.error('Error accepting request:', err);
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

  // Check if user is within range of a specific disposal site (50m = 0.05km)
  const checkWithinDisposalRange = useCallback((userCoords, site) => {
    if (!userCoords || !site) return false;
    
    // Normalize user coordinates (handle both lat/lng and latitude/longitude formats)
    const normalizedUserCoords = {
      lat: userCoords.lat || userCoords.latitude,
      lng: userCoords.lng || userCoords.longitude
    };
    
    // Get site coordinates in the right format
    const siteCoords = {
      lat: site.lat || site.latitude || site.coordinates?.[0],
      lng: site.lng || site.longitude || site.coordinates?.[1]
    };
    
    if (!normalizedUserCoords.lat || !normalizedUserCoords.lng) {
      logger.warn('Invalid user coordinates:', userCoords);
      return false;
    }
    
    if (!siteCoords.lat || !siteCoords.lng) {
      logger.warn('Invalid disposal site coordinates:', site);
      return false;
    }
    
    const distance = calculateDistance(normalizedUserCoords, siteCoords);
    logger.info('📍 Distance to disposal site:', {
      siteName: site.name,
      distance: `${(distance * 1000).toFixed(0)}m`,
      withinRange: distance <= 0.05
    });
    return distance <= 0.05; // 50 meters in km
  }, [calculateDistance]);

  // AUTO-DETECT: Check if user is near any disposal site and set selectedDisposalCenter
  useEffect(() => {
    const autoDetectDisposalSite = async () => {
      // Only run if user has location and is on picked_up tab with items
      // Handle both lat/lng and latitude/longitude formats
      const hasValidLocation = (userLocation?.lat || userLocation?.latitude) && 
                               (userLocation?.lng || userLocation?.longitude);
      if (!hasValidLocation) return;
      if (activeTab !== 'picked_up') return;
      if (!requests.picked_up || requests.picked_up.length === 0) return;
      
      // If already at a disposal site, don't re-fetch
      if (selectedDisposalCenter?.lat && checkWithinDisposalRange(userLocation, selectedDisposalCenter)) {
        return;
      }
      
      try {
        // Fetch all disposal centers
        const { data: disposalCenters, error } = await supabase
          .from('disposal_centers')
          .select('id, name, address, latitude, longitude, waste_type, center_type')
          .order('name');
        
        if (error || !disposalCenters) return;
        
        // Check if user is within 50m of any disposal center
        for (const center of disposalCenters) {
          const siteWithCoords = {
            ...center,
            lat: center.latitude,
            lng: center.longitude
          };
          
          if (checkWithinDisposalRange(userLocation, siteWithCoords)) {
            logger.info('🎯 Auto-detected at disposal site:', center.name);
            setSelectedDisposalCenter(siteWithCoords);
            return;
          }
        }
      } catch (err) {
        logger.error('Error auto-detecting disposal site:', err);
      }
    };
    
    autoDetectDisposalSite();
  }, [userLocation, activeTab, requests.picked_up, selectedDisposalCenter, checkWithinDisposalRange]);

  // OPTIMIZATION: Handle tab change with memoization to avoid unnecessary operations
  const handleTabChange = useCallback((tab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      // Only track tab changes, don't refetch data unnecessarily
      logger.debug('Tab changed to:', tab);
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

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { success, profile } = await authService.getUserProfile(user.id);
        if (success && profile) {
          setUserProfile({
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone
          });
        }
      } catch (err) {
        logger.error('Error loading user profile for nav:', err);
      }
    };
    
    fetchUserProfile();
  }, [user]);
  
  // Initial data fetch
  useEffect(() => {
    // Initialize requestManager with current user ID
    if (user?.id) {
      requestManager.initialize(user.id)
        .then(() => logger.info('RequestManager initialized successfully'))
        .catch(err => logger.error('Failed to initialize RequestManager:', err));
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


        // Set up real-time subscription
        subscription = supabase
          .channel('pickup_requests_changes')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'pickup_requests'
          }, async (payload) => {
            if (!payload) {
              logger.error('Received empty payload in real-time subscription');
              return;
            }

            const { eventType, new: newRecord } = payload;
            if (!eventType || !newRecord) {
              logger.error('Invalid payload structure in real-time subscription', { eventType, newRecord });
              return;
            }

            // Refresh requests when changes occur
            await fetchRequests();
          })
          .subscribe();
      } catch (error) {
        logger.error('Error setting up subscription:', error);
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
          logger.error('Error removing subscription channel:', error);
        }
      }

      // Clean up connectivity listeners if unregister function exists
      if (unregister && typeof unregister === 'function') {
        try {
          unregister();
        } catch (error) {
          logger.error('Error unregistering connectivity listeners:', error);
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
    
    if (request) {
      // Diagnostic logging to see what we have
      logger.info('🔍 Request found for directions:', {
        id: request.id,
        source_type: request.source_type,
        has_bin_locations: !!request.bin_locations,
        bin_locations_keys: request.bin_locations ? Object.keys(request.bin_locations) : [],
        has_coordinates: !!request.coordinates,
        coordinates_type: typeof request.coordinates
      });
      
      // Helper function to parse PostGIS binary format (WKB - Well-Known Binary)
      const parsePostGISBinary = (hexString) => {
        try {
          // PostGIS binary format: 0101000020E6100000 + 16 hex chars (lng) + 16 hex chars (lat)
          if (!hexString || typeof hexString !== 'string' || !hexString.startsWith('0101000020')) {
            return null;
          }
          
          // Extract the coordinate bytes (skip the header)
          const coordStart = 18; // After "0101000020E6100000"
          const lngHex = hexString.substring(coordStart, coordStart + 16);
          const latHex = hexString.substring(coordStart + 16, coordStart + 32);
          
          // Convert hex to IEEE 754 double (little-endian)
          const hexToDouble = (hex) => {
            const bytes = new Uint8Array(8);
            for (let i = 0; i < 8; i++) {
              bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
            }
            return new DataView(bytes.buffer).getFloat64(0, true); // true = little-endian
          };
          
          const lng = hexToDouble(lngHex);
          const lat = hexToDouble(latHex);
          
          logger.info('✅ Parsed PostGIS binary coordinates:', { lat, lng, source: hexString.substring(0, 20) + '...' });
          return { lat, lng };
        } catch (error) {
          logger.warn('⚠️ Failed to parse PostGIS binary:', error.message);
          return null;
        }
      };
      
      // Parse coordinates from various formats
      let lat, lng;
      let coordinatesSource = null;
      
      // CRITICAL: For digital bins, get coordinates from bin_locations (joined table)
      if (request.source_type === 'digital_bin' && request.bin_locations?.coordinates) {
        coordinatesSource = request.bin_locations.coordinates;
        logger.info('📍 Using bin_locations coordinates for digital bin:', coordinatesSource);
        
        // Handle GeoJSON Point format from PostGIS: {type: 'Point', coordinates: [lng, lat]}
        if (coordinatesSource.type === 'Point' && Array.isArray(coordinatesSource.coordinates) && coordinatesSource.coordinates.length === 2) {
          lng = coordinatesSource.coordinates[0]; // longitude first in GeoJSON
          lat = coordinatesSource.coordinates[1]; // latitude second
          logger.info('✅ Parsed GeoJSON Point from bin_locations:', { lat, lng });
        }
      } 
      // Fallback: For digital bins without bin_locations, or for pickup requests, use the regular coordinates field
      else if (request.coordinates) {
        coordinatesSource = request.coordinates;
        if (request.source_type === 'digital_bin') {
          logger.info('📍 bin_locations not available, using direct coordinates field for digital bin:', coordinatesSource);
        }
        
        // Handle array format [lat, lng]
        if (Array.isArray(coordinatesSource) && coordinatesSource.length >= 2) {
          lat = coordinatesSource[0];
          lng = coordinatesSource[1];
        }
        // Handle object format {lat: x, lng: y} or {latitude: x, longitude: y}
        else if (typeof coordinatesSource === 'object' && coordinatesSource !== null) {
          lat = coordinatesSource.lat || coordinatesSource.latitude;
          lng = coordinatesSource.lng || coordinatesSource.longitude;
        }
        // Handle PostGIS formats (string-based)
        else if (typeof coordinatesSource === 'string') {
          // Try PostGIS binary format first (WKB hex string)
          if (coordinatesSource.startsWith('0101000020')) {
            const parsed = parsePostGISBinary(coordinatesSource);
            if (parsed) {
              lat = parsed.lat;
              lng = parsed.lng;
            }
          }
          // Try PostGIS text format "POINT(lng lat)"
          else {
            const pointMatch = coordinatesSource.match(/POINT\(([+-]?\d+\.?\d*) ([+-]?\d+\.?\d*)\)/);
            if (pointMatch) {
              lng = parseFloat(pointMatch[1]); // longitude first in PostGIS
              lat = parseFloat(pointMatch[2]);  // latitude second
            }
          }
        }
      }
      
      // If we have valid coordinates, open in-app navigation
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const navState = {
          isOpen: true,
          destination: [lat, lng],
          requestId: requestId,
          wasteType: request.waste_type || 'general',
          sourceType: request.source_type || 'pickup_request'
        };
        
        // CRITICAL: Save to localStorage FIRST (synchronous) for app switch persistence
        saveNavModalState(navState);
        
        setNavigationDestination([lat, lng]);
        setNavigationRequestId(requestId);
        setNavigationWasteType(request.waste_type || 'general');
        setNavigationSourceType(request.source_type || 'pickup_request');
        setShowNavigationModal(true);
        
        // Mark this request as having navigation started (for visual-first UX)
        setNavigationStartedRequests(prev => new Set([...prev, requestId]));
        
        // Clear any highlight on this request
        if (highlightDirectionsId === requestId) {
          setHighlightDirectionsId(null);
        }
        
        showToast(`Opening in-app navigation to ${location || 'pickup location'}`, 'info');
        logger.info('✅ Opening navigation to:', { lat, lng, location, wasteType: request.waste_type, sourceType: request.source_type });
      } else {
        // Fallback to external navigation if coordinates are invalid
        logger.warn('⚠️ Invalid coordinates, falling back to search:', { lat, lng, coordinatesSource });
        const fallbackUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(location || 'pickup location')}`;
        window.open(fallbackUrl, '_blank');
        showToast(`Opening directions to ${location || 'pickup location'}`, 'info');
      }
    } else {
      // Fallback to external navigation if no request found or no coordinates
      logger.warn('⚠️ Request not found, falling back to search');
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
      
      // Async operations (don't block UI)
      Promise.resolve().then(() => {
        try {
          
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
              logger.warn('Failed to update earnings transactions:', e);
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
              logger.warn('Failed to update user stats:', e);
            }
            
            // Batch write to localStorage
            updates.forEach(([key, value]) => {
              try {
                localStorage.setItem(key, value);
              } catch (e) {
                logger.warn(`Failed to write ${key} to localStorage:`, e);
              }
            });
          }
        } catch (error) {
          logger.warn('Background processing failed:', error);
        }
      });
      
      const processingTime = performance.now() - startTime;
      logger.debug(`⚡ QR scan processed in ${processingTime.toFixed(2)}ms`);
      
      showToast(
        `✅ Scanned ${scannedBags.length} bag${scannedBags.length > 1 ? 's' : ''} • ${totalPoints} points • $${totalFee.toFixed(2)}`, 
        'success'
      );
    } catch (err) {
      logger.error('Error updating scanned bags:', err);
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
        // Determine if this is a digital bin or pickup request
        const isDigitalBin = requestToComplete.source_type === 'digital_bin';
        
        if (isDigitalBin) {
          // Update digital bin status in Supabase
          const { error: binError } = await supabase
            .from('digital_bins')
            .update({ 
              status: 'picked_up'
            })
            .eq('id', requestId);
          
          if (binError) throw binError;
        } else {
          // Update pickup request in Supabase
          const { error: assignmentError } = await supabase
            .from('pickup_requests')
            .update({ 
              status: PickupRequestStatus.PICKED_UP,
              picked_up_at: new Date().toISOString()
              // Removed non-existent columns: scanned_bags, environmental_impact, completion_bonus, total_earnings
            })
            .eq('id', requestId);
          
          if (assignmentError) throw assignmentError;
        }
      } else {
        // For non-UUID IDs (like A-42861), we'll only update the local state
        // This is for demo/test data that doesn't exist in the database
        logger.debug(`Skipping database update for non-UUID request ID: ${requestId} (using local state only)`); 
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
        logger.error('Error storing pickup data in localStorage:', localStorageError);
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
      logger.debug('Bonus transaction (not saved to DB):', bonusTransaction);
      
      // Store transaction in localStorage for persistence across sessions
      try {
        // Get existing transactions or initialize empty array
        const existingTransactions = JSON.parse(localStorage.getItem('earnings_transactions') || '[]');
        // Add new bonus transaction
        existingTransactions.push(bonusTransaction);
        // Save back to localStorage
        localStorage.setItem('earnings_transactions', JSON.stringify(existingTransactions));
      } catch (localStorageError) {
        logger.error('Error storing bonus transaction in localStorage:', localStorageError);
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
        logger.debug('Updated user stats with bonus (stored in localStorage):', existingStats);
      } catch (statsError) {
        logger.error('Error updating user stats with bonus in localStorage:', statsError);
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
      
      // Show success toast with bonus info
      showToast(
        `Successfully completed pickup! Earned ₵${completionBonus.toFixed(2)} bonus for ${scannedBags.length} bags.`,
        'success'
      );
      
      // Switch to picked up tab
      setActiveTab('picked_up');
    } catch (err) {
      logger.error('Error completing pickup:', err);
      showToast('Failed to complete pickup. Please try again.', 'error');
    }
  };

  // Handle locate site - Fetch nearest disposal center and open directions
  const handleLocateSite = async (requestId) => {
    try {
      // Find the request
      const request = requests.picked_up.find(req => req.id === requestId);
      
      if (!request) {
        showToast('Request not found', 'error');
        return;
      }
      
      // Show loading state
      showToast('Finding nearest disposal center...', 'info');
      
      // Fetch all disposal centers from Supabase
      const { data: disposalCenters, error: fetchError } = await supabase
        .from('disposal_centers')
        .select('id, name, address, latitude, longitude, waste_type, center_type')
        .order('name');
      
      if (fetchError) {
        logger.error('Error fetching disposal centers:', fetchError);
        showToast('Unable to fetch disposal centers. Please check your connection and try again.', 'error');
        return;
      }
      
      if (!disposalCenters || disposalCenters.length === 0) {
        showToast('No disposal centers found in the database.', 'error');
        return;
      }
      
      // Find nearest disposal center based on user location
      let nearestCenter = null;
      let minDistance = Infinity;
      
      // Check for userLocation with either lat/lng or latitude/longitude format
      const hasValidLocation = userLocation && 
        ((userLocation.lat && userLocation.lng) || 
         (userLocation.latitude && userLocation.longitude));
      
      if (hasValidLocation) {
        // Normalize coordinates to lat/lng format
        const userLat = userLocation.lat || userLocation.latitude;
        const userLng = userLocation.lng || userLocation.longitude;
        
        logger.info('📍 Using user location for disposal center search:', {
          lat: userLat,
          lng: userLng,
          isFallback: userLocation.isFallback || false
        });
        
        // Calculate distance to each disposal center
        disposalCenters.forEach(center => {
          // Parse coordinates - handle multiple PostGIS formats
          let centerLat = null;
          let centerLng = null;
          
          // Try parsing latitude
          if (typeof center.latitude === 'number') {
            centerLat = center.latitude;
          } else if (typeof center.latitude === 'object') {
            // PostGIS POINT format: {x: lng, y: lat}
            if (center.latitude.x !== undefined && center.latitude.y !== undefined) {
              centerLng = center.latitude.x;
              centerLat = center.latitude.y;
            }
            // PostGIS GEOGRAPHY format with coordinates array
            else if (center.latitude.coordinates && Array.isArray(center.latitude.coordinates)) {
              centerLng = center.latitude.coordinates[0];
              centerLat = center.latitude.coordinates[1];
            }
          } else if (typeof center.latitude === 'string') {
            // Try parsing numeric string
            const parsed = parseFloat(center.latitude);
            if (!isNaN(parsed)) centerLat = parsed;
          }
          
          // Try parsing longitude (if not already set from latitude object)
          if (centerLng === null) {
            if (typeof center.longitude === 'number') {
              centerLng = center.longitude;
            } else if (typeof center.longitude === 'object') {
              if (center.longitude.x !== undefined && center.longitude.y !== undefined) {
                centerLng = center.longitude.x;
                centerLat = center.longitude.y;
              } else if (center.longitude.coordinates && Array.isArray(center.longitude.coordinates)) {
                centerLng = center.longitude.coordinates[0];
                centerLat = center.longitude.coordinates[1];
              }
            } else if (typeof center.longitude === 'string') {
              const parsed = parseFloat(center.longitude);
              if (!isNaN(parsed)) centerLng = parsed;
            }
          }
          
          // Skip if we couldn't parse coordinates
          if (centerLat === null || centerLng === null || isNaN(centerLat) || isNaN(centerLng)) {
            logger.warn('Could not parse disposal center coordinates:', {
              id: center.id,
              name: center.name,
              latType: typeof center.latitude,
              lngType: typeof center.longitude
            });
            return;
          }
          
          const distance = calculateDistance(
            { lat: userLat, lng: userLng },
            { lat: centerLat, lng: centerLng }
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestCenter = {
              ...center,
              lat: centerLat,
              lng: centerLng,
              coordinates: [centerLat, centerLng], // Add coordinates array for DisposalModal
              distance: distance
            };
          }
        });
      } else {
        // No user location available, use first disposal center
        logger.warn('User location not available, using first disposal center');
        const firstCenter = disposalCenters[0];
        let centerLat = null;
        let centerLng = null;
        
        // Parse coordinates using same logic as above
        if (typeof firstCenter.latitude === 'number') {
          centerLat = firstCenter.latitude;
        } else if (typeof firstCenter.latitude === 'object') {
          if (firstCenter.latitude.x !== undefined && firstCenter.latitude.y !== undefined) {
            centerLng = firstCenter.latitude.x;
            centerLat = firstCenter.latitude.y;
          } else if (firstCenter.latitude.coordinates && Array.isArray(firstCenter.latitude.coordinates)) {
            centerLng = firstCenter.latitude.coordinates[0];
            centerLat = firstCenter.latitude.coordinates[1];
          }
        } else if (typeof firstCenter.latitude === 'string') {
          const parsed = parseFloat(firstCenter.latitude);
          if (!isNaN(parsed)) centerLat = parsed;
        }
        
        if (centerLng === null) {
          if (typeof firstCenter.longitude === 'number') {
            centerLng = firstCenter.longitude;
          } else if (typeof firstCenter.longitude === 'object') {
            if (firstCenter.longitude.x !== undefined && firstCenter.longitude.y !== undefined) {
              centerLng = firstCenter.longitude.x;
              centerLat = firstCenter.longitude.y;
            } else if (firstCenter.longitude.coordinates && Array.isArray(firstCenter.longitude.coordinates)) {
              centerLng = firstCenter.longitude.coordinates[0];
              centerLat = firstCenter.longitude.coordinates[1];
            }
          } else if (typeof firstCenter.longitude === 'string') {
            const parsed = parseFloat(firstCenter.longitude);
            if (!isNaN(parsed)) centerLng = parsed;
          }
        }
        
        nearestCenter = {
          ...firstCenter,
          lat: centerLat,
          lng: centerLng,
          coordinates: [centerLat, centerLng], // Add coordinates array for DisposalModal
          distance: null
        };
      }
      
      if (!nearestCenter) {
        showToast('Unable to find a suitable disposal center.', 'error');
        return;
      }
      
      // Log disposal center details
      logger.info('🗺️ Found nearest disposal center:', {
        name: nearestCenter.name,
        address: nearestCenter.address,
        distance: nearestCenter.distance ? `${nearestCenter.distance.toFixed(2)} km` : 'unknown',
        wasteType: nearestCenter.waste_type
      });
      
      // Store the disposal center and show modal
      setSelectedDisposalCenter(nearestCenter);
      setCurrentDisposalRequestId(requestId);
      setShowDisposalModal(true);
      
      // Mark this request as having its site located (for visual-first UX)
      setLocatedSiteRequests(prev => new Set([...prev, requestId]));
      
      // Clear any highlight on this request
      if (highlightRequestId === requestId) {
        setHighlightRequestId(null);
      }
      
      // Show toast with disposal center info
      const distanceText = nearestCenter.distance 
        ? ` (${nearestCenter.distance.toFixed(1)} km away)` 
        : '';
      showToast(`Found ${nearestCenter.name}${distanceText}`, 'success', 3000);
      
    } catch (error) {
      logger.error('Error in handleLocateSite:', error);
      showToast('An error occurred while locating the disposal site.', 'error');
    }
  };

// Geofence Error Modal Component
const GeofenceErrorModal = ({ 
  isOpen, 
  onClose, 
  onRetry, 
  onBypass, 
  locationError,
  onLocateSite,
  targetSite // The disposal site user should be at
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
  
  // Get site name and address to display
  const siteName = targetSite?.name || 'Disposal Center';
  const siteAddress = targetSite?.address || '';
  
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
            <p className="text-sm text-gray-600 mt-1">The disposal center is located at: <strong>{siteName}{siteAddress ? `, ${siteAddress}` : ''}</strong></p>
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

  // Handle dispose bag
  const handleDisposeBag = async (requestId) => {
    // Get the selected disposal center for this request
    // Use selectedDisposalCenter if it matches this request, otherwise auto-detect
    let targetSite = selectedDisposalCenter;
    
    // If no disposal site has been selected yet, try to auto-detect if user is at ANY disposal site
    if (!targetSite || !targetSite.lat || !targetSite.lng) {
      logger.info('No disposal site selected, auto-detecting nearby sites...');
      
      // Fetch disposal centers to check if user is at any of them
      const { data: disposalCenters, error: fetchError } = await supabase
        .from('disposal_centers')
        .select('id, name, address, latitude, longitude, waste_type, center_type')
        .order('name');
      
      if (!fetchError && disposalCenters && disposalCenters.length > 0) {
        // Check if user is within range of ANY disposal center
        for (const center of disposalCenters) {
          // Parse coordinates
          let centerLat = null;
          let centerLng = null;
          
          if (typeof center.latitude === 'number') {
            centerLat = center.latitude;
          } else if (typeof center.latitude === 'string') {
            centerLat = parseFloat(center.latitude);
          }
          
          if (typeof center.longitude === 'number') {
            centerLng = center.longitude;
          } else if (typeof center.longitude === 'string') {
            centerLng = parseFloat(center.longitude);
          }
          
          if (centerLat && centerLng && !isNaN(centerLat) && !isNaN(centerLng)) {
            const siteWithCoords = {
              ...center,
              lat: centerLat,
              lng: centerLng
            };
            
            if (checkWithinDisposalRange(userLocation, siteWithCoords)) {
              logger.info('✅ Auto-detected user at disposal site:', center.name);
              targetSite = siteWithCoords;
              // Store for subsequent disposals
              setSelectedDisposalCenter(siteWithCoords);
              break;
            }
          }
        }
      }
      
      // If still no site found after auto-detection, show guidance
      if (!targetSite || !targetSite.lat || !targetSite.lng) {
        // Haptic feedback - attention pattern
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        
        // Highlight the "Locate Site" button for this request
        setHighlightRequestId(requestId);
        
        // Auto-remove highlight after 3 seconds
        setTimeout(() => {
          setHighlightRequestId(null);
        }, 3000);
        
        return;
      }
    }
    
    // Check if user is within range of the disposal center
    const isWithinRange = checkWithinDisposalRange(userLocation, targetSite);
    
    if (!isWithinRange) {
      // Set the target site before showing modal so it displays the correct name
      setTargetDisposalSite(targetSite);
      setGeofenceModalOpen(true);
      return;
    }
    try {
      // Validate input
      if (!requestId) {
        logger.error('Invalid requestId in handleDisposeBag:', requestId);
        showToast('Invalid request data', 'error');
        return;
      }

      // Ensure requests.picked_up exists and is an array
      if (!requests.picked_up || !Array.isArray(requests.picked_up)) {
        logger.error('requests.picked_up is not an array:', requests.picked_up);
        showToast('Error accessing request data. Please refresh the page.', 'error');
        return;
      }
      
      // Find the request
      const requestIndex = requests.picked_up.findIndex(req => req && req.id === requestId);
      
      if (requestIndex === -1) {
        showToast('Request not found', 'error');
        return;
      }
      
      const request = requests.picked_up[requestIndex];
      if (!request) {
        logger.error('Request at index not found:', requestIndex);
        showToast('Error processing request. Please try again.', 'error');
        return;
      }
      
      // **NEW: Check if this is a digital bin**
      if (request.source_type === 'digital_bin') {
        logger.info('Disposing digital bin with sharing model:', requestId);
        
        // Show processing toast
        showToast('Processing disposal and calculating earnings...', 'info');
        
        // Call disposal service with sharing model
        const result = await disposeDigitalBin(requestId, user?.id);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to dispose bin');
        }
        
        logger.info('Digital bin disposed successfully:', result);
        
        // Show earnings info
        const earnings = result.payoutBreakdown?.collector_total_payout || 0;
        showToast(
          `Bin disposed! Your earnings: GHS ${earnings.toFixed(2)}`,
          'success',
          5000
        );
        
        // Refresh requests to update UI
        await fetchRequests();
        
        return; // Exit early for digital bins
      }
      
      // **EXISTING: Regular pickup request disposal logic**
      
      // Show processing toast
      showToast('Processing disposal...', 'info');
      
      // Generate disposal details using the selected disposal center
      const disposalSite = targetSite?.name ? `${targetSite.name}${targetSite.address ? ', ' + targetSite.address : ''}` : 'Disposal Center';
      const disposalTimestamp = new Date().toISOString();
      
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
              // CRITICAL: Set status to 'disposed' so earningsService counts it
              status: 'disposed',
              disposal_site: disposalSite,
              disposal_timestamp: disposalTimestamp,
              disposed_at: disposalTimestamp
            })
            .eq('id', requestId);
          
          if (error) {
            logger.error('Error updating disposal details:', error);
            showToast('Failed to update disposal details. Please try again.', 'error');
            return;
          }
        } catch (updateError) {
          logger.error('Error updating disposal details:', updateError);
          showToast('Failed to update disposal details. Please try again.', 'error');
          return;
        }
      } else {
        // For non-UUID IDs (like A-42861), we'll only update the local state
        // This is for demo/test data that doesn't exist in the database
        logger.debug(`Skipping database update for non-UUID request ID: ${requestId} (using local state only for disposal)`); 
      }
      
      // REMOVE disposed item from picked_up list to save memory and avoid clutter
      const newPickedUp = requests.picked_up.filter((_, idx) => idx !== requestIndex);
      
      const updatedRequests = {
        ...requests,
        picked_up: newPickedUp
      };
      
      setRequests(updatedRequests);
      
      // Show success toast
      showToast('Successfully disposed bags!', 'success');
    } catch (err) {
      logger.error('Error disposing bags:', err);
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
      logger.error('Error viewing report:', err);
      showToast('Failed to view report', 'error');
    }
  };

  // Handle dispose ALL picked up items at once
  const handleDisposeAll = async () => {
    // Verify user is at a disposal site
    if (!selectedDisposalCenter?.lat || !selectedDisposalCenter?.lng) {
      showToast('Please locate a disposal site first', 'warning');
      return;
    }
    
    const isWithinRange = checkWithinDisposalRange(userLocation, selectedDisposalCenter);
    if (!isWithinRange) {
      showToast('You must be within 50m of the disposal site', 'warning');
      return;
    }
    
    const itemsToDispose = requests.picked_up?.filter(req => req.status !== 'disposed') || [];
    
    if (itemsToDispose.length === 0) {
      showToast('No items to dispose', 'info');
      return;
    }
    
    const totalItems = itemsToDispose.length;
    showToast(`Disposing ${totalItems} item${totalItems > 1 ? 's' : ''}...`, 'info');
    
    let successCount = 0;
    let totalEarnings = 0;
    const disposalTimestamp = new Date().toISOString();
    const disposalSite = selectedDisposalCenter?.name || 'Disposal Center';
    
    try {
      for (const request of itemsToDispose) {
        try {
          if (request.source_type === 'digital_bin') {
            // Dispose digital bin with payout calculation
            const result = await disposeDigitalBin(request.id, user?.id, selectedDisposalCenter?.id);
            if (result.success) {
              successCount++;
              totalEarnings += result.payoutBreakdown?.collector_total_payout || 0;
            }
          } else {
            // Dispose regular pickup request
            const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.id);
            
            if (isValidUuid) {
              const { error } = await supabase
                .from('pickup_requests')
                .update({
                  status: 'disposed',
                  disposal_site: disposalSite,
                  disposal_timestamp: disposalTimestamp,
                  disposed_at: disposalTimestamp
                })
                .eq('id', request.id);
              
              if (!error) {
                successCount++;
              }
            } else {
              // Demo/local data - count as success
              successCount++;
            }
          }
        } catch (itemError) {
          logger.error(`Error disposing item ${request.id}:`, itemError);
        }
      }
      
      // Clear all disposed items from picked_up list
      setRequests(prev => ({
        ...prev,
        picked_up: []
      }));
      
      // Refresh requests to sync with database
      await fetchRequests();
      
      // Show success message with earnings if applicable
      if (totalEarnings > 0) {
        showToast(
          `✅ Disposed ${successCount}/${totalItems} items! Earnings: GHS ${totalEarnings.toFixed(2)}`,
          'success',
          5000
        );
      } else {
        showToast(`✅ Disposed ${successCount}/${totalItems} items at ${disposalSite}!`, 'success', 4000);
      }
      
    } catch (err) {
      logger.error('Error in handleDisposeAll:', err);
      showToast('Some items failed to dispose. Please try again.', 'error');
    }
  };

  // Check if user is within 50m of a disposal site (for FAB visibility)
  const isAtDisposalSite = selectedDisposalCenter?.lat && selectedDisposalCenter?.lng && 
    checkWithinDisposalRange(userLocation, selectedDisposalCenter);
  
  // Count items available to dispose
  const itemsToDisposeCount = requests.picked_up?.filter(req => req.status !== 'disposed')?.length || 0;

  // Handle payment submission (digital bin client collection)
  const handlePaymentSubmit = async (paymentData) => {
    try {
      logger.info('Processing payment submission:', paymentData);
      
      // Get collector profile ID
      const { data: collectorProfile, error: profileError } = await supabase
        .from('collector_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      
      if (profileError || !collectorProfile) {
        throw new Error('Collector profile not found');
      }
      
      // Update payment data with collector profile ID
      const completePaymentData = {
        ...paymentData,
        collectorId: collectorProfile.id
      };
      
      // Initiate collection
      const result = await initiateCollection(completePaymentData);
      
      if (!result.success) {
        throw new Error(result.error || 'Payment failed');
      }
      
      logger.info('Payment initiated successfully:', result);
      
      // Show appropriate message based on payment mode
      if (paymentData.paymentMode === 'cash') {
        showToast('Cash payment recorded successfully', 'success');
      } else {
        showToast('Payment initiated. Awaiting client approval.', 'info');
      }
      
      // Refresh requests to update UI
      await fetchRequests();
      
      // Return result to modal for status tracking
      return result;
      
    } catch (error) {
      logger.error('Error processing payment:', error);
      showToast(error.message || 'Failed to process payment', 'error');
      throw error; // Re-throw to let modal handle it
    }
  };

  // View details functionality removed as per requirements
  
  // State for geofence modal
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);
  const [targetDisposalSite, setTargetDisposalSite] = useState(null); // Track the disposal site user should be at

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
                logger.error('Received empty payload in real-time subscription');
                return;
              }
              
              const { eventType, new: newRecord, old: oldRecord } = payload;
              
              if (!eventType || !newRecord) {
                logger.error('Invalid payload structure in real-time subscription', { eventType, newRecord });
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
                  logger.error(`Unhandled event type: ${eventType}`);
                  break;
              }
            } catch (error) {
              logger.error('Error handling subscription payload:', error);
              showToast('Error processing real-time update', 'error');
            }
          })
          .subscribe();
      } catch (error) {
        logger.error('Error setting up subscription:', error);
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
          logger.error('Error removing subscription channel:', error);
        }
      }

      if (unregister && typeof unregister === 'function') {
        try {
          unregister();
        } catch (error) {
          logger.error('Error unregistering connectivity listeners:', error);
        }
      }
    };
  }, [user?.id, fetchRequests]);

  return (
    <div className="app-container bg-gray-100 min-h-screen flex flex-col">
      <TopNavBar user={user} />
      
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
          onClose={() => {
            setGeofenceModalOpen(false);
            setTargetDisposalSite(null);
          }}
          targetSite={targetDisposalSite}
          onLocateSite={() => {
            setGeofenceModalOpen(false);
            if (currentDisposalRequestId) {
              handleLocateSite(currentDisposalRequestId);
            }
          }}
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
          ) : activeTab === 'available' && (!requests.available || requests.available.length === 0) ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No available requests at the moment.</p>
            </div>
          ) : activeTab === 'accepted' && (!requests.accepted || requests.accepted.length === 0) ? (
            <div className="text-center py-8">
              <p className="text-gray-600">You haven't accepted any requests yet.</p>
            </div>
          ) : activeTab === 'picked_up' && (!requests.picked_up || requests.picked_up.length === 0) ? (
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
                          siteLocated={locatedSiteRequests.has(request.id)}
                          highlightLocateSite={highlightRequestId === request.id}
                          navigationStarted={navigationStartedRequests.has(request.id)}
                          highlightDirections={highlightDirectionsId === request.id}
                          hasArrived={arrivedRequests.has(request.id)}
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
                    // Sort: non-disposed digital bins first, then others, then disposed
                    requests.picked_up
                      .slice() // Create copy to avoid mutating original
                      .sort((a, b) => {
                        const aIsDigitalBin = a.source_type === 'digital_bin';
                        const bIsDigitalBin = b.source_type === 'digital_bin';
                        const aIsDisposed = aIsDigitalBin && a.status === 'disposed';
                        const bIsDisposed = bIsDigitalBin && b.status === 'disposed';
                        
                        // Non-disposed items first
                        if (aIsDisposed && !bIsDisposed) return 1;
                        if (!aIsDisposed && bIsDisposed) return -1;
                        
                        // Within same disposal status, sort by pickup time (most recent first)
                        const aTime = new Date(a.picked_up_at || a.accepted_at || a.created_at).getTime();
                        const bTime = new Date(b.picked_up_at || b.accepted_at || b.created_at).getTime();
                        return bTime - aTime;
                      })
                      .map(request => {
                        // Smart siteLocated: If user is already at ANY disposal center, allow disposing ALL requests
                        // This enables disposing multiple bags without re-navigating
                        const isAtDisposalSite = selectedDisposalCenter?.lat && selectedDisposalCenter?.lng && 
                          checkWithinDisposalRange(userLocation, selectedDisposalCenter);
                        const siteLocatedForRequest = locatedSiteRequests.has(request.id) || isAtDisposalSite;
                        
                        return request && (
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
                            siteLocated={siteLocatedForRequest}
                            highlightLocateSite={highlightRequestId === request.id}
                            navigationStarted={navigationStartedRequests.has(request.id)}
                            highlightDirections={highlightDirectionsId === request.id}
                          />
                        );
                      })
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
      
      {/* Dispose All FAB - Only shows when at disposal site with items to dispose */}
      {/* z-[70] ensures it stays above modals (z-50/z-60) so collectors always see it */}
      {activeTab === 'picked_up' && isAtDisposalSite && itemsToDisposeCount > 0 && (
        <button
          onClick={handleDisposeAll}
          className="fixed bottom-24 right-4 z-[70] bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-2 transition-all duration-300 animate-pulse hover:animate-none"
          style={{ boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)' }}
        >
          {/* Trash/Dispose icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="font-semibold">Dispose All ({itemsToDisposeCount})</span>
        </button>
      )}
      
      <BottomNavBar activeTab="request" />
      
      {/* Toast Notification */}
      {toast.show && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />
      )}
      
      {/* Navigation Modal */}
      {showNavigationModal && navigationDestination && (
        <NavigationQRModal
          isOpen={showNavigationModal}
          onClose={() => {
            // CRITICAL: Clear localStorage state when modal closes
            saveNavModalState(null);
            setShowNavigationModal(false);
          }}
          destination={navigationDestination}
          requestId={navigationRequestId}
          wasteType={navigationWasteType}
          sourceType={navigationSourceType}
          onArrival={(requestId) => {
            // Mark this request as arrived so external "Scan QR" button works
            logger.info('📍 User arrived at request location:', requestId);
            setArrivedRequests(prev => new Set([...prev, requestId]));
          }}
          onQRScanned={async (scannedValues) => {
            // Handle multiple scanned QR codes
            if (Array.isArray(scannedValues) && scannedValues.length > 0) {
              // Process all scanned items
              logger.debug(`Received ${scannedValues.length} scanned items:`, scannedValues);
              
              // Update the request with scanned items
              if (navigationRequestId) {
                try {
                  // Find the request to determine if it's a digital bin
                  let request = null;
                  if (requests.accepted) {
                    request = requests.accepted.find(req => req && req.id === navigationRequestId);
                  }
                  
                  if (request && request.source_type === 'digital_bin') {
                    // DUPLICATE CHECK: Verify bin is not already picked up
                    const { data: existingBin, error: checkError } = await supabase
                      .from('digital_bins')
                      .select('id, status, collector_id')
                      .eq('id', navigationRequestId)
                      .single();
                    
                    if (checkError) {
                      logger.error('Error checking bin status before pickup:', checkError);
                      showToast('Error verifying bin status. Please try again.', 'error');
                      return;
                    }
                    
                    // Check if already picked up
                    if (existingBin.status === 'picked_up') {
                      logger.warn('⚠️ Bin already picked up:', {
                        binId: navigationRequestId,
                        collectorId: existingBin.collector_id,
                        currentUser: user?.id
                      });
                      showToast('This bin has already been picked up.', 'warning');
                      
                      // Force refresh to sync UI
                      localStorage.setItem('force_cache_reset', 'true');
                      await fetchRequests();
                      return;
                    }
                    
                    // Verify this collector accepted the bin
                    if (existingBin.collector_id !== user?.id) {
                      logger.error('❌ Collector mismatch:', {
                        binCollector: existingBin.collector_id,
                        currentUser: user?.id
                      });
                      showToast('This bin was accepted by a different collector.', 'error');
                      return;
                    }
                    
                    // Update digital bin status in Supabase
                    const { error: binError } = await supabase
                      .from('digital_bins')
                      .update({ 
                        status: 'picked_up'
                        // Note: digital_bins table doesn't have picked_up_at column
                      })
                      .eq('id', navigationRequestId)
                      .eq('collector_id', user?.id); // Extra safety: only update if collector matches
                    
                    if (binError) {
                      logger.error('Error updating digital bin status:', binError);
                      showToast('Error updating bin status. Please try again.', 'error');
                      return;
                    }
                    
                    logger.info(`✅ Digital bin ${navigationRequestId} marked as picked up`);
                    
                    // Force cache reset to fetch fresh data from database
                    localStorage.setItem('force_cache_reset', 'true');
                    
                    // Show success toast
                    showToast('QR code scanned! Bin marked as picked up.', 'success');
                    logger.info('📢 Success toast displayed');
                    
                    // Refresh data to move bin to "Picked Up" tab
                    logger.info('🔄 Fetching fresh data from database...');
                    await fetchRequests();
                    logger.info('✅ Data refresh complete');
                    
                    // Close navigation modal first before opening payment modal
                    saveNavModalState(null); // Clear persisted state
                    setShowNavigationModal(false);
                    
                    // Wait a moment for navigation modal to close
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Open payment modal for client collection
                    logger.info('💰 Opening payment modal for digital bin:', navigationRequestId);
                    setCurrentPaymentBinId(navigationRequestId);
                    setShowPaymentModal(true);
                    logger.info('✅ Payment modal state set to open');
                  } else if (request) {
                    // Handle regular pickup request
                    showToast(`Successfully scanned ${scannedValues.length} items!`, 'success');
                  } else {
                    showToast('Request not found.', 'warning');
                  }
                } catch (error) {
                  logger.error('Error processing QR scan:', error);
                  showToast('Error processing scan. Please try again.', 'error');
                }
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
      
      {/* Disposal Center Modal */}
      {showDisposalModal && selectedDisposalCenter && (
        <DisposalModal
          assignment={{ id: currentDisposalRequestId }}
          isOpen={showDisposalModal}
          onClose={() => {
            setShowDisposalModal(false);
            // Don't clear selectedDisposalCenter - keep it for FAB and subsequent disposals
            setCurrentDisposalRequestId(null);
          }}
          onDispose={async (assignmentId, site) => {
            logger.info('Disposal confirmed:', { assignmentId, site });
            
            try {
              // Find the request to determine if it's a digital bin or pickup request
              const request = requests.picked_up?.find(req => req.id === assignmentId);
              
              if (!request) {
                showToast('Request not found', 'error');
                setShowDisposalModal(false);
                return;
              }
              
              showToast('Processing disposal...', 'info');
              
              if (request.source_type === 'digital_bin') {
                // Use disposeDigitalBin for digital bins
                const result = await disposeDigitalBin(assignmentId, user?.id, site?.id);
                
                if (!result.success) {
                  throw new Error(result.error || 'Failed to dispose bin');
                }
                
                const earnings = result.payoutBreakdown?.collector_total_payout || 0;
                showToast(`Disposal confirmed at ${site.name}! Earnings: GHS ${earnings.toFixed(2)}`, 'success', 5000);
              } else {
                // Update pickup_requests status to 'disposed'
                const { error } = await supabase
                  .from('pickup_requests')
                  .update({
                    status: 'disposed',
                    disposal_site: site?.name || 'Disposal Center',
                    disposal_timestamp: new Date().toISOString(),
                    disposed_at: new Date().toISOString()
                  })
                  .eq('id', assignmentId);
                
                if (error) {
                  throw new Error(error.message);
                }
                
                showToast(`Disposal confirmed at ${site.name}!`, 'success');
              }
              
              // Refresh requests to update UI and earnings
              await fetchRequests();
              
            } catch (error) {
              logger.error('Error confirming disposal:', error);
              showToast(`Disposal failed: ${error.message}`, 'error');
            }
            
            setShowDisposalModal(false);
            // KEEP selectedDisposalCenter set so subsequent items show "Site Found" button
            // User is still at the same disposal site, no need to re-locate
            setCurrentDisposalRequestId(null);
          }}
          // onGetDirections is NOT provided - let DisposalModal handle in-app navigation internally
        />
      )}
      
      {/* Digital Bin Payment Modal (Client Collection) */}
      {showPaymentModal && currentPaymentBinId && (
        <DigitalBinPaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setCurrentPaymentBinId(null);
          }}
          digitalBinId={currentPaymentBinId}
          collectorId={user?.id}
          onSubmit={handlePaymentSubmit}
        />
      )}
    </div>
  );
};

export default RequestPage;
