import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { 
  calculateNearestNeighborRoute, 
  calculateRouteDistance, 
  estimateRouteTime,
  generateDirectionsUrl
} from '../utils/routeOptimizationUtils';

/**
 * Route optimizer component for planning efficient collection routes
 */
const RouteOptimizer = ({ assignments, userLocation }) => {
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [mapCenter, setMapCenter] = useState([0, 0]);
  const [mapZoom, setMapZoom] = useState(13);
  const [isLoading, setIsLoading] = useState(true);
  
  // Custom marker icons
  const startIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  
  const stopIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  
  // Calculate optimized route when assignments or user location changes
  useEffect(() => {
    if (!assignments || assignments.length === 0 || !userLocation) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    // Filter only accepted assignments
    const acceptedAssignments = assignments.filter(assignment => 
      assignment.status === 'accepted'
    );
    
    if (acceptedAssignments.length === 0) {
      setOptimizedRoute([]);
      setTotalDistance(0);
      setEstimatedTime(0);
      setIsLoading(false);
      return;
    }
    
    // Calculate optimized route
    const startPosition = {
      lat: userLocation.latitude,
      lng: userLocation.longitude
    };
    
    const route = calculateNearestNeighborRoute(acceptedAssignments, startPosition);
    const distance = calculateRouteDistance(route, startPosition);
    const time = estimateRouteTime(route, startPosition);
    
    setOptimizedRoute(route);
    setTotalDistance(distance);
    setEstimatedTime(time);
    
    // Set map center to user location
    setMapCenter([userLocation.latitude, userLocation.longitude]);
    
    setIsLoading(false);
  }, [assignments, userLocation]);
  
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
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Optimized Route</h2>
          {userLocation && userLocation.isFallback && (
            <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Using estimated location
            </div>
          )}
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
              className="w-full py-2 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Navigate Route
            </button>
          </div>
        )}
      </div>
      
      <div className="h-72 relative z-0 mb-16">
        {!isLoading && (
          <MapContainer 
            center={mapCenter} 
            zoom={mapZoom} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* User location marker */}
            {userLocation && (
              <Marker 
                position={[userLocation.latitude, userLocation.longitude]}
                icon={startIcon}
              >
                <Popup>
                  <div className="text-center">
                    <strong>Your Location</strong>
                    <p className="text-xs text-gray-600">Starting point</p>
                  </div>
                </Popup>
              </Marker>
            )}
            
            {/* Assignment markers */}
            {optimizedRoute.map((assignment, index) => (
              <Marker
                key={assignment.id}
                position={[assignment.latitude, assignment.longitude]}
                icon={stopIcon}
              >
                <Popup>
                  <div>
                    <strong>Stop {index + 1}</strong>
                    <p className="text-xs">{assignment.location}</p>
                    <p className="text-xs text-gray-600">{assignment.customer_name}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* Route polyline */}
            {routeCoordinates.length > 1 && (
              <Polyline
                positions={routeCoordinates}
                color="#10B981"
                weight={4}
                opacity={0.7}
                dashArray="10,10"
              />
            )}
          </MapContainer>
        )}
      </div>
      
      {optimizedRoute.length > 0 && (
        <div className="p-4 border-t">
          <h3 className="font-medium text-gray-800 mb-2">Route Details</h3>
          <ol className="text-sm">
            {optimizedRoute.map((assignment, index) => (
              <li key={assignment.id} className="py-2 border-b last:border-0 flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 mt-1">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{assignment.location}</p>
                  <p className="text-xs text-gray-600">{assignment.customer_name}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default RouteOptimizer;
