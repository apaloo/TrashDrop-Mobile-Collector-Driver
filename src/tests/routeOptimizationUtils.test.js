/**
 * Tests for route optimization utilities
 */
import { 
  calculateNearestNeighborRoute, 
  calculateRouteDistance, 
  estimateRouteTime,
  generateDirectionsUrl
} from '../utils/routeOptimizationUtils';

describe('Route Optimization Utils', () => {
  // Sample test data
  const sampleAssignments = [
    {
      id: '1',
      latitude: 37.7749,
      longitude: -122.4194,
      location: 'San Francisco',
      customer_name: 'Customer 1'
    },
    {
      id: '2',
      latitude: 37.3382,
      longitude: -121.8863,
      location: 'San Jose',
      customer_name: 'Customer 2'
    },
    {
      id: '3',
      latitude: 37.8715,
      longitude: -122.2730,
      location: 'Berkeley',
      customer_name: 'Customer 3'
    }
  ];
  
  const startPosition = {
    lat: 37.7749,
    lng: -122.4194
  };
  
  describe('calculateNearestNeighborRoute', () => {
    test('should return empty array for empty input', () => {
      const result = calculateNearestNeighborRoute([], startPosition);
      expect(result).toEqual([]);
    });
    
    test('should return empty array for null input', () => {
      const result = calculateNearestNeighborRoute(null, startPosition);
      expect(result).toEqual([]);
    });
    
    test('should return a route with all assignments', () => {
      const result = calculateNearestNeighborRoute(sampleAssignments, startPosition);
      expect(result.length).toBe(sampleAssignments.length);
      
      // Check that all assignments are included in the result
      const resultIds = result.map(a => a.id);
      const originalIds = sampleAssignments.map(a => a.id);
      expect(resultIds.sort()).toEqual(originalIds.sort());
    });
    
    test('should start with the closest assignment to start position', () => {
      // Create test data where the order is known
      const testAssignments = [
        { id: 'far', latitude: 38.5, longitude: -123.5 },
        { id: 'medium', latitude: 38.0, longitude: -123.0 },
        { id: 'close', latitude: 37.8, longitude: -122.5 }
      ];
      
      const result = calculateNearestNeighborRoute(testAssignments, startPosition);
      expect(result[0].id).toBe('close');
    });
  });
  
  describe('calculateRouteDistance', () => {
    test('should return 0 for empty route', () => {
      const result = calculateRouteDistance([], startPosition);
      expect(result).toBe(0);
    });
    
    test('should return 0 for null route', () => {
      const result = calculateRouteDistance(null, startPosition);
      expect(result).toBe(0);
    });
    
    test('should calculate total distance for a route', () => {
      const route = calculateNearestNeighborRoute(sampleAssignments, startPosition);
      const distance = calculateRouteDistance(route, startPosition);
      
      // Distance should be positive
      expect(distance).toBeGreaterThan(0);
      
      // Distance should be a number
      expect(typeof distance).toBe('number');
    });
  });
  
  describe('estimateRouteTime', () => {
    test('should return 0 for empty route', () => {
      const result = estimateRouteTime([], startPosition);
      expect(result).toBe(0);
    });
    
    test('should return 0 for null route', () => {
      const result = estimateRouteTime(null, startPosition);
      expect(result).toBe(0);
    });
    
    test('should calculate estimated time for a route', () => {
      const route = calculateNearestNeighborRoute(sampleAssignments, startPosition);
      const time = estimateRouteTime(route, startPosition);
      
      // Time should be positive
      expect(time).toBeGreaterThan(0);
      
      // Time should be a number
      expect(typeof time).toBe('number');
    });
    
    test('should include pickup time in the calculation', () => {
      const route = [sampleAssignments[0]]; // Just one assignment
      
      // Calculate with different pickup times
      const time1 = estimateRouteTime(route, startPosition, 30, 10);
      const time2 = estimateRouteTime(route, startPosition, 30, 20);
      
      // Time2 should be greater than time1 by exactly 10 minutes
      expect(time2 - time1).toBe(10);
    });
  });
  
  describe('generateDirectionsUrl', () => {
    test('should return empty string for empty route', () => {
      const result = generateDirectionsUrl([], startPosition);
      expect(result).toBe('');
    });
    
    test('should return empty string for null route', () => {
      const result = generateDirectionsUrl(null, startPosition);
      expect(result).toBe('');
    });
    
    test('should generate a valid Google Maps URL', () => {
      const route = calculateNearestNeighborRoute(sampleAssignments, startPosition);
      const url = generateDirectionsUrl(route, startPosition);
      
      // URL should start with Google Maps URL
      expect(url).toContain('https://www.google.com/maps/dir/');
      
      // URL should contain origin
      expect(url).toContain(`origin=${startPosition.lat},${startPosition.lng}`);
      
      // URL should contain destination (last point in route)
      const lastPoint = route[route.length - 1];
      expect(url).toContain(`destination=${lastPoint.latitude},${lastPoint.longitude}`);
      
      // URL should contain travel mode
      expect(url).toContain('travelmode=driving');
    });
    
    test('should include waypoints for routes with multiple stops', () => {
      const route = calculateNearestNeighborRoute(sampleAssignments, startPosition);
      const url = generateDirectionsUrl(route, startPosition);
      
      // URL should contain waypoints if route has more than 1 point
      if (route.length > 1) {
        expect(url).toContain('waypoints=');
      }
    });
  });
});
