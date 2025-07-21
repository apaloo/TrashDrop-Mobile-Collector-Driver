import { supabase } from './supabase';

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
}

/**
 * Create analytics service instance
 */
export const createAnalyticsService = (collectorId) => {
  return new AnalyticsService(collectorId);
};

/**
 * Default export for convenience
 */
export default AnalyticsService;
