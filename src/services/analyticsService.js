import { supabase } from './supabase';
import { logger } from '../utils/logger';

/**
 * Parse coordinates from any format into { lat, lng }.
 * Returns null if coordinates are invalid or at [0, 0] (Gulf of Guinea).
 * Handles: arrays [lat, lng], objects {lat, lng}/{latitude, longitude},
 * GeoJSON Point, JSON strings, and comma-separated strings.
 */
const parseCoordinates = (raw) => {
  if (!raw) return null;

  let coords = raw;

  // 1. String → try JSON parse, then comma-separated
  if (typeof coords === 'string') {
    try {
      coords = JSON.parse(coords);
    } catch {
      // Try "lat,lng" format
      const parts = coords.split(',').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coords = { lat: parts[0], lng: parts[1] };
      } else {
        return null;
      }
    }
  }

  let lat, lng;

  // 2. GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
  if (coords?.type === 'Point' && Array.isArray(coords.coordinates) && coords.coordinates.length === 2) {
    lng = coords.coordinates[0];
    lat = coords.coordinates[1];
  }
  // 3. Array: [lat, lng]
  else if (Array.isArray(coords) && coords.length === 2) {
    lat = coords[0];
    lng = coords[1];
  }
  // 4. Object with lat/lng (or latitude/longitude)
  else if (coords && typeof coords === 'object') {
    lat = coords.lat ?? coords.latitude;
    lng = coords.lng ?? coords.longitude;
  }

  lat = Number(lat);
  lng = Number(lng);

  // Reject NaN, [0,0], or clearly out-of-range values
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat === 0 && lng === 0) return null;           // Gulf of Guinea
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat, lng };
};

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
        .in('status', ['accepted', 'en_route', 'arrived'])
        .order('accepted_at', { ascending: true });

      if (pickupsError) {
        logger.error('❌ Error fetching accepted pickups:', pickupsError);
        throw pickupsError;
      }

      logger.info(`📦 Found ${acceptedPickups?.length || 0} accepted pickup requests for collector ${this.collectorId}`);
      
      // CRITICAL: Also get accepted digital bins (they're in a separate table!)
      // Digital bins have coordinates in a related bin_locations table
      // Use * to select all columns since the schema varies
      let acceptedDigitalBins = [];
      
      try {
        const { data: binsData, error: binsError } = await supabase
          .from('digital_bins')
          .select(`
            *,
            bin_locations!location_id(
              coordinates,
              location_name
            )
          `)
          .eq('collector_id', this.collectorId)
          .in('status', ['accepted', 'en_route', 'arrived'])
          .order('created_at', { ascending: true });

        if (binsError) {
          // Check if it's a relationship/table error
          if (binsError.code === '42P01' || binsError.message?.includes('bin_locations') || binsError.message?.includes('location_id')) {
            logger.warn('⚠️ bin_locations table or relationship not found. Skipping digital bins.');
            logger.info('💡 Digital bins feature requires bin_locations table setup.');
            // Continue without digital bins - not a critical error
            acceptedDigitalBins = [];
          } else {
            // Other errors should still throw
            logger.error('❌ Error fetching accepted digital bins:', binsError);
            throw binsError;
          }
        } else {
          acceptedDigitalBins = binsData || [];
        }
      } catch (error) {
        // Gracefully handle any bin_locations related errors
        logger.warn('⚠️ Could not fetch digital bins:', error.message);
        logger.info('📍 Continuing with pickup requests only');
        acceptedDigitalBins = [];
      }

      logger.info(`📦 Found ${acceptedDigitalBins?.length || 0} accepted digital bins for collector ${this.collectorId}`);
      
      // DIAGNOSTIC: Query ALL accepted items to see what collector_ids exist
      const { data: allAcceptedPickups, error: allError } = await supabase
        .from('pickup_requests')
        .select('id, collector_id, status, location')
        .in('status', ['accepted', 'en_route', 'arrived']);
      
      const { data: allAcceptedBins, error: allBinsError } = await supabase
        .from('digital_bins')
        .select('id, collector_id, status, location')
        .in('status', ['accepted', 'en_route', 'arrived']);
      
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
      // Filter out any with unparseable coordinates to prevent route-from-the-sea bug
      const pickupAssignments = (acceptedPickups || []).map(pickup => {
        const coords = parseCoordinates(pickup.coordinates);
        if (!coords) {
          logger.warn(`⚠️ Skipping pickup ${pickup.id} — invalid coordinates:`, pickup.coordinates);
        }
        return {
          id: pickup.id,
          type: 'assignment',
          source_type: 'pickup_request',
          status: pickup.status,
          location: pickup.location || 'Unknown location',
          customer_name: `Customer #${pickup.id}`,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          fee: pickup.fee || 0,
          waste_type: pickup.waste_type || 'general',
          special_instructions: pickup.special_instructions || '',
          bag_count: pickup.bag_count || 1,
          accepted_at: pickup.accepted_at,
          created_at: pickup.created_at
        };
      }).filter(a => a.latitude !== null && a.longitude !== null);

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
        
        // Get location name from joined bin_locations table
        const locationName = bin.bin_locations?.location_name || 'Digital Bin Station';
        
        // Re-parse through the shared helper to catch [0,0] and NaN
        const validCoords = parseCoordinates(coords);
        if (!validCoords) {
          logger.warn(`⚠️ Skipping digital bin ${bin.id} — invalid coordinates:`, coords);
        }

        return {
          id: bin.id,
          type: 'assignment',
          source_type: 'digital_bin',
          status: bin.status,
          location: locationName,
          customer_name: `Digital Bin - ${wasteType}`,
          latitude: validCoords?.lat ?? null,
          longitude: validCoords?.lng ?? null,
          fee: bin.fee || 0,
          waste_type: wasteType,
          special_instructions: `${binSize}L bin, ${frequency} pickup${isUrgent ? ' (URGENT)' : ''}${bin.details ? `, ${bin.details}` : ''}`,
          bag_count: bin.bag_count || 1,
          accepted_at: bin.updated_at || bin.created_at,
          created_at: bin.created_at
        };
      });

      // Combine both types of assignments, filtering out any with null coords
      const assignments = [...pickupAssignments, ...binAssignments.filter(b => b.latitude !== null && b.longitude !== null)].sort((a, b) => {
        // Sort by accepted_at timestamp (oldest first), fallback to created_at
        const timeA = new Date(a.accepted_at || a.created_at);
        const timeB = new Date(b.accepted_at || b.created_at);
        return timeA - timeB;
      });

      logger.info(`✅ Transformed ${assignments.length} accepted items for route optimization (${pickupAssignments.length} pickups + ${binAssignments.length} bins)`);

      const requests = (availablePickups || []).map(pickup => {
        const coords = parseCoordinates(pickup.coordinates);
        if (!coords) {
          logger.warn(`⚠️ Skipping available pickup ${pickup.id} — invalid coordinates:`, pickup.coordinates);
        }
        return {
          id: pickup.id,
          type: 'request',
          status: pickup.status,
          location: pickup.location || 'Unknown location',
          customer_name: `Customer #${pickup.id}`,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          fee: pickup.fee || 0,
          waste_type: pickup.waste_type || 'general', // Use 'type' field
          special_instructions: pickup.special_instructions || '',
          bag_count: pickup.bag_count || 1,
          created_at: pickup.created_at
        };
      }).filter(r => r.latitude !== null && r.longitude !== null);

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
    const coords = parseCoordinates(pickup.coordinates);
    
    return {
      id: pickup.id,
      type: pickup.status === 'available' ? 'request' : 'assignment',
      status: pickup.status,
      location: pickup.location || 'Unknown location',
      customer_name: `Customer #${pickup.id}`,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
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
