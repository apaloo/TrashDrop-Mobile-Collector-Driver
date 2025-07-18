import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  calculateNearestNeighborRoute, 
  calculateRouteDistance, 
  estimateRouteTime, 
  generateDirectionsUrl 
} from '../utils/routeOptimizationUtils';
import { calculateDistance } from '../utils/locationUtils';
import { initOfflineMapStorage, createOfflineTileLayer, optimizeMapPerformance } from '../utils/mapUtils';
import { startMarkerIcon, assignmentMarkerIcon, requestMarkerIcon, getStopIcon } from '../utils/markerIcons';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.offline';
import localforage from 'localforage';
// Make sure Leaflet CSS is loaded
import 'leaflet/dist/leaflet.css';

/**
 * Offline-capable tile layer component
 */
const OfflineTileLayer = ({ tileLayerRef, isOfflineMode }) => {
  const map = useMap();
  
  useEffect(() => {
    // Create offline-capable layer if in offline mode and not already created
    if (isOfflineMode && (!tileLayerRef.current || !tileLayerRef.current._offlineEnabled)) {
      console.log('Creating offline tile layer');
      tileLayerRef.current = createOfflineTileLayer();
      
      // Make sure the layer is added to the map
      if (map && !map.hasLayer(tileLayerRef.current)) {
        tileLayerRef.current.addTo(map);
      }
    }
    
    return () => {
      // Cleanup if needed
      if (map && tileLayerRef && tileLayerRef.current && map.hasLayer(tileLayerRef.current)) {
        map.removeLayer(tileLayerRef.current);
      }
    };
  }, [tileLayerRef, map, isOfflineMode]);
  
  // Render the appropriate TileLayer based on offline mode
  return isOfflineMode ? null : (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    />
  );
};

/**
 * Map optimizer component to apply performance optimizations and handle offline capabilities
 */
const MapOptimizer = () => {
  const map = useMap();
  
  useEffect(() => {
    // Apply performance optimizations
    optimizeMapPerformance(map);
    
    // Store map reference for offline operations
    return () => {
      // Cleanup if needed
    };
  }, [map]);
  
  return null; // This component doesn't render anything
};

/**
 * Route optimizer component for planning efficient collection routes
 */
const RouteOptimizer = ({ assignments, requests, userLocation }) => {
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [mapCenter, setMapCenter] = useState([0, 0]);
  const [mapZoom, setMapZoom] = useState(13);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSavingTiles, setIsSavingTiles] = useState(false);
  const [isClearingTiles, setIsClearingTiles] = useState(false);
  const [savingProgress, setSavingProgress] = useState(0);
  const [cachedTileCount, setCachedTileCount] = useState(0);
  
  // Refs for map and tile layer
  const mapRef = useRef(null);
  const offlineTileLayerRef = useRef(null);
  
  // Using SVG-based marker icons imported from markerIcons.js
  // These replace the previous PNG-based icons that were missing
  
  // Initialize offline map storage
  useEffect(() => {
    // Initialize offline storage
    initOfflineMapStorage();
    console.log('Initializing offline map storage');
    
    // Check if we have cached tiles
    const checkCachedTiles = async () => {
      try {
        const keys = await localforage.keys();
        console.log('Cached tiles found:', keys.length);
        setCachedTileCount(keys.length);
        setIsOfflineMode(keys.length > 0);
      } catch (error) {
        console.error('Error checking cached tiles:', error);
      }
    };
    
    checkCachedTiles();
    
    // Clean up any existing tile layers when component unmounts
    return () => {
      if (mapRef.current && offlineTileLayerRef.current) {
        console.log('Cleaning up tile layers');
        if (mapRef.current.hasLayer(offlineTileLayerRef.current)) {
          mapRef.current.removeLayer(offlineTileLayerRef.current);
        }
      }
    };
  }, []);
  
  // Process route with given assignments, requests, and location
  const processRoute = (assignments, requests, location) => {
    setIsLoading(true);
    console.log('Processing route with location:', location);
    
    // Filter only accepted assignments
    const acceptedAssignments = assignments.filter(assignment => 
      assignment.status === 'accepted'
    );
    
    // Filter only pending requests (those that need attention)
    const pendingRequests = requests?.filter(request => 
      request.status === 'pending' || request.status === 'new'
    ) || [];
    
    console.log('Accepted assignments:', acceptedAssignments.length);
    console.log('Pending requests:', pendingRequests.length);
    
    if (acceptedAssignments.length === 0 && pendingRequests.length === 0) {
      console.log('No accepted assignments or pending requests found');
      setOptimizedRoute([]);
      setTotalDistance(0);
      setEstimatedTime(0);
      setIsLoading(false);
      // Still set map center to user location
      setMapCenter([location.latitude, location.longitude]);
      return;
    }
    
    // Calculate optimized route
    const startPosition = {
      lat: location.latitude,
      lng: location.longitude
    };
    
    console.log('Calculating route from:', startPosition);
    
    // Combine assignments and requests for route calculation
    // Prioritize assignments first, then add requests
    let combinedStops = [...acceptedAssignments];
    
    // Add requests to the route calculation if there are any
    if (pendingRequests.length > 0) {
      // Add a type property to distinguish between assignments and requests
      combinedStops = combinedStops.map(item => ({ ...item, type: 'assignment' }));
      const requestsWithType = pendingRequests.map(item => ({ ...item, type: 'request' }));
      combinedStops = [...combinedStops, ...requestsWithType];
    }
    
    console.log('Combined stops for routing:', combinedStops.length);
    
    // Calculate the optimized route with all stops
    const route = calculateNearestNeighborRoute(combinedStops, startPosition);
    const distance = calculateRouteDistance(route, startPosition);
    const time = estimateRouteTime(route, startPosition);
    
    console.log('Route calculated with stops:', route.length);
    
    // Count assignments and requests in the optimized route
    const assignmentCount = route.filter(stop => !stop.type || stop.type === 'assignment').length;
    const requestCount = route.filter(stop => stop.type === 'request').length;
    console.log(`Route contains ${assignmentCount} assignments and ${requestCount} requests`);
    
    setOptimizedRoute(route);
    setTotalDistance(distance);
    setEstimatedTime(time);
    
    // Set map center to user location
    setMapCenter([location.latitude, location.longitude]);
    
    setIsLoading(false);
  };
  
  // Calculate optimized route when assignments, requests, or user location changes
  useEffect(() => {
    // Skip if we have no assignments and no requests
    if ((!assignments || assignments.length === 0) && (!requests || requests.length === 0)) {
      setIsLoading(false);
      return;
    }
    
    // Always ensure we have a valid userLocation
    if (!userLocation) {
      console.log('No user location provided, using default');
      const defaultLocation = {
        latitude: import.meta.env.VITE_DEFAULT_LATITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LATITUDE) : 5.6037,
        longitude: import.meta.env.VITE_DEFAULT_LONGITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LONGITUDE) : -0.1870,
        isFallback: true
      };
      // Continue with default location
      processRoute(assignments, requests, defaultLocation);
      return;
    }
    
    processRoute(assignments, requests, userLocation);
  }, [assignments, requests, userLocation]);
  
  // Generate route coordinates for polyline
  const routeCoordinates = optimizedRoute.map(assignment => [
    assignment.latitude,
    assignment.longitude
  ]);
  
  // Add user location as the first point
  if (userLocation && routeCoordinates.length > 0) {
    routeCoordinates.unshift([userLocation.latitude, userLocation.longitude]);
  }
  
  // Handle navigation to Google Maps
  const navigateToRoute = () => {
    if (optimizedRoute.length === 0 || !userLocation) return;
    
    const startPosition = {
      lat: userLocation.latitude,
      lng: userLocation.longitude
    };
    
    const directionsUrl = generateDirectionsUrl(optimizedRoute, startPosition);
    window.open(directionsUrl, '_blank');
  };
  
  // Handle saving map tiles for offline use
  const handleSaveMapTiles = () => {
    if (!mapRef.current) {
      console.error('Map reference not available');
      toast.info('Map is still initializing. Please try again in a moment.', {
        position: "top-center",
        autoClose: 3000,
      });
      // Try again after a short delay
      setTimeout(() => {
        if (mapRef.current) {
          handleSaveMapTiles();
        }
      }, 1500);
      return;
    }
    
    setIsSavingTiles(true);
    
    // Get the current map bounds
    const bounds = mapRef.current.getBounds();
    const zoom = mapRef.current.getZoom();
    
    // Create offline layer if it doesn't exist
    if (!offlineTileLayerRef.current) {
      offlineTileLayerRef.current = createOfflineTileLayer();
    }
    
    // Save tiles for offline use
    const tileLayer = offlineTileLayerRef.current;
    
    console.log(`Saving tiles for bounds: ${bounds.toBBoxString()}, zoom: ${zoom}`);
    
    // Calculate approximate tile count for better progress reporting
    const tileBounds = L.bounds(
      mapRef.current.project(bounds.getNorthWest(), zoom).divideBy(256).floor(),
      mapRef.current.project(bounds.getSouthEast(), zoom).divideBy(256).ceil()
    );
    const width = tileBounds.max.x - tileBounds.min.x + 1;
    const height = tileBounds.max.y - tileBounds.min.y + 1;
    const zoomLevels = Math.min(zoom + 1, 18) - Math.max(zoom - 1, 0) + 1;
    const approxTileCount = width * height * zoomLevels;
    
    console.log(`Approximately ${approxTileCount} tiles will be saved`);
    
    // Show toast notification
    toast.info(`Saving approximately ${approxTileCount} map tiles for offline use...`, {
      position: "top-center",
      autoClose: 5000,
    });
    
    tileLayer.saveTiles({
      bounds,
      minZoom: Math.max(zoom - 1, 0),
      maxZoom: Math.min(zoom + 1, 18),
      validateTile: () => true,
      // Add progress callback
      progress: (count, total) => {
        console.log(`Saved ${count} of ${total} tiles (${Math.round(count/total*100)}%)`);
      }
    }).then(() => {
      console.log('Tiles saved successfully');
      
      // Update the tile count
      return tileLayer.getTileCount();
    }).then((count) => {
      setCachedTileCount(count);
      setIsOfflineMode(count > 0);
      setIsSavingTiles(false);
      
      // Force a refresh of the map
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
      
      console.log(`${count} tiles now cached`);
      
      // Show success notification
      toast.success(`Successfully saved ${count} map tiles for offline use!`, {
        position: "top-center",
        autoClose: 3000,
      });
    }).catch((error) => {
      console.error('Error saving tiles:', error);
      setIsSavingTiles(false);
      
      // Show error notification
      toast.error(`Failed to save map tiles: ${error.message}`, {
        position: "top-center",
        autoClose: 5000,
      });
    });
  };
  
  // Handle clearing map tiles
  const handleClearMapTiles = () => {
    if (!offlineTileLayerRef.current) {
      console.error('Offline tile layer not available');
      return;
    }
    
    setIsClearingTiles(true);
    
    // Show confirmation toast
    toast.info(`Clearing ${cachedTileCount} cached map tiles...`, {
      position: "top-center",
      autoClose: 3000,
    });
    
    offlineTileLayerRef.current.deleteTiles().then(() => {
      console.log('Tiles cleared successfully');
      setCachedTileCount(0);
      setIsOfflineMode(false);
      setIsClearingTiles(false);
      
      // Force a refresh of the map
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
      
      // Show success notification
      toast.success('All offline map tiles have been cleared!', {
        position: "top-center",
        autoClose: 3000,
      });
    }).catch((error) => {
      console.error('Error clearing tiles:', error);
      setIsClearingTiles(false);
      
      // Show error notification
      toast.error(`Failed to clear map tiles: ${error.message}`, {
        position: "top-center",
        autoClose: 5000,
      });
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Optimized Route</h2>
          <div className="flex items-center">
            {isOfflineMode ? (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Offline Ready</span>
              </span>
            ) : (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded mr-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-medium">Online Only</span>
              </span>
            )}
            <span 
              className={`text-xs ${cachedTileCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'} px-2 py-1 rounded flex items-center`}
              title={`${cachedTileCount} map tiles cached for offline use`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="font-medium">{cachedTileCount} {cachedTileCount === 1 ? 'Tile' : 'Tiles'}</span>
            </span>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          <span className="ml-2 text-gray-600">Calculating optimal route...</span>
        </div>
      ) : optimizedRoute.length === 0 ? (
        <div className="py-4 text-center text-gray-600">
          <p>No accepted assignments to optimize.</p>
          <p className="text-sm mt-1">Accept assignments to plan your route.</p>
        </div>
      ) : (
        <div className="mt-2">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Total distance: {totalDistance.toFixed(1)} km</span>
            <span>Estimated time: {estimatedTime} min</span>
          </div>
          
          <button
            onClick={navigateToRoute}
            className="w-full py-2 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 transition-colors mb-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Navigate Route
          </button>
          
          {/* Offline map controls */}
          <div className="flex space-x-2">
            {isSavingTiles ? (
              <div className="w-full py-2 bg-blue-100 text-blue-800 rounded-md flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                <span>Saving map tiles... {savingProgress}%</span>
              </div>
            ) : isOfflineMode ? (
              <button
                onClick={handleClearMapTiles}
                className="flex-1 py-2 bg-red-100 text-red-700 rounded-md flex items-center justify-center hover:bg-red-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Offline Maps
              </button>
            ) : (
              <button
                onClick={handleSaveMapTiles}
                className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-md flex items-center justify-center hover:bg-blue-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Save Maps for Offline
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className="h-72 relative z-0 mb-16" style={{ position: 'relative' }}>
        <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, backgroundColor: '#f0f0f0' }}>
          {!isLoading && (
            <MapContainer 
              key={`map-${userLocation?.latitude || 0}-${userLocation?.longitude || 0}-${isOfflineMode ? 'offline' : 'online'}-${Date.now()}`}
              center={mapCenter} 
              zoom={mapZoom} 
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              whenCreated={(map) => {
                console.log('Map created with center:', mapCenter);
                mapRef.current = map;
                
                // Apply optimizations
                optimizeMapPerformance(map);
                
                // Initialize the offline tile layer immediately if in offline mode
                if (isOfflineMode && (!offlineTileLayerRef.current || !offlineTileLayerRef.current._offlineEnabled)) {
                  console.log('Creating offline tile layer on map creation');
                  offlineTileLayerRef.current = createOfflineTileLayer();
                  offlineTileLayerRef.current.addTo(map);
                }
              }}
            >
              {/* Use appropriate tile layer based on mode */}
              {!isOfflineMode && (
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
              )}
              
              {/* Offline layer is added via whenCreated and not as a React component */}
              
              {/* Apply map optimizations */}
              <MapOptimizer />
              
              {/* User location marker */}
              {userLocation && (
                <Marker 
                  position={[userLocation.latitude, userLocation.longitude]}
                  icon={startMarkerIcon}
                >
                  <Popup>
                    <div className="text-center">
                      <strong>Your Location</strong>
                      <p className="text-xs text-gray-600">Starting point</p>
                    </div>
                  </Popup>
                </Marker>
              )}
              
              {/* Stop markers (assignments and requests) */}
              {optimizedRoute && optimizedRoute.length > 0 && optimizedRoute.map((stop, index) => {
                return (
                  <Marker
                    key={`stop-${stop.id}`}
                    position={[stop.latitude, stop.longitude]}
                    icon={getStopIcon(stop)}
                  >
                    <Popup>
                      <div>
                        <div className={`text-sm font-bold ${stop.type === 'request' ? 'text-red-600' : 'text-blue-600'} mb-1`}>
                          {stop.type === 'request' ? 'Request' : 'Assignment'} #{index + 1}
                        </div>
                        <p className="text-xs">{stop.location}</p>
                        <p className="text-xs text-gray-600">{stop.customer_name}</p>
                        {stop.waste_type && (
                          <p className="text-xs mt-1 bg-gray-100 px-2 py-1 rounded inline-block">
                            {stop.waste_type}
                          </p>
                        )}
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            Stop {index + 1} of {optimizedRoute.length}
                          </p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
              
              {/* Route polyline */}
              {routeCoordinates && routeCoordinates.length > 1 && (
                <>
                  {/* Main route line */}
                  <Polyline
                    positions={routeCoordinates}
                    color="#10B981"
                    weight={4}
                    opacity={0.7}
                    dashArray="10,10"
                  />
                  
                  {/* Direction arrows along the route */}
                  {routeCoordinates.length > 2 && routeCoordinates.slice(0, -1).map((position, index) => {
                    if (index % 2 === 0 && index < routeCoordinates.length - 1) {
                      // Calculate midpoint for arrow placement
                      const nextPosition = routeCoordinates[index + 1];
                      const midLat = (position[0] + nextPosition[0]) / 2;
                      const midLng = (position[1] + nextPosition[1]) / 2;
                      
                      return (
                        <Marker
                          key={`arrow-${index}`}
                          position={[midLat, midLng]}
                          icon={L.divIcon({
                            html: '→',
                            className: 'route-arrow-icon',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                          })}
                          zIndexOffset={-1000}
                        />
                      );
                    }
                    return null;
                  })}
                </>
              )}
            </MapContainer>
          )}
        </div>
      </div>
      
      {optimizedRoute.length > 0 && (
        <div className="p-4 border-t">
          <h3 className="font-medium text-gray-800 mb-2">Route Details</h3>
          <ol className="text-sm">
            {optimizedRoute.map((stop, index) => {
              // Determine if this is an assignment or request
              const isRequest = stop.type === 'request';
              const bgColor = isRequest ? 'bg-red-500' : 'bg-blue-500';
              
              return (
                <li key={stop.id} className="py-2 border-b last:border-0 flex items-start">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full ${bgColor} text-white flex items-center justify-center mr-3 mt-1`}>
                    {index + 1}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{stop.location}</p>
                        <p className="text-xs text-gray-600">{stop.customer_name}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${isRequest ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                        {isRequest ? 'Request' : 'Assignment'}
                      </span>
                    </div>
                    {stop.waste_type && (
                      <p className="text-xs mt-1 bg-gray-100 px-2 py-1 rounded inline-block">
                        {stop.waste_type}
                      </p>
                    )}
                    {index < optimizedRoute.length - 1 && (
                      <div className="mt-1 text-xs text-gray-500 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Next stop: {(calculateDistance(
                          { latitude: stop.latitude, longitude: stop.longitude },
                          { latitude: optimizedRoute[index + 1].latitude, longitude: optimizedRoute[index + 1].longitude }
                        )).toFixed(1)} km
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
};

export default RouteOptimizer;
