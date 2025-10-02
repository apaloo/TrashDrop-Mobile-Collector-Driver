import { useState, useEffect, useRef, useCallback } from 'react';
import GoogleMapModalComponent from './GoogleMapModalComponent';
import { getCurrentLocation, calculateDistance } from '../utils/geoUtils';
import Toast from './Toast';
import { debounce } from 'lodash';
import { DEV_MODE } from '../services/supabase';

const GEOFENCE_RADIUS = 50; // 50 meters radius for auto-completion
const LOCATION_UPDATE_INTERVAL = 10000; // 10 seconds

const AssignmentNavigationModal = ({
  isOpen,
  onClose,
  destination,
  assignmentId,
  assignmentTitle = 'Assignment',
  onArrival
}) => {
  const [userLocation, setUserLocation] = useState(null);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasArrived, setHasArrived] = useState(false);
  const [arrivalProcessing, setArrivalProcessing] = useState(false);
  const [withinGeofence, setWithinGeofence] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [navigationInstructions, setNavigationInstructions] = useState([]);
  
  const mapRef = useRef(null);
  const locationInterval = useRef(null);
  const toastTimeout = useRef(null);
  const arrivalTimeout = useRef(null);
  const directionsService = useRef(null);
  const directionsRenderer = useRef(null);

  // Toast management
  const showToast = useCallback(({ message, type = 'info' }) => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    setError({ message, type });

    toastTimeout.current = setTimeout(() => {
      setError(null);
      toastTimeout.current = null;
    }, 3000);
  }, []);

  // Format distance for display
  const formatDistance = useCallback((distance) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }, []);

  // Handle when user clicks "Start Cleaning" button
  const handleStartCleaning = useCallback(async () => {
    if (arrivalProcessing || !assignmentId) return;
    
    try {
      setArrivalProcessing(true);
      setHasArrived(true);
      
      console.log(`✅ Assignment ${assignmentId} started - user clicked Start Cleaning`);
      
      // Call the onArrival callback to handle the assignment completion
      if (onArrival) {
        await onArrival(assignmentId);
      }
      
      // Show success message
      showToast({
        message: 'Assignment started! Good luck with the cleaning.',
        type: 'success'
      });
      
    } catch (error) {
      console.error('Error starting assignment:', error);
      showToast({
        message: 'Error starting assignment. Please try again.',
        type: 'error'
      });
      setArrivalProcessing(false);
      setHasArrived(false);
      return;
    }
    
    // Close modal after 1 second
    setTimeout(() => {
      onClose();
    }, 1000);
  }, [assignmentId, onArrival, onClose, arrivalProcessing, showToast]);

  // Parse coordinates to handle different formats (defined early to prevent hoisting issues)
  const parseDestination = useCallback((dest) => {
    if (!dest) return null;
    
    // Handle array format [lat, lng]
    if (Array.isArray(dest) && dest.length >= 2) {
      return { lat: dest[0], lng: dest[1], isFallback: false };
    }
    
    // Handle string coordinates
    if (typeof dest === 'string') {
      try {
        // Handle PostGIS POINT format: "POINT(lng lat)"
        const pointMatch = dest.match(/POINT\(([+-]?\d+\.?\d*) ([+-]?\d+\.?\d*)\)/);
        if (pointMatch) {
          const lng = parseFloat(pointMatch[1]);
          const lat = parseFloat(pointMatch[2]);
          console.log('📍 Parsed PostGIS POINT coordinates:', { lat, lng });
          return { lat, lng, isFallback: false };
        }
        
        // Handle PostGIS binary format - use fallback coordinates
        if (dest.startsWith('0101000020')) {
          // Reduce PostGIS warning spam to 1% frequency
          if (Math.random() < 0.01) {
            console.warn('⚠️ PostGIS binary format detected - using fallback coordinates for assignment');
          }
          // Return Accra coordinates as fallback but mark as fallback
          return { lat: 5.6037, lng: -0.1870, isFallback: true };
        }
        
        // Handle "lat,lng" string
        const coordParts = dest.split(',').map(c => c.trim());
        if (coordParts.length === 2) {
          const lat = parseFloat(coordParts[0]);
          const lng = parseFloat(coordParts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng, isFallback: false };
          }
        }
      } catch (error) {
        console.error('Error parsing destination coordinates:', error);
      }
    }
    
    // Handle object format {lat: x, lng: y}
    if (typeof dest === 'object') {
      const lat = dest.lat || dest.latitude;
      const lng = dest.lng || dest.lon || dest.longitude;
      if (lat !== undefined && lng !== undefined) {
        return { lat, lng, isFallback: false };
      }
    }
    
    console.warn('Unable to parse destination coordinates:', dest);
    return null;
  }, []);

  // Initialize Google Maps Directions API
  const initializeDirectionsAPI = useCallback(() => {
    if (window.google && window.google.maps) {
      directionsService.current = new window.google.maps.DirectionsService();
      directionsRenderer.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: false,
        suppressInfoWindows: true,
        polylineOptions: {
          strokeColor: '#4F46E5',
          strokeWeight: 5,
          strokeOpacity: 0.8
        }
      });
      return true;
    }
    return false;
  }, []);

  // Get navigation route from Google Maps Directions API
  const getNavigationRoute = useCallback(async (origin, destination) => {
    if (!directionsService.current) {
      if (!initializeDirectionsAPI()) {
        console.error('Google Maps not loaded');
        return null;
      }
    }

    return new Promise((resolve, reject) => {
      directionsService.current.route({
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          console.log('🗺️ Navigation route calculated:', result);
          resolve(result);
        } else {
          console.error('❌ Directions request failed:', status);
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }, [initializeDirectionsAPI]);

  // Start in-app navigation
  const startInAppNavigation = useCallback(async () => {
    if (!userLocation) {
      showToast({
        message: 'Unable to get your current location for navigation',
        type: 'error'
      });
      return;
    }

    const destinationObj = parseDestination(destination);
    if (!destinationObj) {
      showToast({
        message: 'Invalid destination coordinates',
        type: 'error'
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('🧭 Starting in-app navigation...');
      
      const route = await getNavigationRoute(userLocation, destinationObj);
      if (!route) {
        throw new Error('Could not calculate route');
      }

      setNavigationRoute(route);
      setCurrentStep(0);
      
      // Extract step-by-step instructions
      const steps = route.routes[0].legs[0].steps.map((step, index) => ({
        index,
        instruction: step.instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
        distance: step.distance.text,
        duration: step.duration.text,
        maneuver: step.maneuver || 'straight',
        startLocation: {
          lat: step.start_location.lat(),
          lng: step.start_location.lng()
        },
        endLocation: {
          lat: step.end_location.lat(),
          lng: step.end_location.lng()
        }
      }));
      
      setNavigationInstructions(steps);
      setIsNavigating(true);
      
      // Display route on map if available
      if (directionsRenderer.current && mapRef.current) {
        directionsRenderer.current.setMap(mapRef.current);
        directionsRenderer.current.setDirections(route);
      }
      
      showToast({
        message: `Navigation started! ${steps.length} steps to destination.`,
        type: 'success'
      });
      
    } catch (error) {
      console.error('❌ Navigation setup failed:', error);
      showToast({
        message: 'Failed to start navigation. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, destination, parseDestination, getNavigationRoute, showToast]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavigationRoute(null);
    setCurrentStep(0);
    setNavigationInstructions([]);
    
    // Clear route from map
    if (directionsRenderer.current) {
      directionsRenderer.current.setMap(null);
    }
    
    console.log('🛑 Navigation stopped');
    showToast({
      message: 'Navigation stopped',
      type: 'info'
    });
  }, [showToast]);

  // Calculate distance to next step
  const getDistanceToNextStep = useCallback(() => {
    if (!navigationInstructions.length || !userLocation || currentStep >= navigationInstructions.length) {
      return null;
    }
    
    const nextStep = navigationInstructions[currentStep];
    return calculateDistance(userLocation, nextStep.startLocation);
  }, [navigationInstructions, userLocation, currentStep]);

  // Update navigation progress
  const updateNavigationProgress = useCallback(() => {
    if (!isNavigating || !navigationInstructions.length || !userLocation) return;
    
    const distanceToNextStep = getDistanceToNextStep();
    
    // If user is within 50m of next step, advance to next instruction
    if (distanceToNextStep && distanceToNextStep <= 0.05 && currentStep < navigationInstructions.length - 1) {
      setCurrentStep(prev => prev + 1);
      console.log(`📍 Advanced to step ${currentStep + 1}/${navigationInstructions.length}`);
      
      // Announce next instruction
      const nextInstruction = navigationInstructions[currentStep + 1];
      if (nextInstruction) {
        showToast({
          message: nextInstruction.instruction,
          type: 'info'
        });
      }
    }
  }, [isNavigating, navigationInstructions, userLocation, currentStep, getDistanceToNextStep, showToast]);

  // Location update with arrival detection
  const updateLocation = useCallback(
    debounce(async () => {
      if (!isOpen || hasArrived) return;
      
      setIsLoading(true);
      
      try {
        const position = await getCurrentLocation();
        setUserLocation(position);
        
        // Parse destination coordinates
        const destinationObj = parseDestination(destination);
        
        // Calculate distance if we have both points
        if (destinationObj && position) {
          const distance = calculateDistance(position, destinationObj);
          setDistanceToDestination(distance);
          
          // Check if within 50m radius (0.05km)
          const withinGeofence = distance <= 0.05;
          
          // Update geofence status - only if using real coordinates
          const canDetectArrival = !usingFallbackDestination && !usingFallbackUserLocation;
          const userWithinGeofence = withinGeofence && canDetectArrival;
          
          // Update geofence state for UI
          setWithinGeofence(userWithinGeofence);
          
          // Update navigation progress if navigating
          if (isNavigating) {
            updateNavigationProgress();
          }
          
          if (userWithinGeofence && !hasArrived) {
            console.log('✅ User arrived within 50m - ready to start cleaning');
            
            // Auto-stop navigation when arrived
            if (isNavigating) {
              stopNavigation();
            }
            
            showToast({
              message: 'You have arrived! You can now start cleaning.',
              type: 'success'
            });
          } else if (withinGeofence && (usingFallbackDestination || usingFallbackUserLocation)) {
            // Reduce fallback coordinate warning spam to 1% frequency
            if (Math.random() < 0.01) {
              console.log('⚠️ Cannot verify precise arrival - using fallback coordinates');
            }
            setWithinGeofence(false); // Don't show arrival state with fallback coords
            showToast({
              message: 'Unable to verify precise location. Please ensure GPS is enabled for accurate distance tracking.',
              type: 'warning'
            });
          }
        } else {
          // Reduce missing coordinates warning to 1% frequency
          if (Math.random() < 0.01) {
            console.warn('Unable to calculate distance - missing coordinates:', { position, destinationObj, destination });
          }
        }
      } catch (err) {
          console.error('Error updating location:', err);
          setError({
            type: 'error',
            message: 'Could not update your location. Please check your GPS settings.'
          });
        } finally {
          setIsLoading(false);
        }
    }, 1000),
    [destination, isOpen, hasArrived, assignmentTitle, formatDistance, arrivalProcessing, parseDestination, isNavigating, updateNavigationProgress, stopNavigation]
  );

  // Initialize location tracking
  useEffect(() => {
    if (!isOpen) return;

    const startLocationTracking = async () => {
      console.log(`🗺️ Starting navigation to ${assignmentTitle}...`);
      
      // Initial location update
      await updateLocation();

      // Set up periodic location updates
      locationInterval.current = setInterval(() => {
        updateLocation();
      }, LOCATION_UPDATE_INTERVAL);
    };

    startLocationTracking();

    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
        locationInterval.current = null;
      }
    };
  }, [isOpen, assignmentTitle, updateLocation]);

  // Clean up on modal close
  useEffect(() => {
    if (!isOpen) {
      // Reset all state
      setError(null);
      setUserLocation(null);
      setHasArrived(false);
      setIsLoading(false);
      setDistanceToDestination(null);
      setArrivalProcessing(false);

      // Clear all timers
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
        locationInterval.current = null;
      }
      if (toastTimeout.current) {
        clearTimeout(toastTimeout.current);
        toastTimeout.current = null;
      }
      if (arrivalTimeout.current) {
        clearTimeout(arrivalTimeout.current);
        arrivalTimeout.current = null;
      }

      // Clear map reference
      if (mapRef.current) {
        mapRef.current = null;
      }
    }
  }, [isOpen]);

  // Handle retry location
  const handleRetryLocation = useCallback(async () => {
    // Provide haptic feedback on mobile devices
    if (navigator.vibrate) {
      navigator.vibrate(50); // Short vibration for button press
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Retrying location update...');
      await updateLocation();
      showToast({
        message: 'Location updated successfully',
        type: 'success'
      });
      
      // Success haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]); // Success pattern
      }
    } catch (err) {
      console.error('❌ Location retry failed:', err);
      showToast({
        message: 'Unable to get location. Please check your GPS settings.',
        type: 'error'
      });
      
      // Error haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]); // Error pattern
      }
    } finally {
      setIsLoading(false);
    }
  }, [updateLocation, showToast]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center overflow-y-auto" style={{ paddingTop: '4rem', paddingBottom: '5rem' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-full overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            Navigate to {assignmentTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close modal"
            disabled={arrivalProcessing}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Area - Google Maps */}
        <div className="flex-1 relative overflow-hidden">
          <div className="relative w-full h-[60vh] bg-gray-100 rounded-lg overflow-hidden">
            {userLocation && parseDestination(destination) ? (
              <GoogleMapModalComponent
                userLocation={userLocation}
                destination={parseDestination(destination)}
                onMapReady={(map) => {
                  console.log(`✅ Google Maps loaded for ${assignmentTitle} navigation`);
                  mapRef.current = map;
                  
                  // Initialize directions API when map is ready
                  initializeDirectionsAPI();
                  
                  // Connect directions renderer to map if navigation is active
                  if (directionsRenderer.current && navigationRoute) {
                    directionsRenderer.current.setMap(map);
                    directionsRenderer.current.setDirections(navigationRoute);
                  }
                }}
                className="w-full h-full"
                shouldInitialize={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600 text-sm">Getting your location...</p>
                  {destination && (
                    <p className="mt-1 text-xs text-gray-500">
                      Parsing assignment coordinates...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Instructions Panel */}
        {isNavigating && navigationInstructions.length > 0 && (
          <div className="bg-blue-50 border-t border-blue-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-2">
                  {currentStep + 1}
                </div>
                <span className="text-sm text-blue-600 font-medium">
                  Step {currentStep + 1} of {navigationInstructions.length}
                </span>
              </div>
              <div className="text-xs text-blue-500">
                {navigationInstructions[currentStep]?.distance} • {navigationInstructions[currentStep]?.duration}
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-200">
              <div className="flex items-start">
                <div className="bg-blue-100 rounded-full p-2 mr-3 flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 font-medium">
                    {navigationInstructions[currentStep]?.instruction}
                  </p>
                  {getDistanceToNextStep() && (
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDistance(getDistanceToNextStep())} to next step
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Next instruction preview */}
            {currentStep < navigationInstructions.length - 1 && (
              <div className="mt-3 text-xs text-gray-500">
                <span className="font-medium">Next:</span> {navigationInstructions[currentStep + 1]?.instruction}
              </div>
            )}
          </div>
        )}

        {/* Status Bar */}
        <div className="bg-white border-t p-5 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {hasArrived ? (
                <div className="flex items-center text-green-600 font-medium">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Assignment Started!
                </div>
              ) : withinGeofence ? (
                <div className="flex items-center text-green-600 font-medium">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 10a7 7 0 1114 0 7 7 0 01-14 0zm7-3a1 1 0 00-.867.5L8 9H6a1 1 0 100 2h2l1.133 1.5a1 1 0 001.734 0L12 11h2a1 1 0 100-2h-2l-1.133-1.5A1 1 0 0010 7z" clipRule="evenodd" />
                  </svg>
                  🎯 You have arrived! Ready to start cleaning.
                </div>
              ) : (
                <div className="text-gray-700">
                  {distanceToDestination !== null && !isNaN(distanceToDestination) ? (
                    <div>
                      <span className="font-medium">
                        {formatDistance(distanceToDestination)} to assignment
                      </span>
                      {(() => {
                        const destinationObj = parseDestination(destination);
                        const usingFallback = destinationObj?.isFallback || userLocation?.isFallback;
                        return usingFallback ? (
                          <div className="text-xs text-amber-600 mt-1">
                            ⚠️ Using approximate location - enable GPS for precise tracking
                          </div>
                        ) : null;
                      })()} 
                    </div>
                  ) : (
                    <span>Calculating distance...</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex space-x-2 min-w-0">
              {error && !hasArrived && (
                <button
                  onClick={handleRetryLocation}
                  className="relative p-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 hover:shadow-md active:scale-95 active:bg-blue-100 transition-all duration-200 font-medium flex-shrink-0 transform hover:scale-105 overflow-hidden group"
                  disabled={isLoading}
                  title={isLoading ? 'Retrying...' : 'Retry Location'}
                >
                  {/* Ripple effect overlay */}
                  <div className="absolute inset-0 rounded-lg opacity-0 group-active:opacity-100 group-active:animate-ping bg-blue-200 transition-opacity duration-300"></div>
                  
                  {/* Pulse effect on click */}
                  <div className={`absolute inset-0 rounded-lg transition-all duration-500 ${isLoading ? 'animate-pulse bg-blue-100' : ''}`}></div>
                  
                  <div className={`relative transition-all duration-300 ${isLoading ? 'animate-spin' : 'hover:rotate-180 group-active:rotate-90 group-active:scale-110'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                </button>
              )}
              
              {!hasArrived && !withinGeofence && userLocation && parseDestination(destination) && !isNavigating && (
                <button
                  onClick={startInAppNavigation}
                  className="flex-1 min-w-0 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                  disabled={isLoading}
                >
                  <div className="flex items-center justify-center min-w-0">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span className="truncate">
                      {isLoading ? 'Starting...' : 'Start Navigation'}
                    </span>
                  </div>
                </button>
              )}
              
              {isNavigating && (
                <button
                  onClick={stopNavigation}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm"
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Stop Navigation
                  </div>
                </button>
              )}
              
              {hasArrived && (
                <div className="flex items-center text-green-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                  <span className="text-sm">Assignment started...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Success Message Overlay */}
        {hasArrived && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="bg-white rounded-lg p-6 m-4 max-w-sm text-center shadow-2xl">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Mission Accomplished!</h3>
              <p className="text-gray-600">{assignmentTitle} has been completed successfully.</p>
            </div>
          </div>
        )}

        {/* Error Toast */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          {error && (
            <Toast
              message={typeof error === 'object' ? error.message : error}
              type={typeof error === 'object' ? error.type : 'error'}
              onClose={() => setError(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentNavigationModal;
