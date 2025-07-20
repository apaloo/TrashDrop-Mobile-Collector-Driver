import React, { useState, useEffect } from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { SectionLoading } from '../components/LoadingIndicator';
import PullToRefresh from '../components/PullToRefresh';
import Notification from '../components/Notification';
import RouteOptimizer from '../components/RouteOptimizer';
import RouteStatistics from '../components/RouteStatistics';
import ItemList from '../components/ItemList';
import { supabase } from '../services/supabase';

// Part 1: Main component and state management
const RouteOptimizationPage = () => {
  // State for assignments, requests, and user location
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  
  // Get offline status
  const { online } = useOffline();
  
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
    
    // Geolocation options
    const geoOptions = {
      enableHighAccuracy: false, // Use low accuracy for faster response
      timeout: 5000,            // 5 seconds timeout
      maximumAge: 60000         // 1 minute cache
    };
    
    // Try to get the user's location once
    const locationTimeout = setTimeout(() => {
      // If this timeout fires, we're already using the fallback location
      console.log('Location request taking too long, continuing with default location');
    }, 6000); // Slightly longer than the geolocation timeout
    
    // Attempt to get precise location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Success - we got a real location
        clearTimeout(locationTimeout);
        
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().getTime(),
          isFallback: false
        });
        setUsingFallback(false);
        setError(null);
        console.log('Location successfully retrieved:', position.coords);
      },
      (error) => {
        // Error getting location - already using fallback
        clearTimeout(locationTimeout);
        
        console.error('Error getting precise location:', error);
        let errorMessage = 'Using approximate location for route planning.';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Using approximate location for route planning.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable. Using approximate location for route planning.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Using approximate location for route planning.';
            break;
        }
        
        // Show a non-blocking error message
        setError(errorMessage);
      },
      geoOptions
    );
    
    // No need for retries or watch position - we're already showing content with the fallback location
    // This simplifies the code and reduces the chance of errors
    
    // No cleanup needed since we're not setting up any watches
  }, []);
  
  // Fetch assignments and requests data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch accepted pickup requests from Supabase
        const { data: acceptedRequests, error } = await supabase
          .from('pickup_requests')
          .select('*')
          .eq('status', 'accepted')
          .order('accepted_at', { ascending: true });
          
        if (error) throw error;
        
        // Transform the data to match the expected format
        const formattedAssignments = (acceptedRequests || []).map(request => ({
          id: request.id,
          type: 'assignment',
          status: request.status,
          location: request.location || 'Location not specified',
          customer_name: request.customer_name || 'Customer',
          latitude: request.coordinates?.lat || 0,
          longitude: request.coordinates?.lng || 0,
          fee: request.fee,
          waste_type: request.waste_type,
          special_instructions: request.special_instructions,
          scheduled_date: request.scheduled_date,
          preferred_time: request.preferred_time
        }));
        
        setAssignments(formattedAssignments);
        setRequests([]); // We don't need pending requests for the route optimization
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data');
        setIsLoading(false);
      }
    };
    
    if (userLocation) {
      fetchData();
    }
  }, [userLocation]);
  
  // Handle refresh
  const handleRefresh = async () => {
    if (!online) {
      setError('You are currently offline. Some features may be limited.');
      return Promise.resolve();
    }
    
    try {
      // Fetch the latest accepted requests from Supabase
      const { data: acceptedRequests, error } = await supabase
        .from('pickup_requests')
        .select('*')
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: true });
        
      if (error) throw error;
      
      // Transform the data to match the expected format
      const formattedAssignments = (acceptedRequests || []).map(request => ({
        id: request.id,
        type: 'assignment',
        status: request.status,
        location: request.location || 'Location not specified',
        customer_name: request.customer_name || 'Customer',
        latitude: request.coordinates?.lat || 0,
        longitude: request.coordinates?.lng || 0,
        fee: request.fee,
        waste_type: request.waste_type,
        special_instructions: request.special_instructions,
        scheduled_date: request.scheduled_date,
        preferred_time: request.preferred_time
      }));
      
      setAssignments(formattedAssignments);
      setRequests([]); // We don't need pending requests for the route optimization
      return Promise.resolve();
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data');
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
      
      <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Route Optimization</h1>
              <p className="text-xs text-gray-600">
                Plan the most efficient route for your pickups
              </p>
            </div>
          </div>
        </div>
        
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
                />
                
                {/* Route Statistics */}
                <RouteStatistics 
                  assignments={assignments} 
                  userLocation={userLocation} 
                />
                
                {/* Item List - Shows both assignments and requests */}
                <ItemList 
                  assignments={assignments}
                  requests={requests}
                  userLocation={userLocation} 
                />
              </div>
              </>
            )}
          </div>
        </PullToRefresh>
      </div>
  );
};

export default RouteOptimizationPage;
