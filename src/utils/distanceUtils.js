/**
 * Calculate distance between two points using the Haversine formula
 * @param {Array} start - Starting coordinates [lat, lng]
 * @param {Array} end - Ending coordinates [lat, lng]
 * @returns {number} - Distance in kilometers
 */
export const calculateDistance = (start, end) => {
  if (!start || !end || !Array.isArray(start) || !Array.isArray(end)) {
    console.warn('Invalid coordinates:', { start, end });
    return Infinity;
  }

  const [lat1, lon1] = start;
  const [lat2, lon2] = end;

  if (!lat1 || !lon1 || !lat2 || !lon2) {
    console.warn('Invalid coordinate values:', { start, end });
    return Infinity;
  }

  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Number(distance.toFixed(2));
};

/**
 * Convert degrees to radians
 * @param {number} value - Value in degrees
 * @returns {number} - Value in radians
 */
const toRad = (value) => (value * Math.PI) / 180;

/**
 * Format distance for display
 * @param {number} distance - Distance in kilometers
 * @returns {string} - Formatted distance string
 */
export const formatDistance = (distance) => {
  if (typeof distance !== 'number' || isNaN(distance)) return 'Unknown';
  if (distance === Infinity) return 'Too far';
  if (distance < 1) return `${Math.round(distance * 1000)}m`;
  return `${distance.toFixed(1)}km`;
};
