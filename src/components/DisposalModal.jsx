import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isWithinRadius } from '../utils/locationUtils';
import { logger } from '../utils/logger';

/**
 * Modal component for disposal process
 * Shows nearest dumping sites, directions, and confirmation
 */
const DisposalModal = ({ 
  assignment, 
  isOpen, 
  onClose, 
  onDispose,
  onGetDirections
}) => {
  const [selectedSite, setSelectedSite] = useState(null);
  const [isDisposing, setIsDisposing] = useState(false);
  const defaultLat = import.meta.env.VITE_DEFAULT_LATITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LATITUDE) : 5.6037;
  const defaultLng = import.meta.env.VITE_DEFAULT_LONGITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LONGITUDE) : -0.1870;
  const [mapCenter, setMapCenter] = useState([defaultLat, defaultLng]); // Default from env vars
  const [userLocation, setUserLocation] = useState([defaultLat, defaultLng]); // Default user location
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const RADIUS_METERS = 50; // 50 meter radius requirement
  
  // Fix Leaflet icon issues with Webpack/Vite
  useEffect(() => {
    // Fix Leaflet's icon paths
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }, []);
  
  // State for disposal centers fetched from Supabase
  const [disposalCenters, setDisposalCenters] = useState([]);
  
  // Fetch disposal centers from Supabase when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchDisposalCenters = async () => {
        try {
          // Import supabase client
          const { supabase } = await import('../services/supabase');
          
          // Fetch disposal centers from the disposal_centers table
          const { data, error } = await supabase
            .from('disposal_centers')
            .select('*');
            
          if (error) {
            logger.error('Error fetching disposal centers:', error);
            return;
          }
          
          if (data && data.length > 0) {
            // Transform data to match our component's expected format
            const centers = data.map(center => ({
              id: center.id,
              name: center.name,
              address: center.address,
              coordinates: [center.latitude, center.longitude],
              openHours: center.operating_hours || '8:00 AM - 6:00 PM',
              rating: center.rating || 4.0,
              // We'll calculate distance dynamically based on user location
              distance: '...' // Will be calculated when user location is available
            }));
            
            setDisposalCenters(centers);
          }
        } catch (err) {
          logger.error('Failed to fetch disposal centers:', err);
        }
      };
      
      fetchDisposalCenters();
    }
  }, [isOpen]);
  
  // Import location utilities
  const calculateDistance = async () => {
    const { calculateDistance } = await import('../utils/locationUtils');
    return calculateDistance;
  };
  
  // Get user's current location when modal opens and update distances
  useEffect(() => {
    if (isOpen) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
            
            // Update distances for all disposal centers
            if (disposalCenters.length > 0) {
              try {
                const distanceCalc = await calculateDistance();
                const updatedCenters = disposalCenters.map(center => {
                  const distance = distanceCalc(
                    latitude,
                    longitude,
                    center.coordinates[0],
                    center.coordinates[1]
                  );
                  return {
                    ...center,
                    distance: `${distance.toFixed(1)} km`
                  };
                });
                setDisposalCenters(updatedCenters);
              } catch (err) {
                logger.error('Error calculating distances:', err);
              }
            }
          },
          (error) => {
            logger.error('Error getting location:', error);
            // Keep default location if there's an error
          },
          { enableHighAccuracy: true }
        );
      }
    }
  }, [isOpen, disposalCenters.length]);

  // Update map center when a site is selected
  useEffect(() => {
    if (selectedSite) {
      setMapCenter(selectedSite.coordinates);
    }
  }, [selectedSite]);
  
  // Check if user is within range of selected site
  useEffect(() => {
    if (selectedSite && userLocation) {
      const withinRange = isWithinRadius(userLocation, selectedSite.coordinates, RADIUS_METERS);
      setIsWithinRange(withinRange);
    } else {
      setIsWithinRange(false);
    }
  }, [selectedSite, userLocation, RADIUS_METERS]);
  
  if (!isOpen || !assignment) return null;
  
  // Handle disposal confirmation
  const handleDispose = () => {
    if (!selectedSite) {
      alert('Please select a dumping site');
      return;
    }
    
    // Check if user is within 50 meters of the selected site
    if (!isWithinRange) {
      setShowLocationModal(true);
      return;
    }
    
    setIsDisposing(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      onDispose(assignment.id, selectedSite);
      setIsDisposing(false);
      onClose();
    }, 1500);
  };
  
  // Close location restriction modal
  const closeLocationModal = () => {
    setShowLocationModal(false);
  };
  
  // Handle get directions
  const handleGetDirections = () => {
    if (!selectedSite) {
      alert('Please select a dumping site');
      return;
    }
    
    onGetDirections(selectedSite);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" style={{ paddingTop: '4rem', paddingBottom: '5rem' }}>
      {/* Location Restriction Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-4" style={{ paddingTop: '4rem', paddingBottom: '5rem' }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 text-center">
            <div className="mb-4 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Location Restriction</h3>
            <p className="text-gray-600 mb-6">
              You must be within 50 meters of the selected dumping site to confirm disposal.
              Please move closer to the site and try again.
            </p>
            <div className="flex justify-center">
              <button
                onClick={closeLocationModal}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                OK, I Understand
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Nearest Dumping Sites</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto p-4 max-h-[calc(90vh-12rem)]">
          <p className="text-sm text-gray-500 mb-4">
            Select a dumping site to dispose of waste from assignment #{assignment.id}.
          </p>
          
          {/* Dumping Sites List */}
          <div className="space-y-3">
            {disposalCenters.map(site => (
              <div 
                key={site.id}
                onClick={() => setSelectedSite(site)}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  selectedSite?.id === site.id 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-800">{site.name}</h3>
                    <p className="text-sm text-gray-600">{site.address}</p>
                    <div className="flex items-center mt-1">
                      <div className="flex items-center text-amber-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-xs ml-1">{site.rating}</span>
                      </div>
                      <span className="text-xs text-gray-500 ml-3">{site.openHours}</span>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-green-600">{site.distance}</span>
                </div>
                
                {selectedSite?.id === site.id && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGetDirections();
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Get Directions
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Interactive Map */}
          <div className="mt-4 bg-gray-100 rounded-lg overflow-hidden">
            <div className="h-48 w-full">
              <MapContainer 
                center={mapCenter} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Markers for all dumping sites */}
                {disposalCenters.map(site => (
                  <React.Fragment key={site.id}>
                    <Marker 
                      position={site.coordinates}
                      opacity={selectedSite?.id === site.id ? 1 : 0.7}
                    >
                      <Popup>
                        <div>
                          <strong>{site.name}</strong><br />
                          {site.address}<br />
                          <span className="text-xs">{site.openHours}</span>
                        </div>
                      </Popup>
                    </Marker>
                    
                    {/* Show 50m radius circle for selected site */}
                    {selectedSite?.id === site.id && (
                      <Circle 
                        center={site.coordinates}
                        radius={RADIUS_METERS}
                        pathOptions={{
                          color: isWithinRange ? 'green' : 'red',
                          fillColor: isWithinRange ? 'green' : 'red',
                          fillOpacity: 0.2
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
                
                {/* User location marker */}
                <Marker 
                  position={userLocation} // Real or simulated user location
                  icon={new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                  })}
                >
                  <Popup>
                    Your Location
                    {selectedSite && (
                      <div className="text-xs mt-1">
                        {isWithinRange 
                          ? <span className="text-green-600">Within 50m range ✓</span>
                          : <span className="text-red-600">Outside 50m range ✗</span>
                        }
                      </div>
                    )}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        </div>
        
        {/* Footer with Action Buttons */}
        <div className="border-t border-gray-200 p-4 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleDispose}
            disabled={!selectedSite || isDisposing || (selectedSite && !isWithinRange)}
            className={`px-4 py-2 rounded-md text-white transition-colors ${
              !selectedSite || isDisposing
                ? 'bg-gray-400 cursor-not-allowed'
                : selectedSite && !isWithinRange
                  ? 'bg-red-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isDisposing ? 'Confirming...' : 
              (selectedSite && !isWithinRange) ? 
                'Too Far From Site' : 'Confirm Disposal'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisposalModal;
