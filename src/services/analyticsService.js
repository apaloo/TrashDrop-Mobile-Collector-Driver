import { supabase } from './supabase';
import { logger } from '../utils/logger';

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
      logger.error('Error fetching route performance analytics:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Get current active route data - focuses on accepted pickup requests from Request page
   */
  async getCurrentRouteData() {
    try {
      logger.debug(`🔍 Fetching route data for collector: ${this.collectorId}`);

      // Get accepted pickup requests (from Request page Accepted tab)
      const { data: acceptedPickups, error: pickupsError } = await supabase
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

      if (pickupsError) {
        logger.error('❌ Error fetching accepted pickups:', pickupsError);
        throw pickupsError;
      }

      logger.info(`📦 Found ${acceptedPickups?.length || 0} accepted pickup requests for collector ${this.collectorId}`);
      
      // CRITICAL: Also get accepted digital bins (they're in a separate table!)
      // Digital bins have coordinates in a related bin_locations table
      // Use * to select all columns since the schema varies
      const { data: acceptedDigitalBins, error: binsError } = await supabase
        .from('digital_bins')
        .select(`
          *,
          bin_locations!location_id(
            coordinates
          )
        `)
        .eq('collector_id', this.collectorId)
        .eq('status', 'accepted')
        .order('created_at', { ascending: true });

      if (binsError) {
        logger.error('❌ Error fetching accepted digital bins:', binsError);
        throw binsError;
      }

      logger.info(`📦 Found ${acceptedDigitalBins?.length || 0} accepted digital bins for collector ${this.collectorId}`);
      
      // DIAGNOSTIC: Query ALL accepted items to see what collector_ids exist
      const { data: allAcceptedPickups, error: allError } = await supabase
        .from('pickup_requests')
        .select('id, collector_id, status, location')
        .eq('status', 'accepted');
      
      const { data: allAcceptedBins, error: allBinsError } = await supabase
        .from('digital_bins')
        .select('id, collector_id, status, location')
        .eq('status', 'accepted');
      
      const totalAccepted = (allAcceptedPickups?.length || 0) + (allAcceptedBins?.length || 0);
      
      if (totalAccepted > 0) {
        logger.info(`🔍 DIAGNOSTIC: Found ${totalAccepted} total accepted items in database:`);
        logger.info(`  - ${allAcceptedPickups?.length || 0} pickup requests`);
        logger.info(`  - ${allAcceptedBins?.length || 0} digital bins`);
        
        if (allAcceptedPickups && allAcceptedPickups.length > 0) {
          allAcceptedPickups.forEach(req => {
            const isMatch = req.collector_id === this.collectorId;
            logger.info(`  ${isMatch ? '✅' : '❌'} Pickup: ${req.id}, Collector: ${req.collector_id}, Match: ${isMatch}`);
          });
        }
        
        if (allAcceptedBins && allAcceptedBins.length > 0) {
          allAcceptedBins.forEach(bin => {
            const isMatch = bin.collector_id === this.collectorId;
            logger.info(`  ${isMatch ? '✅' : '❌'} Bin: ${bin.id}, Collector: ${bin.collector_id}, Match: ${isMatch}`);
          });
        }
      }
      
      // Log each accepted item for debugging
      const totalMyAccepted = (acceptedPickups?.length || 0) + (acceptedDigitalBins?.length || 0);
      
      if (totalMyAccepted > 0) {
        if (acceptedPickups && acceptedPickups.length > 0) {
          acceptedPickups.forEach(pickup => {
            logger.info(`  ✓ Pickup Request: ${pickup.id}, Status: ${pickup.status}`);
          });
        }
        if (acceptedDigitalBins && acceptedDigitalBins.length > 0) {
          acceptedDigitalBins.forEach(bin => {
            logger.info(`  ✓ Digital Bin: ${bin.id}, Status: ${bin.status}`);
          });
        }
      } else {
        logger.warn(`⚠️ No accepted items found for collector ${this.collectorId}`);
        logger.info('🔍 Troubleshooting: Queried both pickup_requests and digital_bins tables');
      }

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

      // Transform accepted pickup requests to assignment format
      const pickupAssignments = (acceptedPickups || []).map(pickup => {
        // Parse coordinates if they're stored as JSON string
        let coords = pickup.coordinates;
        if (typeof coords === 'string') {
          try {
            coords = JSON.parse(coords);
          } catch (e) {
            logger.warn(`Failed to parse coordinates for pickup ${pickup.id}:`, e);
            coords = { lat: 0, lng: 0 };
          }
        }
        
        return {
          id: pickup.id,
          type: 'assignment',
          source_type: 'pickup_request',
          status: pickup.status,
          location: pickup.location || 'Unknown location',
          customer_name: `Customer #${pickup.id}`,
          latitude: coords?.lat || 0,
          longitude: coords?.lng || 0,
          fee: pickup.fee || 0,
          waste_type: pickup.waste_type || 'general',
          special_instructions: pickup.special_instructions || '',
          bag_count: pickup.bag_count || 1,
          accepted_at: pickup.accepted_at,
          created_at: pickup.created_at
        };
      });

      // Transform accepted digital bins to assignment format
      const binAssignments = (acceptedDigitalBins || []).map(bin => {
        // Extract coordinates from the nested bin_locations object
        let coords = { lat: 0, lng: 0 };
        
        // DIAGNOSTIC: Log the bin structure to see what we're getting
        logger.info(`🔍 Processing bin ${bin.id}:`, {
          has_bin_locations: !!bin.bin_locations,
          bin_locations_type: typeof bin.bin_locations,
          bin_locations: bin.bin_locations,
          coordinates: bin.bin_locations?.coordinates
        });
        
        if (bin.bin_locations && bin.bin_locations.coordinates) {
          // Coordinates come from the joined bin_locations table
          const binCoords = bin.bin_locations.coordinates;
          logger.info(`📍 Found coordinates for bin ${bin.id}:`, binCoords);
          
          // Handle GeoJSON Point format (PostGIS returns this format)
          if (binCoords.type === 'Point' && Array.isArray(binCoords.coordinates) && binCoords.coordinates.length === 2) {
            // GeoJSON format: coordinates are [longitude, latitude]
            coords = { 
              lat: binCoords.coordinates[1],  // latitude is second
              lng: binCoords.coordinates[0]   // longitude is first
            };
            logger.info(`✅ Converted GeoJSON Point coordinates:`, coords);
          } else if (typeof binCoords === 'string') {
            try {
              coords = JSON.parse(binCoords);
              logger.info(`✅ Parsed string coordinates:`, coords);
            } catch (e) {
              logger.warn(`Failed to parse coordinates for bin ${bin.id}:`, e);
            }
          } else if (Array.isArray(binCoords) && binCoords.length === 2) {
            // Handle array format [lat, lng]
            coords = { lat: binCoords[0], lng: binCoords[1] };
            logger.info(`✅ Converted array coordinates:`, coords);
          } else if (binCoords.lat && binCoords.lng) {
            // Already in object format
            coords = binCoords;
            logger.info(`✅ Using object coordinates:`, coords);
          } else {
            logger.warn(`❌ Unknown coordinate format for bin ${bin.id}:`, typeof binCoords, binCoords);
          }
        } else {
          logger.warn(`❌ No bin_locations or coordinates for bin ${bin.id}`);
        }
        
        // Use actual digital_bins schema fields
        const wasteType = bin.waste_type || 'general';
        const binSize = bin.bin_size_liters || 120;
        const isUrgent = bin.is_urgent || false;
        const frequency = bin.frequency || 'weekly';
        
        return {
          id: bin.id,
          type: 'assignment',
          source_type: 'digital_bin',
          status: bin.status,
          location: bin.location || 'Unknown location',
          customer_name: `Digital Bin - ${wasteType}`,
          latitude: coords.lat || 0,
          longitude: coords.lng || 0,
          fee: bin.fee || 0,
          waste_type: wasteType,
          special_instructions: `${binSize}L bin, ${frequency} pickup${isUrgent ? ' (URGENT)' : ''}${bin.details ? `, ${bin.details}` : ''}`,
          bag_count: bin.bag_count || 1,
          accepted_at: bin.updated_at || bin.created_at,
          created_at: bin.created_at
        };
      });

      // Combine both types of assignments
      const assignments = [...pickupAssignments, ...binAssignments].sort((a, b) => {
        // Sort by accepted_at timestamp (oldest first), fallback to created_at
        const timeA = new Date(a.accepted_at || a.created_at);
        const timeB = new Date(b.accepted_at || b.created_at);
        return timeA - timeB;
      });

      logger.info(`✅ Transformed ${assignments.length} accepted items for route optimization (${pickupAssignments.length} pickups + ${binAssignments.length} bins)`);

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
      logger.error('Error fetching current route data:', error);
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
      // For now, we'll just log it
      logger.debug('Route optimization logged:', {
        collector_id: this.collectorId,
        timestamp: new Date().toISOString(),
        ...routeData
      });

      return {
        success: true,
        message: 'Route optimization logged successfully'
      };

    } catch (error) {
      logger.error('Error logging route optimization:', error);
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
      logger.error('Error fetching collector session:', error);
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
