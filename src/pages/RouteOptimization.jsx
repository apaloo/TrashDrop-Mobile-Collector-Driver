import React, { useState, useEffect } from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { SectionLoading } from '../components/LoadingIndicator';
import PullToRefresh from '../components/PullToRefresh';
import ErrorBoundary from '../components/ErrorBoundary';
import RouteOptimizer from '../components/RouteOptimizer';

// Part 1: Main component and state management
const RouteOptimizationPage = () => {
  // State for assignments and user location
  const [assignments, setAssignments] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get offline status
  const { online } = useOffline();
  
  // Fetch user's current location with retry mechanism
  useEffect(() => {
    // Track retry attempts
    let retryCount = 0;
    const maxRetries = 3;
    
    // Set geolocation options with higher timeout and maximum age
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds
      maximumAge: 30000 // 30 seconds
    };
    
    const getLocation = () => {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser');
        setIsLoading(false);
        return;
      }
      
      // Create a copy of the options for this attempt
      const currentGeoOptions = {...geoOptions};
      
      // Decrease accuracy requirements on retries
      if (retryCount > 0) {
        currentGeoOptions.enableHighAccuracy = false;
        currentGeoOptions.timeout = 15000; // 15 seconds on retry
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Success - store location and clear errors
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().getTime()
          });
          setIsLoading(false);
          setError(null);
          console.log('Location successfully retrieved:', position.coords);
        },
        (error) => {
          console.error(`Error getting location (attempt ${retryCount + 1}):`, error);
          
          // Try again with reduced accuracy if we haven't exceeded max retries
          if (retryCount < maxRetries) {
            console.log(`Retrying geolocation (${retryCount + 1}/${maxRetries})...`);
            retryCount++;
            // Wait a moment before retrying
            setTimeout(getLocation, 1000);
            return;
          }
          
          // All retries failed, show error and use fallback
          // Provide more specific error messages
          let errorMessage = 'Unable to retrieve your location';
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions in your browser settings and reload the page.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable. This may be due to poor GPS signal or network connectivity issues.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please check your connection and try again.';
              break;
            default:
              errorMessage = `Location error: ${error.message}`;
          }
          
          setError(errorMessage);
          setIsLoading(false);
          
          // Fallback to default location if we can't get user's location
          setUserLocation({
            latitude: import.meta.env.VITE_DEFAULT_LATITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LATITUDE) : 5.6037, // Default to Accra, Ghana
            longitude: import.meta.env.VITE_DEFAULT_LONGITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LONGITUDE) : -0.1870,
            isFallback: true // Flag to indicate this is a fallback location
          });
        },
        currentGeoOptions
      );
    };
    
    getLocation();
    
    // Set up location watching with better error handling
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().getTime()
        });
        setError(null);
      },
      (error) => {
        console.error('Error watching location:', error);
        // Don't update error state here to avoid overriding the initial error message
      },
      geoOptions
    );
    
    // Clean up
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);
  
  // Fetch assignments data
  useEffect(() => {
    const fetchAssignments = async () => {
      setIsLoading(true);
      
      try {
        // In a real app, this would be an API call
        // For now, we'll use mock data
        const mockAssignments = [
          {
            id: '1',
            status: 'accepted',
            location: '123 Main St, City',
            customer_name: 'John Doe',
            latitude: userLocation ? userLocation.latitude + 0.01 : 0,
            longitude: userLocation ? userLocation.longitude + 0.01 : 0
          },
          {
            id: '2',
            status: 'accepted',
            location: '456 Oak Ave, City',
            customer_name: 'Jane Smith',
            latitude: userLocation ? userLocation.latitude - 0.01 : 0,
            longitude: userLocation ? userLocation.longitude - 0.01 : 0
          },
          {
            id: '3',
            status: 'accepted',
            location: '789 Pine Rd, City',
            customer_name: 'Bob Johnson',
            latitude: userLocation ? userLocation.latitude + 0.02 : 0,
            longitude: userLocation ? userLocation.longitude - 0.02 : 0
          }
        ];
        
        setAssignments(mockAssignments);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching assignments:', error);
        setError('Failed to load assignments');
        setIsLoading(false);
      }
    };
    
    if (userLocation) {
      fetchAssignments();
    }
  }, [userLocation]);
  
  // Handle refresh
  const handleRefresh = async () => {
    if (!online) {
      return Promise.resolve();
    }
    
    try {
      // In a real app, this would refresh data from the API
      // For now, we'll just wait a bit to simulate a refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update mock assignments with slightly different coordinates
      const refreshedAssignments = assignments.map(assignment => ({
        ...assignment,
        latitude: assignment.latitude + (Math.random() * 0.002 - 0.001),
        longitude: assignment.longitude + (Math.random() * 0.002 - 0.001)
      }));
      
      setAssignments(refreshedAssignments);
      return Promise.resolve();
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data');
      return Promise.reject(error);
    }
  };
  
  return (
    <ErrorBoundary>
      <div className="bg-gray-100 min-h-screen pb-16">
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
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Route Optimizer Component */}
                <RouteOptimizer 
                  assignments={assignments} 
                  userLocation={userLocation} 
                />
                
                {/* Route Statistics */}
                <RouteStatistics 
                  assignments={assignments} 
                  userLocation={userLocation} 
                />
                
                {/* Assignment List */}
                <AssignmentList 
                  assignments={assignments} 
                  userLocation={userLocation} 
                />
              </div>
            )}
          </div>
        </PullToRefresh>
      </div>
    </ErrorBoundary>
  );
};

export default RouteOptimizationPage;
