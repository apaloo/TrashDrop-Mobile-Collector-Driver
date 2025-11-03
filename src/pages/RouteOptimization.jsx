import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { SectionLoading } from '../components/LoadingIndicator';
import PullToRefresh from '../components/PullToRefresh';
import Notification from '../components/Notification';
import RouteOptimizer from '../components/RouteOptimizer';
import RouteStatistics from '../components/RouteStatistics';
import ItemList from '../components/ItemList';
import { createAnalyticsService } from '../services/analyticsService';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';

// Part 1: Main component and state management
const RouteOptimizationPage = () => {
  // Get auth context
  const { user } = useAuth();
  
  // State for assignments, requests, and user location
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [analyticsService, setAnalyticsService] = useState(null);
  
  // Get offline status
  const { online } = useOffline();
  
  // Initialize analytics service when user is available
  useEffect(() => {
    if (user?.id) {
      const service = createAnalyticsService(user.id);
      setAnalyticsService(service);
      logger.debug('✅ Analytics service initialized for collector:', user.id);
      logger.debug('👤 Current user object:', {
        id: user.id,
        email: user.email,
        phone: user.phone,
        full_user: user
      });
    } else {
      logger.warn('⚠️ User or user.id not available for analytics service');
      logger.debug('👤 User object received:', user);
    }
  }, [user]);
  
  // Get default location from environment variables
  const getDefaultLocation = () => ({
    latitude: import.meta.env.VITE_DEFAULT_LATITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LATITUDE) : 5.6037, // Default to Accra, Ghana
    longitude: import.meta.env.VITE_DEFAULT_LONGITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LONGITUDE) : -0.1870,
    isFallback: true // Flag to indicate this is a fallback location
  });
  
  // Initialize location handling
  useEffect(() => {
    // Immediately set default location to ensure we have something to work with
    const defaultLocation = getDefaultLocation();
    setUserLocation(defaultLocation);
    setUsingFallback(true);
    
    // Don't block the UI while we try to get the real location
    setIsLoading(false);
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Using default location.');
      return; // Early return if geolocation is not supported
    }
    
    // Enhanced geolocation options for better reliability (same as successful fixes on other pages)
    const geoOptions = {
      enableHighAccuracy: false, // Disabled to avoid Google network provider 400 errors
      timeout: 15000,            // 15 second timeout (longer to prevent premature timeouts)
      maximumAge: 300000         // 5 minute cache (longer cache for better performance)
    };
    
    logger.debug('🌍 Attempting to get user location for route optimization...');
    
    // Enhanced success handler
    const handleLocationSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      logger.debug(`✅ Location obtained: ${latitude}, ${longitude} (±${accuracy}m)`);
      
      setUserLocation({
        latitude,
        longitude,
        accuracy,
        timestamp: new Date().getTime(),
        isFallback: false
      });
      setUsingFallback(false);
      setError(null);
    };
    
    // Enhanced error handler with specific error messages
    const handleLocationError = (error) => {
      let errorMessage = 'Using approximate location for route planning.';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location access denied. Using approximate location for route planning.';
          logger.warn('🚫 Geolocation permission denied');
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable. Using approximate location for route planning.';
          logger.warn('📍 Geolocation position unavailable');
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out. Using approximate location for route planning.';
          logger.warn('⏰ Geolocation request timed out');
          break;
        default:
          errorMessage = error.message || 'Failed to get location. Using approximate location for route planning.';
          logger.warn('❌ Geolocation error:', error);
          break;
      }
      
      logger.debug('🔄 Using fallback location due to geolocation error');
      // Show a non-blocking error message
      setError(errorMessage);
    };
    
    // Try to get location with timeout protection
    const locationTimeout = setTimeout(() => {
      logger.debug('⏰ Location request timeout protection triggered, continuing with fallback');
    }, 16000); // Slightly longer than geolocation timeout
    
    // Attempt to get precise location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(locationTimeout);
        handleLocationSuccess(position);
      },
      (error) => {
        clearTimeout(locationTimeout);
        handleLocationError(error);
      },
      geoOptions
    );
    
    // No need for retries or watch position - we're already showing content with the fallback location
    // This simplifies the code and reduces the chance of errors
    
    // No cleanup needed since we're not setting up any watches
  }, []);
  
  // Fetch assignments and requests data using analytics service
  useEffect(() => {
    const fetchData = async () => {
      if (!analyticsService || !online) {
        logger.debug('📍 Skipping data fetch - missing analytics service or offline');
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        logger.debug('📊 Fetching current route data from analytics service...');
        
        // DIAGNOSTIC: Query database directly to see what's there
        logger.debug('🔍 DIAGNOSTIC: Checking database for accepted requests...');
        logger.debug('🔍 DIAGNOSTIC: Current user.id from RouteOptimization:', user?.id);
        
        const { data: diagnosticData, error: diagError } = await supabase
          .from('pickup_requests')
          .select('id, status, collector_id, accepted_at, location')
          .eq('status', 'accepted');
        
        logger.debug(`🔍 DIAGNOSTIC: Total accepted requests in database: ${diagnosticData?.length || 0}`);
        if (diagnosticData && diagnosticData.length > 0) {
          diagnosticData.forEach(req => {
            const isMyRequest = req.collector_id === user?.id;
            logger.debug(`  ${isMyRequest ? '✅' : '❌'} ID: ${req.id}, Status: ${req.status}, Collector: ${req.collector_id}, Match: ${isMyRequest}, Accepted: ${req.accepted_at}`);
          });
          
          // Count how many match current user
          const myRequests = diagnosticData.filter(req => req.collector_id === user?.id);
          logger.debug(`🔍 DIAGNOSTIC: ${myRequests.length} requests match current user ID (${user?.id})`);
        }
        
        // Use analytics service to get current route data
        const result = await analyticsService.getCurrentRouteData();
        
        if (result.success) {
          const { assignments, requests } = result.data;
          
          logger.debug(`✅ Loaded ${assignments.length} assignments and ${requests.length} requests`);
          
          setAssignments(assignments);
          setRequests(requests);
          
          // Log route optimization for analytics
          if (assignments.length > 0) {
            await analyticsService.logRouteOptimization({
              total_assignments: assignments.length,
              total_requests: requests.length,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          logger.error('Failed to fetch route data:', result.error);
          setError(result.error || 'Failed to load route data');
        }
      } catch (error) {
        logger.error('Error in fetchData:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (userLocation && analyticsService) {
      fetchData();
    }
  }, [userLocation, analyticsService, online]);
  
  // Handle refresh using analytics service
  const handleRefresh = async () => {
    if (!online || !analyticsService) {
      setError('You are currently offline or analytics service not available.');
      return Promise.resolve();
    }
    
    try {
      logger.debug('🔄 Refreshing route data...');
      
      // Use analytics service to get fresh route data
      const result = await analyticsService.getCurrentRouteData();
      
      if (result.success) {
        const { assignments, requests } = result.data;
        
        logger.debug(`✅ Refreshed: ${assignments.length} assignments, ${requests.length} requests`);
        
        setAssignments(assignments);
        setRequests(requests);
        
        // Clear any existing errors
        setError(null);
        
        return Promise.resolve();
      } else {
        logger.error('Failed to refresh route data:', result.error);
        setError(result.error || 'Failed to refresh data');
        return Promise.reject(new Error(result.error));
      }
    } catch (error) {
      logger.error('Error refreshing data:', error);
      setError('Failed to refresh data. Please try again.');
      return Promise.reject(error);
    }
  };
  
  return (
    <div className="bg-gray-100 min-h-screen pb-16">
      {/* Notification for showing temporary messages */}
      {error && (
        <Notification 
          message={error} 
          type="warning" 
          duration={5000}
          onClose={() => setError('')}
        />
      )}
      
      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow pt-14">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Route Optimization</h1>
              <p className="text-xs text-gray-600">
                Plan the most efficient route for your pickups
              </p>
            </div>
          </div>
      </div>
        
      {/* Content area with top padding to account for fixed header */}
      <div className="pt-28">
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="max-w-7xl mx-auto px-4 py-2">
            {isLoading ? (
              <SectionLoading text="Loading route data..." />
            ) : (
              <>
                {/* Content area */}
              <div className="space-y-6">
                {/* Route Optimizer Component */}
                <RouteOptimizer 
                  assignments={assignments}
                  requests={requests}
                  userLocation={userLocation}
                  analyticsService={analyticsService}
                />
                
                {/* Route Statistics */}
                <RouteStatistics 
                  assignments={assignments} 
                  userLocation={userLocation}
                  analyticsService={analyticsService}
                />
                
                {/* Item List - Shows only accepted requests for route optimization */}
                <ItemList 
                  assignments={assignments}
                  requests={[]} 
                  userLocation={userLocation}
                />
              </div>
              </>
            )}
          </div>
        </PullToRefresh>
      </div>
    </div>
  );
};

export default RouteOptimizationPage;
