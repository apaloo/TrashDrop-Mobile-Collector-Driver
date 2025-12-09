import React, { useEffect, useRef, useState } from 'react';
import { logger } from '../utils/logger';

// Google Maps configuration with fallback to .env.example value
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDuYitEO0gBP2iqywnD0X76XGvGzAr9nQA';

if (!GOOGLE_MAPS_API_KEY) {
  logger.error('❌ VITE_GOOGLE_MAPS_API_KEY environment variable is not set');
} else if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
  logger.debug('💡 Using fallback Google Maps API key from .env.example');
}

// Load Google Maps API with enhanced validation and preload support
const loadGoogleMapsAPI = () => {
  return new Promise((resolve, reject) => {
    // Check if Google Maps is fully loaded with all required objects
    if (window.googleMapsReady && window.google && window.google.maps && window.google.maps.MapTypeId) {
      logger.debug('✅ Google Maps fully loaded from preload (Modal)');
      resolve(window.google.maps);
      return;
    }
    
    // Check if Google Maps is available without preload flag
    if (window.google && window.google.maps && window.google.maps.MapTypeId && window.google.maps.MapTypeId.ROADMAP) {
      logger.debug('✅ Google Maps fully loaded (Modal)');
      resolve(window.google.maps);
      return;
    }

    // Listen for global ready event or check existing script
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existingScript || window.googleMapsReady === false) {
      logger.debug('⏳ Google Maps script exists or preloaded, waiting for complete load... (Modal)');
      // Wait for the API to be ready with enhanced validation
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds timeout
      const checkReady = () => {
        if ((window.googleMapsReady && window.google && window.google.maps) ||
            (window.google && window.google.maps && window.google.maps.MapTypeId && window.google.maps.MapTypeId.ROADMAP)) {
          logger.debug('✅ Google Maps API fully ready (Modal)');
          resolve(window.google.maps);
        } else if (attempts++ < maxAttempts) {
          setTimeout(checkReady, 100);
        } else {
          reject(new Error('Google Maps API timeout - not ready after 10 seconds'));
        }
      };
      checkReady();
      return;
    }

    // Create new script
    logger.debug('🔄 Loading Google Maps API script... (Modal)');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      logger.debug('📜 Google Maps script loaded, validating complete API... (Modal)');
      // Poll for complete API availability with enhanced validation
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds timeout
      const checkFullyLoaded = () => {
        if (window.google && 
            window.google.maps && 
            window.google.maps.MapTypeId && 
            window.google.maps.MapTypeId.ROADMAP) {
          logger.debug('✅ Google Maps API fully ready with MapTypeId (Modal)');
          resolve(window.google.maps);
        } else if (attempts++ < maxAttempts) {
          setTimeout(checkFullyLoaded, 100);
        } else {
          reject(new Error('Google Maps API incomplete - MapTypeId not available'));
        }
      };
      checkFullyLoaded();
    };

    script.onerror = (error) => {
      logger.error('❌ Failed to load Google Maps script (Modal):', error);
      // Check for common API key issues
      if (error.type === 'error' || error.message?.includes('ApiNotActivatedMapError')) {
        reject(new Error('Google Maps API key invalid or not activated. Please check your API key configuration.'));
      } else {
        reject(new Error('Failed to load Google Maps script - network or configuration issue'));
      }
    };

    document.head.appendChild(script);
  });
};

// Create user location icon (tricycle)
const createUserLocationIcon = () => {
  if (!window.google || !window.google.maps) {
    return null;
  }
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="40" height="24">
        <circle cx="20" cy="45" r="8" fill="#1f2937"/>
        <circle cx="80" cy="45" r="6" fill="#1f2937"/>
        <path d="M65,35 L85,35 Q90,35 90,30 L90,25 Q90,20 85,20 L65,20 Q60,20 60,25 L60,30 Q60,35 65,35 Z" fill="#1d4ed8"/>
        <path d="M30,20 L40,35 L60,35" stroke="#1f2937" stroke-width="3" fill="none"/>
        <rect x="33" y="17" width="8" height="5" rx="2" fill="#dc2626"/>
        <rect x="67" y="25" width="6" height="6" rx="1" fill="#059669"/>
        <rect x="76" y="25" width="6" height="6" rx="1" fill="#059669"/>
      </svg>
    `)}`,
    scaledSize: new window.google.maps.Size(40, 24),
    anchor: new window.google.maps.Point(20, 12)
  };
};

// Create destination marker icon
const createDestinationIcon = () => {
  if (!window.google || !window.google.maps) {
    return null;
  }
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#ef4444" stroke="white" stroke-width="2"/>
        <path d="M10 12h12l-1 10H11z" fill="white"/>
        <path d="M13 11h2v12h-2zM17 11h2v12h-2z" fill="#ef4444"/>
      </svg>
    `)}`,
    scaledSize: new window.google.maps.Size(32, 32),
    anchor: new window.google.maps.Point(16, 32)
  };
};

// Helper function to normalize coordinates to [lat, lng] format
const normalizeCoords = (coords) => {
  if (!coords) return null;
  
  // Handle array format [lat, lng]
  if (Array.isArray(coords) && coords.length >= 2) {
    return [coords[0], coords[1]];
  }
  
  // Handle string coordinates
  if (typeof coords === 'string') {
    try {
      // Handle PostGIS POINT format: "POINT(lng lat)"
      const pointMatch = coords.match(/POINT\(([+-]?\d+\.?\d*) ([+-]?\d+\.?\d*)\)/);
      if (pointMatch) {
        const lng = parseFloat(pointMatch[1]);
        const lat = parseFloat(pointMatch[2]);
        logger.debug('📍 Parsed PostGIS POINT coordinates:', { lat, lng });
        return [lat, lng];
      }
      
      // Handle PostGIS binary format - extract readable coordinates
      if (coords.startsWith('0101000020')) {
        logger.warn('⚠️ PostGIS binary format detected - using fallback coordinates');
        // For now, return Accra coordinates as fallback
        // TODO: Implement proper PostGIS binary parsing
        return [5.6037, -0.1870]; // Accra, Ghana
      }
      
      // Handle "lat,lng" string
      const coordParts = coords.split(',').map(c => c.trim());
      if (coordParts.length === 2) {
        const lat = parseFloat(coordParts[0]);
        const lng = parseFloat(coordParts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          return [lat, lng];
        }
      }
    } catch (error) {
      logger.error('Error parsing string coordinates:', error);
    }
  }
  
  // Handle object format {lat: x, lng: y}
  if (typeof coords === 'object') {
    const lat = coords.lat || coords.latitude;
    const lng = coords.lng || coords.lon || coords.longitude;
    if (lat !== undefined && lng !== undefined) {
      return [lat, lng];
    }
  }
  
  logger.warn('Unable to normalize coordinates:', coords);
  return null;
};

const GoogleMapModalComponent = ({ 
  userLocation, 
  destination, 
  onMapReady,
  className = "w-full h-full",
  shouldInitialize = true // Add control prop
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('Initializing map...');
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const initializationAttemptedRef = useRef(false);

  // Initialize map with enhanced error handling
  const initMap = async () => {
    // Prevent multiple initialization attempts
    if (initializationAttemptedRef.current) {
      return;
    }
    initializationAttemptedRef.current = true;

    try {
      setIsLoading(true);
      setHasError(false);
      setLoadingPhase('Loading map...');
      logger.debug('📍 Initializing Google Maps modal...');
      
      // Validate API key first
      if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your-api-key-here') {
        throw new Error('Google Maps API key not configured');
      }
      
      setLoadingPhase('Loading map API...');
      const maps = await loadGoogleMapsAPI();
      
      // Validate complete API object
      if (!maps.MapTypeId || !maps.MapTypeId.ROADMAP) {
        throw new Error('Google Maps API incomplete - MapTypeId not available');
      }
      
      setLoadingPhase('Creating map...');
      
      if (!mapRef.current) {
        throw new Error('Map container not available');
      }

      // Create the map with optimized settings
      const map = new maps.Map(mapRef.current, {
        zoom: 15,
        center: { lat: 5.6037, lng: -0.1870 }, // Default to Accra
        mapTypeId: maps.MapTypeId.ROADMAP,
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
        disableDefaultUI: false,
        gestureHandling: 'greedy',
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "transit",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      });

      logger.debug('✅ Google Maps modal created successfully');
      
      setLoadingPhase('Preparing navigation...');
      
      // Store references
      mapInstanceRef.current = map;
      directionsServiceRef.current = new maps.DirectionsService();
      directionsRendererRef.current = new maps.DirectionsRenderer({
        suppressMarkers: true, // We'll add custom markers
        polylineOptions: {
          strokeColor: '#1d4ed8',
          strokeOpacity: 0.8,
          strokeWeight: 4
        }
      });
      
      directionsRendererRef.current.setMap(map);
      
      // Notify parent that map is ready
      if (onMapReady) {
        onMapReady(map);
      }
      
      setIsLoading(false);
    } catch (error) {
      logger.error('❌ Google Maps initialization failed:', error);
      setHasError(true);
      setErrorMessage(error.message);
      setIsLoading(false);
      initializationAttemptedRef.current = false; // Allow retry
    }
  };

  // Initialize map after component mounts and DOM is ready
  useEffect(() => {

    // Don't initialize if not supposed to or if we've already attempted initialization (unless there was an error)
    if (!shouldInitialize) {

      return;
    }

    const initMapWhenReady = async () => {
      // Only initialize if not already attempted or if we have an error to retry
      if (initializationAttemptedRef.current && !hasError) {
        return;
      }
      

      
      // Wait until the DOM element is actually available
      let attempts = 0;
      const maxWaitAttempts = 50; // 5 seconds max wait
      while (!mapRef.current && attempts < maxWaitAttempts) {

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!mapRef.current) {
        logger.error('❌ Map container still not found after waiting');
        setHasError(true);
        setErrorMessage('Map container not available');
        setIsLoading(false);
        return;
      }
      
      try {
        await initMap();
      } catch (error) {
        logger.error('❌ Failed to initialize Google Maps modal:', error);
        setHasError(true);
        setErrorMessage(error.message || 'Failed to load navigation map');
        setIsLoading(false);
      }
    };

    // Start initialization after a small delay to ensure DOM is rendered
    const timeoutId = setTimeout(initMapWhenReady, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [shouldInitialize]); // Re-run when shouldInitialize changes

  // Update markers and routing when locations change
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation || !destination) return;

    // Normalize coordinates
    const normalizedUserLocation = normalizeCoords(userLocation);
    const normalizedDestination = normalizeCoords(destination);
    
    if (!normalizedUserLocation || !normalizedDestination) {
      logger.error('❌ Invalid coordinates provided:', { userLocation, destination });
      return;
    }

    // Show route calculation loading state
    setIsCalculatingRoute(true);
    setLoadingPhase('Calculating route...');
    
    // Only log route setup occasionally to reduce console spam
    if (Math.random() < 0.1) { // 10% chance
      logger.debug('🧭 Setting up navigation route from', normalizedUserLocation, 'to', normalizedDestination);
    }

    // Clear existing markers (handle both modern and legacy)
    if (userMarkerRef.current) {
      if (userMarkerRef.current.setMap) {
        userMarkerRef.current.setMap(null);
      } else if (userMarkerRef.current.map) {
        userMarkerRef.current.map = null;
      }
    }
    if (destinationMarkerRef.current) {
      if (destinationMarkerRef.current.setMap) {
        destinationMarkerRef.current.setMap(null);
      } else if (destinationMarkerRef.current.map) {
        destinationMarkerRef.current.map = null;
      }
    }

    // Add user location marker with modern API fallback
    try {
      // Try to use modern AdvancedMarkerElement if available
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        const userPin = document.createElement('div');
        userPin.innerHTML = '📍';
        userPin.style.fontSize = '24px';
        
        userMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: normalizedUserLocation[0], lng: normalizedUserLocation[1] },
          map: mapInstanceRef.current,
          content: userPin,
          title: 'Your Location'
        });
      } else {
        // Fallback to legacy Marker
        userMarkerRef.current = new window.google.maps.Marker({
          position: { lat: normalizedUserLocation[0], lng: normalizedUserLocation[1] },
          map: mapInstanceRef.current,
          icon: createUserLocationIcon(),
          title: 'Your Location',
          zIndex: 1000
        });
      }
    } catch (error) {
      // Fallback to legacy Marker if modern API fails
      userMarkerRef.current = new window.google.maps.Marker({
        position: { lat: normalizedUserLocation[0], lng: normalizedUserLocation[1] },
        map: mapInstanceRef.current,
        icon: createUserLocationIcon(),
        title: 'Your Location',
        zIndex: 1000
      });
    }

    // Add destination marker with modern API fallback
    try {
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        const destPin = document.createElement('div');
        destPin.innerHTML = '🗑️';
        destPin.style.fontSize = '24px';
        
        destinationMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: normalizedDestination[0], lng: normalizedDestination[1] },
          map: mapInstanceRef.current,
          content: destPin,
          title: 'Pickup Location'
        });
      } else {
        // Fallback to legacy Marker
        destinationMarkerRef.current = new window.google.maps.Marker({
          position: { lat: normalizedDestination[0], lng: normalizedDestination[1] },
          map: mapInstanceRef.current,
          icon: createDestinationIcon(),
          title: 'Pickup Location',
          zIndex: 1000
        });
      }
    } catch (error) {
      // Fallback to legacy Marker if modern API fails
      destinationMarkerRef.current = new window.google.maps.Marker({
        position: { lat: normalizedDestination[0], lng: normalizedDestination[1] },
        map: mapInstanceRef.current,
        icon: createDestinationIcon(),
        title: 'Pickup Location',
        zIndex: 1000
      });
    }

    // Calculate and display route
    if (directionsServiceRef.current && directionsRendererRef.current) {
      const request = {
        origin: { lat: normalizedUserLocation[0], lng: normalizedUserLocation[1] },
        destination: { lat: normalizedDestination[0], lng: normalizedDestination[1] },
        travelMode: window.google.maps.TravelMode.DRIVING
      };

      directionsServiceRef.current.route(request, (result, status) => {
        if (status === 'OK') {
          directionsRendererRef.current.setDirections(result);
          setIsCalculatingRoute(false);
          // Only log successful route calculation occasionally to reduce console spam
          if (Math.random() < 0.05) { // 5% chance
            logger.debug('✅ Route calculated successfully');
          }
        } else {
          logger.warn('⚠️ Directions request failed due to', status, '- showing markers only');
          setIsCalculatingRoute(false);
          // Clear any existing route
          if (directionsRendererRef.current) {
            directionsRendererRef.current.setDirections({ routes: [] });
          }
          // Fallback to showing markers and fitting bounds
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend({ lat: normalizedUserLocation[0], lng: normalizedUserLocation[1] });
          bounds.extend({ lat: normalizedDestination[0], lng: normalizedDestination[1] });
          mapInstanceRef.current.fitBounds(bounds, { padding: 80 });
        }
      });
    }
  }, [userLocation, destination]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
      }
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setMap(null);
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
    };
  }, []);

  const handleRetry = () => {
    initializationAttemptedRef.current = false;
    setHasError(false);
    setErrorMessage('');
    initMap();
  };

  return (
    <div className={`${className} rounded-lg relative`}>
      {/* Always render the map div so ref is available */}
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '200px' }}
      />
      
      {/* Loading overlay */}
      {(!shouldInitialize || isLoading) && (
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-50 to-white flex items-center justify-center z-10">
          <div className="text-center bg-white p-6 rounded-xl shadow-lg">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">🗺️</span>
              </div>
            </div>
            <p className="mt-4 text-gray-700 font-medium">
              {!shouldInitialize ? 'Getting your location...' : loadingPhase}
            </p>
            <div className="mt-2 flex justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Route calculation loading overlay - shows on top of map */}
      {!isLoading && isCalculatingRoute && (
        <div className="absolute inset-0 rounded-lg bg-black bg-opacity-30 flex items-center justify-center z-20 backdrop-blur-sm">
          <div className="bg-white px-6 py-4 rounded-lg shadow-xl flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-3 border-blue-200 border-t-blue-600"></div>
            <div>
              <p className="text-gray-800 font-medium">Calculating route...</p>
              <p className="text-xs text-gray-500">Finding the best path</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Error overlay with enhanced navigation options */}
      {hasError && (
        <div className="absolute inset-0 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200 z-10">
          <div className="text-center p-4">
            <div className="text-blue-500 text-3xl mb-3">🗺️</div>
            <h3 className="text-lg font-semibold text-blue-700 mb-2">External Navigation</h3>
            <p className="text-blue-600 text-sm mb-4">
              Google Maps integration temporarily unavailable.<br/>
              Use external navigation to reach your destination.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => {
                  const coords = normalizeCoords(destination);
                  if (coords) {
                    const [lat, lng] = coords;
                    // Universal maps URL that works across platforms
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
                  }
                }} 
                className="w-full bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <span>🚗</span>
                <span>Navigate with Google Maps</span>
              </button>
              <button 
                onClick={() => {
                  const coords = normalizeCoords(destination);
                  if (coords) {
                    const [lat, lng] = coords;
                    // Apple Maps for iOS devices
                    window.open(`https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`, '_blank');
                  }
                }} 
                className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <span>🍎</span>
                <span>Navigate with Apple Maps</span>
              </button>
              <div className="pt-2 border-t border-blue-200">
                <p className="text-xs text-blue-500">
                  Coordinates: {(() => {
                    const coords = normalizeCoords(destination);
                    return coords ? `${coords[0]?.toFixed(6)}, ${coords[1]?.toFixed(6)}` : 'Invalid coordinates';
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleMapModalComponent;
