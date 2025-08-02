import React, { useEffect, useRef, useState } from 'react';

// Google Maps configuration
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDuYitEO0gBP2iqywnD0X76XGvGzAr9nQA';

// Load Google Maps API
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
      // Wait for the existing script to load
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
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
      }, 100);
    };
    
    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps script (Modal):', error);
      reject(new Error('Failed to load Google Maps API script'));
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
  className = "w-full h-full" 
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const initMap = async () => {
      try {
        console.log('🗺️ Initializing Google Maps for modal...');
        setIsLoading(true);
        setHasError(false);
        
        await loadGoogleMapsAPI();
        console.log('✅ Google Maps API loaded for modal');
        
        // Wait a bit for the DOM element to be ready
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!mapRef.current) {
          console.log('⚠️ Modal map ref not ready');
          setIsLoading(false);
          return;
        }
        
        if (mapInstanceRef.current) {
          console.log('⚠️ Modal map already initialized');
          setIsLoading(false);
          return;
        }

        console.log('🎯 Creating modal map instance...');
        const map = new window.google.maps.Map(mapRef.current, {
          center: destination ? { lat: destination[0], lng: destination[1] } : { lat: 5.6037, lng: -0.1870 },
          zoom: 15,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true
        });

        mapInstanceRef.current = map;
        
        // Initialize directions service and renderer
        directionsServiceRef.current = new window.google.maps.DirectionsService();
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          suppressMarkers: true, // We'll add custom markers
          polylineOptions: {
            strokeColor: '#6366F1',
            strokeWeight: 6,
            strokeOpacity: 0.8
          }
        });
        directionsRendererRef.current.setMap(map);

        console.log('🎉 Modal map instance created successfully!');
        
        setIsLoading(false);
        onMapReady && onMapReady(map);

      } catch (error) {
        console.error('❌ Failed to initialize Google Maps for modal:', error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    initMap();
  }, [destination, onMapReady]);

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

    console.log('🧭 Setting up navigation route from', normalizedUserLocation, 'to', normalizedDestination);

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
          console.log('✅ Route calculated successfully');
        } else {
          console.error('❌ Directions request failed due to', status);
          // Fallback to showing markers and fitting bounds
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend({ lat: normalizedUserLocation[0], lng: normalizedUserLocation[1] });
          bounds.extend({ lat: normalizedDestination[0], lng: normalizedDestination[1] });
          mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
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

  // Show loading state while Google Maps is loading
  if (isLoading) {
    return (
      <div className={`${className} rounded-lg bg-gray-100 flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm">Loading Navigation...</p>
        </div>
      </div>
    );
  }

  // Show error state if Google Maps failed to load
  if (hasError) {
    return (
      <div className={`${className} rounded-lg bg-red-50 flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-red-500 text-2xl mb-2">⚠️</div>
          <p className="text-red-600 text-sm">Failed to load navigation</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapRef} 
      className={`${className} rounded-lg`}
    />
  );
};

export default GoogleMapModalComponent;
