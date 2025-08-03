import { useState, useEffect, useRef, useCallback } from 'react';
import GoogleMapModalComponent from './GoogleMapModalComponent';
import { getCurrentLocation, isWithinRadius, calculateDistance } from '../utils/geoUtils';
import Toast from './Toast';
import { debounce } from 'lodash';
import { DEV_MODE } from '../services/supabase';
import './navigation-modal.css'; // Custom CSS for better readability
import QRCodeScanner from './QRCodeScanner'; // Import our existing QR scanner component
import ErrorBoundary from './ErrorBoundary'; // Import error boundary

// QR Scan Rate Limiting
const QR_SCAN_RATE_LIMIT = 10; // per minute
const LOCATION_RETRY_MAX_ATTEMPTS = 3;
const CAMERA_INIT_TIMEOUT = 2000;
const GEOFENCE_RADIUS = 50; // 50 meters radius for geofence

const NavigationQRModal = ({
  isOpen,
  onClose,
  destination,
  requestId,
  onQRScanned,
  expectedQRValue
}) => {
  const [mode, setMode] = useState('navigation'); // 'navigation' or 'qr'
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [isCameraPreloading, setIsCameraPreloading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [scannedItems, setScannedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [scanStartTime, setScanStartTime] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const mapRef = useRef(null);
  const routingControlRef = useRef(null);
  const qrScanner = useRef(null);
  const mapContainerKey = useRef(`map-${Date.now()}`).current; // Unique key for map container to prevent reuse

  // Rate limiting for QR scans
  const qrScanAttempts = useRef([]);
  const watchId = useRef(null);
  const cameraInitTimer = useRef(null);
  const toastTimeout = useRef(null);

  // Toast management
  const showToast = useCallback(({ message, type = 'info' }) => {
    // Clear any existing toast timeout
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    setError({ message, type });

    // Auto-hide toast after 3 seconds
    toastTimeout.current = setTimeout(() => {
      setError(null);
      toastTimeout.current = null;
    }, 3000);
  }, []);

  // Rate limiting check for QR scans
  const isQRScanRateLimited = () => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    // Clean up old attempts
    qrScanAttempts.current = qrScanAttempts.current.filter(time => time > oneMinuteAgo);
    // Check if we've exceeded the rate limit
    if (qrScanAttempts.current.length >= QR_SCAN_RATE_LIMIT) {
      showToast({
        message: 'Please wait before scanning more codes',
        type: 'warning'
      });
      return true;
    }
    return false;
  };

  // QR Scan handlers
  // Handle back to navigation mode
  const handleBackToNavigation = useCallback(async () => {
    // First set loading state to prevent any new scans
    setIsLoading(true);
    
    try {
      // Clear any existing errors
      setError(null);
      
      // Switch mode back to navigation
      setMode('navigation');
      console.log('✅ Switched back to navigation mode');
      
      // Small delay to ensure clean transition
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      console.error('❌ Error switching back to navigation:', err);
      setError({
        type: 'error',
        message: 'Error switching modes. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleQRScanSuccess = useCallback((decodedText) => {
    // Handle scan success with rate limiting
    if (isQRScanRateLimited()) {
      return;
    }
    
    // Add to scan attempts for rate limiting
    qrScanAttempts.current.push(Date.now());
    
    // Process the scanned code
    const scanStartTime = Date.now();
    console.log(`⚡ QR scan processed in ${Date.now() - scanStartTime}ms`, decodedText);
    
    // Validate scanned QR code
    if (expectedQRValue && decodedText !== expectedQRValue) {
      showToast({
        message: 'Invalid QR code. Please scan the correct code.',
        type: 'error'
      });
      return;
    }
    
    // Add to scanned items
    const newItem = { code: decodedText, timestamp: Date.now() };
    setScannedItems(prev => [...prev, newItem]);
    
    // Show success toast
    showToast({
      message: 'QR code scanned successfully!',
      type: 'success'
    });
    
    // Optional: Auto-complete if expectedQRValue matches
    if (expectedQRValue && decodedText === expectedQRValue) {
      onQRScanned([decodedText]);
      setTimeout(() => onClose(), 1500);
    }
  }, [expectedQRValue, onQRScanned, onClose]);
  
  const handleQRScanError = useCallback((error) => {
    console.error('QR scan error:', error);
    showToast({
      message: `QR scan error: ${error.message || error}`,
      type: 'error'
    });
  }, []);

  // Handle map instance ready
  const setMapInstance = useCallback((map) => {
    if (map) {
      mapRef.current = map;
    }
  }, []);

  // Handle starting navigation
  const handleStartNavigation = useCallback(async () => {
    setNavigationStarted(true);
    
    // Show toast notification
    setError({
      type: 'success',
      message: 'Navigation started. Follow the route to the pickup location.'
    });
    
    if (!isWithinGeofence) {
      setError({
        type: 'error',
        message: 'You must be within 50 meters of the pickup location to scan QR codes.'
      });
      return;
    }
    
    // Preload camera
    setIsCameraPreloading(true);
    
    // Set a timeout for camera initialization
    if (cameraInitTimer.current) {
      clearTimeout(cameraInitTimer.current);
    }
    cameraInitTimer.current = setTimeout(() => {
      setIsCameraPreloading(false);
      cameraInitTimer.current = null;
    }, CAMERA_INIT_TIMEOUT);
    
    try {
      // Request camera permission before switching to QR mode
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Release camera immediately
      setHasCameraPermission(true);
      setMode('qr');
      setError(null);
    } catch (err) {
      console.error('Camera permission error:', err);
      setError({ type: 'error', message: 'Camera access denied. Please grant camera permissions.' });
      setHasCameraPermission(false);
    } finally {
      setIsCameraPreloading(false);
    }
    
    // Add a slight delay for animation
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, []);

  // Handle switching to QR mode when already within geofence
  const handleSwitchToQR = useCallback(async () => {
    // If not within geofence, show error
    if (!isWithinGeofence) {
      setError({
        type: 'error',
        message: 'You must be within 50 meters of the pickup location to scan QR codes.'
      });
      return;
    }
    
    // Preload camera
    setIsCameraPreloading(true);
    
    try {
      // Request camera permission first
      console.log('🎥 Requesting camera permission for QR scanning...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Release immediately after permission check
      
      // Permission granted - switch to QR mode
      setHasCameraPermission(true);
      setMode('qr');
      setError(null);
      console.log('✅ Successfully switched to QR scanning mode');
      
    } catch (err) {
      console.error('❌ Camera permission error:', err);
      setError({ 
        type: 'error', 
        message: 'Camera access denied. Please grant camera permissions to scan QR codes.' 
      });
      setHasCameraPermission(false);
    } finally {
      setIsCameraPreloading(false);
    }
  }, [isWithinGeofence]);

  // Retry mechanism for location updates
  const retryLocationUpdate = useCallback(async (maxRetries = LOCATION_RETRY_MAX_ATTEMPTS) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setLocationRetryCount(attempt);
        
        // Get location from geoUtils utility
        const locationResult = await getCurrentLocation();
        
        // Handle both direct position objects and the structured result from geoUtils
        let coords;
        
        if (locationResult.coords) {
          // Standard Geolocation API response
          coords = [locationResult.coords.latitude, locationResult.coords.longitude];
        } else if (locationResult.lat !== undefined && locationResult.lng !== undefined) {
          // Our geoUtils response format
          coords = [locationResult.lat, locationResult.lng];
          
          // If using fallback location in dev mode, show warning instead of error
          if (locationResult.isFallback && DEV_MODE) {
            console.warn('Using fallback location (Accra, Ghana) - DEV_MODE enabled');
          } else if (locationResult.isFallback) {
            setError('Using approximate location. Enable location services for accurate navigation.');
          }
        } else {
          throw new Error('Invalid location data format');
        }
        
        setUserLocation(coords);
        
        // Validate destination before calculations
        if (!destination || !Array.isArray(destination) || destination.length !== 2) {
          throw new Error('Invalid destination coordinates');
        }
        
        // Calculate distance and check geofence
        const distance = calculateDistance({ lat: coords[0], lng: coords[1] }, { lat: destination[0], lng: destination[1] });
        const within50m = distance <= 0.05; // 50 meters = 0.05 km
        
        // Force within geofence if in dev mode
        const isWithin = DEV_MODE ? true : within50m;
        
        setDistanceToDestination(distance);
        setIsWithinGeofence(isWithin);
        
        // Only clear error if we have a non-fallback location
        if (!locationResult.isFallback) {
          setError(null);
        }
        
        setLocationRetryCount(0);
        return coords;
        
      } catch (err) {
        console.error(`Location attempt ${attempt} failed:`, err);
        
        if (attempt === maxRetries) {
          // More user-friendly error message
          setError({
            type: 'error',
            message: 'Unable to get your location. Please check your GPS settings.'
          });
          
          if (DEV_MODE) {
            // In dev mode, return a default location
            const defaultCoords = [5.6037, -0.1870]; // Accra
            console.warn('Using default location in DEV_MODE:', defaultCoords);
            return defaultCoords;
          } else {
            throw err;
          }
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }, [destination, DEV_MODE]);

  // Location tracking with debounce and retry logic
  const updateLocation = useCallback(
    debounce(async () => {
      if (!isOpen || mode !== 'navigation') return;
      setIsLoading(true);

      try {
        const coords = await retryLocationUpdate();
        if (!coords) return;

        setUserLocation(coords);
        
        // Update distance and geofence status if we have both points
        if (destination) {
          const distance = calculateDistance(
            { lat: coords[0], lng: coords[1] },
            { lat: destination[0], lng: destination[1] }
          );
          setDistanceToDestination(distance);
          setIsWithinGeofence(distance <= 0.05); // 50m = 0.05km
        }
      } catch (err) {
        console.error('Error updating location:', err);
        setError({
          type: 'error',
          message: 'Could not update your location. Please check your GPS settings.'
        });
      } finally {
        setIsLoading(false);
      }
    }, 1000),
    [destination, isOpen, mode, retryLocationUpdate]
  );

// Track scanned items
const addScannedItem = useCallback(
  (code) => {
    // Validate code format or structure here if needed
    if (!code) return false;
    
    const newItem = {
      id: Date.now(),
      code: code,
      timestamp: new Date().toISOString()
    };
    
    setScannedItems(prev => [...prev, newItem]);
    return true;
  },
  []
);



// Request camera permission with timeout and enhanced error handling
const requestCameraPermission = useCallback(async () => {
  try {
      // Check if browser supports mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('BROWSER_NOT_SUPPORTED');
      }
      
      // Set timeout for camera initialization
      const timeoutPromise = new Promise((_, reject) => {
        cameraInitTimer.current = setTimeout(() => {
          reject(new Error('CAMERA_TIMEOUT'));
        }, CAMERA_INIT_TIMEOUT);
      });
      
      // Try to access camera with optimal settings for QR scanning
      const permissionPromise = navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: { ideal: 'continuous' },
          frameRate: { ideal: 30 }
        } 
      });
      
      const stream = await Promise.race([permissionPromise, timeoutPromise]);
      
      // Clean up timeout
      if (cameraInitTimer.current) {
        clearTimeout(cameraInitTimer.current);
        cameraInitTimer.current = null;
      }
      
      // Release camera immediately after permission check
      stream.getTracks().forEach(track => track.stop());
      setHasCameraPermission(true);
      
    } catch (err) {
      console.error('Camera permission error:', err);
      setHasCameraPermission(false);
      
      // Enhanced error messages with specific guidance
      switch(err.name || err.message) {
        case 'BROWSER_NOT_SUPPORTED':
          setError({ type: 'error', message: 'Your browser does not support camera access. Please try using Chrome, Firefox, or Safari.' });
          break;
        case 'CAMERA_TIMEOUT':
          setError({ type: 'error', message: 'Camera initialization timed out. Please ensure no other apps are using your camera and try again.' });
          break;
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          setError({
            type: 'error',
            message: 'Camera access denied. To scan QR codes:\n' +
            '1. Click the camera icon in your address bar\n' +
            '2. Select "Allow" for camera access\n' +
            '3. Refresh the page'
          });
          break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          setError({ type: 'error', message: 'No camera detected. Please ensure your device has a working camera and try again.' });
          break;
        case 'NotReadableError':
        case 'TrackStartError':
          setError({ type: 'error', message: 'Cannot access camera. Please close other apps that might be using your camera.' });
          break;
        case 'OverconstrainedError':
          setError({ type: 'error', message: 'Your camera does not support the required features. Try using your device\'s main camera.' });
          break;
        default:
          setError({ type: 'error', message: 'Camera access failed. Please check your device settings and permissions.' });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize map and location tracking
  useEffect(() => {
    if (!isOpen || mode !== 'navigation') return;

    let locationInterval;
    let consecutiveFallbackUpdates = 0;
    
    const updateLocation = async () => {
      // Only log location updates occasionally to reduce console spam
      if (consecutiveFallbackUpdates < 3 || consecutiveFallbackUpdates % 5 === 0) {
        console.log('Updating location...');
      }
      try {
        const position = await getCurrentLocation();
        
        // Only log position details occasionally
        if (consecutiveFallbackUpdates < 2) {
          console.log('Current position:', position);
        }
        
        setUserLocation(position);
        
        // Track if we're getting fallback locations
        if (position.isFallback) {
          consecutiveFallbackUpdates++;
        } else {
          consecutiveFallbackUpdates = 0;
        }
        
        if (destination && position) {
          // Only log debug info occasionally
          if (consecutiveFallbackUpdates < 2) {
            console.log('DEBUG - Position:', position);
            console.log('DEBUG - Destination:', destination);
          }
          
          // Convert destination array [lat, lng] to object {lat, lng} format
          const destinationObj = Array.isArray(destination) 
            ? { lat: destination[0], lng: destination[1] }
            : destination;
          
          const distance = calculateDistance(position, destinationObj);
          
          // Only log distance occasionally  
          if (consecutiveFallbackUpdates < 2) {
            console.log('Distance to destination:', distance);
          }
          
          setDistanceToDestination(distance);
          
          const withinGeofence = isWithinRadius(position, destinationObj, GEOFENCE_RADIUS);
          
          // Only log geofence status occasionally
          if (consecutiveFallbackUpdates < 2) {
            console.log('Within geofence:', withinGeofence);
          }
          
          setIsWithinGeofence(withinGeofence);
        }
      } catch (err) {
        console.error('Error updating location:', err);
      }
    };

    // Initial location update
    updateLocation();

    // Set up adaptive periodic location updates
    const scheduleNextUpdate = () => {
      // Use longer interval when consistently getting fallback locations
      const interval = consecutiveFallbackUpdates >= 3 ? 30000 : 10000; // 30s vs 10s
      locationInterval = setTimeout(() => {
        updateLocation().then(() => {
          scheduleNextUpdate();
        });
      }, interval);
    };
    
    scheduleNextUpdate();

    return () => {
      clearTimeout(locationInterval);
      // Clean up routing control if it exists
      if (routingControlRef.current && mapRef.current) {
        try {
          mapRef.current.removeControl(routingControlRef.current);
          routingControlRef.current = null;
        } catch (err) {
          console.warn('Error cleaning up routing control:', err);
        }
      }
    };
  }, [isOpen, destination]);



  // Clean up on modal close
  useEffect(() => {
    if (!isOpen) {
      // Reset all state
      setMode('navigation');
      setError(null);
      setUserLocation(null);
      setNavigationStarted(false);
      setIsWithinGeofence(false);
      setIsCameraPreloading(false);
      setHasCameraPermission(null);
      setScannedItems([]);
      setIsLoading(false);
      setDistanceToDestination(null);
      setScanStartTime(null);
      setIsScanning(false);

      // Clear all refs and timers
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (cameraInitTimer.current) {
        clearTimeout(cameraInitTimer.current);
        cameraInitTimer.current = null;
      }
      if (toastTimeout.current) {
        clearTimeout(toastTimeout.current);
        toastTimeout.current = null;
      }
      if (qrScanner.current) {
        try {
          qrScanner.current.stop();
          qrScanner.current.clear();
          qrScanner.current = null;
        } catch (err) {
          console.warn('Error cleaning up QR scanner:', err);
        }
      }

      // Clean up map container
      if (mapRef.current) {
        try {
          const container = mapRef.current.getContainer();
          if (container && container.parentNode) {
            container.parentNode.removeChild(container);
          }
          mapRef.current = null;
        } catch (err) {
          console.warn('Error cleaning up map container:', err);
        }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      // Clean up Google Maps instance (Google Maps cleanup is automatic)
      if (mapRef.current) {
        // Google Maps automatically cleans up when the DOM element is removed
        // No need to call remove() - just clear the reference
        mapRef.current = null;
      }

      // Clean up toast timeout
      if (toastTimeout.current) {
        clearTimeout(toastTimeout.current);
      }

      console.log('NavigationQRModal resources cleaned up successfully');
    };
  }, []);

  // Main component render
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-hidden flex flex-col my-4 mx-4 sm:mx-auto">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {mode === 'navigation' ? 'Pickup Navigation' : 'Scan QR Code'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Map or QR Scanner based on mode */}
          {mode === 'navigation' ? (
            <div className="relative w-full h-[60vh] bg-gray-100 rounded-lg overflow-hidden">
              {/* Debug logging for navigation conditions - reduced frequency */}
              {Math.random() < 0.05 && console.log('Navigation render check:', { userLocation: !!userLocation, destination: !!destination, userLocationData: userLocation, destinationData: destination })}
              {userLocation && destination ? (
                <GoogleMapModalComponent
                  userLocation={userLocation}
                  destination={destination}
                  onMapReady={(map) => {
                    console.log('Google Maps loaded in modal');
                    mapRef.current = map;
                  }}
                  className="w-full h-full"
                  shouldInitialize={true}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600 text-sm">Getting your location...</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full rounded-lg overflow-hidden">
              {mode === 'qr' && (
                <div className={`w-full ${
                  isCameraPreloading ? 'opacity-75' : 'opacity-100'
                }`}>
                  <ErrorBoundary
                    fallback={error => (
                      <div className="p-4 text-center">
                        <p className="text-red-600 mb-4">Camera error: {error?.message}</p>
                        <button
                          onClick={handleBackToNavigation}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Back to Map
                        </button>
                      </div>
                    )}
                  >
                    <QRCodeScanner
                      key={`qr-scanner-${scanStartTime}`}
                      onScanSuccess={handleQRScanSuccess}
                      onScanError={handleQRScanError}
                      isWithinRange={isWithinGeofence}
                    />
                  </ErrorBoundary>
                  <div className="mt-4 text-center">
                    <p className="text-white text-sm mb-2">Position the QR code within the scanner frame</p>
                    {scannedItems.length > 0 && (
                      <p className="text-green-500 text-sm">
                        {scannedItems.length} item{scannedItems.length > 1 ? 's' : ''} scanned
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="bg-white border-t p-5 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {mode === 'navigation' && (
                <div className="text-gray-700">
                  {isWithinGeofence ? (
                    <div className="flex items-center text-green-600">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      You've arrived!
                    </div>
                  ) : (
                    <span>
                      {distanceToDestination !== null ? (
                        `${distanceToDestination < 1 ? (
                          Math.round(distanceToDestination * 1000)
                        ) : (
                          distanceToDestination.toFixed(1)
                        )} to destination`
                      ) : (
                        'Calculating...'
                      )}
                    </span>
                  )}
                </div>
              )}
              {mode === 'qr' && (
                <div className="text-gray-700">
                  {scannedItems.length > 0 ? (
                    `${scannedItems.length} item${scannedItems.length > 1 ? 's' : ''} scanned`
                  ) : (
                    'Ready to scan'
                  )}
                </div>
              )}
            </div>
            <div className="flex space-x-2">
              {mode === 'navigation' && (
                <>
                  {error && !isWithinGeofence && (
                    <button
                      onClick={handleRetryLocation}
                      className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                      disabled={isLoading}
                    >
                      Retry Location
                    </button>
                  )}
                  <button
                    onClick={isWithinGeofence ? handleSwitchToQR : handleStartNavigation}
                    className={`px-6 py-2 text-white rounded-lg transition-all duration-300 font-medium shadow-sm transform hover:scale-105 ${
                      isWithinGeofence
                        ? isCameraPreloading
                          ? 'bg-green-500 opacity-75'
                          : 'bg-green-600 hover:bg-green-700 hover:shadow-lg'
                        : navigationStarted
                          ? 'bg-blue-700 hover:bg-blue-800'
                          : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    aria-label={isWithinGeofence ? 'Switch to QR code scanning' : 'Start navigation'}
                    disabled={isLoading || (isWithinGeofence && (hasCameraPermission === false || isCameraPreloading))}
                  >
                    <div className="flex items-center justify-center">
                      {isWithinGeofence
                        ? isCameraPreloading
                          ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Preparing Camera...
                            </>
                          )
                          : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 14v1m8-8h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                              </svg>
                              Scan Now
                            </>
                          )
                        : navigationStarted 
                          ? 'Navigating...' 
                          : 'Start'}
                    </div>
                  </button>
                </>
              )}
              {mode === 'qr' && (
                <div className="flex space-x-2">
                  <button
                    onClick={handleBackToNavigation}
                    className="px-5 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                    aria-label="Return to navigation"
                  >
                    Back to Map
                  </button>
                  {scannedItems.length > 0 && (
                    <button
                      onClick={() => {
                        onQRScanned(scannedItems.map(item => item.code));
                        onClose();
                      }}
                      className="px-5 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                      aria-label="Complete scanning"
                    >
                      Complete ({scannedItems.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Toast */}
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          {error && (
            <Toast
              message={typeof error === 'object' ? error.message : error}
              type={typeof error === 'object' ? error.type : 'error'}
              onClose={() => setError(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default NavigationQRModal;
