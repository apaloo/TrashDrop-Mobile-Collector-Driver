import { logger } from './logger';

/**
 * Calculates the distance between two coordinates in kilometers
 * using the Haversine formula
 * @param {Object} coord1 - First coordinate {lat, lng}
 * @param {Object} coord2 - Second coordinate {lat, lng}
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (coord1, coord2) => {
  if (!coord1 || !coord2) return 0;
  
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

/**
 * Converts degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
const toRad = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Checks if a location is within a certain radius of another location
 * @param {Object} location - The location to check {lat, lng}
 * @param {Object} center - The center point {lat, lng}
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean} True if within radius
 */
export const isWithinRadius = (location, center, radiusKm) => {
  if (!location || !center) return false;
  const distance = calculateDistance(location, center);
  return distance <= radiusKm;
};

// NO DEFAULT/FALLBACK LOCATION - App must use ACTUAL GPS coordinates only
// Removed hardcoded Accra coordinates to ensure navigation uses real user location

// Location caching to reduce repeated failed attempts
let locationCache = {
  lastAttempt: 0,
  lastSuccessfulLocation: null,
  consecutiveFailures: 0,
  isCurrentlyFetching: false,
  lastFailureWarning: 0,
  lastRetryWarning: 0,
  lastMethodWarning: 0
};

const CACHE_DURATION = 30000; // 30 seconds
const MAX_CONSECUTIVE_FAILURES = 3;
const FAILURE_BACKOFF_TIME = 60000; // 1 minute backoff after max failures

/**
 * Gets the user's current location with fallback to default location
 * @returns {Promise<{lat: number, lng: number, isFallback: boolean}>}
 */
export const getCurrentLocation = () => {
  return new Promise((resolve) => {
    // Check if we have a cached location
    const now = Date.now();
    if (locationCache.lastSuccessfulLocation && now - locationCache.lastAttempt < CACHE_DURATION) {
      logger.debug('✅ Using cached location');
      resolve(locationCache.lastSuccessfulLocation);
      return;
    }

    // Check if we've exceeded max consecutive failures
    if (locationCache.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      // Only log this warning every 2 minutes to reduce console spam
      if (!locationCache.lastFailureWarning || now - locationCache.lastFailureWarning > 120000) {
        logger.warn('⚠️ Max consecutive GPS failures - location unavailable');
        locationCache.lastFailureWarning = now;
      }
      // Return null to indicate GPS is unavailable - NO FALLBACK COORDINATES
      resolve(null);
      return;
    }

    // Check if we're currently fetching a location
    if (locationCache.isCurrentlyFetching) {
      logger.debug('⏳ Location is currently being fetched, waiting...');
      const maxWait = 5000; // 5 seconds timeout
      const startTime = Date.now();
      const intervalId = setInterval(() => {
        if (!locationCache.isCurrentlyFetching) {
          clearInterval(intervalId);
          getCurrentLocation().then(resolve);
        } else if (Date.now() - startTime > maxWait) {
          // Timeout reached - return null, NO FALLBACK
          clearInterval(intervalId);
          logger.warn('⚠️ Location fetch timeout - GPS unavailable');
          locationCache.isCurrentlyFetching = false; // Reset flag
          resolve(null);
        }
      }, 100);
      return;
    }

    // First try the Google Maps Geolocation API
    const tryGoogleGeolocation = async () => {
      try {
        // Check if Google Maps is loaded and available
        if (window.google && window.google.maps && window.google.maps.Geolocation) {
          const geolocation = new window.google.maps.Geolocation();
          const position = await new Promise((geoResolve, geoReject) => {
            geolocation.getCurrentPosition(
              pos => geoResolve(pos),
              error => geoReject(error),
              { enableHighAccuracy: true, timeout: 8000 }
            );
          });

          return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            isFallback: false,
            source: 'google'
          };
        }
      } catch (error) {
        logger.warn('🌍 Google Geolocation failed:', error);
        // Let it fall through to browser geolocation
      }
      return null;
    };

    // Fallback to browser geolocation
    const tryBrowserGeolocation = () => {
      return new Promise((geoResolve) => {
        if (!navigator.geolocation) {
          logger.warn('📱 Browser geolocation not supported');
          geoResolve(null);
          return;
        }

        const options = {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000
        };

        navigator.geolocation.getCurrentPosition(
          (position) => {
            geoResolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              isFallback: false,
              source: 'browser'
            });
          },
          (error) => {
            // Only log browser location errors on first few failures to reduce spam
            if (locationCache.consecutiveFailures < 2) {
              logger.warn(`📍 Browser location error (${error.code}):`, error.message);
            }
            geoResolve(null);
          },
          options
        );
      });
    };

    // Try both methods in sequence with caching
    const getLocation = async () => {
      locationCache.isCurrentlyFetching = true;
      locationCache.lastAttempt = now;
      
      try {
        // Try Google Maps first
        const googleLocation = await tryGoogleGeolocation();
        if (googleLocation) {
          logger.debug('✅ Using Google Maps location');
          locationCache.lastSuccessfulLocation = googleLocation;
          locationCache.consecutiveFailures = 0;
          locationCache.isCurrentlyFetching = false;
          resolve(googleLocation);
          return;
        }

        // Fall back to browser geolocation
        const browserLocation = await tryBrowserGeolocation();
        if (browserLocation) {
          logger.debug('✅ Using browser geolocation');
          locationCache.lastSuccessfulLocation = browserLocation;
          locationCache.consecutiveFailures = 0;
          locationCache.isCurrentlyFetching = false;
          resolve(browserLocation);
          return;
        }

        // If both fail, increment failure count - NO FALLBACK COORDINATES
        locationCache.consecutiveFailures++;
        locationCache.isCurrentlyFetching = false;
        
        // Only log warning on first few failures and then occasionally to reduce console spam
        if (locationCache.consecutiveFailures <= 2 || (!locationCache.lastMethodWarning || now - locationCache.lastMethodWarning > 120000)) {
          logger.warn('⚠️ All geolocation methods failed - GPS unavailable');
          locationCache.lastMethodWarning = now;
        }
        
        // Return null to indicate GPS is unavailable - NO FALLBACK
        resolve(null);
      } catch (error) {
        locationCache.consecutiveFailures++;
        locationCache.isCurrentlyFetching = false;
        
        // Only log error on first failure to reduce console spam
        if (locationCache.consecutiveFailures === 1) {
          logger.error('❌ Critical geolocation error:', error);
        }
        
        // Return null - NO FALLBACK COORDINATES
        resolve(null);
      }
    };

    getLocation();
  });
};

/**
 * Gets the current location with retry logic
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<{lat: number, lng: number, isFallback: boolean}>}
 */
export const getLocationWithRetry = async (maxRetries = 3, delay = 2000) => {
  let lastError = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      logger.debug(`🔄 Location attempt ${i + 1}/${maxRetries}`);
      const location = await getCurrentLocation();
      
      // If we got a non-fallback location, return it immediately
      if (!location.isFallback) {
        logger.debug(`✅ Got location from ${location.source}`);
        return location;
      }
      
      // If this isn't the last attempt, wait before trying again
      if (i < maxRetries - 1) {
        logger.debug(`⏳ Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error;
      logger.warn(`❌ Attempt ${i + 1} failed:`, error);
      
      // If this isn't the last attempt, wait before trying again
      if (i < maxRetries - 1) {
        logger.debug(`⏳ Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All attempts failed - return null, NO FALLBACK COORDINATES
  const now = Date.now();
  if (!locationCache.lastRetryWarning || now - locationCache.lastRetryWarning > 300000) { // 5 minutes
    logger.warn('⚠️ All location attempts failed - GPS unavailable');
    locationCache.lastRetryWarning = now;
  }
  // Return null to indicate GPS is unavailable
  return null;
};

/**
 * Parses a POINT() string from PostGIS into coordinates
 * @param {string} pointString - PostGIS POINT() format string
 * @returns {Object|null} {lat, lng} or null if invalid
 */
export const parsePointString = (pointString) => {
  if (!pointString || typeof pointString !== 'string') return null;
  
  // Match POINT(lng lat) format
  const match = pointString.match(/POINT\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/i);
  if (!match) return null;
  
  const lng = parseFloat(match[1]);
  const lat = parseFloat(match[2]);
  
  if (isNaN(lat) || isNaN(lng)) return null;
  
  return { lat, lng };
};

/**
 * Formats coordinates into a readable location string
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Formatted location string
 */
export const formatCoordinates = (lat, lng) => {
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
    return 'Location unavailable';
  }
  
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
};

/**
 * Cache for reverse geocoded addresses to avoid excessive API calls
 */
const geocodeCache = new Map();
const GEOCODE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Rate limiting for Nominatim API (max 1 request per second)
 */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
const requestQueue = [];
let isProcessingQueue = false;

/**
 * Circuit breaker for geocoding API
 * Stops attempts after repeated failures to avoid console spam
 */
const circuitBreaker = {
  failures: 0,
  lastFailureTime: 0,
  isOpen: false,
  failureThreshold: 5, // Open circuit after 5 failures
  resetTimeout: 60000, // Try again after 1 minute
  
  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.isOpen = true;
      logger.warn(`🚫 Geocoding circuit breaker opened after ${this.failures} failures. Will retry in 1 minute.`);
    }
  },
  
  recordSuccess() {
    this.failures = 0;
    this.isOpen = false;
  },
  
  shouldAllowRequest() {
    // Check if circuit should be reset
    if (this.isOpen && Date.now() - this.lastFailureTime > this.resetTimeout) {
      logger.info('🔄 Geocoding circuit breaker reset - attempting new requests');
      this.isOpen = false;
      this.failures = 0;
    }
    
    return !this.isOpen;
  }
};

const processGeocodeQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (requestQueue.length > 0) {
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    
    const { lat, lng, resolve, reject } = requestQueue.shift();
    lastRequestTime = Date.now();
    
    try {
      const result = await performReverseGeocode(lat, lng);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }
  
  isProcessingQueue = false;
};

const performReverseGeocode = async (lat, lng, retryCount = 0) => {
  // Check circuit breaker before attempting request
  if (!circuitBreaker.shouldAllowRequest()) {
    logger.debug(`⚡ Geocoding blocked by circuit breaker for ${lat}, ${lng}`);
    throw new Error('Circuit breaker open - geocoding temporarily disabled');
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
  
  try {
    // Use Netlify serverless function to proxy Nominatim API (avoids CORS issues)
    // In development, this will fall back to direct API call if function not available
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const apiUrl = isProduction 
      ? `/.netlify/functions/geocode?lat=${lat}&lng=${lng}`
      : `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`;
    
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: isProduction ? {
        'Accept': 'application/json'
      } : {
        'User-Agent': 'TrashDropCollectorApp/1.0',
        'Accept': 'application/json',
        'Accept-Language': 'en'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check if we got valid data
    if (data.error) {
      throw new Error(data.error);
    }
    
    // Extract meaningful address components
    let address = '';
    
    if (data.address) {
      const parts = [];
      
      // Add road/street
      if (data.address.road) parts.push(data.address.road);
      
      // Add house number if available
      if (data.address.house_number) {
        parts[0] = `${data.address.house_number} ${parts[0] || ''}`.trim();
      }
      
      // Add neighbourhood or suburb
      if (data.address.neighbourhood) {
        parts.push(data.address.neighbourhood);
      } else if (data.address.suburb) {
        parts.push(data.address.suburb);
      } else if (data.address.village) {
        parts.push(data.address.village);
      }
      
      // Add city/town
      if (data.address.city) {
        parts.push(data.address.city);
      } else if (data.address.town) {
        parts.push(data.address.town);
      } else if (data.address.county) {
        parts.push(data.address.county);
      }
      
      address = parts.filter(Boolean).join(', ');
    }
    
    // Fallback to display_name if no structured address
    if (!address && data.display_name) {
      // Take first 3 parts of display_name for brevity
      const parts = data.display_name.split(',').slice(0, 3).map(p => p.trim());
      address = parts.join(', ');
    }
    
    if (address) {
      logger.info(`✅ Geocoded: ${lat},${lng} → ${address.substring(0, 50)}`);
      // Record success with circuit breaker
      circuitBreaker.recordSuccess();
    }
    
    return address || null;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Record failure with circuit breaker
    circuitBreaker.recordFailure();
    
    // Better error logging with diagnostics (but less frequent due to circuit breaker)
    if (error.name === 'AbortError') {
      logger.warn(`⏱️ Geocoding timeout (${lat}, ${lng})`);
    } else if (error.message.includes('Failed to fetch')) {
      logger.warn(`🌐 Network/CORS error geocoding (${lat}, ${lng}) - Circuit breaker at ${circuitBreaker.failures}/${circuitBreaker.failureThreshold} failures`);
    } else if (!error.message.includes('Circuit breaker')) {
      logger.warn(`❌ Geocoding failed (${lat}, ${lng}):`, error.message);
    }
    
    // Retry once if it's a network error and we haven't retried yet
    if (retryCount === 0 && error.message.includes('Failed to fetch') && circuitBreaker.failures < circuitBreaker.failureThreshold) {
      logger.info(`🔄 Retrying geocode for ${lat}, ${lng}`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      return performReverseGeocode(lat, lng, 1);
    }
    
    throw error;
  }
}

/**
 * Reverse geocodes coordinates to a human-readable address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} Address string or formatted coordinates as fallback
 */
export const reverseGeocode = async (lat, lng) => {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return 'Location unavailable';
  }

  // Create cache key
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  
  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEOCODE_CACHE_DURATION) {
    return cached.address;
  }

  try {
    // Add to queue for rate limiting
    const address = await new Promise((resolve, reject) => {
      requestQueue.push({ lat, lng, resolve, reject });
      processGeocodeQueue();
    });
    
    // If we got an address, cache it
    if (address) {
      geocodeCache.set(cacheKey, {
        address,
        timestamp: Date.now()
      });
      return address;
    }
    
    // No address found, use coordinates
    // Fallback to formatted coordinates
    return formatCoordinates(lat, lng);
  } catch (error) {
    // Fallback to formatted coordinates on any error
    const coords = formatCoordinates(lat, lng);
    
    // Cache the coordinate fallback to avoid repeated failed requests
    geocodeCache.set(cacheKey, {
      address: coords,
      timestamp: Date.now()
    });
    
    return coords;
  }
};

/**
 * Formats a location string (handles both POINT() format and regular strings)
 * Synchronous version - returns coordinates for POINT() strings
 * @param {string} location - Location string (POINT() or address)
 * @returns {string} Formatted location
 */
export const formatLocation = (location) => {
  if (!location) return 'Location unavailable';
  
  // If it's a POINT() string, parse and format coordinates
  if (location.includes('POINT(')) {
    const coords = parsePointString(location);
    if (coords) {
      return formatCoordinates(coords.lat, coords.lng);
    }
    return 'Invalid location format';
  }
  
  // Otherwise, return as-is (it's already an address)
  return location;
};

/**
 * Formats a location string with reverse geocoding (async version)
 * Converts POINT() coordinates to actual addresses
 * @param {string} location - Location string (POINT() or address)
 * @returns {Promise<string>} Formatted address or location
 */
export const formatLocationAsync = async (location) => {
  if (!location) return 'Location unavailable';
  
  // If it's a POINT() string, parse and reverse geocode
  if (location.includes('POINT(')) {
    const coords = parsePointString(location);
    if (coords) {
      return await reverseGeocode(coords.lat, coords.lng);
    }
    return 'Invalid location format';
  }
  
  // Otherwise, return as-is (it's already an address)
  return location;
};
