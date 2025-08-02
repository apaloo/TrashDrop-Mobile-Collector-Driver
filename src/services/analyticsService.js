import { supabase, DEV_MODE } from './supabase';

// Mock data for dev mode
const mockCompletedPickups = [
  {
    id: 'mock-pickup-1',
    collector_id: 'dev-collector',
    picked_up_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    coordinates: [5.6037, -0.1870],
    fee: 50,
    waste_type: 'general',
    location: 'Test Location 1',
    bag_count: 2,
    special_instructions: 'Mock pickup 1',
    created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-pickup-2',
    collector_id: 'dev-collector',
    picked_up_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    accepted_at: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
    coordinates: [5.6038, -0.1871],
    fee: 75,
    waste_type: 'recyclable',
    location: 'Test Location 2',
    bag_count: 3,
    special_instructions: 'Mock pickup 2',
    created_at: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString()
  }
];

const mockAcceptedPickups = [
  {
    id: 'mock-accepted-1',
    collector_id: 'dev-collector',
    status: 'accepted',
    accepted_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    coordinates: [5.6039, -0.1872],
    fee: 60,
    waste_type: 'general',
    location: 'Test Location 3',
    bag_count: 1,
    special_instructions: 'Mock accepted 1',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  }
];

const mockAvailablePickups = [
  {
    id: 'mock-available-1',
    collector_id: null,
    status: 'available',
    coordinates: [5.6040, -0.1873],
    fee: 45,
    waste_type: 'general',
    location: 'Test Location 4',
    bag_count: 2,
    special_instructions: 'Mock available 1',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  }
];

/**
 * Analytics service for route optimization and performance metrics
 */
export class AnalyticsService {
  constructor(collectorId) {
    this.collectorId = collectorId;
  }

  /**
   * Get route performance analytics
   */
  async getRoutePerformanceAnalytics(timeframe = '7d') {
    try {
      if (DEV_MODE) {
        console.log('[DEV MODE] Using mock route performance data');
        return {
          success: true,
          data: {
            timeframe,
            totalPickups: mockCompletedPickups.length,
            totalDistance: mockCompletedPickups.length * 3.5,
            totalTime: mockCompletedPickups.length * 25,
            totalEarnings: mockCompletedPickups.reduce((sum, pickup) => sum + pickup.fee, 0),
            totalFuelConsumed: (mockCompletedPickups.length * 3.5) / 10,
            totalCo2Saved: ((mockCompletedPickups.length * 3.5) / 10) * 0.2 * 2.3,
            avgDistancePerPickup: 3.5,
            avgTimePerPickup: 25,
            avgEarningsPerPickup: mockCompletedPickups.reduce((sum, pickup) => sum + pickup.fee, 0) / mockCompletedPickups.length,
            fuelEfficiency: 10,
            timeEfficiency: 2.4,
            pickups: mockCompletedPickups
          }
        };
      }
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      // Fetch picked up (completed) requests for the collector
      const { data: completedPickups, error } = await supabase
        .from('pickup_requests')
        .select(`
          id,
          collector_id,
          picked_up_at,
          accepted_at,
          coordinates,
          fee,
          waste_type,
          location,
          bag_count,
          special_instructions,
          created_at
        `)
        .eq('collector_id', this.collectorId)
        .eq('status', 'picked_up')
        .gte('picked_up_at', startDate.toISOString())
        .lte('picked_up_at', endDate.toISOString())
        .order('picked_up_at', { ascending: false });

      if (error) throw error;

      // Calculate analytics with available data and estimates
      const totalPickups = completedPickups?.length || 0;
      const totalEarnings = completedPickups?.reduce((sum, pickup) => sum + (pickup.fee || 0), 0) || 0;
      const totalBags = completedPickups?.reduce((sum, pickup) => sum + (pickup.bag_count || 1), 0) || 0;
      
      // Estimate distances and times based on pickup data
      // These are estimates since the actual columns don't exist yet
      const avgDistancePerPickup = 3.5; // Average 3.5km per pickup (estimate)
      const avgTimePerPickup = 25; // Average 25 minutes per pickup (estimate)
      
      const totalDistance = totalPickups * avgDistancePerPickup;
      const totalTime = totalPickups * avgTimePerPickup;
      
      // Calculate fuel estimates (assuming 10 km/L average for tricycle)
      const totalFuelConsumed = totalDistance / 10;
      
      // Calculate CO2 savings estimate (2.3 kg CO2 per liter of fuel saved through optimization)
      const totalCo2Saved = totalFuelConsumed * 0.2 * 2.3; // 20% savings through optimization

      const avgEarningsPerPickup = totalPickups > 0 ? totalEarnings / totalPickups : 0;

      // Calculate efficiency metrics
      const fuelEfficiency = totalDistance > 0 ? totalDistance / totalFuelConsumed : 0;
      const timeEfficiency = totalTime > 0 ? totalPickups / (totalTime / 60) : 0; // pickups per hour

      return {
        success: true,
        data: {
          timeframe,
          totalPickups,
          totalDistance,
          totalTime,
          totalEarnings,
          totalFuelConsumed,
          totalCo2Saved,
          avgDistancePerPickup,
          avgTimePerPickup,
          avgEarningsPerPickup,
          fuelEfficiency,
          timeEfficiency,
          pickups: completedPickups || []
        }
      };

    } catch (error) {
      console.error('Error fetching route performance analytics:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Get current active route data
   */
  async getCurrentRouteData() {
    try {
      if (DEV_MODE) {
        console.log('[DEV MODE] Using mock route data');
        return {
          success: true,
          data: {
            assignments: mockAcceptedPickups.map(this._formatPickupData),
            requests: mockAvailablePickups.map(this._formatPickupData),
            totalAssignments: mockAcceptedPickups.length,
            totalRequests: mockAvailablePickups.length
          }
        };
      }
      // Get accepted pickups (current assignments)
      const { data: acceptedPickups, error } = await supabase
        .from('pickup_requests')
        .select(`
          id,
          collector_id,
          status,
          accepted_at,
          coordinates,
          fee,
          waste_type,
          location,
          bag_count,
          special_instructions,
          created_at
        `)
        .eq('collector_id', this.collectorId)
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: true });

      if (error) throw error;

      // Get available pickups in the area (requests)
      const { data: availablePickups, error: availableError } = await supabase
        .from('pickup_requests')
        .select(`
          id,
          status,
          coordinates,
          fee,
          waste_type,
          location,
          bag_count,
          special_instructions,
          created_at
        `)
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(50); // Limit to prevent too many markers

      if (availableError) throw availableError;

      // Transform the data to match expected format
      const assignments = (acceptedPickups || []).map(pickup => {
        // Parse coordinates if they're stored as JSON string
        let coords = pickup.coordinates;
        if (typeof coords === 'string') {
          try {
            coords = JSON.parse(coords);
          } catch (e) {
            coords = { lat: 0, lng: 0 };
          }
        }
        
        return {
          id: pickup.id,
          type: 'assignment',
          status: pickup.status,
          location: pickup.location || 'Unknown location',
          customer_name: `Customer #${pickup.id}`, // Generate customer name since it doesn't exist
          latitude: coords?.lat || 0,
          longitude: coords?.lng || 0,
          fee: pickup.fee || 0,
          waste_type: pickup.waste_type || 'general', // Use 'type' field
          special_instructions: pickup.special_instructions || '',
          bag_count: pickup.bag_count || 1,
          accepted_at: pickup.accepted_at,
          created_at: pickup.created_at
        };
      });

      const requests = (availablePickups || []).map(pickup => {
        // Parse coordinates if they're stored as JSON string
        let coords = pickup.coordinates;
        if (typeof coords === 'string') {
          try {
            coords = JSON.parse(coords);
          } catch (e) {
            coords = { lat: 0, lng: 0 };
          }
        }
        
        return {
          id: pickup.id,
          type: 'request',
          status: pickup.status,
          location: pickup.location || 'Unknown location',
          customer_name: `Customer #${pickup.id}`, // Generate customer name since it doesn't exist
          latitude: coords?.lat || 0,
          longitude: coords?.lng || 0,
          fee: pickup.fee || 0,
          waste_type: pickup.waste_type || 'general', // Use 'type' field
          special_instructions: pickup.special_instructions || '',
          bag_count: pickup.bag_count || 1,
          created_at: pickup.created_at
        };
      });

      return {
        success: true,
        data: {
          assignments,
          requests,
          totalAssignments: assignments.length,
          totalRequests: requests.length
        }
      };

    } catch (error) {
      console.error('Error fetching current route data:', error);
      return {
        success: false,
        error: error.message,
        data: {
          assignments: [],
          requests: [],
          totalAssignments: 0,
          totalRequests: 0
        }
      };
    }
  }

  /**
   * Log route optimization result for analytics
   */
  async logRouteOptimization(routeData) {
    try {
      if (DEV_MODE) {
        console.log('[DEV MODE] Simulating route optimization logging:', {
          collector_id: this.collectorId,
          timestamp: new Date().toISOString(),
          ...routeData
        });
        return {
          success: true,
          message: '[DEV MODE] Route optimization logged successfully'
        };
      }
      // This would typically be stored in a route_optimizations table
      // For now, we'll just console log it
      console.log('Route optimization logged:', {
        collector_id: this.collectorId,
        timestamp: new Date().toISOString(),
        ...routeData
      });

      return {
        success: true,
        message: 'Route optimization logged successfully'
      };

    } catch (error) {
      console.error('Error logging route optimization:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get collector session data
   */
  async getCollectorSession() {
    try {
      if (DEV_MODE) {
        console.log('[DEV MODE] Using mock collector session');
        return {
          success: true,
          data: {
            collector_id: this.collectorId,
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          }
        };
      }
      const { data, error } = await supabase
        .from('collector_sessions')
        .select('*')
        .eq('collector_id', this.collectorId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error is ok
        throw error;
      }

      return {
        success: true,
        data: data || null
      };

    } catch (error) {
      console.error('Error fetching collector session:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Format pickup data for consistent output
   */
  _formatPickupData(pickup) {
    // Parse coordinates if they're stored as JSON string
    let coords = pickup.coordinates;
    if (typeof coords === 'string') {
      try {
        coords = JSON.parse(coords);
      } catch (e) {
        coords = [0, 0];
      }
    }
    
    return {
      id: pickup.id,
      type: pickup.status === 'available' ? 'request' : 'assignment',
      status: pickup.status,
      location: pickup.location || 'Unknown location',
      customer_name: `Customer #${pickup.id}`,
      latitude: Array.isArray(coords) ? coords[0] : coords?.lat || 0,
      longitude: Array.isArray(coords) ? coords[1] : coords?.lng || 0,
      fee: pickup.fee || 0,
      waste_type: pickup.waste_type || 'general',
      special_instructions: pickup.special_instructions || '',
      bag_count: pickup.bag_count || 1,
      accepted_at: pickup.accepted_at,
      created_at: pickup.created_at
    };
  }
}

export const createAnalyticsService = (collectorId) => {
  return new AnalyticsService(collectorId);
};

export default AnalyticsService;
