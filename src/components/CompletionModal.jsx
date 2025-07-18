import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isWithinRadius } from '../utils/locationUtils';

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
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const cameraInputRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
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

  // State for map coordinates
  const defaultLat = import.meta.env.VITE_DEFAULT_LATITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LATITUDE) : 5.6037;
  const defaultLng = import.meta.env.VITE_DEFAULT_LONGITUDE ? parseFloat(import.meta.env.VITE_DEFAULT_LONGITUDE) : -0.1870;
  const [coordinates, setCoordinates] = useState([defaultLat, defaultLng]); // Default coordinates from env vars
  const [userCoordinates, setUserCoordinates] = useState([defaultLat, defaultLng]); // Default user coordinates
  
  // Load existing photos from assignment if available
  useEffect(() => {
    if (isOpen && !imagesLoaded && assignment) {
      // In production, we would fetch photos from Supabase
      // based on the assignment_id using the assignment_photos table
      const fetchAssignmentPhotos = async () => {
        try {
          // This would be a real Supabase query in production
          // const { data, error } = await supabase
          //   .from('assignment_photos')
          //   .select('*')
          //   .eq('assignment_id', assignment.id);
          
          // For now, we'll initialize with an empty array
          // as we expect users to take new photos
          setPhotos([]);
          setImagesLoaded(true);
        } catch (error) {
          console.error('Error fetching assignment photos:', error);
          setPhotos([]);
          setImagesLoaded(true);
        }
      };
      
      fetchAssignmentPhotos();
    }
  }, [isOpen, imagesLoaded, assignment]);
  
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
  
  // Get user's current location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      setIsCheckingLocation(true);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserCoordinates([latitude, longitude]);
          checkLocationProximity([latitude, longitude]);
          setIsCheckingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to default location from environment variables
          setUserCoordinates([defaultLat, defaultLng]);
          setIsCheckingLocation(false);
          setLocationVerified(false);
          setIsWithinRange(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
      setIsCheckingLocation(false);
      setLocationVerified(false);
      setIsWithinRange(false);
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
  
  if (!isOpen || !assignment) return null;
  
  // Handle photo capture from camera
  const handlePhotoCapture = (e) => {
    const files = Array.from(e.target.files);
    
    // Check if adding these files would exceed the maximum (6)
    if (photos.length + files.length > 6) {
      alert('Maximum 6 photos allowed');
      return;
    }
    
    // Create URL objects for preview
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    
    setPhotos([...photos, ...newPhotos]);
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
            
            // Convert canvas to blob
            canvas.toBlob(blob => {
              // Create a file from the blob
              const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
              
              // Create a new photo object
              const newPhoto = {
                file,
                preview: URL.createObjectURL(blob)
              };
              
              // Add to photos state
              setPhotos(prev => [...prev, newPhoto]);
              
              // Clean up
              stopStreamAndRemoveModal(stream, videoModal);
            }, 'image/jpeg', 0.8);
          });
          
          // Handle cancel button click
          cancelButton.addEventListener('click', () => {
            stopStreamAndRemoveModal(stream, videoModal);
          });
          
        })
        .catch(err => {
          console.error('Error accessing camera:', err);
          alert('Could not access camera. Please ensure camera permissions are granted.');
          
          // Fallback to file input as last resort
          if (cameraInputRef.current) {
            cameraInputRef.current.click();
          }
        });
    } else {
      // Fallback for browsers that don't support MediaDevices API
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };
  
  // Helper function to stop stream and remove video modal
  const stopStreamAndRemoveModal = (stream, modal) => {
    // Stop all video tracks
    stream.getTracks().forEach(track => track.stop());
    
    // Remove the modal from DOM
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  };
  
  // Remove a photo
  const removePhoto = (index) => {
    const newPhotos = [...photos];
    
    // Only revoke URL if it's not a sample photo
    if (!newPhotos[index].isSample) {
      // Revoke the object URL to avoid memory leaks
      URL.revokeObjectURL(newPhotos[index].preview);
    }
    
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (photos.length < 3) {
      alert('Please upload at least 3 photos');
      return;
    }
    
    if (!locationVerified) {
      alert('Location must be verified');
      return;
    }
    
    setIsSubmitting(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      // Clean up object URLs to avoid memory leaks (only for non-sample photos)
      photos.forEach(photo => {
        if (!photo.isSample && photo.preview) {
          URL.revokeObjectURL(photo.preview);
        }
      });
      
      onSubmit(assignment.id, photos);
      setIsSubmitting(false);
      onClose();
    }, 1500);
  };
  
  // Verify location using real geolocation
  const verifyLocation = () => {
    setIsCheckingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserCoordinates([latitude, longitude]);
          
          // Check if user is within range
          const withinRange = isWithinRadius([latitude, longitude], coordinates, RADIUS_METERS);
          setIsWithinRange(withinRange);
          setLocationVerified(withinRange);
          setIsCheckingLocation(false);
          
          // Show location restriction modal if not within range
          if (!withinRange) {
            setShowLocationModal(true);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsCheckingLocation(false);
          setLocationVerified(false);
          setIsWithinRange(false);
          alert('Unable to get your location. Please check your device settings and try again.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
      setIsCheckingLocation(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4 overflow-hidden">
      {/* Location Restriction Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 text-center">
            <div className="mb-4 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Location Restriction</h3>
            <p className="text-gray-600 mb-6">
              You must be within 50 meters of the assignment location to complete this task.
              Please move closer to the location and try again.
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setShowLocationModal(false)}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                OK, I Understand
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col relative my-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Complete Assignment</h2>
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
        <div className="overflow-y-auto p-4 flex-1 pb-16">
          <div>
            {/* Photo Upload Section */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-700 mb-2">Capture Photos *</h3>
              <p className="text-sm text-gray-500 mb-4">
                Please take at least 3 photos (maximum 6) showing the completed assignment.
              </p>
              
              {/* Photo Grid */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-square bg-gray-100 rounded-md overflow-hidden">
                    <img 
                      src={photo.preview} 
                      alt={`Photo ${index + 1}`} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback if image fails to load
                        e.target.onerror = null;
                        e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wD///yH5BAEAAAEALAAAAAABAAEAAAICTAEAOw==';
                      }}
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                
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
