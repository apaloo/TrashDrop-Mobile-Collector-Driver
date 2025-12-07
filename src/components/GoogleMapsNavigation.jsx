import { useEffect, useRef, useState } from 'react';
import { logger } from '../utils/logger';

// Google Maps API Key - you can also move this to .env if preferred
const GOOGLE_MAPS_API_KEY = 'AIzaSyDuYitEO0gBP2iqywnD0X76XGvGzAr9nQA';

const GoogleMapsNavigation = ({ 
  userLocation, 
  destination,
  waypoints = [], // Array of waypoint coordinates [{lat, lng}, ...]
  navigationControlRef, // Ref to expose navigation control functions
  onMapReady,
  onRouteCalculated,
  onError,
  onNavigationStop // Callback when navigation ends
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [navigationSteps, setNavigationSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const gpsWatchIdRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  // Helper function to check if Google Maps API is fully loaded
  const isGoogleMapsFullyLoaded = () => {
    return window.google && 
           window.google.maps && 
           window.google.maps.Map && 
           typeof window.google.maps.Map === 'function';
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateGPSDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Voice announcement function
  const announceInstruction = (instruction, distance) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Clean HTML tags from instruction
      const cleanText = instruction.replace(/<[^>]*>/g, '');
      
      // Create announcement
      const utterance = new SpeechSynthesisUtterance(
        `In ${distance}, ${cleanText}`
      );
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      
      logger.info('🔊 Voice announcement:', cleanText);
    }
  };

  // Load Google Maps API
  useEffect(() => {
    if (isGoogleMapsFullyLoaded()) {
      setIsInitialized(true);
      return;
    }

    const loadGoogleMaps = async () => {
      try {
        // Check if script already exists
        if (document.querySelector('script[src*="maps.googleapis.com"]')) {
          // Wait for it to load
          let attempts = 0;
          const checkLoaded = setInterval(() => {
            if (isGoogleMapsFullyLoaded()) {
              clearInterval(checkLoaded);
              setIsInitialized(true);
              logger.info('✅ Google Maps API already loaded');
            } else if (attempts++ > 50) {
              clearInterval(checkLoaded);
              const error = 'Google Maps API failed to load';
              setHasError(true);
              setErrorMessage(error);
              if (onError) onError(error);
            }
          }, 100);
          return;
        }

        // Load new script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry&loading=async`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          // Wait for google.maps.Map constructor to be fully available
          const checkInterval = setInterval(() => {
            if (isGoogleMapsFullyLoaded()) {
              clearInterval(checkInterval);
              setIsInitialized(true);
              logger.info('✅ Google Maps API loaded successfully');
            }
          }, 100);
        };

        script.onerror = () => {
          const error = 'Failed to load Google Maps API';
          setHasError(true);
          setErrorMessage(error);
          if (onError) onError(error);
          logger.error('❌ Google Maps API loading error');
        };

        document.head.appendChild(script);
      } catch (error) {
        logger.error('❌ Error loading Google Maps:', error);
        setHasError(true);
        setErrorMessage(error.message);
        if (onError) onError(error.message);
      }
    };

    loadGoogleMaps();
  }, [onError]);

  // Initialize map when API is ready
  useEffect(() => {
    if (!isInitialized || !mapRef.current || !userLocation || !destination) {
      return;
    }

    try {
      // Initialize map if not already done
      if (!mapInstanceRef.current) {
        logger.info('🗺️ Initializing Google Maps...');
        
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: userLocation.lat, lng: userLocation.lng },
          zoom: 15,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        mapInstanceRef.current = map;
        
        if (onMapReady) {
          onMapReady(map);
        }

        logger.info('✅ Google Maps initialized successfully');
      }

      const map = mapInstanceRef.current;

      // Clear existing markers
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.setMap(null);
      }

      // Add user location marker (blue dot)
      userMarkerRef.current = new window.google.maps.Marker({
        position: { lat: userLocation.lat, lng: userLocation.lng },
        map: map,
        title: 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });

      // Add destination marker (red pin)
      const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
      const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
      
      destMarkerRef.current = new window.google.maps.Marker({
        position: { lat: destLat, lng: destLng },
        map: map,
        title: 'Destination',
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
        },
      });

      // Initialize Directions Service and Renderer
      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          map: map,
          suppressMarkers: true, // We'll use our custom markers
          polylineOptions: {
            strokeColor: '#4285F4',
            strokeWeight: 5,
            strokeOpacity: 0.8,
          },
        });
      }

      // Calculate and display route
      const directionsService = new window.google.maps.DirectionsService();
      
      // Prepare waypoints for Google Maps API
      const formattedWaypoints = waypoints.map(wp => ({
        location: { lat: wp.lat, lng: wp.lng },
        stopover: true
      }));
      
      const hasWaypoints = formattedWaypoints.length > 0;
      logger.info(`🛣️ Calculating route with ${hasWaypoints ? formattedWaypoints.length + ' waypoints' : 'direct path'}...`);
      
      const directionsRequest = {
        origin: { lat: userLocation.lat, lng: userLocation.lng },
        destination: { lat: destLat, lng: destLng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      };
      
      // Add waypoints if present
      if (hasWaypoints) {
        directionsRequest.waypoints = formattedWaypoints;
        directionsRequest.optimizeWaypoints = false; // Use our optimized order
      }
      
      directionsService.route(
        directionsRequest,
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            directionsRendererRef.current.setDirections(result);
            
            // Extract route information
            const route = result.routes[0];
            
            // Calculate total distance and duration across all legs
            let totalDistance = 0;
            let totalDuration = 0;
            let totalSteps = 0;
            
            // Extract all navigation steps from all legs
            const allSteps = [];
            route.legs.forEach((leg, legIndex) => {
              totalDistance += leg.distance.value; // in meters
              totalDuration += leg.duration.value; // in seconds
              
              leg.steps.forEach((step, stepIndex) => {
                allSteps.push({
                  legIndex,
                  stepIndex,
                  instruction: step.instructions,
                  distance: step.distance.text,
                  distanceValue: step.distance.value,
                  duration: step.duration.text,
                  maneuver: step.maneuver || 'continue',
                  startLocation: step.start_location,
                  endLocation: step.end_location
                });
              });
              
              totalSteps += leg.steps.length;
            });
            
            // Store navigation steps for turn-by-turn
            setNavigationSteps(allSteps);
            
            const routeInfo = {
              distance: `${(totalDistance / 1000).toFixed(1)} km`,
              duration: `${Math.round(totalDuration / 60)} min`,
              steps: totalSteps,
              legs: route.legs.length
            };
            
            logger.info('✅ Route calculated successfully:', routeInfo);
            logger.info(`📍 Extracted ${allSteps.length} navigation steps`);
            
            if (onRouteCalculated) {
              onRouteCalculated(routeInfo);
            }
            
            setIsLoading(false);
          } else {
            const error = `Directions request failed: ${status}`;
            logger.error('❌ Routing error:', error);
            setHasError(true);
            setErrorMessage(error);
            if (onError) onError(error);
            setIsLoading(false);
          }
        }
      );

    } catch (error) {
      logger.error('❌ Error initializing Google Maps:', error);
      setHasError(true);
      setErrorMessage(error.message);
      if (onError) onError(error.message);
      setIsLoading(false);
    }
  }, [isInitialized, userLocation, destination, waypoints, onMapReady, onRouteCalculated, onError]);

  // GPS tracking for auto-advance navigation
  useEffect(() => {
    if (!isNavigating || navigationSteps.length === 0) {
      // Stop GPS tracking when not navigating
      if (gpsWatchIdRef.current) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      return;
    }

    // Start GPS tracking
    logger.info('📍 Starting GPS tracking for auto-advance...');
    
    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        setCurrentPosition({ lat: userLat, lng: userLng });

        // Update user marker on map
        if (userMarkerRef.current && mapInstanceRef.current) {
          userMarkerRef.current.setPosition({ lat: userLat, lng: userLng });
        }

        // Check if we've reached the next step location
        const currentStep = navigationSteps[currentStepIndex];
        if (currentStep && currentStep.endLocation) {
          const distanceToNextPoint = calculateGPSDistance(
            userLat,
            userLng,
            currentStep.endLocation.lat(),
            currentStep.endLocation.lng()
          );

          logger.debug(`Distance to next point: ${distanceToNextPoint.toFixed(0)}m`);

          // Auto-advance when within 30 meters of the step endpoint
          if (distanceToNextPoint < 30) {
            if (currentStepIndex < navigationSteps.length - 1) {
              logger.info(`✅ Reached waypoint! Advancing to step ${currentStepIndex + 2}`);
              
              const nextIndex = currentStepIndex + 1;
              setCurrentStepIndex(nextIndex);
              
              // Announce next instruction
              const nextStep = navigationSteps[nextIndex];
              if (nextStep) {
                announceInstruction(nextStep.instruction, nextStep.distance);
              }
            } else {
              // Reached final destination
              logger.info('🎉 Destination reached!');
              announceInstruction('You have arrived at your destination', '');
              setIsNavigating(false);
              
              // Notify parent
              if (onNavigationStop) {
                onNavigationStop();
              }
            }
          }
          // Voice announcement when 200m away from turn
          else if (distanceToNextPoint < 200 && distanceToNextPoint > 150) {
            const distanceText = `${Math.round(distanceToNextPoint)} meters`;
            announceInstruction(currentStep.instruction, distanceText);
          }
        }
      },
      (error) => {
        logger.error('GPS tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );

    // Cleanup GPS tracking
    return () => {
      if (gpsWatchIdRef.current) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      // Stop any ongoing speech
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isNavigating, navigationSteps, currentStepIndex]);

  // Expose navigation control functions to parent
  useEffect(() => {
    if (navigationControlRef) {
      navigationControlRef.current = {
        startNavigation: () => {
          if (navigationSteps.length > 0) {
            setIsNavigating(true);
            setCurrentStepIndex(0);
            logger.info('🧭 Starting turn-by-turn navigation');
            
            // Announce first instruction
            const firstStep = navigationSteps[0];
            if (firstStep) {
              announceInstruction(firstStep.instruction, firstStep.distance);
            }
          } else {
            logger.warn('⚠️ No navigation steps available');
          }
        },
        stopNavigation: () => {
          setIsNavigating(false);
          logger.info('⏹️ Navigation stopped');
          
          // Stop speech
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
        },
        hasSteps: () => navigationSteps.length > 0
      };
    }
  }, [navigationSteps, navigationControlRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.setMap(null);
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      // Note: Google Maps instance cleanup is automatic when DOM element is removed
    };
  }, []);

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-4">
          <p className="text-red-600 mb-2">⚠️ Map Error</p>
          <p className="text-sm text-gray-600">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map and route...</p>
          </div>
        </div>
      )}
      
      {/* Hands-Free Navigation Overlay - Fullscreen */}
      {isNavigating && navigationSteps.length > 0 && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Current Instruction - Large and Clear */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-blue-600 to-blue-500 text-white shadow-2xl pointer-events-auto">
            <div className="px-6 py-5">
              {/* Progress and Distance */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="bg-white bg-opacity-20 rounded-full px-3 py-1">
                    <span className="text-sm font-bold">
                      {currentStepIndex + 1}/{navigationSteps.length}
                    </span>
                  </div>
                  <svg className="h-5 w-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs opacity-90">GPS Active</span>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {navigationSteps[currentStepIndex]?.distance}
                  </div>
                </div>
              </div>
              
              {/* Main Instruction - Large Text */}
              <div 
                className="text-xl font-semibold leading-snug mb-3"
                dangerouslySetInnerHTML={{ 
                  __html: navigationSteps[currentStepIndex]?.instruction || 'Continue on route' 
                }}
              />
              
              {/* Next Step Preview - Compact */}
              {currentStepIndex < navigationSteps.length - 1 && (
                <div className="bg-white bg-opacity-10 rounded-lg px-3 py-2">
                  <div className="text-xs opacity-75 mb-1">THEN</div>
                  <div 
                    className="text-sm opacity-90"
                    dangerouslySetInnerHTML={{ 
                      __html: navigationSteps[currentStepIndex + 1]?.instruction || 'Continue' 
                    }}
                  />
                </div>
              )}
            </div>
            
            {/* Exit Button - Top Right Corner */}
            <button
              onClick={() => {
                setIsNavigating(false);
                if (window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                // Notify parent
                if (onNavigationStop) {
                  onNavigationStop();
                }
              }}
              className="absolute top-4 right-4 p-2 bg-red-500 hover:bg-red-600 rounded-full shadow-lg transition-colors"
              title="Exit Navigation"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Auto-Advance Indicator */}
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg pointer-events-auto flex items-center space-x-2">
            <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Auto-Navigation Active</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

export default GoogleMapsNavigation;
