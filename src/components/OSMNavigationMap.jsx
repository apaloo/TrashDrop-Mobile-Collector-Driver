import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { logger } from '../utils/logger';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const OSMNavigationMap = ({ 
  userLocation, 
  destination, 
  onMapReady,
  onRouteCalculated,
  onError 
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routingControlRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!mapRef.current || !userLocation || !destination) {
      return;
    }

    try {
      // Initialize map if not already done
      if (!mapInstanceRef.current) {
        logger.info('🗺️ Initializing OpenStreetMap...');
        
        const map = L.map(mapRef.current, {
          center: [userLocation.lat, userLocation.lng],
          zoom: 15,
          zoomControl: true,
        });

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
        
        if (onMapReady) {
          onMapReady(map);
        }

        logger.info('✅ OpenStreetMap initialized successfully');
      }

      const map = mapInstanceRef.current;

      // Clear existing markers and routing
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
      }
      if (destMarkerRef.current) {
        map.removeLayer(destMarkerRef.current);
      }
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
      }

      // Create custom icons
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `<div style="
          background-color: #4285F4;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const destIcon = L.divIcon({
        className: 'custom-dest-marker',
        html: `<div style="
          background-color: #EA4335;
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      // Add user location marker
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        title: 'Your Location'
      }).addTo(map);

      // Add destination marker
      const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
      const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
      
      destMarkerRef.current = L.marker([destLat, destLng], {
        icon: destIcon,
        title: 'Destination'
      }).addTo(map);

      // Add routing
      logger.info('🛣️ Calculating route with OpenStreetMap...');
      
      routingControlRef.current = L.Routing.control({
        waypoints: [
          L.latLng(userLocation.lat, userLocation.lng),
          L.latLng(destLat, destLng)
        ],
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'driving'
        }),
        routeWhileDragging: false,
        showAlternatives: false,
        addWaypoints: false,
        fitSelectedRoutes: true,
        lineOptions: {
          styles: [{ color: '#4285F4', opacity: 0.8, weight: 6 }]
        },
        createMarker: () => null, // Don't create default markers (we have custom ones)
      }).addTo(map);

      // Handle route calculation
      routingControlRef.current.on('routesfound', (e) => {
        const routes = e.routes;
        const summary = routes[0].summary;
        
        logger.info('✅ Route calculated:', {
          distance: `${(summary.totalDistance / 1000).toFixed(2)} km`,
          duration: `${Math.round(summary.totalTime / 60)} min`
        });

        if (onRouteCalculated) {
          onRouteCalculated({
            distance: summary.totalDistance,
            duration: summary.totalTime,
            route: routes[0]
          });
        }

        setIsLoading(false);
      });

      routingControlRef.current.on('routingerror', (e) => {
        logger.warn('⚠️ Route calculation failed:', e.error);
        setHasError(true);
        setErrorMessage('Could not calculate route. Showing direct path.');
        setIsLoading(false);

        // Draw a straight line as fallback
        L.polyline([
          [userLocation.lat, userLocation.lng],
          [destLat, destLng]
        ], {
          color: '#EA4335',
          weight: 4,
          opacity: 0.6,
          dashArray: '10, 10'
        }).addTo(map);

        // Fit bounds to show both markers
        const bounds = L.latLngBounds([
          [userLocation.lat, userLocation.lng],
          [destLat, destLng]
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });

        if (onError) {
          onError(e.error);
        }
      });

    } catch (error) {
      logger.error('❌ Map initialization error:', error);
      setHasError(true);
      setErrorMessage('Failed to load map');
      setIsLoading(false);
      
      if (onError) {
        onError(error);
      }
    }

    // Cleanup
    return () => {
      if (routingControlRef.current && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.removeControl(routingControlRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [userLocation, destination, onMapReady, onRouteCalculated, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        } catch (e) {
          logger.warn('⚠️ Map cleanup error:', e);
        }
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '400px' }}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading route...</p>
          </div>
        </div>
      )}

      {hasError && errorMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default OSMNavigationMap;
