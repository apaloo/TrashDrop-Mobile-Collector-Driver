import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useFilters } from '../context/FilterContext';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { PickupRequestStatus, WasteType, AssignmentStatus } from '../utils/types';
import { transformRequestsData } from '../utils/requestUtils';
import { getCurrentLocation, getLocationWithRetry, isWithinRadius } from '../utils/geoUtils';
import { supabase } from '../services/supabase';
import RequestCard from '../components/RequestCard';
// OPTIMIZATION: Memoize RequestCard for better performance
const MemoizedRequestCard = memo(RequestCard);
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import { 
  saveToCache, 
  getFromCache, 
  clearCache, 
  CACHE_KEYS, 
  isOnline, 
  registerConnectivityListeners 
} from '../utils/cacheUtils';

const RequestPage = () => {
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
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentReport, setCurrentReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // OPTIMIZATION: Cache for transformed request data to avoid recalculation
  const [requestCache, setRequestCache] = useState({
    available: { data: [], timestamp: 0 },
    accepted: { data: [], timestamp: 0 },
    completed: { data: [], timestamp: 0 }
  });
  
  // Get filters and filtered requests from context
  const { filters, filteredRequests, updateFilteredRequests } = useFilters();

  // Format date to show in the format shown in screenshots
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Show toast notification
  const showToast = (message, type = 'info', duration = 3000) => {
    setToast({ show: true, message, type, duration });
  };

  // Hide toast notification
  const hideToast = () => {
    setToast({ ...toast, show: false });
  };

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

  // Fetch requests from Supabase
  const fetchRequests = useCallback(async () => {
    try {
      // SUPER-FAST: Show cached data immediately, then update in background
      if (requestCache.available.data.length > 0) {
        console.log('⚡ INSTANT: Showing cached data immediately');
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
        console.log('⚡ CACHE HIT: Using extended cache, skipping API call');
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
        
        if (location.isFallback) {
          console.warn('Using fallback location');
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
      const online = await isOnline();
      setIsOnlineStatus(online);
      
      if (online) {
        // OPTIMIZATION: Parallelize all Supabase queries for faster loading
        const [
          availableResult,
          acceptedResult, 
          pickedUpResult
        ] = await Promise.all([
          // PERFORMANCE: Skip available requests query if we have filtered data from Map
          filteredRequests.available && filteredRequests.available.length > 0 
            ? Promise.resolve({ data: [], error: null }) // Skip if we have filtered data
            : supabase
                .from('pickup_requests')
                .select('id, type, location, coordinates, bag_count, fee, status, created_at, special_instructions') // Only select needed fields
                .eq('status', 'available')
                .limit(50) // Limit results for faster loading
                .order('created_at', { ascending: false }),
          
          // Accepted requests for this user
          supabase
            .from('pickup_requests')
            .select('*')
            .eq('status', 'accepted')
            .eq('collector_id', user?.id)
            .order('accepted_at', { ascending: true }),
          
          // Picked up requests for this user  
          supabase
            .from('pickup_requests')
            .select('*')
            .eq('status', 'picked_up')
            .eq('collector_id', user?.id)
            .order('picked_up_at', { ascending: false })
        ]);
        
        // Check for errors
        if (availableResult.error) throw availableResult.error;
        if (acceptedResult.error) throw acceptedResult.error;
        if (pickedUpResult.error) throw pickedUpResult.error;
        
        const availableData = availableResult.data;
        const acceptedData = acceptedResult.data;
        const picked_up_data = pickedUpResult.data;
        
        // Transform all data first
        const allAvailable = transformRequestsData(availableData);
        const accepted = transformRequestsData(acceptedData);
        const picked_up = transformRequestsData(picked_up_data);
        
        // ⚡ LIGHTNING-FAST: Prioritize using filtered data from Map context (fastest path)
        let available;
        if (filteredRequests.available && filteredRequests.available.length > 0) {
          // 🚀 TURBO MODE: Use pre-filtered and pre-processed data from Map context
          console.log('⚡ TURBO: Using', filteredRequests.available.length, 'pre-filtered requests');
          
          // SPEED: Minimal processing - just ensure required fields exist
          available = filteredRequests.available.map((req, index) => ({
            ...req, // Keep all existing data
            bags: req.bags || req.bag_count || 1,
            fee: req.fee || '5.00', // Use simple default
            status: req.status || 'available',
            type: req.type || req.waste_type || 'General',
            location: req.location || 'Unknown',
            // Skip expensive calculations - use existing or defaults
            points: req.points || 50,
            distance: req.distance || 'Unknown',
            distanceValue: req.distanceValue ?? 999999
          }));
        } else if (userLocation && allAvailable.length > 0) {
          // SLOW PATH: Fallback with optimized distance filtering (only when Map data unavailable)
          console.log('Available tab: Slow path - fallback distance filtering for', allAvailable.length, 'requests');
          
          const searchRadius = filters.searchRadius || 10;
          const userCoords = { lat: userLocation.latitude, lng: userLocation.longitude };
          
          available = allAvailable
            .map(req => {
              if (!req.coordinates || !Array.isArray(req.coordinates)) {
                return null;
              }
              
              const distance = calculateDistance(
                userCoords,
                { lat: req.coordinates[0], lng: req.coordinates[1] }
              );
              
              if (distance > searchRadius) {
                return null;
              }
              
              return {
                ...req,
                distanceValue: distance,
                distance: `${distance.toFixed(1)} km away`
              };
            })
            .filter(Boolean)
            .sort((a, b) => a.distanceValue - b.distanceValue);
        } else {
          console.log('Available tab: No filtering possible, showing empty state');
          available = [];
        }
        
        // FIXED: Convert useMemo to regular processing (hooks can't be called in async functions)
        const sortedAccepted = [...accepted].sort((a, b) => {
          // First sort by accepted_at timestamp (oldest first)
          const dateA = new Date(a.accepted_at || a.created_at || 0);
          const dateB = new Date(b.accepted_at || b.created_at || 0);
          if (dateA - dateB !== 0) return dateA - dateB;
          
          // If dates are equal, sort by proximity (nearest first)
          return (a.distanceValue || 0) - (b.distanceValue || 0);
        });
        
        // ⚡ INSTANT UPDATE: Stream results to UI immediately
        const newRequests = { available, accepted: sortedAccepted, picked_up };
        
        // SPEED: Batch state updates for better performance  
        requestAnimationFrame(() => {
          setRequests(newRequests);
          updateFilteredRequests({ available });
        });
        
        // BACKGROUND: Async cache updates (don't block UI)
        setTimeout(() => {
          saveToCache(CACHE_KEYS.ALL_REQUESTS, newRequests);
          setRequestCache(prev => ({
            ...prev,
            available: { data: available, timestamp: Date.now() },
            accepted: { data: sortedAccepted, timestamp: Date.now() },
            completed: { data: picked_up, timestamp: Date.now() }
          }));
        }, 0);
        
        // Update last updated timestamp
        const now = new Date();
        setLastUpdated(now);
        saveToCache(CACHE_KEYS.LAST_UPDATED, now.toISOString());
      } else {
        // Fetch from cache
        const cachedRequests = getFromCache(CACHE_KEYS.ALL_REQUESTS);
        const cachedLastUpdated = getFromCache(CACHE_KEYS.LAST_UPDATED);
        
        if (cachedRequests) {
          setRequests(cachedRequests);
          if (cachedLastUpdated) {
            setLastUpdated(new Date(cachedLastUpdated));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Failed to fetch requests. Please try again.');
      
      // Try to get from cache as fallback
      const cachedRequests = getFromCache(CACHE_KEYS.ALL_REQUESTS);
      if (cachedRequests) {
        setRequests(cachedRequests);
        const cachedLastUpdated = getFromCache(CACHE_KEYS.LAST_UPDATED);
        if (cachedLastUpdated) {
          setLastUpdated(new Date(cachedLastUpdated));
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userLocation, filters.searchRadius, filters.wasteTypes, filters.minPayment, filters.priority]);

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
    fetchRequests();
    
    // Set up connectivity listeners
    const unsubscribe = registerConnectivityListeners((online) => {
      setIsOnlineStatus(online);
      if (online) {
        // Refresh data when coming back online
        fetchRequests();
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Handle accepting a single request
  const handleAcceptRequest = async (requestId, showToasts = true) => {
    try {
      // Find the request in the available list
      const requestToAccept = requests.available.find(req => req.id === requestId);
      
      if (!requestToAccept) {
        showToast('Request not found', 'error');
        return;
      }
      
      // Update assignment in Supabase
      const { data, error } = await supabase
        .from('authority_assignments')
        .update({ 
          status: AssignmentStatus.ACCEPTED,
          collector_id: user?.id,
          accepted_at: new Date().toISOString()
        })
        .eq('id', requestId);
      
      if (error) throw error;
      
      // Update the status
      const updatedRequest = {
        ...requestToAccept,
        status: PickupRequestStatus.ACCEPTED,
        accepted_at: new Date().toISOString()
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
      
      // Show success toast and switch tab only if showToasts is true (single accept mode)
      if (showToasts) {
        showToast(`Successfully accepted ${requestToAccept.type} pickup!`, 'success');
        // Switch to accepted tab
        setActiveTab('accepted');
      }
    } catch (err) {
      console.error('Error accepting request:', err);
      showToast('Failed to accept request. Please try again.', 'error');
    }
  };

  // Handle opening directions with GPS coordinates
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
    
    let googleMapsUrl = '';
    
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
      
      // If we have valid coordinates, use them for precise navigation
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        showToast(`Opening GPS directions to pickup location`, 'info');
      } else {
        // Fallback to location string if coordinates are invalid
        googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || 'pickup location')}`;
        showToast(`Opening directions to ${location || 'pickup location'}`, 'info');
      }
    } else {
      // Fallback to location string if no request found or no coordinates
      googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || 'pickup location')}`;
      showToast(`Opening directions to ${location || 'pickup location'}`, 'info');
    }
    
    // Open Google Maps in a new tab
    window.open(googleMapsUrl, '_blank');
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
                total_pickups: 0,
                total_earnings: 0,
                total_points: 0,
                last_updated: new Date().toISOString()
              }));
              
              existingStats.today_earnings = (existingStats.today_earnings || 0) + (latestBag.fee || 0);
              existingStats.today_points = (existingStats.today_points || 0) + (latestBag.points || 0);
              existingStats.total_earnings = (existingStats.total_earnings || 0) + (latestBag.fee || 0);
              existingStats.total_points = (existingStats.total_points || 0) + (latestBag.points || 0);
              existingStats.total_pickups = (existingStats.total_pickups || 0) + 1;
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
          week_earnings: 0,
          month_earnings: 0,
          total_earnings: 0,
          total_points: 0,
          last_updated: new Date().toISOString()
        }));
        
        // Update stats with completion bonus
        existingStats.today_earnings = (existingStats.today_earnings || 0) + completionBonus;
        existingStats.week_earnings = (existingStats.week_earnings || 0) + completionBonus;
        existingStats.month_earnings = (existingStats.month_earnings || 0) + completionBonus;
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

  // Add real-time subscription for assignments
  useEffect(() => {
    if (!isOnlineStatus || !user) return;
    
    let subscription;
    
    const setupRealtimeSubscription = async () => {
      try {
        // First fetch initial data
        await fetchRequests();
        
        // Then set up real-time subscription
        subscription = supabase
          .channel('pickup_requests_changes')
          .on('postgres_changes', {
            event: '*', 
            schema: 'public',
            table: 'pickup_requests'
          }, (payload) => {
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
              
              // Update cache after any change
              saveToCache(CACHE_KEYS.ALL_REQUESTS, requests);
            } catch (error) {
              console.error('Error handling real-time subscription event:', error);
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscribed to authority_assignments table');
            }
          });
      } catch (error) {
        console.error('Error setting up real-time subscription:', error);
      }
    };
    
    setupRealtimeSubscription();
    
    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [isOnlineStatus, user]);

  return (
    <div className="app-container bg-gray-100 min-h-screen flex flex-col">
      <TopNavBar title="" />
      
      {/* Offline indicator */}
      {!isOnlineStatus && (
        <div className="w-full bg-gray-800 text-white py-1 text-center text-sm z-40 mt-12">
          You are currently offline. Limited functionality available.
        </div>
      )}
      
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
      <main className="flex-1 overflow-y-auto pt-40 pb-20 px-4">
        
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
                  {Array.isArray(requests.available) && requests.available.length > 0 ? (
                    requests.available.map(request => (
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
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No available requests found
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
      
      {/* Report Modal will be implemented separately */}
    </div>
  );
};

export default RequestPage;
