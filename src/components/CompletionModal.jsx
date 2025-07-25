import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isWithinRadius } from '../utils/locationUtils';
import usePhotoCapture from '../hooks/usePhotoCapture';
import { assignmentService } from '../services/assignmentService';
import { toast } from 'react-toastify';

/**
 * Modal component for completing an assignment
 * Includes photo capture interface, location verification, and submit button
 */
const CompletionModal = ({ 
  assignment, 
  isOpen, 
  onClose, 
  onSubmit 
}) => {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const cameraInputRef = useRef(null);
  const RADIUS_METERS = 50; // 50 meter radius requirement
  
  // Default coordinates from environment variables or fallback to Accra, Ghana
  const defaultLat = import.meta.env.VITE_DEFAULT_LATITUDE 
    ? parseFloat(import.meta.env.VITE_DEFAULT_LATITUDE) 
    : 5.6037;
  const defaultLng = import.meta.env.VITE_DEFAULT_LONGITUDE 
    ? parseFloat(import.meta.env.VITE_DEFAULT_LONGITUDE) 
    : -0.1870;
  
  // Set coordinates from assignment or use defaults
  const coordinates = assignment?.coordinates || [defaultLat, defaultLng];
  const [userCoordinates, setUserCoordinates] = useState(coordinates);
  
  // Photo capture hook
  const {
    photos = [],
    capturePhoto,
    removePhoto,
    clearPhotos,
    error: photoError,
    hasPhotos
  } = usePhotoCapture(assignment?.id);
  
  // Fix Leaflet icon issues with Webpack/Vite
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }, []);

  // Show error toast if photo capture fails
  useEffect(() => {
    if (photoError) {
      toast.error(photoError);
    }
  }, [photoError]);
  
  // Get user's current location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsCheckingLocation(true);

    const options = {
      enableHighAccuracy: false,
      timeout: 15000, // 15 second timeout
      maximumAge: 300000 // 5 minutes
    };

    // Success handler
    const handleSuccess = (position) => {
      const { latitude, longitude } = position.coords;
      setUserCoordinates([latitude, longitude]);
      checkLocationProximity([latitude, longitude]);
      setIsCheckingLocation(false);
    };

    // Error handler
    const handleError = (error) => {
      let errorMessage = 'Error getting location';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location access denied by user';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out';
          break;
      }
      
      toast.error(errorMessage);
      setIsCheckingLocation(false);
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
  };

  // Check if user is within allowed radius of assignment location
  const checkLocationProximity = (userCoords) => {
    const isInRange = isWithinRadius(
      { lat: userCoords[0], lng: userCoords[1] },
      { lat: coordinates[0], lng: coordinates[1] },
      RADIUS_METERS
    );
    
    setIsWithinRange(isInRange);
    setLocationVerified(true);
    
    if (!isInRange) {
      toast.error(`You must be within ${RADIUS_METERS}m of the assignment location`);
    }
  };

  // Verify location button handler
  const verifyLocation = () => {
    getUserLocation();
  };

  // Handle photo capture
  const handlePhotoCapture = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await capturePhoto(e.target.files[0]);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (photos.length < 3) {
      toast.error('Please take at least 3 photos');
      return;
    }
    
    if (!locationVerified || !isWithinRange) {
      toast.error('Please verify your location first');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data, error } = await assignmentService.completeAssignment(
        assignment.id,
        photos,
        { lat: userCoordinates[0], lng: userCoordinates[1] },
        'Assignment completed via mobile app'
      );
      
      if (error) throw new Error(error);
      
      toast.success('Assignment completed successfully!');
      onClose();
      
      if (onSubmit && typeof onSubmit === 'function') {
        onSubmit(data);
      }
    } catch (error) {
      console.error('Error completing assignment:', error);
      toast.error(error.message || 'Failed to complete assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !assignment) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div 
          className="fixed inset-0 transition-opacity" 
          aria-hidden="true" 
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Complete Assignment
              </h3>
              
              {/* Photo Capture Section */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-2">Photo Evidence</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Please take at least 3 photos of the completed assignment. Maximum 6 photos allowed.
                </p>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {/* Photo previews */}
                  {photos.map((photo, index) => (
                    <div key={`photo-${index}`} className="relative aspect-square">
                      <img 
                        src={photo.url || URL.createObjectURL(photo.file)} 
                        alt={`Evidence ${index + 1}`}
                        className="w-full h-full object-cover rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  {/* Add photo button */}
                  {photos.length < 6 && (
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="aspect-square bg-gray-100 rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300 p-4"
                    >
                      <svg 
                        className="w-6 h-6 text-gray-400" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
                        />
                      </svg>
                      <span className="text-xs text-gray-500 mt-1">
                        {photos.length}/6 photos
                      </span>
                      <input
                        type="file"
                        ref={cameraInputRef}
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoCapture}
                        className="hidden"
                        multiple
                      />
                    </button>
                  )}
                </div>
                
                {photoError && (
                  <p className="text-red-500 text-sm mt-1">{photoError}</p>
                )}
                
                <p className="text-xs text-gray-500">
                  {photos.length < 3 
                    ? `Minimum 3 photos required (${3 - photos.length} more needed)`
                    : '3+ photos captured'}
                </p>
              </div>
              
              {/* Location Verification Section */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-2">Location Verification</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Please verify that you are at the assignment location. You must be within {RADIUS_METERS}m of the reported location.
                </p>
                
                <div className="h-48 bg-gray-100 rounded-md mb-2 overflow-hidden">
                  <MapContainer 
                    center={coordinates} 
                    zoom={16} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Marker position={coordinates}>
                      <Popup>Assignment Location</Popup>
                    </Marker>
                    <Marker position={userCoordinates}>
                      <Popup>Your Location</Popup>
                    </Marker>
                    <Circle
                      center={coordinates}
                      radius={RADIUS_METERS}
                      color="blue"
                      fillColor="#3b82f6"
                      fillOpacity={0.2}
                    />
                  </MapContainer>
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center">
                    {isCheckingLocation ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                        <span className="text-sm text-gray-600">Checking location...</span>
                      </div>
                    ) : locationVerified ? (
                      <div className="flex items-center text-green-600">
                        <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">
                          {isWithinRange ? 'Location verified' : 'Too far from assignment location'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-600">Verify your location</span>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={verifyLocation}
                    disabled={isCheckingLocation}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      isCheckingLocation 
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCheckingLocation ? 'Verifying...' : 'Verify Location'}
                  </button>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-1 sm:text-sm"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || photos.length < 3 || !locationVerified || !isWithinRange}
                  className={`mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:mt-0 sm:col-start-2 sm:text-sm ${
                    isSubmitting || photos.length < 3 || !locationVerified || !isWithinRange
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    'Complete Assignment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompletionModal;
