import { calculateDistance } from './distanceUtils';
import { logger } from './logger';

/**
 * Filter requests based on current filters and user position
 * @param {Array} requests - Array of request objects
 * @param {Object} filters - Current filter settings
 * @param {Array} position - User's current position [lat, lng]
 * @returns {Array} - Filtered requests
 */
export const filterRequests = (requests, filters, position) => {
  if (!requests || !Array.isArray(requests)) return [];

  return requests.filter(request => {
    // Skip invalid requests
    if (!request || !request.coordinates || !Array.isArray(request.coordinates)) {
      logger.warn('Invalid request:', request);
      return false;
    }

    // Distance filter
    if (position && filters.maxDistance) {
      const distance = calculateDistance(position, request.coordinates);
      if (distance > filters.maxDistance) return false;
    }

    // Waste type filter
    if (filters.wasteType && filters.wasteType !== 'all') {
      if (request.type !== filters.wasteType) return false;
    }

    // Payment filter
    if (filters.payment && filters.payment !== 'all') {
      if (request.payment_type !== filters.payment) return false;
    }

    // Priority filter
    if (filters.priority && filters.priority !== 'all') {
      if (request.priority !== filters.priority) return false;
    }

    return true;
  });
};
