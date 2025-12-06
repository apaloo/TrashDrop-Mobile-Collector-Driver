import { useEffect, useRef, useState } from 'react';
import { logger } from '../utils/logger';

// Google Maps API Key is provided via environment variable
// Define once here to avoid hard-coding secrets in the repo
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const GoogleMapsNavigation = ({ 
  userLocation, 
  destination, 
  onMapReady,
  onRouteCalculated,
  onError 
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

  // Load Google Maps API
  useEffect(() => {
    if (window.google && window.google.maps) {
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
            if (window.google && window.google.maps) {
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

        // Ensure the API key is present before loading the script
        if (!GOOGLE_MAPS_API_KEY) {
          const error = 'Missing VITE_GOOGLE_MAPS_API_KEY. Please set it in your environment.';
          logger.error(error);
          setHasError(true);
          setErrorMessage(error);
          if (onError) onError(error);
          return;
        }

        // Load new script with env-provided key
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry&loading=async`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          // Wait for google.maps to be fully available
          const checkInterval = setInterval(() => {
            if (window.google && window.google.maps) {
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
      
      logger.info('🛣️ Calculating route with Google Maps Directions...');
      
      directionsService.route(
        {
          origin: { lat: userLocation.lat, lng: userLocation.lng },
          destination: { lat: destLat, lng: destLng },
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            directionsRendererRef.current.setDirections(result);
            
            // Extract route information
            const route = result.routes[0];
            const leg = route.legs[0];
            
            const routeInfo = {
              distance: leg.distance.text,
              duration: leg.duration.text,
              steps: leg.steps.length,
            };
            
            logger.info('✅ Route calculated successfully:', routeInfo);
            
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
  }, [isInitialized, userLocation, destination, onMapReady, onRouteCalculated, onError]);

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
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

export default GoogleMapsNavigation;
