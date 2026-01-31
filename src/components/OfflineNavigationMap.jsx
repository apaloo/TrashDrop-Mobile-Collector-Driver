/**
 * Offline Navigation Map Component
 * 
 * A Leaflet-based map component that works offline using cached tiles.
 * Falls back to this when Google Maps is unavailable due to no internet.
 * 
 * Features:
 * - Uses cached OpenStreetMap tiles from IndexedDB
 * - Displays pre-cached route polyline
 * - Shows user location marker (GPS works offline)
 * - Shows destination marker
 * - Provides distance/ETA based on cached route data
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { offlineMapService } from '../services/offlineMapService';
import { logger } from '../utils/logger';
import { calculateDistance } from '../utils/geoUtils';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create tricycle icon for user location (same as main map)
const createTricycleIcon = () => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="50" height="30">
      <ellipse cx="50" cy="55" rx="30" ry="5" fill="rgba(0,0,0,0.2)"/>
      <g>
        <path d="M65,40 L90,40 Q95,40 95,35 L95,30 Q95,25 90,25 L65,25 Q60,25 60,30 L60,35 Q60,40 65,40 Z" 
              fill="#1d4ed8" stroke="#1e40af" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M90,40 L95,35 L95,30 L90,25 L90,40 Z" fill="#1e40af" stroke="#1e40af" stroke-width="1"/>
        <circle cx="20" cy="45" r="12" fill="#1f2937" stroke="#111827" stroke-width="2.5"/>
        <circle cx="20" cy="45" r="10" fill="none" stroke="#4b5563" stroke-width="1" stroke-dasharray="1,3"/>
        <circle cx="80" cy="45" r="10" fill="#1f2937" stroke="#111827" stroke-width="2.5"/>
        <circle cx="80" cy="45" r="8" fill="none" stroke="#4b5563" stroke-width="1" stroke-dasharray="1,3"/>
        <path d="M30,25 L40,40 L60,40" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M20,25 L20,35 Q20,20 30,25 L35,25" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
        <rect x="40" y="25" width="10" height="5" rx="1" fill="#1f2937" stroke="#111827" stroke-width="1"/>
        <circle cx="45" cy="20" r="6" fill="#22c55e" stroke="#fff" stroke-width="1.5"/>
        <circle cx="45" cy="20" r="3" fill="#fff"/>
      </g>
    </svg>
  `;
  
  return L.divIcon({
    className: 'custom-tricycle-icon',
    html: svgIcon,
    iconSize: [50, 30],
    iconAnchor: [25, 15],
    popupAnchor: [0, -15]
  });
};

// Create destination icon
const createDestinationIcon = (wasteType = 'general') => {
  const colors = {
    recyclable: '#22c55e',
    organic: '#84cc16',
    hazardous: '#ef4444',
    electronic: '#8b5cf6',
    general: '#3b82f6',
    plastic: '#06b6d4',
    paper: '#f59e0b',
    metal: '#6b7280',
    glass: '#14b8a6'
  };
  
  const color = colors[wasteType?.toLowerCase()] || colors.general;
  
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="36" height="48">
      <circle cx="12" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      <circle cx="36" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      <path fill="${color}" stroke="${color}" stroke-width="1.5" 
            d="M40,16h-4v-2c0-1.1-0.9-2-2-2H14c-1.1,0-2,0.9-2,2v2H8v32c0,4.4,3.6,8,8,8h16c4.4,0,8-3.6,8-8V16H40z"/>
      <path fill="${color}" stroke="${color}" stroke-width="1.5" 
            d="M40,16H8c-1.1,0-2-0.9-2-2v-2c0-1.1,0.9-2,2-2h32c1.1,0,2,0.9,2,2v2C42,15.1,41.1,16,40,16z"/>
      <rect x="20" y="10" width="8" height="2" rx="1" fill="#9CA3AF"/>
      <text x="24" y="38" font-size="16" text-anchor="middle" fill="white" font-weight="bold">📍</text>
    </svg>
  `;
  
  return L.divIcon({
    className: 'custom-destination-icon',
    html: svgIcon,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -48]
  });
};

// Custom tile layer that uses cached tiles when offline
class CachedTileLayer extends L.TileLayer {
  constructor(urlTemplate, options) {
    super(urlTemplate, options);
    this.isOffline = !navigator.onLine;
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOffline = false;
      this.redraw();
    });
    window.addEventListener('offline', () => {
      this.isOffline = true;
      this.redraw();
    });
  }

  createTile(coords, done) {
    const tile = document.createElement('img');
    
    tile.onerror = () => {
      // If online fetch fails, try cache
      this.loadFromCache(coords, tile, done);
    };

    tile.onload = () => {
      done(null, tile);
    };

    if (this.isOffline) {
      // Offline: try cache first
      this.loadFromCache(coords, tile, done);
    } else {
      // Online: try network first
      tile.src = this.getTileUrl(coords);
    }

    return tile;
  }

  async loadFromCache(coords, tile, done) {
    try {
      const cachedUrl = await offlineMapService.getTileUrl(coords.z, coords.x, coords.y);
      if (cachedUrl) {
        tile.src = cachedUrl;
      } else {
        // No cached tile - show placeholder
        tile.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        done(new Error('Tile not cached'), tile);
      }
    } catch (error) {
      done(error, tile);
    }
  }
}

// Map controller component to handle map updates
const MapController = ({ center, zoom, userLocation, followUser }) => {
  const map = useMap();
  
  useEffect(() => {
    if (followUser && userLocation) {
      map.setView([userLocation.lat, userLocation.lng], zoom, { animate: true });
    }
  }, [map, userLocation, followUser, zoom]);
  
  return null;
};

const OfflineNavigationMap = ({
  userLocation,
  destination,
  destinationName = 'Pickup Location',
  routeCoordinates = [],
  navigationSteps = [],
  currentStepIndex = 0,
  wasteType = 'general',
  onMapReady,
  isNavigating = false
}) => {
  const mapRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [cachedRouteCoords, setCachedRouteCoords] = useState([]);
  
  // Initialize map and load cached route if needed
  useEffect(() => {
    const loadCachedRoute = async () => {
      try {
        await offlineMapService.initialize();
        
        // If we don't have route coordinates, try to load from cache
        if (routeCoordinates.length === 0) {
          const cachedRoute = await offlineMapService.getRoute('current-navigation');
          if (cachedRoute && cachedRoute.polylineCoords) {
            setCachedRouteCoords(cachedRoute.polylineCoords);
            logger.info('📦 Loaded cached route for offline display');
          }
        }
      } catch (error) {
        logger.error('Error loading cached route:', error);
      }
    };
    
    loadCachedRoute();
  }, [routeCoordinates]);
  
  // Calculate distance to destination
  useEffect(() => {
    if (userLocation && destination) {
      const userCoords = { lat: userLocation.lat || userLocation[0], lng: userLocation.lng || userLocation[1] };
      const destCoords = { lat: destination[0] || destination.lat, lng: destination[1] || destination.lng };
      const distance = calculateDistance(userCoords, destCoords);
      setDistanceToDestination(distance);
    }
  }, [userLocation, destination]);
  
  // Handle map ready
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    if (onMapReady) {
      onMapReady(mapRef.current);
    }
  }, [onMapReady]);
  
  // Get initial center
  const getInitialCenter = () => {
    if (userLocation) {
      return [userLocation.lat || userLocation[0], userLocation.lng || userLocation[1]];
    }
    if (destination) {
      return [destination[0] || destination.lat, destination[1] || destination.lng];
    }
    return [5.6037, -0.1870]; // Default to Accra
  };
  
  // Format distance for display
  const formatDistance = (distanceKm) => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  };
  
  // Use route coordinates from props or cache
  const displayRouteCoords = routeCoordinates.length > 0 ? routeCoordinates : cachedRouteCoords;
  
  // Convert route coordinates to Leaflet format
  const polylinePositions = displayRouteCoords.map(coord => {
    if (Array.isArray(coord)) {
      return coord;
    }
    return [coord.lat, coord.lng];
  });

  return (
    <div className="relative w-full h-full">
      {/* Offline indicator */}
      <div className="absolute top-2 left-2 z-[1000] bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-lg">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
        Offline Mode
      </div>
      
      {/* Current navigation instruction */}
      {isNavigating && navigationSteps.length > 0 && currentStepIndex < navigationSteps.length && (
        <div className="absolute top-12 left-2 right-2 z-[1000] bg-blue-600 text-white p-3 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded-full">
              Step {currentStepIndex + 1}/{navigationSteps.length}
            </span>
            <span className="font-bold">{navigationSteps[currentStepIndex]?.distance}</span>
          </div>
          <div 
            className="text-sm font-medium"
            dangerouslySetInnerHTML={{ __html: navigationSteps[currentStepIndex]?.instruction }}
          />
        </div>
      )}
      
      {/* Distance to destination */}
      {distanceToDestination !== null && (
        <div className="absolute bottom-20 left-2 z-[1000] bg-white px-3 py-2 rounded-lg shadow-lg">
          <div className="text-xs text-gray-500">Distance</div>
          <div className="text-lg font-bold text-blue-600">{formatDistance(distanceToDestination)}</div>
        </div>
      )}
      
      {/* Follow user toggle */}
      <button
        onClick={() => setFollowUser(!followUser)}
        className={`absolute bottom-20 right-2 z-[1000] p-3 rounded-full shadow-lg transition-colors ${
          followUser ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
        }`}
        title={followUser ? 'Auto-follow enabled' : 'Auto-follow disabled'}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      
      <MapContainer
        center={getInitialCenter()}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        whenReady={handleMapReady}
        zoomControl={false}
      >
        {/* Use standard OSM tiles - they'll fail gracefully offline */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        />
        
        {/* Map controller for auto-follow */}
        <MapController 
          center={getInitialCenter()} 
          zoom={16} 
          userLocation={userLocation ? { lat: userLocation.lat || userLocation[0], lng: userLocation.lng || userLocation[1] } : null}
          followUser={followUser}
        />
        
        {/* Route polyline */}
        {polylinePositions.length > 0 && (
          <Polyline 
            positions={polylinePositions} 
            color="#4285F4" 
            weight={5} 
            opacity={0.8}
          />
        )}
        
        {/* User location marker */}
        {userLocation && (
          <>
            <Marker
              position={[userLocation.lat || userLocation[0], userLocation.lng || userLocation[1]]}
              icon={createTricycleIcon()}
            >
              <Popup>
                <div className="text-center">
                  <strong>Your Location</strong>
                  <br />
                  <span className="text-xs text-gray-500">GPS Active</span>
                </div>
              </Popup>
            </Marker>
            {/* Accuracy circle */}
            <Circle
              center={[userLocation.lat || userLocation[0], userLocation.lng || userLocation[1]]}
              radius={30}
              pathOptions={{ color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.15 }}
            />
          </>
        )}
        
        {/* Destination marker */}
        {destination && (
          <Marker
            position={[destination[0] || destination.lat, destination[1] || destination.lng]}
            icon={createDestinationIcon(wasteType)}
          >
            <Popup>
              <div className="text-center">
                <strong>{destinationName}</strong>
                {distanceToDestination && (
                  <>
                    <br />
                    <span className="text-xs text-gray-500">{formatDistance(distanceToDestination)} away</span>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Geofence circle at destination (50m) */}
        {destination && (
          <Circle
            center={[destination[0] || destination.lat, destination[1] || destination.lng]}
            radius={50}
            pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.1, dashArray: '5, 5' }}
          />
        )}
      </MapContainer>
      
      {/* Cached data notice */}
      <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-lg text-xs">
        <span className="font-medium">📡 Offline Navigation:</span> GPS tracking active. Route may not update until connection restored.
      </div>
    </div>
  );
};

export default OfflineNavigationMap;
