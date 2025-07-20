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
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by your browser, using default location');
      resolve({ ...DEFAULT_LOCATION, isFallback: true });
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 8000,  // Reduced from 10s to 8s
      maximumAge: 30000
    };

    const onSuccess = (position) => {
      resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        isFallback: false
      });
    };

    const onError = (error) => {
      console.warn(`Location error (${error.code}): ${error.message}`);
      // Fall back to default location
      resolve({ ...DEFAULT_LOCATION, isFallback: true });
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
  });
};

/**
 * Gets the current location with retry logic
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<{lat: number, lng: number, isFallback: boolean}>}
 */
export const getLocationWithRetry = async (maxRetries = 2, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const location = await getCurrentLocation();
      if (!location.isFallback) {
        return location;
      }
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) {
        console.warn('All location attempts failed, using default location');
        return { ...DEFAULT_LOCATION, isFallback: true };
      }
    }
  }
  return { ...DEFAULT_LOCATION, isFallback: true };
};
