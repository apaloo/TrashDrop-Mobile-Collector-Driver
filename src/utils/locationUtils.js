/**
 * Location utility functions
 */

/**
 * Calculate the distance between two coordinates in meters using the Haversine formula
 * @param {Array|Object} coord1 - First coordinate [latitude, longitude] or {latitude, longitude}
 * @param {Array|Object} coord2 - Second coordinate [latitude, longitude] or {latitude, longitude}
 * @returns {Number} - Distance in meters
 */
export const calculateDistance = (coord1, coord2) => {
  // Handle both array format [lat, lng] and object format {latitude, longitude}
  const lat1 = Array.isArray(coord1) ? coord1[0] : coord1.latitude;
  const lon1 = Array.isArray(coord1) ? coord1[1] : coord1.longitude;
  const lat2 = Array.isArray(coord2) ? coord2[0] : coord2.latitude;
  const lon2 = Array.isArray(coord2) ? coord2[1] : coord2.longitude;
  
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance; // Distance in meters
};

/**
 * Check if user is within specified radius of a target location
 * @param {Array|Object} userCoords - User coordinates [latitude, longitude] or {latitude, longitude}
 * @param {Array|Object} targetCoords - Target coordinates [latitude, longitude] or {latitude, longitude}
 * @param {Number} radiusMeters - Radius in meters
 * @returns {Boolean} - True if within radius, false otherwise
 */
export const isWithinRadius = (userCoords, targetCoords, radiusMeters) => {
  const distance = calculateDistance(userCoords, targetCoords);
  return distance <= radiusMeters;
};
