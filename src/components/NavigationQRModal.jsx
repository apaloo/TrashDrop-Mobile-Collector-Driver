import { useState, useEffect, useRef, useCallback } from 'react';
import GoogleMapsNavigation from './GoogleMapsNavigation';
import { getCurrentLocation, isWithinRadius, calculateDistance } from '../utils/geoUtils';
import Toast from './Toast';
import { debounce } from 'lodash';
import { useAuth } from '../context/AuthContext';
import { locationBroadcast } from '../services/locationBroadcast';
import './navigation-modal.css'; // Custom CSS for better readability
import QRCodeScanner from './QRCodeScanner'; // Import our existing QR scanner component
import ErrorBoundary from './ErrorBoundary'; // Import error boundary
import { logger } from '../utils/logger';
import useWakeLock from '../hooks/useWakeLock';
import { useNavigationPersistence } from '../hooks/useNavigationPersistence';

// QR Scan Rate Limiting
const QR_SCAN_RATE_LIMIT = 10; // per minute
const LOCATION_RETRY_MAX_ATTEMPTS = 3;
const CAMERA_INIT_TIMEOUT = 2000;
const GEOFENCE_RADIUS = 50; // 50 meters radius for geofence
const LOCATION_UPDATE_INTERVAL = 10000; // 10 seconds

const NavigationQRModal = ({
  isOpen,
  onClose,
  destination,
  destinationName = 'pickup location', // Name for arrival announcement
  requestId,
  onQRScanned,
  expectedQRValue,
  wasteType = 'general', // Waste type for destination icon color
  sourceType = 'pickup_request' // Source type (pickup_request or digital_bin)
}) => {
  const { user } = useAuth();
  const { saveNavigationState, restoreNavigationState, clearNavigationState } = useNavigationPersistence();
  const [mode, setMode] = useState('navigation'); // 'navigation' or 'qr'
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [hasArrivedAtDestination, setHasArrivedAtDestination] = useState(false); // Latched arrival state - once true, stays true
  const [isCameraPreloading, setIsCameraPreloading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [scannedItems, setScannedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [scanStartTime, setScanStartTime] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [locationRetryCount, setLocationRetryCount] = useState(0);
  
  // Turn-by-turn navigation state (adopted from AssignmentNavigationModal)
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [navigationInstructions, setNavigationInstructions] = useState([]);
  const [isInstructionsCollapsed, setIsInstructionsCollapsed] = useState(false);
  const [hasAnnouncedArrival, setHasAnnouncedArrival] = useState(false);
  
  // Keep screen on during navigation
  const { isEnabled: isScreenOn, toggle: toggleScreenOn } = useWakeLock(true); // Auto-enable
  
  const mapRef = useRef(null);
  const routingControlRef = useRef(null);
  const qrScanner = useRef(null);
  const mapContainerKey = useRef(`map-${Date.now()}`).current; // Unique key for map container to prevent reuse
  const navigationControlRef = useRef(null);

  // Rate limiting for QR scans
  const qrScanAttempts = useRef([]);
  const watchId = useRef(null);
  const cameraInitTimer = useRef(null);
  const toastTimeout = useRef(null);
  
  // Voice navigation refs
  const directionsService = useRef(null);
  const directionsRenderer = useRef(null);
  const hasArrivedRef = useRef(false); // Ref to track arrival state inside useEffect closures
  const speechSynthesis = useRef(window.speechSynthesis);
  const currentUtterance = useRef(null);

  // CENTRALIZED geofence setter that ALWAYS respects the latch
  // This prevents any code from accidentally setting isWithinGeofence to false after arrival
  const updateGeofenceState = useCallback((newValue, source = 'unknown') => {
    // If we've arrived, NEVER set to false (unless explicitly resetting via clearNavigationState)
    if (hasArrivedRef.current && !newValue) {
      logger.debug(`🔒 Geofence latch active - blocking false value from ${source}`);
      return; // Don't update - keep it true
    }
    
    // If setting to true, also latch the arrival state
    if (newValue && !hasArrivedRef.current) {
      hasArrivedRef.current = true;
      setHasArrivedAtDestination(true);
      logger.info('🎯 Latching arrival state via updateGeofenceState');
    }
    
    logger.debug(`📍 Geofence update from ${source}: ${newValue} (latched: ${hasArrivedRef.current})`);
    setIsWithinGeofence(newValue);
  }, []);

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

  // Voice announcement function using Web Speech API
  const speak = useCallback((text, priority = 'normal') => {
    if (!speechSynthesis.current) {
      logger.warn('Speech synthesis not available');
      return;
    }
    
    // Cancel current speech if high priority
    if (priority === 'high' && currentUtterance.current) {
      speechSynthesis.current.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';
    
    utterance.onend = () => {
      currentUtterance.current = null;
    };
    
    utterance.onerror = (event) => {
      logger.error('Speech synthesis error:', event);
      currentUtterance.current = null;
    };
    
    currentUtterance.current = utterance;
    speechSynthesis.current.speak(utterance);
    logger.debug(`🔊 Speaking: "${text}"`);
  }, []);

  // Stop voice announcements
  const stopSpeaking = useCallback(() => {
    if (speechSynthesis.current) {
      speechSynthesis.current.cancel();
      currentUtterance.current = null;
    }
  }, []);

  // Format distance for display
  const formatDistance = useCallback((distance) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }, []);

  // Initialize Google Maps Directions API
  const initializeDirectionsAPI = useCallback(() => {
    if (window.google && window.google.maps) {
      directionsService.current = new window.google.maps.DirectionsService();
      directionsRenderer.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: false,
        suppressInfoWindows: true,
        polylineOptions: {
          strokeColor: '#4F46E5',
          strokeWeight: 5,
          strokeOpacity: 0.8
        }
      });
      return true;
    }
    return false;
  }, []);

  // Get navigation route from Google Maps Directions API
  const getNavigationRoute = useCallback(async (origin, dest) => {
    if (!directionsService.current) {
      if (!initializeDirectionsAPI()) {
        logger.error('Google Maps not loaded');
        return null;
      }
    }

    // Convert destination array to object if needed
    const destinationObj = Array.isArray(dest) 
      ? { lat: dest[0], lng: dest[1] }
      : dest;
    
    const originObj = Array.isArray(origin)
      ? { lat: origin[0], lng: origin[1] }
      : origin;

    return new Promise((resolve, reject) => {
      directionsService.current.route({
        origin: new window.google.maps.LatLng(originObj.lat, originObj.lng),
        destination: new window.google.maps.LatLng(destinationObj.lat, destinationObj.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          logger.debug('🗺️ Navigation route calculated:', result);
          resolve(result);
        } else {
          logger.error('❌ Directions request failed:', status);
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }, [initializeDirectionsAPI]);

  // Start voice navigation with turn-by-turn instructions
  const startVoiceNavigation = useCallback(async () => {
    if (!userLocation) {
      showToast({
        message: 'Unable to get your current location for navigation',
        type: 'error'
      });
      return;
    }

    if (!destination) {
      showToast({
        message: 'Invalid destination coordinates',
        type: 'error'
      });
      return;
    }

    try {
      setIsLoading(true);
      logger.debug('🧭 Starting voice navigation...');
      
      const route = await getNavigationRoute(userLocation, destination);
      if (!route) {
        throw new Error('Could not calculate route');
      }

      setNavigationRoute(route);
      setCurrentStep(0);
      
      // Extract step-by-step instructions
      const steps = route.routes[0].legs[0].steps.map((step, index) => ({
        index,
        instruction: step.instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
        distance: step.distance.text,
        duration: step.duration.text,
        maneuver: step.maneuver || 'straight',
        startLocation: {
          lat: step.start_location.lat(),
          lng: step.start_location.lng()
        },
        endLocation: {
          lat: step.end_location.lat(),
          lng: step.end_location.lng()
        }
      }));
      
      setNavigationInstructions(steps);
      setIsNavigating(true);
      setNavigationStarted(true);
      
      // Announce first instruction
      if (steps.length > 0) {
        speak(`Starting navigation to ${destinationName}. ${steps[0].instruction}`, 'high');
      }
      
      // Display route on map if available
      if (directionsRenderer.current && mapRef.current) {
        directionsRenderer.current.setMap(mapRef.current);
        directionsRenderer.current.setDirections(route);
      }
      
      showToast({
        message: `Voice navigation started! ${steps.length} steps to destination.`,
        type: 'success'
      });
      
    } catch (error) {
      logger.error('❌ Voice navigation setup failed:', error);
      showToast({
        message: 'Failed to start voice navigation. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, destination, destinationName, getNavigationRoute, showToast, speak]);

  // Stop voice navigation
  const stopVoiceNavigation = useCallback(() => {
    setIsNavigating(false);
    setNavigationRoute(null);
    setCurrentStep(0);
    setNavigationInstructions([]);
    stopSpeaking();
    
    // Clear route from map
    if (directionsRenderer.current) {
      directionsRenderer.current.setMap(null);
    }
    
    logger.debug('🛑 Voice navigation stopped');
    showToast({
      message: 'Voice navigation stopped',
      type: 'info'
    });
  }, [showToast, stopSpeaking]);

  // Calculate distance to next navigation step
  const getDistanceToNextStep = useCallback(() => {
    if (!navigationInstructions.length || !userLocation || currentStep >= navigationInstructions.length) {
      return null;
    }
    
    const nextStep = navigationInstructions[currentStep];
    const userPos = Array.isArray(userLocation) 
      ? { lat: userLocation[0], lng: userLocation[1] }
      : userLocation;
    
    return calculateDistance(userPos, nextStep.startLocation);
  }, [navigationInstructions, userLocation, currentStep]);

  // Update navigation progress and announce next step
  const updateNavigationProgress = useCallback(() => {
    if (!isNavigating || !navigationInstructions.length || !userLocation) return;
    
    const distanceToNextStep = getDistanceToNextStep();
    
    // If user is within 50m of next step, advance to next instruction
    if (distanceToNextStep && distanceToNextStep <= 0.05 && currentStep < navigationInstructions.length - 1) {
      setCurrentStep(prev => prev + 1);
      logger.debug(`📍 Advanced to step ${currentStep + 1}/${navigationInstructions.length}`);
      
      // Announce next instruction via voice
      const nextInstruction = navigationInstructions[currentStep + 1];
      if (nextInstruction) {
        speak(nextInstruction.instruction, 'high');
        showToast({
          message: nextInstruction.instruction,
          type: 'info'
        });
      }
    }
  }, [isNavigating, navigationInstructions, userLocation, currentStep, getDistanceToNextStep, speak, showToast]);

  // Voice announcement for arrival within geofence
  const announceArrival = useCallback(() => {
    if (hasAnnouncedArrival) return;
    
    setHasAnnouncedArrival(true);
    
    // Haptic feedback for arrival
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]); // Triple vibration pattern
    }
    
    // Voice announcement
    speak(`You have arrived at ${destinationName}. You can now scan the QR code.`, 'high');
    
    // Stop voice navigation if active
    if (isNavigating) {
      stopVoiceNavigation();
    }
    
    logger.info(`🎯 Arrival announced for ${destinationName}`);
  }, [hasAnnouncedArrival, destinationName, speak, isNavigating, stopVoiceNavigation]);

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
      logger.debug('✅ Switched back to navigation mode');
      
      // Small delay to ensure clean transition
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      logger.error('❌ Error switching back to navigation:', err);
      setError({
        type: 'error',
        message: 'Error switching modes. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleQRScanSuccess = useCallback(async (decodedText) => {
    // Handle scan success with rate limiting
    if (isQRScanRateLimited()) {
      return;
    }
    
    // Add to scan attempts for rate limiting
    qrScanAttempts.current.push(Date.now());
    
    // Process the scanned code
    const scanStartTime = Date.now();
    logger.debug(`⚡ QR scan processed in ${Date.now() - scanStartTime}ms`, decodedText);
    
    // Extract ID from scanned text (handles both full URLs and plain IDs)
    const extractId = (text) => {
      // If it's a URL like "https://trashdrop.app/bin/6fd90afb-...", extract the ID
      const urlMatch = text.match(/\/bin\/([a-f0-9-]+)$/i);
      if (urlMatch) {
        return urlMatch[1];
      }
      // Otherwise return as-is (already an ID)
      return text;
    };
    
    const scannedId = extractId(decodedText);
    logger.info('🔍 Validation check - expectedQRValue:', expectedQRValue);
    logger.info('🔍 Validation check - decodedText:', decodedText);
    logger.info('🔍 Validation check - extractedId:', scannedId);
    logger.info('🔍 Validation check - match:', scannedId === expectedQRValue);
    
    // Validate scanned QR code (only if expected value is set)
    if (expectedQRValue && scannedId !== expectedQRValue) {
      logger.error('❌ QR code mismatch! Expected:', expectedQRValue, 'Got:', scannedId);
      showToast({
        message: 'Invalid QR code. Please scan the correct code.',
        type: 'error'
      });
      return;
    }
    
    logger.info('✅ Validation passed, continuing to success logic...');
    
    // Add to scanned items
    const newItem = { code: decodedText, timestamp: Date.now() };
    setScannedItems(prev => [...prev, newItem]);
    
    logger.info('📞 Calling onQRScanned callback...');
    // Call the parent callback - Request.jsx will handle closing this modal and opening payment modal
    await onQRScanned([decodedText]);
    logger.info('✅ QR scan callback completed - parent component will handle modal transitions');
  }, [expectedQRValue, onQRScanned, onClose]);
  
  const handleQRScanError = useCallback((error) => {
    logger.error('QR scan error:', error);
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
    
    // Save navigation state for persistence/recovery
    await saveNavigationState({
      destination,
      destinationName,
      userLocation,
      isNavigating: true,
      requestId,
      wasteType,
      sourceType
    });
    
    // Start broadcasting location to user
    if (requestId && user?.id) {
      await locationBroadcast.startTracking(requestId, user.id);
      logger.info('📡 Started real-time location tracking for user');
    }
    
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
      logger.error('Camera permission error:', err);
      setError({ type: 'error', message: 'Camera access denied. Please grant camera permissions.' });
      setHasCameraPermission(false);
    } finally {
      setIsCameraPreloading(false);
    }
  }, []);

  // Handle switching to QR mode when already within geofence
  const handleSwitchToQR = useCallback(async () => {
    logger.info('🔄 handleSwitchToQR called', {
      isWithinGeofence,
      hasArrivedRef: hasArrivedRef.current,
      hasArrivedAtDestination,
      mode,
      distanceToDestination
    });
    
    // If not within geofence, show error
    if (!isWithinGeofence) {
      setError({
        type: 'error',
        message: 'You must be within 50 meters of the pickup location to scan QR codes.'
      });
      return;
    }
    
    // Stop voice navigation when switching to QR mode
    if (isNavigating) {
      stopVoiceNavigation();
    }
    stopSpeaking();
    
    // Preload camera
    setIsCameraPreloading(true);
    
    try {
      // Request camera permission first
      logger.debug('🎥 Requesting camera permission for QR scanning...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Release immediately after permission check
      
      // Permission granted - switch to QR mode
      setHasCameraPermission(true);
      
      // CRITICAL: Ensure geofence state is true if we've arrived (prevents race conditions)
      if (hasArrivedRef.current) {
        logger.info('✅ Arrival latched - ensuring geofence state is true before QR mode');
        updateGeofenceState(true, 'handleSwitchToQR');
      }
      
      setMode('qr');
      setError(null);
      logger.info('✅ Successfully switched to QR scanning mode', {
        isWithinGeofence,
        hasArrivedRef: hasArrivedRef.current
      });
      
    } catch (err) {
      logger.error('❌ Camera permission error:', err);
      setError({ 
        type: 'error', 
        message: 'Camera access denied. Please grant camera permissions to scan QR codes.' 
      });
      setHasCameraPermission(false);
    } finally {
      setIsCameraPreloading(false);
    }
  }, [isWithinGeofence, isNavigating, stopVoiceNavigation, stopSpeaking, updateGeofenceState]);

  // Retry mechanism for location updates (declared first to avoid temporal dead zone)
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
          
          // If using fallback location, show warning
          if (locationResult.isFallback) {
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
        
        // Use actual distance check (don't force geofence in dev mode for QR scanning)
        const isWithin = within50m;
        
        setDistanceToDestination(distance);
        updateGeofenceState(isWithin, 'retryLocationUpdate');
        
        // Only clear error if we have a non-fallback location
        if (!locationResult.isFallback) {
          setError(null);
        }
        
        setLocationRetryCount(0);
        return coords;
        
      } catch (err) {
        logger.error(`Location attempt ${attempt} failed:`, err);
        
        if (attempt === maxRetries) {
          // More user-friendly error message
          setError({
            type: 'error',
            message: 'Unable to get your location. Please check your GPS settings.'
          });
          throw err;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }, [destination, updateGeofenceState]);

  // Handle retry location button
  const handleRetryLocation = useCallback(async () => {
    // Provide haptic feedback on mobile devices
    if (navigator.vibrate) {
      navigator.vibrate(50); // Short vibration for button press
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      logger.debug('🔄 Retrying location update...');
      const coords = await retryLocationUpdate();
      if (coords) {
        logger.debug('✅ Location retry successful:', coords);
        showToast({
          message: 'Location updated successfully',
          type: 'success'
        });
        
        // Success haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]); // Success pattern
        }
      }
    } catch (err) {
      logger.error('❌ Location retry failed:', err);
      showToast({
        message: 'Unable to get location. Please check your GPS settings.',
        type: 'error'
      });
      
      // Error haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]); // Error pattern
      }
    } finally {
      setIsLoading(false);
    }
  }, [retryLocationUpdate, showToast]);

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
          
          const withinGeofence = distance <= 0.05;
          updateGeofenceState(withinGeofence, 'debouncedUpdateLocation');
        }
      } catch (err) {
        logger.error('Error updating location:', err);
        setError({
          type: 'error',
          message: 'Could not update your location. Please check your GPS settings.'
        });
      } finally {
        setIsLoading(false);
      }
    }, 1000),
    [destination, isOpen, mode, retryLocationUpdate, updateGeofenceState]
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
      logger.error('Camera permission error:', err);
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
        logger.debug('Updating location...');
      }
      try {
        const position = await getCurrentLocation();
        
        // Only log position details occasionally
        if (consecutiveFallbackUpdates < 2) {
          logger.debug('Current position:', position);
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
            logger.debug('DEBUG - Position:', position);
            logger.debug('DEBUG - Destination:', destination);
          }
          
          // Convert destination array [lat, lng] to object {lat, lng} format
          const destinationObj = Array.isArray(destination) 
            ? { lat: destination[0], lng: destination[1] }
            : destination;
          
          const distance = calculateDistance(position, destinationObj);
          
          // Only log distance occasionally  
          if (consecutiveFallbackUpdates < 2) {
            logger.debug('Distance to destination:', distance);
          }
          
          setDistanceToDestination(distance);
          
          // Use distance-based check for geofence (50m = 0.05km)
          const withinGeofence = distance <= 0.05;
          
          // Only log geofence status occasionally
          if (consecutiveFallbackUpdates < 2) {
            logger.debug('🎯 Geofence check - Within 50m:', withinGeofence, `| Distance: ${distance.toFixed(3)}km (${Math.round(distance * 1000)}m)`);
          }
          
          // Check if we just entered the geofence (transition from outside to inside)
          const wasOutsideGeofence = !isWithinGeofence;
          
          // Use centralized geofence setter (handles latching automatically)
          updateGeofenceState(withinGeofence, 'mainLocationLoop');
          
          // Trigger arrival announcement when entering geofence
          if (withinGeofence && wasOutsideGeofence && !position.isFallback) {
            announceArrival();
          }
          
          // Update navigation progress if voice navigation is active
          if (isNavigating) {
            updateNavigationProgress();
          }
        }
      } catch (err) {
        logger.error('Error updating location:', err);
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
          logger.warn('Error cleaning up routing control:', err);
        }
      }
    };
  }, [isOpen, destination, updateGeofenceState]);



  // Cleanup on component unmount or modal close
  useEffect(() => {
    if (!isOpen) {
      // Clear navigation state when modal closes
      clearNavigationState();
      
      // Stop location broadcasting when modal closes
      locationBroadcast.stopTracking();
      
      // Stop voice navigation and speaking
      stopSpeaking();
      
      // Reset states when modal closes
      setMode('navigation');
      setError(null);
      setUserLocation(null);
      setNavigationStarted(false);
      setIsWithinGeofence(false);
      setHasArrivedAtDestination(false); // Reset latched state when modal closes
      hasArrivedRef.current = false; // Reset ref too
      setIsCameraPreloading(false);
      setHasCameraPermission(null);
      setScannedItems([]);
      setIsLoading(false);
      setDistanceToDestination(null);
      setScanStartTime(null);
      setIsScanning(false);
      
      // Reset voice navigation state
      setIsNavigating(false);
      setNavigationRoute(null);
      setCurrentStep(0);
      setNavigationInstructions([]);
      setIsInstructionsCollapsed(false);
      setHasAnnouncedArrival(false);

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
          logger.warn('Error cleaning up QR scanner:', err);
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
          logger.warn('Error cleaning up map container:', err);
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

      logger.debug('NavigationQRModal resources cleaned up successfully');
    };
  }, []);

  // Main component render
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center overflow-y-auto" style={{ paddingTop: '4rem', paddingBottom: '5rem' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-full overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800 flex-1 truncate pr-2">
            {mode === 'navigation' ? 'Pickup Navigation' : 'Scan QR Code'}
          </h2>
          <div className="flex items-center space-x-2">
            {/* Keep Screen On Toggle */}
            <button
              onClick={toggleScreenOn}
              className={`p-2 rounded-full transition-colors duration-200 ${
                isScreenOn 
                  ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' 
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              aria-label={isScreenOn ? 'Disable keep screen on' : 'Enable keep screen on'}
              title={isScreenOn ? 'Screen will stay on' : 'Screen may turn off'}
            >
              <svg className="w-5 h-5" fill={isScreenOn ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
            {/* Close Button */}
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
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden" style={{ minHeight: '350px' }}>
          {/* Map or QR Scanner based on mode */}
          {mode === 'navigation' ? (
            <div className="absolute inset-0 bg-gray-100 rounded-lg overflow-hidden">
              {/* Debug logging for navigation conditions - reduced frequency */}
              {Math.random() < 0.05 && logger.debug('Navigation render check:', { userLocation: !!userLocation, destination: !!destination, userLocationData: userLocation, destinationData: destination })}
              {userLocation && destination ? (
                <GoogleMapsNavigation
                  userLocation={userLocation}
                  destination={destination}
                  destinationName={destinationName}
                  navigationControlRef={navigationControlRef}
                  wasteType={wasteType}
                  sourceType={sourceType}
                  onMapReady={(map) => {
                    logger.debug('Google Maps loaded in modal');
                    mapRef.current = map;
                  }}
                  onRouteCalculated={(routeInfo) => {
                    logger.debug('Route calculated:', routeInfo);
                  }}
                  onError={(error) => {
                    logger.warn('Map error:', error);
                    showToast({
                      message: 'Map loading issue. You can still navigate externally.',
                      type: 'warning'
                    });
                  }}
                  onNavigationStop={() => {
                    logger.info('Navigation stopped from GoogleMapsNavigation');
                  }}
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
                    {/* Debug: Log the prop value being passed */}
                    {logger.info('📷 Rendering QRCodeScanner with isWithinRange:', isWithinGeofence, 'hasArrivedRef:', hasArrivedRef.current)}
                    <QRCodeScanner
                      key={`qr-scanner-${scanStartTime}`}
                      onScanSuccess={handleQRScanSuccess}
                      onScanError={handleQRScanError}
                      isWithinRange={isWithinGeofence}
                    />
                    {/* Debug info */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mt-2 p-2 bg-gray-800 text-white text-xs rounded">
                        <div>Distance: {distanceToDestination ? `${Math.round(distanceToDestination * 1000)}m` : 'Calculating...'}</div>
                        <div>Within 50m: {isWithinGeofence ? '✅ Yes' : '❌ No'}</div>
                        <div>Mode: {mode}</div>
                      </div>
                    )}
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
            <div className="flex space-x-2 min-w-0">
              {mode === 'navigation' && (
                <>
                  {error && !isWithinGeofence && (
                    <button
                      onClick={handleRetryLocation}
                      className="relative p-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 hover:shadow-md active:scale-95 active:bg-blue-100 transition-all duration-200 font-medium flex-shrink-0 transform hover:scale-105 overflow-hidden group"
                      disabled={isLoading}
                      title={isLoading ? 'Retrying...' : 'Retry Location'}
                    >
                      {/* Ripple effect overlay */}
                      <div className="absolute inset-0 rounded-lg opacity-0 group-active:opacity-100 group-active:animate-ping bg-blue-200 transition-opacity duration-300"></div>
                      
                      {/* Pulse effect on click */}
                      <div className={`absolute inset-0 rounded-lg transition-all duration-500 ${isLoading ? 'animate-pulse bg-blue-100' : ''}`}></div>
                      
                      <div className={`relative transition-all duration-300 ${isLoading ? 'animate-spin' : 'hover:rotate-180 group-active:rotate-90 group-active:scale-110'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                    </button>
                  )}
                  {/* Only show Scan Now button when within 50m geofence */}
                  {isWithinGeofence ? (
                    <button
                      onClick={handleSwitchToQR}
                      className={`flex-1 min-w-0 px-3 py-2 text-white rounded-lg transition-all duration-300 font-medium shadow-sm transform hover:scale-105 ${
                        isCameraPreloading
                          ? 'bg-green-500 opacity-75'
                          : 'bg-green-600 hover:bg-green-700 hover:shadow-lg'
                      }`}
                      aria-label="Switch to QR code scanning"
                      disabled={isLoading || hasCameraPermission === false || isCameraPreloading}
                    >
                      <div className="flex items-center justify-center min-w-0">
                        {isCameraPreloading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 flex-shrink-0"></div>
                            <span className="truncate">Preparing Camera...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 14v1m8-8h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                            </svg>
                            <span className="truncate">Scan Now</span>
                          </>
                        )}
                      </div>
                    </button>
                  ) : isNavigating ? (
                    /* Stop Voice Navigation button when navigation is active */
                    <button
                      onClick={stopVoiceNavigation}
                      className="flex-1 min-w-0 px-3 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all duration-300 font-medium shadow-sm"
                      aria-label="Stop voice navigation"
                    >
                      <div className="flex items-center justify-center min-w-0">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="truncate">Stop Navigation</span>
                      </div>
                    </button>
                  ) : (
                    /* Voice Navigation button */
                    <button
                      onClick={startVoiceNavigation}
                      className={`flex-1 min-w-0 px-3 py-2 text-white rounded-lg transition-all duration-300 font-medium shadow-sm ${
                        isLoading
                          ? 'bg-blue-500 opacity-75'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      aria-label="Start voice navigation"
                      disabled={isLoading || !userLocation}
                    >
                      <div className="flex items-center justify-center min-w-0">
                        {isLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 flex-shrink-0"></div>
                            <span className="truncate">Loading...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            <span className="truncate">Voice Navigation</span>
                          </>
                        )}
                      </div>
                    </button>
                  )}
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
