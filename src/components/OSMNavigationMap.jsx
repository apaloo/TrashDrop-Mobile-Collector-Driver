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
  const [useSatellite, setUseSatellite] = useState(false);
  const tileLayerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !userLocation || !destination) {
      return;
    }

    try {
      // Initialize map if not already done
      if (!mapInstanceRef.current) {
        if (Math.random() < 0.2) { // Reduce console spam - 20% logging
          logger.info('🗺️ Initializing OpenStreetMap...');
        }
        
        const map = L.map(mapRef.current, {
          center: [userLocation.lat, userLocation.lng],
          zoom: 15,
          zoomControl: true,
          attributionControl: false, // Disable attribution control to prevent external links
        });

        // Add default OpenStreetMap tiles without clickable attribution
        tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors', // No hyperlinks
          maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;
        
        if (onMapReady) {
          onMapReady(map);
        }

        if (Math.random() < 0.2) { // Reduce console spam - 20% logging
          logger.info('✅ OpenStreetMap initialized successfully');
        }
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

      // Add routing with multiple fallback options
      if (Math.random() < 0.1) { // Reduce console spam - 10% logging
        logger.info('🛣️ Calculating route with enhanced navigation...');
      }
      
      // Custom router with fallback to direct path
      const customRouter = L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
        timeout: 5000
      });
      
      // Wrap the original route method to add fallback
      const originalRoute = customRouter.route.bind(customRouter);
      customRouter.route = function(waypoints, callback, context) {
        // Validate waypoints first
        if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
          if (Math.random() < 0.1) { // Reduce console spam - 10% logging
            logger.warn('⚠️ Invalid waypoints provided to router:', waypoints);
          }
          callback.call(context || this, new Error('Invalid waypoints'), []);
          return;
        }
        
        // Ensure each waypoint has valid lat/lng
        const validatedWaypoints = waypoints.filter(wp => {
          return wp && wp.latLng && typeof wp.latLng.lat === 'function' && 
                 typeof wp.latLng.lng === 'function';
        });
        
        if (validatedWaypoints.length < 2) {
          if (Math.random() < 0.05) { // Reduce console spam - 5% logging
            logger.warn('⚠️ Not enough valid waypoints for routing, using direct path');
          }
          // Use fallback direct path with original waypoints (will be processed inside)
          useDirectPath(waypoints, callback, context);
          return;
        }
        
        const start = validatedWaypoints[0];
        const end = validatedWaypoints[validatedWaypoints.length - 1];
        let callbackInvoked = false; // Prevent duplicate callbacks
        let routeSucceeded = false; // Track if route succeeded
        
        // Wrap callback to ensure it's only called once
        const safeCallback = function(err, routes) {
          if (callbackInvoked) {
            logger.warn('⚠️ Preventing duplicate callback invocation');
            return;
          }
          callbackInvoked = true;
          callback.call(context, err, routes);
        };
        
        // Try original OSRM routing first
        try {
          originalRoute.call(this, validatedWaypoints, (err, routes) => {
            if (!err && routes && routes.length > 0) {
              // Success! Use the real route
              if (Math.random() < 0.1) { // Reduce console spam - 10% logging
                logger.info('✅ OSRM route calculated successfully');
              }
              routeSucceeded = true;
              safeCallback(null, routes);
            } else if (!callbackInvoked) {
              // OSRM failed, use direct path fallback
              useDirectPath(validatedWaypoints, safeCallback, context);
            }
          }, context);
        } catch (error) {
          // If OSRM completely fails and we haven't already succeeded, use direct path
          if (routeSucceeded || callbackInvoked) {
            if (Math.random() < 0.05) { // Reduce console spam - 5% logging
              logger.info('Route already processed, skipping catch block');
            }
            return;
          }
          if (Math.random() < 0.05) { // Reduce console spam - 5% logging
            logger.warn('⚠️ OSRM router error, using direct path:', error.message);
          }
          
          useDirectPath(validatedWaypoints, safeCallback, context);
        }
      };
      
      // Helper function for direct path creation to avoid code duplication
      const useDirectPath = (waypoints, callback, context) => {
        if (Math.random() < 0.05) { // Reduce console spam - 5% logging
          logger.info('📍 Showing direct path as fallback');
        }
        
        if (!waypoints || waypoints.length < 2) {
          if (Math.random() < 0.1) { // Reduce console spam - 10% logging
            logger.warn('⚠️ Cannot create direct path - invalid waypoints');
          }
          callback.call(context || this, new Error('Invalid waypoints'), []);
          return;
        }
        
        try {
          // Get start and end coordinates
          const start = waypoints[0];
          const end = waypoints[waypoints.length - 1];
          
          // Safely extract coordinates from different waypoint structures
          // Waypoints can be: L.LatLng objects, L.Routing.Waypoint objects, or plain objects
          const extractCoords = (wp) => {
            if (!wp) return { lat: 0, lng: 0 };
            
            // Check if it's a L.Routing.Waypoint with latLng property
            if (wp.latLng) {
              const latLng = wp.latLng;
              return {
                lat: typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat ?? 0,
                lng: typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng ?? 0
              };
            }
            
            // Check if it's a plain L.LatLng or object with lat/lng
            return {
              lat: typeof wp.lat === 'function' ? wp.lat() : wp.lat ?? 0,
              lng: typeof wp.lng === 'function' ? wp.lng() : wp.lng ?? 0
            };
          };
          
          const startCoords = extractCoords(start);
          const endCoords = extractCoords(end);
          
          const startLat = startCoords.lat;
          const startLng = startCoords.lng;
          const endLat = endCoords.lat;
          const endLng = endCoords.lng;
          
          // Validate coordinates
          if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng) ||
              (startLat === 0 && startLng === 0) || (endLat === 0 && endLng === 0)) {
            throw new Error('Invalid coordinates for direct path');
          }
          
          // Calculate distance using Haversine formula
          const R = 6371000; // Earth's radius in meters
          const dLat = (endLat - startLat) * Math.PI / 180;
          const dLon = (endLng - startLng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c; // Distance in meters
              
          // Create a proper route structure that matches OSRM format
          const directRoute = {
            name: 'Direct Path',
            coordinates: [
              L.latLng(startLat, startLng),
              L.latLng(endLat, endLng)
            ],
            waypoints: [
              { latLng: L.latLng(startLat, startLng), name: 'Start' },
              { latLng: L.latLng(endLat, endLng), name: 'Destination' }
            ],
            inputWaypoints: waypoints,
            summary: {
              totalDistance: distance,
              totalTime: Math.round(distance / 1000 * 3) * 60 // Estimate: 3 min per km
            },
            instructions: [
              { 
                text: `Head towards destination`, 
                distance: distance, 
                time: Math.round(distance / 1000 * 3) * 60,
                index: 0,
                type: 'Straight',
                modifier: undefined,
                road: 'Direct route'
              }
            ]
          };
          
          if (Math.random() < 0.05) { // Reduce console spam - 5% logging
            logger.info('📍 Showing direct path:', {
              distance: `${(distance / 1000).toFixed(2)} km (straight line)`
            });
          }
          
          // Return success with direct route
          callback.call(context || this, null, [directRoute]);
        } catch (error) {
          if (Math.random() < 0.1) { // Reduce console spam - 10% logging
            logger.warn('⚠️ Failed to create direct path:', error);
          }
          callback.call(context || this, error, []);
        }
      };
      
      // Create validated waypoints to prevent issues
      const waypointsArray = [];
      
      // Add user location waypoint with validation
      if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number' &&
          !isNaN(userLocation.lat) && !isNaN(userLocation.lng)) {
        waypointsArray.push(L.latLng(userLocation.lat, userLocation.lng));
      } else {
        if (Math.random() < 0.1) { // Reduce console spam - 10% logging
          logger.warn('⚠️ Invalid user location coordinates, using fallback');
        }
        waypointsArray.push(L.latLng(5.6037, -0.1870)); // Accra fallback
      }
      
      // Add destination waypoint with validation
      if (typeof destLat === 'number' && typeof destLng === 'number' && 
          !isNaN(destLat) && !isNaN(destLng)) {
        waypointsArray.push(L.latLng(destLat, destLng));
      } else {
        if (Math.random() < 0.1) { // Reduce console spam - 10% logging
          logger.warn('⚠️ Invalid destination coordinates, using fallback');
        }
        waypointsArray.push(L.latLng(5.6037, -0.1870)); // Accra fallback
      }
      
      // Create a custom itinerary builder that does nothing to prevent appendChild errors
      const noOpItinerary = L.Class.extend({
        initialize: function() {},
        onAdd: function(map) {
          try {
            // Return a hidden dummy element instead of creating UI
            const dummyDiv = L.DomUtil.create('div', 'leaflet-routing-hidden');
            dummyDiv.style.display = 'none';
            dummyDiv.style.visibility = 'hidden';
            dummyDiv.style.position = 'absolute';
            dummyDiv.style.left = '-9999px';
            
            // Override appendChild to prevent errors
            dummyDiv.appendChild = function() { return null; };
            
            return dummyDiv;
          } catch (e) {
            // Return a minimal element if creation fails
            return document.createElement('div');
          }
        },
        onRemove: function() {},
        createStepsContainer: function() {
          const div = L.DomUtil.create('div');
          div.style.display = 'none';
          return div;
        },
        setAlternatives: function() {},
        // Add more methods to prevent any UI operations
        show: function() {},
        hide: function() {},
        setRoutes: function() {}
      });
      
      // Create routing control with validated waypoints
      const routingControl = L.Routing.control({
        waypoints: waypointsArray,
        router: customRouter,
        routeWhileDragging: false,
        showAlternatives: false,
        addWaypoints: false,
        fitSelectedRoutes: true,
        show: false, // CRITICAL: Suppress UI panel to prevent appendChild errors
        lineOptions: {
          styles: [{ 
            color: '#1E88E5', 
            opacity: 0.9, 
            weight: 7,
            dashArray: null // Will be set dynamically based on route type
          }],
          extendToWaypoints: false, // Prevent the extendToWaypoints issue causing the error
          missingRouteTolerance: 100 // Increase tolerance for missing route points
        },
        createMarker: () => null,
        // Use our custom no-op itinerary to completely prevent UI creation
        itinerary: new noOpItinerary(),
        // Custom plan to completely suppress UI creation
        plan: L.Routing.plan(waypointsArray, {
          createMarker: () => null,
          addWaypoints: false,
          draggableWaypoints: false
        }),
        // Custom formatter to prevent DOM manipulation
        formatter: new L.Routing.Formatter({
          language: 'en',
          units: 'metric'
        }),
        // Completely suppress the itinerary container to prevent appendChild errors
        itineraryClassName: 'leaflet-routing-hidden',
        containerClassName: 'leaflet-routing-hidden',
        alternativeClassName: 'leaflet-routing-hidden',
        summaryTemplate: '<div style="display:none;"></div>',
      });
      
      // Override the onAdd method to prevent DOM element creation
      const originalOnAdd = routingControl.onAdd.bind(routingControl);
      routingControl.onAdd = function(map) {
        try {
          const container = originalOnAdd(map);
          // Hide the container completely
          if (container && container.style) {
            container.style.display = 'none';
            container.style.visibility = 'hidden';
            container.style.position = 'absolute';
            container.style.left = '-9999px';
          }
          return container;
        } catch (e) {
          // Silently catch any appendChild or DOM errors
          // Create and return a dummy container that won't cause issues
          if (Math.random() < 0.01) { // Log rarely for debugging
            logger.warn('⚠️ Routing control onAdd error (expected):', e.message);
          }
          const dummyContainer = L.DomUtil.create('div', 'leaflet-routing-hidden');
          dummyContainer.style.display = 'none';
          return dummyContainer;
        }
      };
      
      routingControlRef.current = routingControl;
      
      // Wrap addTo in try-catch to handle any DOM manipulation errors
      try {
        routingControl.addTo(map);
      } catch (addError) {
        // Silently handle errors from addTo - the routing will still work
        if (Math.random() < 0.01) { // Log rarely for debugging
          logger.warn('⚠️ Routing control addTo error (expected):', addError.message);
        }
        // Even if addTo failed, routing can still work via direct API calls
        // The route will be drawn on the map even without the UI panel
      }

      // Ensure we have the routing control reference regardless of addTo success
      if (!routingControlRef.current) {
        routingControlRef.current = routingControl;
      }

      // Handle route calculation - attach handlers to the control directly
      routingControlRef.current.on('routesfound', (e) => {
        const routes = e.routes;
        const summary = routes[0].summary;
        const isDirect = routes[0].name === 'Direct Path';
        
        if (isDirect) {
          if (Math.random() < 0.05) { // Reduce console spam - 5% logging
            logger.info('📍 Showing direct path:', {
              distance: `${(summary.totalDistance / 1000).toFixed(2)} km (straight line)`
            });
          }
          setHasError(true);
          setErrorMessage('🧭 Showing direct path - road routing unavailable');
        } else {
          if (Math.random() < 0.1) { // Reduce console spam - 10% logging
            logger.info('✅ Route calculated:', {
              distance: `${(summary.totalDistance / 1000).toFixed(2)} km`,
              duration: `${Math.round(summary.totalTime / 60)} min`
            });
          }
        }

        if (onRouteCalculated) {
          onRouteCalculated({
            distance: summary.totalDistance,
            duration: summary.totalTime,
            route: routes[0],
            isDirect
          });
        }

        setIsLoading(false);
      });

      routingControlRef.current.on('routingerror', (e) => {
        // Suppress routing errors - our custom router handles fallbacks internally
        // These errors are expected when OSRM routing fails and we use direct path
        
        // Only log if there's actually an error object with meaningful information
        // and only very rarely (1% chance) to avoid console spam
        if (e.error && e.error.message && Math.random() < 0.01) {
          logger.warn('⚠️ Routing fallback triggered:', e.error.message);
        }
        
        setIsLoading(false);
        
        // Don't call onError for expected routing fallbacks
        // Our custom router already handles these gracefully with direct paths
      });

    } catch (error) {
      if (Math.random() < 0.2) { // Reduce console spam - 20% logging for critical errors
        logger.error('❌ Map initialization error:', error);
      }
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

  // Handle satellite layer toggle
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    
    const map = mapInstanceRef.current;
    
    // Remove current tile layer
    map.removeLayer(tileLayerRef.current);
    
    // Add new tile layer based on useSatellite state
    if (useSatellite) {
      // Google Satellite imagery without clickable attribution
      tileLayerRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '© Google', // No hyperlinks
        maxZoom: 20,
      }).addTo(map);
      if (Math.random() < 0.2) { // Reduce console spam - 20% logging
        logger.info('🛰️ Switched to satellite view');
      }
    } else {
      // OpenStreetMap without clickable attribution
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', // No hyperlinks
        maxZoom: 19,
      }).addTo(map);
      if (Math.random() < 0.2) { // Reduce console spam - 20% logging
        logger.info('🗺️ Switched to map view');
      }
    }
  }, [useSatellite]);
  
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
      {/* CSS to disable all links and suppress routing UI */}
      <style>{`
        .leaflet-container a {
          pointer-events: none !important;
          cursor: default !important;
        }
        .leaflet-control-attribution {
          display: none !important;
        }
        /* Completely hide routing UI elements to prevent appendChild errors */
        .leaflet-routing-container,
        .leaflet-routing-hidden,
        .leaflet-routing-alternatives-container,
        .leaflet-routing-geocoders {
          display: none !important;
          visibility: hidden !important;
          position: absolute !important;
          left: -9999px !important;
        }
      `}</style>
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '400px' }}
      />
      
      {/* Satellite Toggle Button */}
      <button
        onClick={() => setUseSatellite(!useSatellite)}
        className="absolute top-4 right-4 bg-white hover:bg-gray-50 text-gray-800 px-4 py-2 rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 font-medium transition-all z-[1000]"
        title={useSatellite ? "Switch to Map View" : "Switch to Satellite View"}
      >
        {useSatellite ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Map
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Satellite
          </>
        )}
      </button>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 font-medium">🚀 Finding best route...</p>
          </div>
        </div>
      )}

      {hasError && errorMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-50 border-2 border-yellow-400 text-yellow-900 px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default OSMNavigationMap;
