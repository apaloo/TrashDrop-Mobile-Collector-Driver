import { calculateDistance } from './geoUtils';
import { logger } from './logger';

/**
 * Transforms raw request data into the format needed by the UI
 * @param {Array} rawData - Array of raw request objects
 * @param {boolean} filterByRadius - Whether to filter by radius
 * @param {string|null} status - Status to filter by (optional)
 * @param {Object|null} userLocation - User's current location
 * @param {Object} disposalCenter - Disposal center coordinates
 * @param {Object} filters - Filter options
 * @returns {Array} Transformed and filtered requests
 */
export const transformRequestsData = (
  rawData,
  filterByRadius = false,
  status = null,
  userLocation = null,
  disposalCenter = { lat: 1.0, lng: 2.0 },
  filters = { searchRadius: 10 }
) => {
  if (!rawData) return [];
  
  const transformedData = rawData
    .map(item => {
      let distanceFromUser = 'N/A';
      let distanceValue = 999999;
      
      // Calculate distance from user if possible
      if (userLocation && item.coordinates?.lat && item.coordinates?.lng) {
        try {
          const distance = calculateDistance(
            { lat: item.coordinates.lat, lng: item.coordinates.lng },
            userLocation
          );
          distanceFromUser = distance.toFixed(1);
          distanceValue = parseFloat(distance);
        } catch (error) {
          logger.warn('Error calculating distance:', error);
        }
      }
      
      // Calculate distance to disposal center
      let distanceToDisposal = null;
      try {
        if (item.coordinates?.lat && item.coordinates?.lng) {
          distanceToDisposal = calculateDistance(
            item.coordinates,
            disposalCenter
          );
        }
      } catch (error) {
        logger.warn('Error calculating disposal distance:', error);
      }
      
      return {
        id: item.id,
        location: item.location || 'Unknown location',
        coordinates: item.coordinates || null,
        bags: item.bags || 1,
        points: item.points || Math.floor(Math.random() * 50) + 50,
        fee: item.fee || ((Math.random() * 10) + 5).toFixed(2),
        status: item.status || 'pending',
        created_at: item.created_at || new Date().toISOString(),
        accepted_at: item.accepted_at || null,
        picked_up_at: item.picked_up_at || null,
        completed_at: item.completed_at || null,
        distance: distanceFromUser === 'N/A' ? 'Unknown distance' : `${distanceFromUser} km away`,
        distanceValue,
        distanceToDisposal,
        type: item.type || 'General',
        scanned_bags: item.scanned_bags || [],
        disposal_complete: item.disposal_complete || false,
        disposal_site: item.disposal_site || null,
        disposal_timestamp: item.disposal_timestamp || null,
        environmental_impact: item.environmental_impact || null
      };
    })
    .filter(item => {
      // Apply status filter if provided
      if (status && item.status !== status) return false;
      
      // Apply radius filter if enabled and user location is available
      if (filterByRadius && userLocation) {
        return item.distanceValue <= (filters?.searchRadius || 10);
      }
      
      return true;
    });
  
  // Sort by created_at (newest first) and then by distance to disposal center
  return [...transformedData].sort((a, b) => {
    // First sort by date (newest first)
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    if (dateB - dateA !== 0) return dateB - dateA;
    
    // If dates are equal, sort by distance to disposal center (nearest first)
    if (a.distanceToDisposal !== null && b.distanceToDisposal !== null) {
      return a.distanceToDisposal - b.distanceToDisposal;
    }
    
    // If disposal distances aren't available, sort by distance from user
    return a.distanceValue - b.distanceValue;
  });
};
