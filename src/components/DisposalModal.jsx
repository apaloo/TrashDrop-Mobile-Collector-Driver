import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isWithinRadius } from '../utils/locationUtils';
import { logger } from '../utils/logger';
import AssignmentNavigationModal from './AssignmentNavigationModal';

// Component to handle map resize when tab becomes visible
const MapResizer = ({ isVisible }) => {
  const map = useMap();
  
  useEffect(() => {
    if (isVisible && map) {
      // Small delay to ensure container is visible before invalidating size
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }, [isVisible, map]);
  
  return null;
};

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
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'map'
  // NO HARDCODED FALLBACK COORDINATES - use actual GPS only
  const [mapCenter, setMapCenter] = useState(null); // Will be set from GPS or disposal center
  const [userLocation, setUserLocation] = useState(null); // Will be set from actual GPS
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [navigationDestination, setNavigationDestination] = useState(null);
  const [navigationTitle, setNavigationTitle] = useState('');
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
  const [centerTypeFilter, setCenterTypeFilter] = useState('all'); // Filter by center type
  
  // Filter options for center types
  const filterOptions = [
    { key: 'all', label: 'All', icon: '🏢' },
    { key: 'landfill', label: 'Landfill', icon: '🏔️' },
    { key: 'recycling_plant', label: 'Recycling', icon: '♻️' },
    { key: 'center', label: 'Center', icon: '📍' },
    { key: 'container', label: 'Container', icon: '🗑️' },
    { key: 'e_waste', label: 'E-Waste', icon: '💻' },
    { key: 'treatment_plant', label: 'Treatment', icon: '🔬' },
  ];
  
  // Filter disposal centers by type
  const filteredCenters = centerTypeFilter === 'all' 
    ? disposalCenters 
    : disposalCenters.filter(c => c.center_type === centerTypeFilter);
  
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
            const centers = data.map(center => {
              // Parse PostGIS GEOGRAPHY coordinates
              let centerLat = null;
              let centerLng = null;
              
              // Try parsing latitude
              if (typeof center.latitude === 'number') {
                centerLat = center.latitude;
              } else if (typeof center.latitude === 'object') {
                // PostGIS POINT format: {x: lng, y: lat}
                if (center.latitude.x !== undefined && center.latitude.y !== undefined) {
                  centerLng = center.latitude.x;
                  centerLat = center.latitude.y;
                }
                // PostGIS GEOGRAPHY format with coordinates array
                else if (center.latitude.coordinates && Array.isArray(center.latitude.coordinates)) {
                  centerLng = center.latitude.coordinates[0];
                  centerLat = center.latitude.coordinates[1];
                }
              } else if (typeof center.latitude === 'string') {
                const parsed = parseFloat(center.latitude);
                if (!isNaN(parsed)) centerLat = parsed;
              }
              
              // Try parsing longitude (if not already set from latitude object)
              if (centerLng === null) {
                if (typeof center.longitude === 'number') {
                  centerLng = center.longitude;
                } else if (typeof center.longitude === 'object') {
                  if (center.longitude.x !== undefined && center.longitude.y !== undefined) {
                    centerLng = center.longitude.x;
                    centerLat = center.longitude.y;
                  } else if (center.longitude.coordinates && Array.isArray(center.longitude.coordinates)) {
                    centerLng = center.longitude.coordinates[0];
                    centerLat = center.longitude.coordinates[1];
                  }
                } else if (typeof center.longitude === 'string') {
                  const parsed = parseFloat(center.longitude);
                  if (!isNaN(parsed)) centerLng = parsed;
                }
              }
              
              // Skip centers with invalid coordinates
              if (centerLat === null || centerLng === null || isNaN(centerLat) || isNaN(centerLng)) {
                logger.warn('Could not parse disposal center coordinates:', {
                  id: center.id,
                  name: center.name,
                  latType: typeof center.latitude,
                  lngType: typeof center.longitude
                });
                return null;
              }
              
              return {
                id: center.id,
                name: center.name,
                address: center.address,
                coordinates: [centerLat, centerLng],
                openHours: center.operating_hours || '8:00 AM - 6:00 PM',
                rating: center.rating || 4.0,
                waste_type: center.waste_type || '',
                region: center.region || 'Greater Accra',
                district: center.district || '',
                center_type: center.center_type || 'center',
                phone: center.phone || null,
                capacity_notes: center.capacity_notes || '',
                status: center.status || 'active',
                // We'll calculate distance dynamically based on user location
                distance: '...' // Will be calculated when user location is available
              };
            }).filter(center => center !== null); // Remove invalid centers
            
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
            // Set map center from actual GPS if not already set
            if (!mapCenter) {
              setMapCenter([latitude, longitude]);
            }
            
            // Update distances for all disposal centers
            if (disposalCenters.length > 0) {
              try {
                const distanceCalc = await calculateDistance();
                const updatedCenters = disposalCenters.map(center => {
                  // Pass coordinates as arrays: [lat, lng]
                  const distanceMeters = distanceCalc(
                    [latitude, longitude],
                    center.coordinates
                  );
                  // Convert meters to kilometers
                  const distanceKm = distanceMeters / 1000;
                  return {
                    ...center,
                    distance: `${distanceKm.toFixed(1)} km`,
                    distanceValue: distanceKm // Store numeric value for sorting
                  };
                });
                
                // Sort by distance (closest first)
                const sortedCenters = updatedCenters.sort((a, b) => a.distanceValue - b.distanceValue);
                
                setDisposalCenters(sortedCenters);
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
  
  // Handle get directions - Open in-app navigation
  const handleGetDirections = (site, e) => { // Add event parameter
    logger.info('🔹 handleGetDirections called', { site: site?.name, hasEvent: !!e });
    
    if (!site) {
      alert('Please select a dumping site');
      return;
    }
    
    // Prevent default action and event propagation to avoid any link behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
      logger.info('🔹 Event propagation stopped');
    }
    
    logger.info('🔹 Opening in-app navigation to disposal site:', site);
    
    // Set navigation details
    const siteCoordinates = site.coordinates;
    const siteName = site.name;
    
    logger.info('🔹 Navigation details:', { coordinates: siteCoordinates, name: siteName });
    
    try {
      // Set navigation state and open the navigation modal
      setNavigationDestination(siteCoordinates);
      setNavigationTitle(siteName);
      setIsNavigationOpen(true);
      
      logger.info('🔹 Navigation modal state set to open, disposal modal will hide');
      
      // DO NOT call onClose() here - let the component stay mounted but hidden
      // The navigation modal will handle cleanup when it closes
      
    } catch (err) {
      logger.error('❌ Error opening navigation:', err);
      // Show error message
      alert('Error opening navigation. Please try again.');
    }
  };
  
  // Close navigation modal
  const handleCloseNavigation = () => {
    setIsNavigationOpen(false);
    setNavigationDestination(null);
    setNavigationTitle('');
  };
  
  return (
    <>
      {/* Disposal Modal */}
      {!isNavigationOpen && (
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
      
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
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
        
        {/* View Tabs */}
        <div className="px-4 pt-2 border-b border-gray-200 flex-shrink-0">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'list'
                  ? 'bg-white text-green-600 border-b-2 border-green-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'map'
                  ? 'bg-white text-green-600 border-b-2 border-green-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </span>
            </button>
          </div>
        </div>
        
        {/* Filter Buttons */}
        <div className="px-4 pt-2 pb-1 border-b border-gray-100 flex-shrink-0">
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {filterOptions.map(option => (
              <button
                key={option.key}
                onClick={() => setCenterTypeFilter(option.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  centerTypeFilter === option.key
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{option.icon}</span>
                <span>{option.label}</span>
                {option.key !== 'all' && (
                  <span className="text-xs opacity-70">
                    ({disposalCenters.filter(c => c.center_type === option.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Content Area - Stacked views for Leaflet compatibility */}
        <div className="relative" style={{ height: '300px', minHeight: '300px' }}>
          {/* List View */}
          <div 
            className={`absolute inset-0 overflow-y-auto p-4 bg-white ${activeTab === 'list' ? 'z-20' : 'z-0'}`}
          >
          <p className="text-sm text-gray-500 mb-3">
            {filteredCenters.length} sites found • Select a site to dispose waste
          </p>
          
          {/* Dumping Sites List */}
          <div className="space-y-3">
            {filteredCenters.map(site => (
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-800 truncate">{site.name}</h3>
                      {/* Center Type Badge */}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        site.center_type === 'landfill' ? 'bg-amber-100 text-amber-700' :
                        site.center_type === 'recycling_plant' ? 'bg-green-100 text-green-700' :
                        site.center_type === 'e_waste' ? 'bg-purple-100 text-purple-700' :
                        site.center_type === 'treatment_plant' ? 'bg-blue-100 text-blue-700' :
                        site.center_type === 'compost_plant' ? 'bg-lime-100 text-lime-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {site.center_type === 'landfill' ? 'Landfill' :
                         site.center_type === 'recycling_plant' ? 'Recycling' :
                         site.center_type === 'e_waste' ? 'E-Waste' :
                         site.center_type === 'treatment_plant' ? 'Treatment' :
                         site.center_type === 'compost_plant' ? 'Compost' :
                         site.center_type === 'container' ? 'Container' : 'Center'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{site.address}</p>
                    {/* Region & District */}
                    {site.region && (
                      <p className="text-xs text-gray-400">
                        {site.district ? `${site.district}, ` : ''}{site.region}
                      </p>
                    )}
                    <div className="flex items-center mt-1 flex-wrap gap-2">
                      <div className="flex items-center text-amber-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-xs ml-1">{site.rating}</span>
                      </div>
                      <span className="text-xs text-gray-500">{site.openHours}</span>
                      {/* Waste Types */}
                      {site.waste_type && site.waste_type !== 'Not Specified' && (
                        <span className="text-xs text-gray-400 truncate max-w-[120px]" title={site.waste_type}>
                          {site.waste_type.split(',').slice(0, 2).join(', ')}{site.waste_type.split(',').length > 2 ? '...' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end ml-2">
                    <span className="text-sm font-medium text-green-600">{site.distance}</span>
                    {/* Phone indicator */}
                    {site.phone && (
                      <a href={`tel:${site.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-blue-500 hover:underline mt-1">
                        📞 Call
                      </a>
                    )}
                  </div>
                </div>
                
                {selectedSite?.id === site.id && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        // Ensure we prevent default behavior and stop event propagation
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        // Pass the event to handleGetDirections
                        handleGetDirections(site, e);
                        return false;
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
          </div>
        
          {/* Map View - Always rendered for Leaflet, z-index controls visibility */}
          <div 
            className={`absolute inset-0 bg-gray-100 ${activeTab === 'map' ? 'z-20' : 'z-0'}`}
          >
          {/* CSS to disable all links in the map */}
          <style>{`
            .leaflet-container a {
              pointer-events: none !important;
              cursor: default !important;
            }
            .leaflet-control-attribution {
              display: none !important;
            }
          `}</style>
          {mapCenter ? (
          <MapContainer 
            center={mapCenter} 
            zoom={12} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            attributionControl={false} /* Disable attribution control to prevent external links */
          >
            {/* Handle map resize when tab becomes visible */}
            <MapResizer isVisible={activeTab === 'map'} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors' /* Remove hyperlink */
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
            
            {/* User location marker - Tricycle icon for collector (only show if location available) */}
            {userLocation && (
            <Marker 
              position={userLocation}
              icon={new L.DivIcon({
                className: 'custom-tricycle-marker',
                html: `<div style="
                  width: 40px;
                  height: 40px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: #22c55e;
                  border-radius: 50%;
                  border: 3px solid white;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                ">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                </div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                popupAnchor: [0, -20]
              })}
            >
              <Popup>
                <strong>📍 Your Location</strong>
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
            )}
          </MapContainer>
          ) : (
            /* GPS Waiting State - No hardcoded coordinates */
            <div className="h-full flex items-center justify-center bg-gray-100">
              <div className="text-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
                <p className="text-gray-600 font-medium">Acquiring GPS location...</p>
                <p className="text-xs text-gray-500 mt-1">Please enable GPS for accurate map display</p>
              </div>
            </div>
          )}
          
          {/* Selected site info overlay on map */}
          {selectedSite && (
            <div className="absolute bottom-2 left-2 right-2 bg-white rounded-lg shadow-lg p-3 z-[1000]">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-800 truncate">{selectedSite.name}</h4>
                  <p className="text-xs text-gray-500 truncate">{selectedSite.address}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-green-600">{selectedSite.distance}</span>
                    {isWithinRange ? (
                      <span className="text-xs text-green-600">✓ Within 50m</span>
                    ) : (
                      <span className="text-xs text-red-500">✗ Outside 50m</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleGetDirections(selectedSite, e);
                  }}
                  className="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Navigate
                </button>
              </div>
            </div>
          )}
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
      )}
      
      {/* In-App Navigation Modal - Only render when isNavigationOpen is true */}
      {isNavigationOpen && (
        <AssignmentNavigationModal
          isOpen={true}
          onClose={() => {
            handleCloseNavigation();
            // Close the disposal modal as well after navigation modal closes
            onClose();
          }}
          destination={navigationDestination}
          assignmentId={assignment?.id}
          assignmentTitle={navigationTitle}
        />
      )}
    </>
  );
};

export default DisposalModal;
