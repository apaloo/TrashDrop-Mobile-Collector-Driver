import React, { useState, useEffect } from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { SectionLoading } from '../components/LoadingIndicator';
import PullToRefresh from '../components/PullToRefresh';
import ErrorBoundary from '../components/ErrorBoundary';
import RouteOptimizer from '../components/RouteOptimizer';
import RouteStatistics from '../components/RouteStatistics';
import ItemList from '../components/ItemList';

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
        // In a real app, this would be API calls
        // For now, we'll use mock data
        const mockAssignments = [
          {
            id: 'a1',
            type: 'assignment',
            status: 'accepted',
            location: '123 Main St, City',
            customer_name: 'John Doe',
            latitude: userLocation ? userLocation.latitude + 0.01 : 0,
            longitude: userLocation ? userLocation.longitude + 0.01 : 0
          },
          {
            id: 'a2',
            type: 'assignment',
            status: 'accepted',
            location: '456 Oak Ave, City',
            customer_name: 'Jane Smith',
            latitude: userLocation ? userLocation.latitude - 0.01 : 0,
            longitude: userLocation ? userLocation.longitude - 0.01 : 0
          },
          {
            id: 'a3',
            type: 'assignment',
            status: 'accepted',
            location: '789 Pine Rd, City',
            customer_name: 'Bob Johnson',
            latitude: userLocation ? userLocation.latitude + 0.02 : 0,
            longitude: userLocation ? userLocation.longitude - 0.02 : 0
          }
        ];
        
        // Mock requests data
        const mockRequests = [
          {
            id: 'r1',
            type: 'request',
            status: 'pending',
            location: '321 Elm St, City',
            customer_name: 'Alice Williams',
            latitude: userLocation ? userLocation.latitude - 0.015 : 0,
            longitude: userLocation ? userLocation.longitude + 0.015 : 0
          },
          {
            id: 'r2',
            type: 'request',
            status: 'pending',
            location: '654 Maple Dr, City',
            customer_name: 'David Brown',
            latitude: userLocation ? userLocation.latitude + 0.025 : 0,
            longitude: userLocation ? userLocation.longitude + 0.01 : 0
          }
        ];
        
        setAssignments(mockAssignments);
        setRequests(mockRequests);
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
      
      // Update mock requests with slightly different coordinates
      const refreshedRequests = requests.map(request => ({
        ...request,
        latitude: request.latitude + (Math.random() * 0.002 - 0.001),
        longitude: request.longitude + (Math.random() * 0.002 - 0.001)
      }));
      
      setAssignments(refreshedAssignments);
      setRequests(refreshedRequests);
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
            ) : (
              <>
                {/* Always show error message if present, but don't block content */}
                {error && (
                  <div className="bg-red-50 p-4 rounded-md mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Notice</h3>
                        <div className="mt-2 text-sm text-red-700">
                          <p>{error}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
    </ErrorBoundary>
  );
};

export default RouteOptimizationPage;
