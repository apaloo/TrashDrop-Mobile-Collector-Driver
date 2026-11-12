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
    
    test('should generate an OpenStreetMap directions URL', () => {
      const route = calculateNearestNeighborRoute(sampleAssignments, startPosition);
      const url = generateDirectionsUrl(route, startPosition);

      expect(url.startsWith('https://www.openstreetmap.org/directions?engine=graphhopper_car&route=')).toBe(true);
    });

    test('lists the start, then each stop in route order, as latitude,longitude', () => {
      const route = calculateNearestNeighborRoute(sampleAssignments, startPosition);
      const url = generateDirectionsUrl(route, startPosition);
      const points = url.split('route=')[1].split(';');

      expect(points[0]).toBe(`${startPosition.lat},${startPosition.lng}`);
      expect(points.slice(1)).toEqual(route.map(stop => `${stop.latitude},${stop.longitude}`));
    });

    test('an Accra pickup stays in Accra (latitude first)', () => {
      const accra = { lat: 5.6037, lng: -0.187 };
      const url = generateDirectionsUrl([{ id: 'a', latitude: 5.6145, longitude: -0.2057 }], accra);

      expect(url.endsWith('route=5.6037,-0.187;5.6145,-0.2057')).toBe(true);
    });
  });
});
