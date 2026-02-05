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
import { startMarkerIcon, assignmentMarkerIcon, requestMarkerIcon, getStopIcon, tricycleIcon } from '../utils/markerIcons';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.offline';
import localforage from 'localforage';
import { logger } from '../utils/logger';
import GoogleMapsNavigation from './GoogleMapsNavigation';
import { useNavigationPersistence } from '../hooks/useNavigationPersistence';
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
      logger.debug('Creating offline tile layer');
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
const MapOptimizer = ({ mapRef, offlineTileLayerRef, isOfflineMode }) => {
  const map = useMap();
  
  useEffect(() => {
    // Store map reference for parent component
    if (mapRef) {
      mapRef.current = map;
      logger.debug('Map reference set in MapOptimizer');
    }
    
    // Apply performance optimizations
    optimizeMapPerformance(map);
    
    // Initialize the offline tile layer immediately if in offline mode
    if (isOfflineMode && offlineTileLayerRef && (!offlineTileLayerRef.current || !offlineTileLayerRef.current._offlineEnabled)) {
      logger.debug('Creating offline tile layer on map initialization');
      offlineTileLayerRef.current = createOfflineTileLayer();
      offlineTileLayerRef.current.addTo(map);
    }
    
    return () => {
      // Cleanup if needed
    };
  }, [map, mapRef, offlineTileLayerRef, isOfflineMode]);
  
  return null; // This component doesn't render anything
};

/**
 * Route optimizer component for planning efficient collection routes
 */
const RouteOptimizer = ({ assignments, requests, userLocation }) => {
  const { saveNavigationState, restoreNavigationState, clearNavigationState } = useNavigationPersistence();
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
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  const [navigationWaypoints, setNavigationWaypoints] = useState([]);
  const [isInTurnByTurn, setIsInTurnByTurn] = useState(false);
  const navigationControlRef = useRef(null);
  
  // Refs for map and tile layer
  const mapRef = useRef(null);
  const offlineTileLayerRef = useRef(null);
  const hasShownTooFarWarning = useRef(false);
  
  // Using SVG-based marker icons imported from markerIcons.js
  // These replace the previous PNG-based icons that were missing
  
  // Initialize offline map storage
  useEffect(() => {
    // Initialize offline storage
    initOfflineMapStorage();
    logger.debug('Initializing offline map storage');
    
    // Check if we have cached tiles
    const checkCachedTiles = async () => {
      try {
        const keys = await localforage.keys();
        logger.debug('Cached tiles found:', keys.length);
        setCachedTileCount(keys.length);
        setIsOfflineMode(keys.length > 0);
      } catch (error) {
        logger.error('Error checking cached tiles:', error);
      }
    };
    
    checkCachedTiles();
    
    // Clean up any existing tile layers when component unmounts
    return () => {
      if (mapRef.current && offlineTileLayerRef.current) {
        logger.debug('Cleaning up tile layers');
        if (mapRef.current.hasLayer(offlineTileLayerRef.current)) {
          mapRef.current.removeLayer(offlineTileLayerRef.current);
        }
      }
    };
  }, []);
  
  // Process route with given assignments, requests, and location
  const processRoute = (assignments, requests, location) => {
    setIsLoading(true);
    logger.debug('Processing route with location:', location);
    
    // Validate inputs to prevent crashes
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      logger.error('⚠️ Invalid location provided to processRoute:', location);
      setIsLoading(false);
      return;
    }
    
    if (!Array.isArray(assignments)) {
      logger.error('⚠️ Invalid assignments provided to processRoute:', assignments);
      setIsLoading(false);
      return;
    }
    
    // Filter only accepted assignments
    const acceptedAssignments = assignments.filter(assignment => 
      assignment && assignment.status === 'accepted'
    );
    
    // Filter only pending requests (those that need attention)
    const pendingRequests = requests?.filter(request => 
      request.status === 'pending' || request.status === 'new'
    ) || [];
    
    logger.debug('Accepted assignments:', acceptedAssignments.length);
    logger.debug('Pending requests:', pendingRequests.length);
    
    if (acceptedAssignments.length === 0 && pendingRequests.length === 0) {
      logger.debug('No accepted assignments or pending requests found');
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
    
    logger.debug('Calculating route from:', startPosition);
    
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
    
    logger.debug('Combined stops for routing:', combinedStops.length);
    
    // Calculate the optimized route with all stops
    const route = calculateNearestNeighborRoute(combinedStops, startPosition);
    const distance = calculateRouteDistance(route, startPosition);
    const time = estimateRouteTime(route, startPosition);
    
    logger.debug('Route calculated with stops:', route.length);
    
    // Count assignments and requests in the optimized route
    const assignmentCount = route.filter(stop => !stop.type || stop.type === 'assignment').length;
    const requestCount = route.filter(stop => stop.type === 'request').length;
    logger.debug(`Route contains ${assignmentCount} assignments and ${requestCount} requests`);
    
    // Data validation: Detect unrealistic calculations
    const maxReasonableDistance = 100; // 100 km max for daily collection routes
    const maxReasonableTime = 600; // 600 minutes (10 hours) max for a workday
    
    if (distance > maxReasonableDistance || time > maxReasonableTime || isNaN(distance) || isNaN(time)) {
      logger.error('⚠️ Unrealistic route detected:', { 
        distance: `${distance.toFixed(1)} km`, 
        time: `${time} min`,
        routeLength: route.length,
        isNaN: isNaN(distance) || isNaN(time)
      });
      
      // Show warning only once (prevents duplicate toasts from StrictMode)
      if (!hasShownTooFarWarning.current) {
        hasShownTooFarWarning.current = true;
        toast.warning(
          <div className="text-center">
            <div className="text-2xl mb-1">⚠️ Too Far!</div>
            <div className="text-base font-bold">{distance.toFixed(0)} km • {Math.round(time/60)} hours</div>
            <div className="text-sm mt-1">📍 Pick closer jobs</div>
          </div>, 
          {
            position: "top-center",
            autoClose: 10000,
            style: { fontSize: '16px', padding: '16px' }
          }
        );
      }
      
      // Still show the route but warn user
      setOptimizedRoute(route);
      setTotalDistance(distance);
      setEstimatedTime(time);
    } else {
      setOptimizedRoute(route);
      setTotalDistance(distance);
      setEstimatedTime(time);
    }
    
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
      logger.debug('No user location provided, using default');
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
  
  // Handle navigation with Google Maps modal
  const navigateToRoute = () => {
    if (optimizedRoute.length === 0) {
      toast.warning('No route available to navigate. Please accept some requests first.', {
        position: "top-center",
        autoClose: 3000,
      });
      return;
    }
    
    if (!userLocation) {
      toast.warning('Your location is not available. Please enable location services.', {
        position: "top-center",
        autoClose: 3000,
      });
      return;
    }
    
    // Prepare waypoints for Google Maps
    const waypoints = optimizedRoute.map(stop => ({
      location: stop.location || 'Stop',
      position: {
        lat: stop.latitude,
        lng: stop.longitude
      }
    }));
    
    logger.info('Opening in-app navigation for', waypoints.length, 'waypoints');
    
    // Set waypoints and show modal
    setNavigationWaypoints(waypoints);
    setShowNavigationModal(true);
    
    toast.success('Loading route navigation...', {
      position: "top-center",
      autoClose: 2000,
    });
  };
  
  // Handle route export/share
  const exportRoute = async () => {
    if (optimizedRoute.length === 0) {
      toast.warning('No route to export. Please accept some requests first.', {
        position: "top-center",
        autoClose: 3000,
      });
      return;
    }
    
    const routeData = {
      timestamp: new Date().toISOString(),
      stops: optimizedRoute.length,
      distance: `${totalDistance.toFixed(1)} km`,
      estimatedTime: `${estimatedTime} min`,
      waypoints: optimizedRoute.map((stop, index) => ({
        order: index + 1,
        location: stop.location || 'Unknown',
        type: stop.type || 'assignment',
        wasteType: stop.waste_type || 'N/A',
        coordinates: [stop.latitude, stop.longitude]
      }))
    };
    
    const routeText = `TrashDrop Route Plan
Generated: ${new Date().toLocaleString()}

📍 ${routeData.stops} stops
📏 ${routeData.distance}
⏱️ ${routeData.estimatedTime}

Stops:
${routeData.waypoints.map(w => `${w.order}. ${w.location} (${w.wasteType})`).join('\n')}

View route: ${generateDirectionsUrl(optimizedRoute, {lat: userLocation.latitude, lng: userLocation.longitude})}`;
    
    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TrashDrop Route Plan',
          text: routeText,
        });
        
        toast.success('Route shared successfully!', {
          position: "top-center",
          autoClose: 2000,
        });
        
        logger.info('Route shared via Web Share API');
      } catch (error) {
        if (error.name !== 'AbortError') {
          logger.error('Error sharing route:', error);
          // Fallback to clipboard
          copyToClipboard(routeText);
        }
      }
    } else {
      // Fallback: Copy to clipboard
      copyToClipboard(routeText);
    }
  };
  
  // Helper function to copy text to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Route details copied to clipboard!', {
        position: "top-center",
        autoClose: 3000,
      });
      logger.info('Route copied to clipboard');
    } catch (error) {
      logger.error('Error copying to clipboard:', error);
      toast.error('Failed to copy route. Please try again.', {
        position: "top-center",
        autoClose: 3000,
      });
    }
  };
  
  // Handle saving map tiles for offline use
  const handleSaveMapTiles = () => {
    if (!mapRef.current) {
      logger.error('Map reference not available');
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
    
    // Check if saveTiles method exists
    if (!tileLayer || typeof tileLayer.saveTiles !== 'function') {
      logger.error('Offline tile layer not properly initialized or saveTiles method not available');
      setIsSavingTiles(false);
      toast.error('Offline map functionality is not available. Please refresh the page and try again.', {
        position: "top-center",
        autoClose: 5000,
      });
      return;
    }
    
    logger.info(`Saving tiles for bounds: ${bounds.toBBoxString()}, zoom: ${zoom}`);
    
    // Calculate approximate tile count for better progress reporting
    const tileBounds = L.bounds(
      mapRef.current.project(bounds.getNorthWest(), zoom).divideBy(256).floor(),
      mapRef.current.project(bounds.getSouthEast(), zoom).divideBy(256).ceil()
    );
    const width = tileBounds.max.x - tileBounds.min.x + 1;
    const height = tileBounds.max.y - tileBounds.min.y + 1;
    const zoomLevels = Math.min(zoom + 1, 18) - Math.max(zoom - 1, 0) + 1;
    const approxTileCount = width * height * zoomLevels;
    
    logger.info(`Approximately ${approxTileCount} tiles will be saved`);
    
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
        logger.debug(`Saved ${count} of ${total} tiles (${Math.round(count/total*100)}%)`);
      }
    }).then(() => {
      logger.info('Tiles saved successfully');
      
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
      
      logger.info(`${count} tiles now cached`);
      
      // Show success notification
      toast.success(`Successfully saved ${count} map tiles for offline use!`, {
        position: "top-center",
        autoClose: 3000,
      });
    }).catch((error) => {
      logger.error('Error saving tiles:', error);
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
      logger.error('Offline tile layer not available');
      return;
    }
    
    setIsClearingTiles(true);
    
    // Show confirmation toast
    toast.info(`Clearing ${cachedTileCount} cached map tiles...`, {
      position: "top-center",
      autoClose: 3000,
    });
    
    offlineTileLayerRef.current.deleteTiles().then(() => {
      logger.info('Tiles cleared successfully');
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
      logger.error('Error clearing tiles:', error);
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
        <div className="flex justify-end items-center">
          <div className="flex items-center space-x-2">
            {isOfflineMode ? (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Offline Ready</span>
              </span>
            ) : (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded flex items-center whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-medium">Online Only</span>
              </span>
            )}
            <span 
              className={`text-xs ${cachedTileCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'} px-2 py-1 rounded flex items-center whitespace-nowrap`}
              title={`${cachedTileCount} map tiles cached for offline use`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="font-medium">{cachedTileCount} {cachedTileCount === 1 ? 'Tile' : 'Tiles'}</span>
            </span>
          </div>
        </div>
      </div>
      
      {/* GPS Fallback Warning Banner - Simplified for low literacy */}
      {userLocation?.isFallback && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mx-4 mt-3 rounded-r-md">
          <div className="flex items-center">
            <span className="text-3xl mr-3">📍</span>
            <div>
              <p className="text-yellow-800 text-base font-bold">Turn ON GPS</p>
              <p className="text-yellow-700 text-sm mt-1">
                👉 Open phone settings → Location → Turn ON
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Fixed position container for route info and navigation button */}
      <div className="sticky top-0 z-[1000] bg-white shadow-md border-b border-gray-200 mb-2">
        {isLoading ? (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            <span className="ml-2 text-gray-600">Calculating optimal route...</span>
          </div>
        ) : optimizedRoute.length === 0 ? (
          <div className="py-6 text-center">
            <div className="flex justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium mb-1">No Route to Optimize</p>
            <p className="text-sm text-gray-500 mb-3">Accept pickup requests or assignments to plan an optimized route</p>
            <div className="text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-md inline-block">
              💡 Tip: Go to <span className="font-semibold text-green-600">Request</span> or <span className="font-semibold text-blue-600">Assign</span> tab to accept items
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex justify-between text-sm text-gray-700 font-medium mb-3">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>Total distance: <span className="text-green-600">{totalDistance.toFixed(1)} km</span></span>
              </div>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Estimated time: <span className="text-green-600">{estimatedTime} min</span></span>
              </div>
            </div>
            
            <div className="flex space-x-2 mb-2">
              <button
                onClick={navigateToRoute}
                className="flex-1 py-2.5 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 transition-colors font-medium shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Navigate Route
              </button>
              
              <button
                onClick={exportRoute}
                className="px-4 py-2.5 bg-blue-500 text-white rounded-md flex items-center justify-center hover:bg-blue-600 transition-colors font-medium shadow-sm"
                title="Share or export route details"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
            
            {/* Offline map controls - DISABLED: Requires leaflet.offline configuration */}
            {/* Uncomment to enable offline maps functionality after proper setup */}
            {/*
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
            */}
          </div>
        )}
      </div>
      
      <div className="relative z-0 mb-4" style={{ height: 'calc(100vh - 400px)', minHeight: '300px', position: 'relative' }}>
        <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, backgroundColor: '#f0f0f0', borderRadius: '0.5rem', overflow: 'hidden' }}>
          {!isLoading && (
            <MapContainer 
              key={`map-${userLocation?.latitude || 0}-${userLocation?.longitude || 0}-${isOfflineMode ? 'offline' : 'online'}-${Date.now()}`}
              center={mapCenter} 
              zoom={mapZoom} 
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              {/* Use appropriate tile layer based on mode */}
              {!isOfflineMode && (
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
              )}
              
              {/* Apply map optimizations and set map reference */}
              <MapOptimizer 
                mapRef={mapRef} 
                offlineTileLayerRef={offlineTileLayerRef} 
                isOfflineMode={isOfflineMode} 
              />
              
              {/* User location marker */}
              {userLocation && (
                <Marker 
                  position={[userLocation.latitude, userLocation.longitude]}
                  icon={tricycleIcon}
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
                    key={`stop-${stop.id || 'stop'}-${index}`}
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
      
      {/* Route details card removed as requested */}
      
      {/* Google Maps Navigation Modal */}
      {showNavigationModal && userLocation && navigationWaypoints.length > 0 && (
        <div 
          className={`fixed inset-0 z-[9999] flex items-center justify-center ${
            isInTurnByTurn ? 'bg-black' : 'bg-black bg-opacity-50'
          }`}
          style={isInTurnByTurn ? {} : { paddingTop: '4rem', paddingBottom: '5rem' }}
        >
          <div className={`relative w-full h-full bg-white overflow-hidden flex flex-col ${
            isInTurnByTurn ? '' : 'max-w-4xl mx-4 rounded-lg shadow-2xl'
          }`}>
            {/* Modal Header - Hidden during turn-by-turn */}
            {!isInTurnByTurn && (
              <div className="bg-green-600 text-white p-4 flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold">Route Navigation</h3>
                  <p className="text-sm opacity-90">{navigationWaypoints.length} stops</p>
                </div>
                <button
                  onClick={() => {
                    setShowNavigationModal(false);
                    setIsInTurnByTurn(false);
                    clearNavigationState();
                  }}
                  className="p-2 hover:bg-green-700 rounded-full transition-colors"
                  aria-label="Close navigation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            
            {/* Google Maps Navigation Component */}
            <div className="flex-1 overflow-hidden">
              <GoogleMapsNavigation
                userLocation={{
                  lat: userLocation.latitude,
                  lng: userLocation.longitude
                }}
                destination={navigationWaypoints[navigationWaypoints.length - 1].position}
                destinationName={navigationWaypoints[navigationWaypoints.length - 1]?.name || 'final stop'}
                waypoints={navigationWaypoints.slice(0, -1).map(wp => wp.position)}
                navigationControlRef={navigationControlRef}
                onMapReady={(map) => {
                  logger.info('Route navigation map ready');
                }}
                onRouteCalculated={(routeInfo) => {
                  logger.info('Multi-stop route calculated:', routeInfo);
                  toast.success(`Route loaded: ${routeInfo.distance}, ${routeInfo.duration}`, {
                    position: "top-center",
                    autoClose: 3000,
                  });
                }}
                onError={(error) => {
                  logger.error('Navigation error:', error);
                  toast.error(`Navigation error: ${error}`, {
                    position: "top-center",
                    autoClose: 5000,
                  });
                }}
                onNavigationStop={() => {
                  // Exit fullscreen mode
                  setIsInTurnByTurn(false);
                  logger.info('Navigation stopped, exiting fullscreen mode');
                }}
              />
            </div>
            
            {/* Modal Footer - Hidden during turn-by-turn */}
            {!isInTurnByTurn && (
              <div className="bg-gray-50 p-3 flex justify-between items-center flex-shrink-0 border-t">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{totalDistance.toFixed(1)} km</span> · 
                  <span className="ml-1 font-medium">{estimatedTime} min</span>
                </div>
                <button
                  onClick={async () => {
                    // Start in-app turn-by-turn navigation
                    if (navigationControlRef.current?.startNavigation) {
                      setIsInTurnByTurn(true);
                      navigationControlRef.current.startNavigation();
                      
                      // Save navigation state for persistence/recovery
                      const finalWaypoint = navigationWaypoints[navigationWaypoints.length - 1];
                      await saveNavigationState({
                        destination: finalWaypoint?.position,
                        destinationName: finalWaypoint?.name || 'final stop',
                        userLocation,
                        isNavigating: true,
                        sourceType: 'route_optimization'
                      });
                      
                      toast.success('Starting hands-free navigation with voice guidance...', {
                        position: "top-center",
                        autoClose: 3000,
                      });
                    } else {
                      toast.warning('Navigation not ready. Please wait...', {
                        position: "top-center",
                        autoClose: 2000,
                      });
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm font-medium flex items-center shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Start Turn-by-Turn
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteOptimizer;
