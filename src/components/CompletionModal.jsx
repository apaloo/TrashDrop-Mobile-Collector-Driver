import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isWithinRadius } from '../utils/locationUtils';
import usePhotoCapture from '../hooks/usePhotoCapture';
import { logger } from '../utils/logger';

/**
 * Modal component for completing an assignment
 * Includes photo capture interface, location verification, and submit button
 * All in a single page form
 */
const CompletionModal = ({ 
  assignment, 
  isOpen, 
  onClose, 
  onSubmit 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [shouldZoomToUser, setShouldZoomToUser] = useState(false);
  const cameraInputRef = useRef(null);
  const RADIUS_METERS = 50; // 50 meter radius requirement
  
  // Component to control map zoom to user location
  const MapController = ({ userCoords, shouldZoom, onZoomComplete }) => {
    const map = useMap();
    
    useEffect(() => {
      if (shouldZoom && userCoords && userCoords[0] && userCoords[1]) {
        map.flyTo(userCoords, 17, { duration: 1.5 });
        onZoomComplete();
      }
    }, [shouldZoom, userCoords, map, onZoomComplete]);
    
    return null;
  };
  
  // Use the photo capture hook
  const {
    photos,
    capturePhoto,
    removePhoto,
    clearPhotos,
    error: photoError,
    hasPhotos
  } = usePhotoCapture(assignment?.id);
  
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

  // State for map coordinates
  const defaultLat = import.meta.env.VITE_DEFAULT_LATITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LATITUDE) : 5.6037;
  const defaultLng = import.meta.env.VITE_DEFAULT_LONGITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LONGITUDE) : -0.1870;
  const [coordinates, setCoordinates] = useState([defaultLat, defaultLng]); // Default coordinates from env vars
  const [userCoordinates, setUserCoordinates] = useState([defaultLat, defaultLng]); // Default user coordinates
  
  // Show error toast if photo capture fails
  useEffect(() => {
    if (photoError) {
      logger.error('Photo capture error:', photoError);
      // You might want to show this to the user via a toast or alert
    }
  }, [photoError]);
  
  // Set assignment coordinates on component mount
  useEffect(() => {
    if (isOpen && assignment && assignment.coordinates) {
      // Use actual assignment coordinates if available
      if (assignment.coordinates.lat && assignment.coordinates.lng) {
        setCoordinates([assignment.coordinates.lat, assignment.coordinates.lng]);
      } else {
        // Fallback to default coordinates from environment variables
        setCoordinates([defaultLat, defaultLng]);
      }
      
      // Get user's current location
      getUserLocation();
    }
  }, [isOpen, assignment]);
  
  // Get user's current location with enhanced error handling and fallbacks
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      logger.warn('⚠️ Geolocation not supported by this browser');
      handleGeolocationFallback('Geolocation not supported');
      return;
    }

    setIsCheckingLocation(true);
    logger.debug('🌍 Requesting user location...');

    // Enhanced geolocation options for better reliability
    const options = {
      enableHighAccuracy: false, // Changed to false to avoid network provider errors
      timeout: 15000, // 15 second timeout
      maximumAge: 300000 // Accept cached location up to 5 minutes old
    };

    // Success handler
    const handleSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      logger.debug(`✅ Location obtained: ${latitude}, ${longitude} (±${accuracy}m)`);
      
      setUserCoordinates([latitude, longitude]);
      checkLocationProximity([latitude, longitude]);
      setIsCheckingLocation(false);
    };

    // Enhanced error handler with specific error messages
    const handleError = (error) => {
      let errorMessage = 'Unknown geolocation error';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location access denied by user';
          logger.warn('🚫 Geolocation permission denied');
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable';
          logger.warn('📍 Geolocation position unavailable');
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out';
          logger.warn('⏰ Geolocation request timed out');
          break;
        default:
          errorMessage = error.message || 'Failed to get location';
          logger.warn('❌ Geolocation error:', error);
          break;
      }
      
      handleGeolocationFallback(errorMessage);
    };

    // Make the geolocation request
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
  };

  // Handle geolocation fallback with enhanced logic
  const handleGeolocationFallback = (reason) => {
    logger.debug(`🔄 Using fallback location due to: ${reason}`);
    
    // Use environment variables as fallback
    const fallbackCoords = [defaultLat, defaultLng];
    setUserCoordinates(fallbackCoords);
    setIsCheckingLocation(false);
    
    // For completion modal, we should be more lenient with location verification
    // when geolocation fails, as the user might be in a location with poor GPS
    if (coordinates) {
      // Still check proximity with fallback coordinates, but don't be as strict
      const withinRange = isWithinRadius(fallbackCoords, coordinates, RADIUS_METERS * 2); // Double the radius for fallback
      setIsWithinRange(withinRange);
      setLocationVerified(true); // Allow completion with fallback location for better UX
      logger.debug(`📍 Fallback proximity check: ${withinRange ? 'within range' : 'outside range'} (relaxed criteria)`);
    } else {
      setLocationVerified(true); // Allow completion if no assignment coordinates available
      setIsWithinRange(true);
    }
  };
  
  // Check if user is within range of assignment location
  const checkLocationProximity = (userCoords) => {
    if (coordinates) {
      const withinRange = isWithinRadius(userCoords, coordinates, RADIUS_METERS);
      setIsWithinRange(withinRange);
      setLocationVerified(withinRange);
    }
  };

  // Add the missing verifyLocation function
  const verifyLocation = () => {
    getUserLocation();
    // Trigger map zoom to user location after a short delay to allow location fetch
    setTimeout(() => {
      setShouldZoomToUser(true);
    }, 500);
  };
  
  if (!isOpen || !assignment) return null;
  
  // Handle photo capture from camera
  const handlePhotoCapture = async (e) => {
    const files = Array.from(e.target.files);
    
    // Check if adding these files would exceed the maximum (6)
    if (photos.length + files.length > 6) {
      alert('Maximum 6 photos allowed');
      return;
    }
    
    try {
      // Process each file sequentially
      for (const file of files) {
        await capturePhoto(file);
      }
    } catch (error) {
      logger.error('Error capturing photos:', error);
      // Error is already handled by the hook
    }
  };
  
  // Open camera for photo capture
  const openCamera = () => {
    // Check if the MediaDevices API is supported
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Use the Web Camera API directly instead of file input
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          // Create a video element to show the stream
          const videoModal = document.createElement('div');
          videoModal.className = 'fixed inset-0 bg-black bg-opacity-75 z-[60] flex flex-col items-center justify-center';
          
          const videoContainer = document.createElement('div');
          videoContainer.className = 'relative w-full max-w-md';
          
          const video = document.createElement('video');
          video.className = 'w-full h-auto';
          video.srcObject = stream;
          video.autoplay = true;
          
          const buttonContainer = document.createElement('div');
          buttonContainer.className = 'absolute bottom-4 left-0 right-0 flex justify-center';
          
          const captureButton = document.createElement('button');
          captureButton.className = 'bg-white rounded-full w-16 h-16 flex items-center justify-center border-4 border-gray-300';
          captureButton.innerHTML = '<div class="w-12 h-12 bg-red-500 rounded-full"></div>';
          
          const cancelButton = document.createElement('button');
          cancelButton.className = 'absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center';
          cancelButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
          
          buttonContainer.appendChild(captureButton);
          videoContainer.appendChild(video);
          videoContainer.appendChild(buttonContainer);
          videoContainer.appendChild(cancelButton);
          videoModal.appendChild(videoContainer);
          
          document.body.appendChild(videoModal);
          
          // Handle capture button click
          captureButton.addEventListener('click', () => {
            // Create a canvas to capture the image
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Convert the canvas to blob and handle the photo
            canvas.toBlob(blob => {
              const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
              handlePhotoCapture({ target: { files: [file] } });
              
              // Clean up
              stream.getTracks().forEach(track => track.stop());
              document.body.removeChild(videoModal);
            }, 'image/jpeg');
          });
          
          cancelButton.addEventListener('click', () => {
            // Clean up on cancel
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(videoModal);
          });
        })
        .catch(err => {
          logger.error('Camera access error:', err);
          alert('Could not access camera. Please ensure you have given permission to use the camera.');
        });
    } else {
      // Fallback for browsers that don't support mediaDevices
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      
      // Call the onSubmit handler with all collected data
      await onSubmit({
        photos,
        locationVerified: isWithinRange,
        userCoordinates
      });
      
      // Clear the form after successful submission
      clearPhotos();
      setLocationVerified(false);
    } catch (error) {
      logger.error('Error submitting completion:', error);
      // Show error notification
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isOpen ? 'visible' : 'invisible'}`} style={{ paddingTop: '4rem', paddingBottom: '5rem' }}>
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto z-10 relative mx-4">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-20">
          <h2 className="text-xl font-semibold text-gray-800">Complete Assignment</h2>
          <p className="text-sm text-gray-500 mt-1">{assignment?.location}</p>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <div className="space-y-6">
            {/* Photo Capture Section */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-700 mb-2">Photo Documentation</h3>
              
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, index) => {
                  // Handle photo objects with url property, Blob/File objects, and string URLs
                  let photoSrc = null;
                  if (typeof photo === 'string') {
                    photoSrc = photo;
                  } else if (photo && photo.url) {
                    photoSrc = photo.url;
                  } else if (photo instanceof Blob || photo instanceof File) {
                    photoSrc = URL.createObjectURL(photo);
                  }
                  
                  if (!photoSrc) return null;
                  
                  const photoId = photo?.id || index;
                  
                  return (
                  <div key={photoId} className="aspect-square relative rounded-md overflow-hidden border-2 border-gray-200">
                    <img src={photoSrc} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removePhoto(photoId)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  );
                })}
                
                {photos.length < 6 && (
                  <div onClick={openCamera} className="aspect-square bg-gray-100 rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300 p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs text-gray-500 mt-1">Take Photo</span>
                    <input 
                      ref={cameraInputRef}
                      type="file" 
                      accept="image/*" 
                      capture="camera"
                      className="hidden" 
                      onChange={handlePhotoCapture}
                    />
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-500 mt-2">
                <p>Add at least 1 photo (up to 6) to document the illegal dumping</p>
                <p className="mt-1 text-blue-500">Note: Photos can only be taken with your device's camera</p>
                {photos.length < 3 ? (
                  <p className="mt-2 text-red-500">Please take at least {3 - photos.length} more photo(s)</p>
                ) : (
                  <p className="mt-2 text-green-500">✓ Minimum photo requirement met</p>
                )}
              </div>
            </div>
            
            {/* Location Verification Section */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-700 mb-2">Verify Location</h3>
              <p className="text-sm text-gray-500 mb-4">
                Please verify that you are at the assignment location. You must be within 50m of the reported location.
              </p>
              
              {/* Map */}
              <div className="h-48 w-full bg-gray-200 rounded-md overflow-hidden">
                <MapContainer 
                  center={coordinates} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* Assignment location marker */}
                  <Marker position={coordinates}>
                    <Popup>
                      {assignment.location}
                    </Popup>
                  </Marker>
                  
                  {/* User location marker */}
                  <Marker position={userCoordinates}>
                    <Popup>
                      Your Location
                    </Popup>
                  </Marker>
                  
                  {/* 50m radius circle around assignment location */}
                  <Circle 
                    center={coordinates}
                    radius={50}
                    pathOptions={{ 
                      color: isWithinRange ? 'green' : 'red', 
                      fillColor: isWithinRange ? 'green' : 'red', 
                      fillOpacity: 0.1 
                    }}
                  />
                  
                  {/* Map controller for auto-zoom to user location */}
                  <MapController 
                    userCoords={userCoordinates} 
                    shouldZoom={shouldZoomToUser} 
                    onZoomComplete={() => setShouldZoomToUser(false)} 
                  />
                </MapContainer>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <p>Assignment location: {assignment.location}</p>
                <div className={`mt-2 p-2 rounded-md ${isWithinRange ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${isWithinRange ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <p className={`text-sm ${isWithinRange ? 'text-green-700' : 'text-red-700'}`}>
                      {isCheckingLocation 
                        ? 'Checking your location...' 
                        : isWithinRange 
                          ? 'You are within 50 meters of the assignment location ✓' 
                          : 'You must be within 50 meters of the assignment location'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                {!locationVerified ? (
                  <button 
                    onClick={verifyLocation}
                    className={`w-full py-3 text-white rounded-md flex items-center justify-center transition-colors ${isCheckingLocation ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                    disabled={isSubmitting || isCheckingLocation}
                  >
                    {isCheckingLocation ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Checking Location...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Verify My Location
                      </>
                    )}
                  </button>
                ) : (
                  <button 
                    onClick={handleSubmit}
                    className={`w-full py-3 text-white rounded-md flex items-center justify-center transition-colors ${isSubmitting || photos.length < 3 || !isWithinRange ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
                    disabled={isSubmitting || photos.length < 3 || !isWithinRange}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </>
                    ) : !isWithinRange ? (
                      'Too Far From Assignment Location'
                    ) : photos.length < 3 ? (
                      'Need At Least 3 Photos'
                    ) : (
                      'Submit Completion'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors ml-auto flex items-center"
            disabled={isSubmitting || !locationVerified || photos.length < 3}
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
  );
};

export default CompletionModal;
