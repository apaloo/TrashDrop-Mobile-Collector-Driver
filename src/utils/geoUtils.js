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

// Default location (Accra, Ghana)
const DEFAULT_LOCATION = {
  lat: 5.6037,
  lng: -0.1870
};

/**
 * Gets the user's current location with fallback to default location
 * @returns {Promise<{lat: number, lng: number, isFallback: boolean}>} User's coordinates with fallback flag
 */
export const getCurrentLocation = () => {
  return new Promise((resolve) => {
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
        console.warn('🌍 Google Geolocation failed:', error);
        // Let it fall through to browser geolocation
      }
      return null;
    };

    // Fallback to browser geolocation
    const tryBrowserGeolocation = () => {
      return new Promise((geoResolve) => {
        if (!navigator.geolocation) {
          console.warn('📱 Browser geolocation not supported');
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
            console.warn(`📍 Browser location error (${error.code}):`, error.message);
            geoResolve(null);
          },
          options
        );
      });
    };

    // Try both methods in sequence
    const getLocation = async () => {
      try {
        // Try Google Maps first
        const googleLocation = await tryGoogleGeolocation();
        if (googleLocation) {
          console.log('✅ Using Google Maps location');
          resolve(googleLocation);
          return;
        }

        // Fall back to browser geolocation
        const browserLocation = await tryBrowserGeolocation();
        if (browserLocation) {
          console.log('✅ Using browser geolocation');
          resolve(browserLocation);
          return;
        }

        // If both fail, use default location
        console.warn('⚠️ All geolocation methods failed, using default location');
        resolve({ ...DEFAULT_LOCATION, isFallback: true, source: 'default' });
      } catch (error) {
        console.error('❌ Critical geolocation error:', error);
        resolve({ ...DEFAULT_LOCATION, isFallback: true, source: 'default' });
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
      console.log(`🔄 Location attempt ${i + 1}/${maxRetries}`);
      const location = await getCurrentLocation();
      
      // If we got a non-fallback location, return it immediately
      if (!location.isFallback) {
        console.log(`✅ Got location from ${location.source}`);
        return location;
      }
      
      // If this isn't the last attempt, wait before trying again
      if (i < maxRetries - 1) {
        console.log(`⏳ Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error;
      console.warn(`❌ Attempt ${i + 1} failed:`, error);
      
      // If this isn't the last attempt, wait before trying again
      if (i < maxRetries - 1) {
        console.log(`⏳ Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All attempts failed
  console.warn('⚠️ All location attempts failed, using default location', lastError);
  return { 
    ...DEFAULT_LOCATION, 
    isFallback: true,
    source: 'default',
    error: lastError?.message
  };
};
