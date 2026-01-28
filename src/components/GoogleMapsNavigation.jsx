import { useEffect, useRef, useState } from 'react';
import { logger } from '../utils/logger';
import { audioAlertService } from '../services/audioAlertService';

// Google Maps API Key from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ============================================
// Custom SVG Icon Generators for Google Maps
// (Matching the Request map icons from markerIcons.js)
// ============================================

// Create tricycle SVG icon for user location (matches Leaflet tricycleIcon)
const createTricycleSvgUrl = () => {
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="60" height="36">
      <!-- Shadow effect -->
      <ellipse cx="50" cy="55" rx="30" ry="5" fill="rgba(0,0,0,0.2)"/>
      
      <!-- Main tricycle -->
      <g>
        <!-- Cargo area with 3D effect -->
        <path d="M65,40 L90,40 Q95,40 95,35 L95,30 Q95,25 90,25 L65,25 Q60,25 60,30 L60,35 Q60,40 65,40 Z" 
              fill="#1d4ed8" stroke="#1e40af" stroke-width="1.5" stroke-linejoin="round"/>
        <!-- Side panel for 3D effect -->
        <path d="M90,40 L95,35 L95,30 L90,25 L90,40 Z" fill="#1e40af" stroke="#1e40af" stroke-width="1"/>
        
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
        
        <!-- Driver indicator -->
        <circle cx="45" cy="20" r="6" fill="#22c55e" stroke="#fff" stroke-width="1.5"/>
        <circle cx="45" cy="20" r="3" fill="#fff"/>
      </g>
    </svg>
  `;
  
  const svgBase64 = btoa(unescape(encodeURIComponent(svgTemplate)));
  return `data:image/svg+xml;base64,${svgBase64}`;
};

// Create dustbin SVG icon for destination (matches Leaflet dustbin icons)
const createDustbinSvgUrl = (wasteType, sourceType) => {
  // Determine color based on waste type (same logic as Map.jsx)
  const typeColorMap = {
    recyclable: 'request',
    organic: 'assignment',
    hazardous: 'request',
    electronic: 'assignment',
    general: 'assignment',
    plastic: 'request',
    paper: 'assignment',
    metal: 'request',
    glass: 'assignment'
  };
  
  // Digital bins are always black
  if (sourceType === 'digital_bin') {
    return createDigitalBinSvgUrl();
  }
  
  const iconType = typeColorMap[wasteType?.toLowerCase()] || 'assignment';
  
  const colors = {
    request: {
      main: '#EF4444', // Red-500
      dark: '#DC2626', // Red-600
      badge: 'R'
    },
    assignment: {
      main: '#3B82F6', // Blue-500
      dark: '#2563EB', // Blue-600
      badge: 'A'
    }
  };
  
  const currentColor = colors[iconType];
  
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64">
      <!-- Wheels -->
      <circle cx="12" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      <circle cx="36" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      
      <!-- Wheel highlights -->
      <circle cx="12" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      <circle cx="36" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      
      <!-- Bin body -->
      <path fill="${currentColor.main}" stroke="${currentColor.dark}" stroke-width="1.5" 
            d="M40,16h-4v-2c0-1.1-0.9-2-2-2H14c-1.1,0-2,0.9-2,2v2H8v32c0,4.4,3.6,8,8,8h16c4.4,0,8-3.6,8-8V16H40z M18,16v-2h12v2H18z"/>
      
      <!-- Bin lid -->
      <path fill="${currentColor.dark}" stroke="${currentColor.dark}" stroke-width="1.5" 
            d="M40,16H8c-1.1,0-2-0.9-2-2v-2c0-1.1,0.9-2,2-2h32c1.1,0,2,0.9,2,2v2C42,15.1,41.1,16,40,16z"/>
      
      <!-- Lid handle -->
      <rect x="20" y="10" width="8" height="2" rx="1" fill="#9CA3AF"/>
      
      <!-- Recycling symbol -->
      <path fill="#FFFFFF" d="M24,24c-0.3,0-0.5,0.1-0.7,0.3l-4,4c-0.4,0.4-0.4,1,0,1.4l4,4c0.2,0.2,0.4,0.3,0.7,0.3s0.5-0.1,0.7-0.3l4-4c0.4-0.4,0.4-1,0-1.4l-4-4C24.5,24.1,24.3,24,24,24z M24,30.6L21.4,28l2.6-2.6l2.6,2.6L24,30.6z"/>
      
      <!-- Type indicator -->
      <circle cx="38" cy="12" r="6" fill="white" stroke="${currentColor.dark}" stroke-width="1.5"/>
      <text x="38" y="15" font-size="8" text-anchor="middle" fill="${currentColor.dark}" font-weight="bold" font-family="Arial, sans-serif">
        ${currentColor.badge}
      </text>
    </svg>
  `;
  
  const svgBase64 = btoa(unescape(encodeURIComponent(svgTemplate)));
  return `data:image/svg+xml;base64,${svgBase64}`;
};

// Create black dustbin SVG for digital bins
const createDigitalBinSvgUrl = () => {
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64">
      <!-- Wheels -->
      <circle cx="12" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      <circle cx="36" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      
      <!-- Wheel highlights -->
      <circle cx="12" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      <circle cx="36" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      
      <!-- Bin body - Black -->
      <path fill="#000000" stroke="#1F2937" stroke-width="1.5" 
            d="M40,16h-4v-2c0-1.1-0.9-2-2-2H14c-1.1,0-2,0.9-2,2v2H8v32c0,4.4,3.6,8,8,8h16c4.4,0,8-3.6,8-8V16H40z M18,16v-2h12v2H18z"/>
      
      <!-- Bin lid -->
      <path fill="#1F2937" stroke="#1F2937" stroke-width="1.5" 
            d="M40,16H8c-1.1,0-2-0.9-2-2v-2c0-1.1,0.9-2,2-2h32c1.1,0,2,0.9,2,2v2C42,15.1,41.1,16,40,16z"/>
      
      <!-- Lid handle -->
      <rect x="20" y="10" width="8" height="2" rx="1" fill="#9CA3AF"/>
      
      <!-- Digital indicator -->
      <path fill="#FFFFFF" d="M18,24 L30,24 Q32,24 32,26 L32,34 Q32,36 30,36 L18,36 Q16,36 16,34 L16,26 Q16,24 18,24 Z"/>
      <text x="24" y="32" font-size="8" text-anchor="middle" fill="#000000" font-weight="bold" font-family="Arial, sans-serif">D</text>
      
      <!-- Type indicator -->
      <circle cx="38" cy="12" r="6" fill="white" stroke="#1F2937" stroke-width="1.5"/>
      <text x="38" y="15" font-size="8" text-anchor="middle" fill="#1F2937" font-weight="bold" font-family="Arial, sans-serif">
        D
      </text>
    </svg>
  `;
  
  const svgBase64 = btoa(unescape(encodeURIComponent(svgTemplate)));
  return `data:image/svg+xml;base64,${svgBase64}`;
};

if (!GOOGLE_MAPS_API_KEY) {
  logger.error('❌ VITE_GOOGLE_MAPS_API_KEY is not set. Please add it to your .env file or Netlify environment variables.');
}

const GoogleMapsNavigation = ({ 
  userLocation, 
  destination,
  destinationName = '', // Name of destination for arrival announcement
  waypoints = [], // Array of waypoint coordinates [{lat, lng}, ...]
  navigationControlRef, // Ref to expose navigation control functions
  onMapReady,
  onRouteCalculated,
  onError,
  onNavigationStop, // Callback when navigation ends
  wasteType = 'general', // Waste type for destination icon color
  sourceType = 'pickup_request' // Source type (pickup_request or digital_bin)
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  
  // Store callbacks in refs to avoid infinite loops in useEffect
  const onMapReadyRef = useRef(onMapReady);
  const onRouteCalculatedRef = useRef(onRouteCalculated);
  const onErrorRef = useRef(onError);
  
  // Keep refs updated with latest callbacks
  onMapReadyRef.current = onMapReady;
  onRouteCalculatedRef.current = onRouteCalculated;
  onErrorRef.current = onError;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [navigationSteps, setNavigationSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [isFollowMode, setIsFollowMode] = useState(true); // Auto-follow user by default
  const [mapInitialized, setMapInitialized] = useState(false); // Track if map has been initialized
  const gpsWatchIdRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  const routeCalculatedForRef = useRef(null); // Track destination for which route was calculated
  const lastUserLocationRef = useRef(null); // Track last user location for smooth updates

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

  // Voice announcement function using audio alert service
  const announceInstruction = (instruction, distance) => {
    audioAlertService.announceNavigation(instruction, distance);
  };

  // Arrival announcement with sound and vibration
  const announceArrival = (locationName) => {
    audioAlertService.announceArrival(locationName || 'pickup location', {
      playSound: true,
      vibrate: true,
      speak: true,
      repeat: true,       // Repeat if not acknowledged
      repeatInterval: 15000 // Every 15 seconds
    });
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
              if (onErrorRef.current) onErrorRef.current(error);
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
          if (onErrorRef.current) onErrorRef.current(error);
          logger.error('❌ Google Maps API loading error');
        };

        document.head.appendChild(script);
      } catch (error) {
        logger.error('❌ Error loading Google Maps:', error);
        setHasError(true);
        setErrorMessage(error.message);
        if (onErrorRef.current) onErrorRef.current(error.message);
      }
    };

    loadGoogleMaps();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOfflineMode(false);
      logger.info('🌐 Back online');
    };
    
    const handleOffline = () => {
      setIsOfflineMode(true);
      logger.info('📵 Gone offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cached route if offline
  useEffect(() => {
    if (!isOfflineMode || navigationSteps.length > 0) return;
    
    try {
      const cachedData = localStorage.getItem('cachedNavigationRoute');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        
        // Check if cache is expired (24 hours)
        if (parsedData.expiresAt > Date.now()) {
          logger.info('📦 Loading cached route for offline navigation');
          setNavigationSteps(parsedData.steps || []);
          setIsLoading(false);
          setHasError(false);
          
          if (onRouteCalculated && parsedData.routeInfo) {
            onRouteCalculated(parsedData.routeInfo);
          }
        } else {
          logger.info('⚠️ Cached route expired');
          localStorage.removeItem('cachedNavigationRoute');
        }
      }
    } catch (error) {
      logger.error('Error loading cached route:', error);
    }
  }, [isOfflineMode, navigationSteps.length, onRouteCalculated]);

  // Initialize map when API is ready
  useEffect(() => {
    if (!isInitialized || !mapRef.current || !userLocation || !destination) {
      return;
    }

    // Create a destination key to check if we've already calculated this route
    const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
    const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
    const destinationKey = `${destLat.toFixed(6)},${destLng.toFixed(6)}`;
    
    // Skip if route already calculated for this destination
    const shouldCalculateRoute = routeCalculatedForRef.current !== destinationKey;

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
        
        if (onMapReadyRef.current) {
          onMapReadyRef.current(map);
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

      // Add user location marker (tricycle icon - matching Request map)
      userMarkerRef.current = new window.google.maps.Marker({
        position: { lat: userLocation.lat, lng: userLocation.lng },
        map: map,
        title: 'Your Location',
        icon: {
          url: createTricycleSvgUrl(),
          scaledSize: new window.google.maps.Size(60, 36),
          anchor: new window.google.maps.Point(30, 18),
        },
      });

      // Add destination marker (red pin)
      const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
      const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
      
      // Add destination marker (dustbin icon - matching Request map)
      destMarkerRef.current = new window.google.maps.Marker({
        position: { lat: destLat, lng: destLng },
        map: map,
        title: 'Destination',
        icon: {
          url: createDustbinSvgUrl(wasteType, sourceType),
          scaledSize: new window.google.maps.Size(48, 64),
          anchor: new window.google.maps.Point(24, 64),
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

      // Only calculate route if destination changed (prevents infinite loop)
      if (!shouldCalculateRoute) {
        logger.debug('📍 Skipping route calculation - already calculated for this destination');
        setIsLoading(false);
        return;
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
      
      // Mark that we're calculating for this destination
      routeCalculatedForRef.current = destinationKey;
      
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
            
            // Cache route data for offline use
            try {
              const offlineRouteData = {
                steps: allSteps,
                routeInfo,
                timestamp: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
              };
              localStorage.setItem('cachedNavigationRoute', JSON.stringify(offlineRouteData));
              logger.info('💾 Route cached for offline navigation');
            } catch (error) {
              logger.warn('Failed to cache route:', error);
            }
            
            logger.info('✅ Route calculated successfully:', routeInfo);
            logger.info(`📍 Extracted ${allSteps.length} navigation steps`);
            
            if (onRouteCalculatedRef.current) {
              onRouteCalculatedRef.current(routeInfo);
            }
            
            setIsLoading(false);
          } else {
            const error = `Directions request failed: ${status}`;
            logger.error('❌ Routing error:', error);
            setHasError(true);
            setErrorMessage(error);
            if (onErrorRef.current) onErrorRef.current(error);
            setIsLoading(false);
          }
        }
      );

    } catch (error) {
      logger.error('❌ Error initializing Google Maps:', error);
      setHasError(true);
      setErrorMessage(error.message);
      if (onErrorRef.current) onErrorRef.current(error.message);
      setIsLoading(false);
    }
  }, [isInitialized, userLocation, destination, waypoints, wasteType, sourceType]);

  // Real-time marker position update (separate from route calculation)
  useEffect(() => {
    if (!mapInstanceRef.current || !userMarkerRef.current || !userLocation) {
      return;
    }

    // Check if location actually changed significantly (>5m) to avoid jitter
    const lastLoc = lastUserLocationRef.current;
    if (lastLoc) {
      const distance = calculateGPSDistance(
        lastLoc.lat, lastLoc.lng,
        userLocation.lat, userLocation.lng
      );
      if (distance < 5) {
        return; // Skip tiny movements
      }
    }

    // Update marker position smoothly
    userMarkerRef.current.setPosition({ 
      lat: userLocation.lat, 
      lng: userLocation.lng 
    });
    
    // Store last location
    lastUserLocationRef.current = { lat: userLocation.lat, lng: userLocation.lng };

    // Auto-pan map to follow user in follow mode
    if (isFollowMode && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      
      // Use higher zoom for navigation mode (better for parallel roads)
      const navigationZoom = 17;
      const currentZoom = map.getZoom();
      
      // Only adjust zoom if significantly different or first time
      if (currentZoom < navigationZoom - 1) {
        map.setZoom(navigationZoom);
      }
      
      // Smoothly pan to user location
      map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
    }

    logger.debug(`📍 Marker updated to: ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`);
  }, [userLocation, isFollowMode]);

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
              
              // Use enhanced arrival alert with sound and vibration
              announceArrival(destinationName || 'pickup location');
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
        startNavigation: async () => {
          if (navigationSteps.length > 0) {
            // Initialize audio service (requires user interaction)
            await audioAlertService.initialize();
            audioAlertService.resetArrivalState();
            
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
          
          // Stop audio alerts and acknowledge arrival
          audioAlertService.acknowledgeArrival();
          audioAlertService.stopSpeaking();
        },
        acknowledgeArrival: () => {
          audioAlertService.acknowledgeArrival();
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
      // Cleanup audio alerts
      audioAlertService.acknowledgeArrival();
      audioAlertService.stopSpeaking();
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
      
      {/* Hands-Free Navigation Overlay - Compact */}
      {isNavigating && navigationSteps.length > 0 && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Current Instruction - Compact Design */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-blue-600 to-blue-500 text-white shadow-lg pointer-events-auto">
            <div className="px-3 py-2">
              {/* Progress and Distance - Single Row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <div className="bg-white bg-opacity-20 rounded-full px-2 py-0.5">
                    <span className="text-xs font-bold">
                      {currentStepIndex + 1}/{navigationSteps.length}
                    </span>
                  </div>
                  <svg className="h-4 w-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs opacity-90">GPS Active</span>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {navigationSteps[currentStepIndex]?.distance}
                  </div>
                </div>
              </div>
              
              {/* Main Instruction - Compact */}
              <div 
                className="text-base font-semibold leading-tight"
                dangerouslySetInnerHTML={{ 
                  __html: navigationSteps[currentStepIndex]?.instruction || 'Continue on route' 
                }}
              />
              
              {/* Next Step Preview - Very Compact, Single Line */}
              {currentStepIndex < navigationSteps.length - 1 && (
                <div className="bg-white bg-opacity-10 rounded px-2 py-1 mt-1 flex items-center">
                  <span className="text-xs opacity-75 mr-2">THEN</span>
                  <span 
                    className="text-xs opacity-90 truncate"
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
              className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full shadow-lg transition-colors"
              title="Exit Navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Auto-Advance Indicator with Offline Status */}
          <div className={`absolute bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full shadow-lg pointer-events-auto flex items-center space-x-2 ${
            isOfflineMode ? 'bg-orange-500' : 'bg-green-500'
          } text-white`}>
            <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {isOfflineMode ? 'Offline Navigation Active' : 'Auto-Navigation Active'}
            </span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isOfflineMode ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
        </div>
      )}
      
      {/* Map Control Buttons - Positioned to avoid Google Maps native controls */}
      {!isLoading && (
        <div className="absolute bottom-4 left-4 z-10 flex flex-col space-y-2">
          {/* Recenter / Follow Mode Toggle */}
          <button
            onClick={() => {
              if (!isFollowMode) {
                // Switching to follow mode - recenter and zoom in
                setIsFollowMode(true);
                if (mapInstanceRef.current && userLocation) {
                  mapInstanceRef.current.setZoom(17);
                  mapInstanceRef.current.panTo({ lat: userLocation.lat, lng: userLocation.lng });
                }
              } else {
                // Switching to overview mode - fit bounds to show entire route
                setIsFollowMode(false);
                if (mapInstanceRef.current && userLocation && destination) {
                  const bounds = new window.google.maps.LatLngBounds();
                  bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
                  const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
                  const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
                  bounds.extend({ lat: destLat, lng: destLng });
                  mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
                }
              }
            }}
            className={`p-3 rounded-full shadow-lg transition-all ${
              isFollowMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            title={isFollowMode ? 'Show full route (Overview)' : 'Follow my location'}
          >
            {isFollowMode ? (
              // Crosshairs icon - currently following
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
            ) : (
              // Location arrow icon - click to follow
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          
          {/* Overview button - quick access to see full route */}
          {isFollowMode && (
            <button
              onClick={() => {
                if (mapInstanceRef.current && userLocation && destination) {
                  const bounds = new window.google.maps.LatLngBounds();
                  bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
                  const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
                  const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
                  bounds.extend({ lat: destLat, lng: destLng });
                  mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
                  setIsFollowMode(false);
                }
              }}
              className="p-3 rounded-full shadow-lg bg-white text-gray-700 hover:bg-gray-100 transition-all"
              title="View full route"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </button>
          )}
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

export default GoogleMapsNavigation;
