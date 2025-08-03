import React, { useEffect, useRef, useState } from 'react';

// Google Maps configuration
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDuYitEO0gBP2iqywnD0X76XGvGzAr9nQA';

// Load Google Maps API with improved error handling
const loadGoogleMapsAPI = () => {
  return new Promise((resolve, reject) => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      console.log('✅ Google Maps already loaded (Modal)');
      resolve(window.google.maps);
      return;
    }

    // Check if script is already loading
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existingScript) {
      console.log('⏳ Google Maps script already exists, waiting for load... (Modal)');
      // Wait for the existing script to load with timeout
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds timeout
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        } else if (attempts++ < maxAttempts) {
          setTimeout(checkLoaded, 100);
        } else {
          reject(new Error('Timeout waiting for existing Google Maps script to load'));
        }
      };
      checkLoaded();
      return;
    }

    // Validate API key exists
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your-api-key-here') {
      reject(new Error('Google Maps API key is not configured'));
      return;
    }

    console.log('📥 Loading Google Maps API... (Modal)');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry&loading=async`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('🔄 Google Maps script loaded, checking API availability... (Modal)');
      // Add a small delay to ensure the API is fully initialized
      setTimeout(() => {
        if (window.google && window.google.maps) {
          console.log('✅ Google Maps API fully loaded and ready (Modal)');
          resolve(window.google.maps);
        } else {
          console.error('❌ Google Maps API loaded but not available (Modal)');
          reject(new Error('Google Maps API failed to initialize'));
        }
      }, 200);
    };
    
    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps script (Modal):', error);
      reject(new Error('Failed to load Google Maps API script - check API key and network'));
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

// Helper function to normalize coordinates to [lat, lng] array format
const normalizeCoords = (coords) => {
  if (!coords) return null;
  
  // If it's already an array [lat, lng]
  if (Array.isArray(coords)) {
    return coords;
  }
  
  // If it's an object {lat, lng} or {latitude, longitude}
  if (typeof coords === 'object') {
    const lat = coords.lat || coords.latitude;
    const lng = coords.lng || coords.lon || coords.longitude;
    if (lat !== undefined && lng !== undefined) {
      return [lat, lng];
    }
  }
  
  console.warn('Unable to normalize coordinates:', coords);
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
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const initializationAttemptedRef = useRef(false);

  // Initialize map with retry mechanism
  const initMap = async () => {
    // Prevent multiple initialization attempts
    if (initializationAttemptedRef.current) {
      return;
    }
    initializationAttemptedRef.current = true;

    try {
      setIsLoading(true);
      setHasError(false);
      console.log('📍 Initializing Google Maps modal...');
      
      const maps = await loadGoogleMapsAPI();
      
      // At this point mapRef should be available (already checked above)
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

      console.log('✅ Google Maps modal created successfully');
      
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
      console.error('❌ Failed to initialize Google Maps modal:', error);
      setHasError(true);
      setErrorMessage(error.message || 'Failed to load navigation map');
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
        console.error('❌ Map container still not found after waiting');
        setHasError(true);
        setErrorMessage('Map container not available');
        setIsLoading(false);
        return;
      }
      
      try {
        await initMap();
      } catch (error) {
        console.error('❌ Failed to initialize Google Maps modal:', error);
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
      console.error('❌ Invalid coordinates provided:', { userLocation, destination });
      return;
    }

    // Only log route setup occasionally to reduce console spam
    if (Math.random() < 0.1) { // 10% chance
      console.log('🧭 Setting up navigation route from', normalizedUserLocation, 'to', normalizedDestination);
    }

    // Clear existing markers
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
    }
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setMap(null);
    }

    // Add user location marker
    userMarkerRef.current = new window.google.maps.Marker({
      position: { lat: normalizedUserLocation[0], lng: normalizedUserLocation[1] },
      map: mapInstanceRef.current,
      icon: createUserLocationIcon(),
      title: 'Your Location',
      zIndex: 1000
    });

    // Add destination marker
    destinationMarkerRef.current = new window.google.maps.Marker({
      position: { lat: normalizedDestination[0], lng: normalizedDestination[1] },
      map: mapInstanceRef.current,
      icon: createDestinationIcon(),
      title: 'Pickup Location',
      zIndex: 1000
    });

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
          // Only log successful route calculation occasionally to reduce console spam
          if (Math.random() < 0.05) { // 5% chance
            console.log('✅ Route calculated successfully');
          }
        } else {
          console.warn('⚠️ Directions request failed due to', status, '- showing markers only');
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
        <div className="absolute inset-0 rounded-lg bg-gray-100 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 text-sm">
              {!shouldInitialize ? 'Waiting for location...' : 'Loading Navigation...'}
            </p>
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 rounded-lg bg-red-50 flex items-center justify-center border border-red-200 z-10">
          <div className="text-center p-4">
            <div className="text-red-500 text-3xl mb-2">📍</div>
            <p className="text-red-700 text-sm font-medium mb-1">Navigation Unavailable</p>
            <p className="text-red-600 text-xs mb-3">{errorMessage}</p>
            <div className="space-x-2">
              <button 
                onClick={handleRetry} 
                className="px-3 py-2 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.open(`https://www.openstreetmap.org/directions?from=${userLocation?.[0]},${userLocation?.[1]}&to=${destination?.[0]},${destination?.[1]}`, '_blank')} 
                className="px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
              >
                Open in Maps
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleMapModalComponent;
