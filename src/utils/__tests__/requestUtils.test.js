import { transformRequestsData } from '../requestUtils';

describe('transformRequestsData', () => {
  const mockUserLocation = { lat: 1.2, lng: 3.4 };
  const mockDisposalCenter = { lat: 1.0, lng: 2.0 };
  
  // Mock data
  const mockRawData = [
    {
      id: '1',
      location: 'Test Location 1',
      coordinates: { lat: 1.21, lng: 3.39 }, // ~1.11km from user
      status: 'available',
      created_at: '2023-01-01T10:00:00Z'
    },
    {
      id: '2',
      location: 'Test Location 2',
      coordinates: { lat: 1.22, lng: 3.40 }, // ~2.22km from user
      status: 'available',
      created_at: '2023-01-02T10:00:00Z'
    },
    {
      id: '3',
      location: 'Test Location 3',
      coordinates: { lat: 1.23, lng: 3.41 }, // ~3.33km from user
      status: 'accepted',
      created_at: '2023-01-03T10:00:00Z'
    },
  ];

  // Mock calculateDistance function
  const calculateDistance = (coord1, coord2) => {
    // Simple distance calculation for testing
    const latDiff = Math.abs(coord1.lat - coord2.lat);
    const lngDiff = Math.abs(coord1.lng - coord2.lng);
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 100; // Scale for km
  };

  beforeEach(() => {
    // Mock the calculateDistance function
    jest.mock('../../utils/geoUtils', () => ({
      calculateDistance: jest.fn((coord1, coord2) => {
        const latDiff = Math.abs(coord1.lat - coord2.lat);
        const lngDiff = Math.abs(coord1.lng - coord2.lng);
        return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 100;
      })
    }));
  });

  it('should handle empty input', () => {
    const result = transformRequestsData([], false, null, mockUserLocation, mockDisposalCenter);
    expect(result).toEqual([]);
  });

  it('should transform data with default values', () => {
    const result = transformRequestsData(
      [{ id: '1', coordinates: { lat: 1, lng: 2 } }],
      false,
      null,
      mockUserLocation,
      mockDisposalCenter
    );
    
    expect(result[0]).toMatchObject({
      id: '1',
      location: 'Unknown location',
      bags: 1,
      status: 'pending',
      type: 'General'
    });
  });

  it('should filter by status', () => {
    const result = transformRequestsData(
      mockRawData,
      false,
      'accepted',
      mockUserLocation,
      mockDisposalCenter
    );
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('accepted');
  });

  it('should filter by radius', () => {
    // Update test data to have two points within 2km of mockUserLocation
    const testData = [
      {
        id: '1',
        location: 'Test Location 1',
        coordinates: { lat: 1.21, lng: 3.39 }, // ~1.11km from user
        status: 'available',
        created_at: '2023-01-01T10:00:00Z'
      },
      {
        id: '2',
        location: 'Test Location 2',
        coordinates: { lat: 1.22, lng: 3.41 }, // ~2.22km from user
        status: 'available',
        created_at: '2023-01-02T10:00:00Z'
      },
      {
        id: '3',
        location: 'Test Location 3',
        coordinates: { lat: 1.5, lng: 3.5 }, // Far away
        status: 'available',
        created_at: '2023-01-03T10:00:00Z'
      }
    ];

    const result = transformRequestsData(
      testData,
      true,
      null,
      mockUserLocation,
      mockDisposalCenter,
      { searchRadius: 2.5 } // Increased radius to include both test points
    );
    
    // Only items within 2.5km radius should be included
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toContain('1');
    expect(result.map(r => r.id)).toContain('2');
  });

  it('should sort by date and distance', () => {
    const result = transformRequestsData(
      mockRawData,
      false,
      null,
      mockUserLocation,
      mockDisposalCenter
    );
    
    // Should be sorted by date (newest first) then by distance
    expect(result[0].id).toBe('3');
    expect(result[1].id).toBe('2');
    expect(result[2].id).toBe('1');
  });

  it('should handle missing user location', () => {
    const result = transformRequestsData(
      mockRawData,
      false,
      null,
      null,
      mockDisposalCenter
    );
    
    // Should still process but show unknown distance
    expect(result[0].distance).toBe('Unknown distance');
    expect(result[0].distanceValue).toBe(999999);
  });
});
