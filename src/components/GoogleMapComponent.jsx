import React, { useEffect, useRef, useState } from 'react';
import { logger } from '../utils/logger';

// Google Maps configuration
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  logger.error('❌ VITE_GOOGLE_MAPS_API_KEY is not set. Please add it to your .env file or Netlify environment variables.');
}

// Load Google Maps API
const loadGoogleMapsAPI = () => {
  return new Promise((resolve, reject) => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      logger.debug('✅ Google Maps already loaded');
      resolve(window.google.maps);
      return;
    }

    // Check if script is already loading
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existingScript) {
      logger.debug('⏳ Google Maps script already exists, waiting for load...');
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

    logger.debug('📥 Loading Google Maps API...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry&loading=async`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      logger.debug('🔄 Google Maps script loaded, checking API availability...');
      // Add a small delay to ensure the API is fully initialized
      setTimeout(() => {
        if (window.google && window.google.maps) {
          logger.debug('✅ Google Maps API fully loaded and ready');
          resolve(window.google.maps);
        } else {
          logger.error('❌ Google Maps API loaded but not available');
          reject(new Error('Google Maps API failed to initialize'));
        }
      }, 100);
    };
    
    script.onerror = (error) => {
      logger.error('❌ Failed to load Google Maps script:', error);
      reject(new Error('Failed to load Google Maps API script'));
    };
    
    document.head.appendChild(script);
  });
};

// Create custom marker icon for requests (safe with API loading)
const createRequestIcon = (type) => {
  if (!window.google || !window.google.maps) {
    return null;
  }
  
  const colors = {
    plastic: '#3b82f6',
    glass: '#10b981',
    paper: '#f59e0b',
    metal: '#8b5cf6',
    organic: '#22c55e',
    electronics: '#ef4444',
    batteries: '#f97316',
    mixed: '#6b7280'
  };
  
  const color = colors[type?.toLowerCase()] || '#6b7280';
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
        <path d="M10 12h12l-1 10H11z" fill="white"/>
        <path d="M13 11h2v12h-2zM17 11h2v12h-2z" fill="${color}"/>
      </svg>
    `)}`,
    scaledSize: new window.google.maps.Size(32, 32),
    anchor: new window.google.maps.Point(16, 32)
  };
};

// Create user location icon (tricycle) (safe with API loading)
const createUserLocationIcon = () => {
  if (!window.google || !window.google.maps) {
    return null;
  }
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="50" height="30">
        <circle cx="20" cy="45" r="10" fill="#1f2937"/>
        <circle cx="80" cy="45" r="8" fill="#1f2937"/>
        <path d="M65,35 L85,35 Q90,35 90,30 L90,25 Q90,20 85,20 L65,20 Q60,20 60,25 L60,30 Q60,35 65,35 Z" fill="#1d4ed8"/>
        <path d="M30,20 L40,35 L60,35" stroke="#1f2937" stroke-width="3" fill="none"/>
        <rect x="33" y="17" width="8" height="5" rx="2" fill="#dc2626"/>
        <rect x="67" y="25" width="6" height="6" rx="1" fill="#059669"/>
        <rect x="76" y="25" width="6" height="6" rx="1" fill="#059669"/>
      </svg>
    `)}`,
    scaledSize: new window.google.maps.Size(50, 30),
    anchor: new window.google.maps.Point(25, 15)
  };
};

// Open Google Maps for routing
const openGoogleMapsRouting = (fromLat, fromLng, toLat, toLng, mode = 'driving') => {
  const url = `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=${mode}`;
  window.open(url, '_blank');
};

const GoogleMapComponent = ({ 
  center = null, // NO HARDCODED FALLBACK - must provide actual coordinates 
  zoom = 13, 
  requests = [], 
  userPosition = null,
  searchRadius = 5,
  navigate,
  onMapLoad 
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const circleRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const initMap = async () => {
      try {
        logger.debug('🗺️ Initializing Google Maps...');
        setIsLoading(true);
        setHasError(false);
        
        await loadGoogleMapsAPI();
        logger.debug('✅ Google Maps API loaded successfully');
        
        // Wait a bit for the DOM element to be ready
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!mapRef.current) {
          logger.warn('⚠️ Map ref not ready');
          setIsLoading(false);
          return;
        }
        
        if (mapInstanceRef.current) {
          logger.warn('⚠️ Map already initialized');
          setIsLoading(false);
          return;
        }

        logger.debug('🎯 Creating map instance...');
        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ],
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true
        });

        mapInstanceRef.current = map;
        logger.debug('🎉 Map instance created successfully!');
        
        // Add click handler to center map on user location
        window.centerMapOnUser = () => {
          if (userPosition && mapInstanceRef.current) {
            const position = { lat: userPosition[0], lng: userPosition[1] };
            mapInstanceRef.current.setCenter(position);
            mapInstanceRef.current.setZoom(15);
          }
        };

        setIsLoading(false);
        onMapLoad && onMapLoad(map);

      } catch (error) {
        logger.error('❌ Failed to initialize Google Maps:', error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    initMap();
  }, [center, zoom, onMapLoad]);

  // Update user position marker
  useEffect(() => {
    if (!mapInstanceRef.current || !userPosition) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
    }

    const position = { lat: userPosition[0], lng: userPosition[1] };
    userMarkerRef.current = new window.google.maps.Marker({
      position,
      map: mapInstanceRef.current,
      icon: createUserLocationIcon(),
      title: 'Your Location',
      zIndex: 1000
    });

    // Add radius circle
    if (circleRef.current) {
      circleRef.current.setMap(null);
    }

    if (searchRadius) {
      circleRef.current = new window.google.maps.Circle({
        strokeColor: '#3b82f6',
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        map: mapInstanceRef.current,
        center: position,
        radius: searchRadius * 1000 // Convert km to meters
      });
    }
  }, [userPosition, searchRadius]);

  // Update request markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    requests
      .filter(request => {
        return request && 
               request.id && 
               request.coordinates && 
               Array.isArray(request.coordinates) && 
               request.coordinates.length === 2 &&
               typeof request.coordinates[0] === 'number' &&
               typeof request.coordinates[1] === 'number';
      })
      .slice(0, 50)
      .forEach(request => {
        const position = {
          lat: request.coordinates[0],
          lng: request.coordinates[1]
        };

        const marker = new window.google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          icon: createRequestIcon(request.type || request.waste_type),
          title: `${request.type?.toUpperCase() || 'PICKUP'} - ₵${request.fee || '0'}`
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; max-width: 200px;">
              <h3 style="font-weight: 600; font-size: 14px; margin: 0 0 8px 0;">${request.type?.toUpperCase() || 'PICKUP'}</h3>
              <p style="font-size: 12px; color: #666; margin: 0 0 8px 0;">${request.location || 'Location not specified'}</p>
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #888; margin-bottom: 8px;">
                <span>${request.distance ? `${request.distance} km` : 'Distance unknown'}</span>
                <span>${request.estimated_time || ''}</span>
              </div>
              <p style="color: #059669; font-weight: 600; margin: 0 0 8px 0;">₵${request.fee || '0'}</p>
              <button 
                onclick="window.handleMarkerClick('${request.id}')"
                style="width: 100%; background: #059669; color: white; font-weight: 600; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;"
                onmouseover="this.style.background='#047857'"
                onmouseout="this.style.background='#059669'"
              >
                Get
              </button>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current, marker);
        });

        markersRef.current.push(marker);
      });

    // Global handler for marker clicks
    window.handleMarkerClick = (requestId) => {
      navigate('/request', { state: { scrollToRequest: requestId } });
    };

  }, [requests, navigate]);

  // Show loading state while Google Maps is loading
  if (isLoading) {
    return (
      <div className="w-full h-full rounded-lg bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  // Show error state if Google Maps failed to load
  if (hasError) {
    return (
      <div className="w-full h-full rounded-lg bg-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-2xl mb-2">⚠️</div>
          <p className="text-red-600 text-sm">Failed to load Google Maps</p>
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
    <>
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '400px' }}
      />
      
      {/* Add routing functionality */}
      {userPosition && (
        <div className="absolute bottom-4 left-4 z-10">
          <button
            onClick={() => {
              if (requests.length > 0) {
                const nearestRequest = requests[0];
                if (nearestRequest.coordinates) {
                  openGoogleMapsRouting(
                    userPosition[0], 
                    userPosition[1], 
                    nearestRequest.coordinates[0], 
                    nearestRequest.coordinates[1]
                  );
                }
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-lg transition-colors"
            title="Get directions to nearest request"
          >
            🧭 Route
          </button>
        </div>
      )}
    </>
  );
};

export default GoogleMapComponent;
