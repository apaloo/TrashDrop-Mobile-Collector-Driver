/**
 * @fileoverview Route optimization utilities for the TrashDrop Mobile Collector Driver app
 * 
 * This module provides functions for optimizing collection routes, calculating distances,
 * estimating completion times, and generating navigation URLs. It uses the Nearest Neighbor
 * algorithm for route optimization, which is a simple greedy approach that always selects
 * the closest next point. While not guaranteed to find the absolute optimal route (which would
 * require solving the NP-hard Traveling Salesman Problem), it provides a good approximation
 * with reasonable performance characteristics for the typical number of assignments a driver
 * would handle in a day.
 * 
 * @module routeOptimizationUtils
 * @requires locationUtils
 * @author TrashDrop Development Team
 * @version 1.0.0
 */
import { calculateDistance } from './locationUtils';

/**
 * Calculate the nearest neighbor route for a set of assignments.
 * This is a simple greedy algorithm that always chooses the closest next point.
 * 
 * The algorithm works as follows:
 * 1. Start from the current position
 * 2. Find the nearest unvisited assignment
 * 3. Add it to the route
 * 4. Update current position to the selected assignment
 * 5. Repeat steps 2-4 until all assignments are visited
 * 
 * Time complexity: O(n²) where n is the number of assignments
 * Space complexity: O(n)
 * 
 * @param {Array} assignments - Array of assignment objects with lat/lng coordinates
 * @param {Object} startPosition - Starting position with lat/lng coordinates
 * @param {number} startPosition.lat - Latitude of starting position
 * @param {number} startPosition.lng - Longitude of starting position
 * @returns {Array} - Ordered array of assignments in optimized route order
 * @example
 * const assignments = [
 *   { id: '1', latitude: 37.7749, longitude: -122.4194 },
 *   { id: '2', latitude: 37.3382, longitude: -121.8863 }
 * ];
 * const startPosition = { lat: 37.7749, lng: -122.4194 };
 * const route = calculateNearestNeighborRoute(assignments, startPosition);
 */
export const calculateNearestNeighborRoute = (assignments, startPosition) => {
  if (!assignments || assignments.length === 0) {
    return [];
  }
  
  // Create a copy of assignments to work with
  const unvisited = [...assignments];
  const route = [];
  
  // Start from the current position
  let currentPosition = startPosition;
  
  // Continue until all assignments are visited
  while (unvisited.length > 0) {
    // Find the nearest unvisited assignment
    let nearestIndex = 0;
    let shortestDistance = calculateDistance(
      { latitude: currentPosition.lat, longitude: currentPosition.lng },
      { latitude: unvisited[0].latitude, longitude: unvisited[0].longitude }
    );
    
    for (let i = 1; i < unvisited.length; i++) {
      const distance = calculateDistance(
        { latitude: currentPosition.lat, longitude: currentPosition.lng },
        { latitude: unvisited[i].latitude, longitude: unvisited[i].longitude }
      );
      
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestIndex = i;
      }
    }
    
    // Add the nearest assignment to the route
    const nextAssignment = unvisited[nearestIndex];
    route.push(nextAssignment);
    
    // Update current position
    currentPosition = {
      lat: nextAssignment.latitude,
      lng: nextAssignment.longitude
    };
    
    // Remove the visited assignment
    unvisited.splice(nearestIndex, 1);
  }
  
  return route;
};

/**
 * Calculate the total distance of a route.
 * 
 * Computes the sum of distances between consecutive points in the route,
 * starting from the provided start position to the first assignment,
 * then between each assignment in the route order.
 * 
 * @param {Array} route - Array of assignment objects with lat/lng coordinates in route order
 * @param {Object} startPosition - Starting position with lat/lng coordinates
 * @param {number} startPosition.lat - Latitude of starting position
 * @param {number} startPosition.lng - Longitude of starting position
 * @returns {number} - Total distance in kilometers
 * @example
 * const route = [
 *   { id: '1', latitude: 37.7749, longitude: -122.4194 },
 *   { id: '2', latitude: 37.3382, longitude: -121.8863 }
 * ];
 * const startPosition = { lat: 37.7749, lng: -122.4194 };
 * const distance = calculateRouteDistance(route, startPosition);
 * // Returns: distance in kilometers
 */
export const calculateRouteDistance = (route, startPosition) => {
  if (!route || route.length === 0) {
    return 0;
  }
  
  let totalDistance = 0;
  let currentPosition = startPosition;
  
  // Calculate distance between each point in the route
  for (const assignment of route) {
    totalDistance += calculateDistance(
      { latitude: currentPosition.lat, longitude: currentPosition.lng },
      { latitude: assignment.latitude, longitude: assignment.longitude }
    );
    
    currentPosition = {
      lat: assignment.latitude,
      lng: assignment.longitude
    };
  }
  
  return totalDistance;
};

/**
 * Estimate the time required to complete a route.
 * 
 * Calculates the estimated completion time based on:
 * 1. Travel time between locations (distance ÷ speed)
 * 2. Time spent at each pickup location
 * 
 * The formula is:
 * Total time = Travel time + (Number of pickups × Average pickup time)
 * 
 * @param {Array} route - Array of assignment objects with lat/lng coordinates in route order
 * @param {Object} startPosition - Starting position with lat/lng coordinates
 * @param {number} startPosition.lat - Latitude of starting position
 * @param {number} startPosition.lng - Longitude of starting position
 * @param {number} [averageSpeed=30] - Average speed in km/h
 * @param {number} [averagePickupTime=10] - Average time to complete a pickup in minutes
 * @returns {number} - Estimated time in minutes (rounded to nearest integer)
 * @example
 * const route = [
 *   { id: '1', latitude: 37.7749, longitude: -122.4194 },
 *   { id: '2', latitude: 37.3382, longitude: -121.8863 }
 * ];
 * const startPosition = { lat: 37.7749, lng: -122.4194 };
 * const time = estimateRouteTime(route, startPosition, 25, 15);
 * // Returns: estimated time in minutes with 25 km/h speed and 15 min per pickup
 */
export const estimateRouteTime = (route, startPosition, averageSpeed = 30, averagePickupTime = 10) => {
  if (!route || route.length === 0) {
    return 0;
  }
  
  // Calculate total distance
  const totalDistance = calculateRouteDistance(route, startPosition);
  
  // Calculate travel time (distance / speed * 60 to convert to minutes)
  const travelTime = (totalDistance / averageSpeed) * 60;
  
  // Add pickup time for each assignment
  const totalPickupTime = route.length * averagePickupTime;
  
  return Math.round(travelTime + totalPickupTime);
};

/**
 * Generate an OSRM (Open Source Routing Machine) directions URL for a route.
 * 
 * Creates a URL that can be opened in a web browser or OSM-compatible app to navigate
 * through the optimized route using the OSRM service.
 * 
 * @param {Array} route - Array of assignment objects with lat/lng coordinates in route order
 * @param {Object} startPosition - Starting position with lat/lng coordinates
 * @param {number} startPosition.lat - Latitude of starting position
 * @param {number} startPosition.lng - Longitude of starting position
 * @returns {string} - OSRM directions URL
 * @example
 * const route = [
 *   { id: '1', latitude: 37.7749, longitude: -122.4194 },
 *   { id: '2', latitude: 37.3382, longitude: -121.8863 }
 * ];
 * const startPosition = { lat: 37.7749, lng: -122.4194 };
 * const url = generateDirectionsUrl(route, startPosition);
 * // Returns: https://www.openstreetmap.org/directions?engine=graphhopper_car&route=37.7749,-122.4194;37.3382,-121.8863
 */
export const generateDirectionsUrl = (route, startPosition) => {
  if (!route || route.length === 0) {
    return '';
  }
  
  // Start with the origin
  let coordinates = `${startPosition.lng},${startPosition.lat}`;
  
  // Add all route points
  route.forEach(assignment => {
    coordinates += `;${assignment.longitude},${assignment.latitude}`;
  });
  
  // Create OSRM URL using GraphHopper (OSM-based routing)
  return `https://www.openstreetmap.org/directions?engine=graphhopper_car&route=${coordinates}`;
};
