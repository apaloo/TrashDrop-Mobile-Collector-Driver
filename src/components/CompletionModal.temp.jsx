import React, { useState, useRef, useEffect } from 'react';

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
  const cameraInputRef = useRef(null);
  
  // Verify location on component mount and initialize map
  useEffect(() => {
    if (isOpen && assignment) {
      verifyLocation();
      
      // Initialize map with a small delay to ensure the container is rendered
      setTimeout(() => {
        const mapContainer = document.getElementById('completion-map');
        if (mapContainer) {
          // In a real app, this would use a mapping library like Google Maps or Leaflet
          // For now, we'll add a simple placeholder with styling to make it look more like a map
          mapContainer.innerHTML = '';
          
          // Create a styled map placeholder
          const mapElement = document.createElement('div');
          mapElement.className = 'w-full h-full relative';
          mapElement.style.background = '#e5e7eb';
          
          // Add some map-like elements
          mapElement.innerHTML = `
            <div class="absolute inset-0" style="background: repeating-linear-gradient(45deg, #e5e7eb, #e5e7eb 10px, #d1d5db 10px, #d1d5db 20px)"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-center">
                <div class="w-8 h-8 bg-blue-500 rounded-full border-4 border-white shadow-lg mx-auto mb-2 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <div class="bg-white px-3 py-1 rounded-full shadow-md text-sm font-medium">Your Location</div>
              </div>
            </div>
            <div class="absolute bottom-2 right-2 bg-white px-2 py-1 rounded-md shadow-md text-xs">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-blue-500 rounded-full mr-1"></div>
                <span>You</span>
              </div>
              <div class="flex items-center mt-1">
                <div class="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
                <span>Assignment</span>
              </div>
            </div>
            <div class="absolute bottom-2 left-2 bg-white px-2 py-1 rounded-md shadow-md text-xs">
              <span>${locationVerified ? 'Within 50m radius ✓' : 'Verifying location...'}</span>
            </div>
          `;
          
          // Add the assignment location marker if we have verified location
          if (locationVerified) {
            const assignmentMarker = document.createElement('div');
            assignmentMarker.className = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -ml-12 -mt-8';
            assignmentMarker.innerHTML = `
              <div class="w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
              <div class="bg-white px-3 py-1 rounded-full shadow-md text-sm font-medium mt-1">${assignment.location}</div>
            `;
            mapElement.appendChild(assignmentMarker);
          }
          
          mapContainer.appendChild(mapElement);
        }
      }, 100);
    }
  }, [isOpen, assignment, locationVerified]);
  
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
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };
  
  // Remove a photo
  const removePhoto = (index) => {
    const newPhotos = [...photos];
    
    // Revoke the object URL to avoid memory leaks
    URL.revokeObjectURL(newPhotos[index].preview);
    
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
      // Clean up object URLs to avoid memory leaks
      photos.forEach(photo => URL.revokeObjectURL(photo.preview));
      
      onSubmit(assignment.id, photos);
      setIsSubmitting(false);
      onClose();
    }, 1500);
  };
  
  // Verify location (simulated)
  const verifyLocation = () => {
    // In a real app, this would use geolocation API to verify user is within 50m radius
    // For now, we'll simulate this with a timeout
    setLocationVerified(false);
    
    setTimeout(() => {
      setLocationVerified(true);
    }, 1500);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
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
        <div className="overflow-y-auto p-4 max-h-[calc(90vh-16rem)]">
          <div>
            {/* Photo Upload Section */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-700 mb-2">Upload Photos</h3>
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
                  <div onClick={openCamera} className="aspect-square bg-gray-100 rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs text-gray-500 mt-1">Take Photo</span>
                    <input 
                      ref={cameraInputRef}
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      onChange={handlePhotoCapture}
                    />
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-500">
                {photos.length < 3 ? (
                  <span className="text-red-500">Please take at least {3 - photos.length} more photo(s)</span>
                ) : (
                  <span className="text-green-500">✓ Minimum photo requirement met</span>
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
              <div id="completion-map" className="h-48 w-full bg-gray-200 rounded-md overflow-hidden">
                {/* Map will be loaded here by useEffect */}
                <div className="h-full w-full flex items-center justify-center">
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="mt-2 text-gray-500">Loading map...</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <p>Assignment location: {assignment.location}</p>
                <p className="text-xs text-gray-500 mt-1">{locationVerified ? 'Location verified ✓' : 'Verifying your location...'}</p>
              </div>
              
              <div className="mt-4">
                {!locationVerified ? (
                  <button 
                    onClick={verifyLocation}
                    className="w-full py-3 bg-blue-500 text-white rounded-md flex items-center justify-center hover:bg-blue-600 transition-colors"
                    disabled={isSubmitting}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Verifying Location...
                  </button>
                ) : (
                  <div className="p-3 bg-green-100 text-green-700 rounded-md flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Location Verified
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
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
