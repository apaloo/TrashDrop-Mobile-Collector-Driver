import { supabase } from './supabase';
import { logger } from '../utils/logger';

/**
 * Location Broadcasting Service
 * Broadcasts collector's real-time location to users during active pickups
 */
class LocationBroadcastService {
  constructor() {
    this.isTracking = false;
    this.locationInterval = null;
    this.currentRequestId = null;
    this.requestTable = 'pickup_requests';
    this.collectorId = null;
    this.BROADCAST_INTERVAL = 10000; // 10 seconds
    this.STATUS_CHECK_EVERY = 6; // broadcasts (about once a minute)
    this.broadcastCount = 0;
    this.hasNotifiedEnRoute = false;
    this.lastSentEta = null;
    this.lastEtaSentAt = 0;
  }

  /**
   * Start broadcasting location for an active pickup request or digital bin
   */
  async startTracking(requestId, collectorId, sourceType = 'pickup_request') {
    if (this.isTracking) {
      if (this.currentRequestId === requestId) return;
      // Switching to another job: stop the old one so its user stops getting updates
      this.stopTracking();
    }

    this.currentRequestId = requestId;
    this.requestTable = sourceType === 'digital_bin' ? 'digital_bins' : 'pickup_requests';
    this.collectorId = collectorId;
    this.isTracking = true;

    logger.info('📍 Starting location tracking for request:', requestId);

    // Immediate first broadcast
    await this.broadcastLocation();

    // Set up periodic broadcasts
    this.locationInterval = setInterval(async () => {
      await this.broadcastLocation();
    }, this.BROADCAST_INTERVAL);
  }

  /**
   * Stop broadcasting location
   */
  stopTracking() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }

    this.isTracking = false;
    this.currentRequestId = null;
    this.broadcastCount = 0;
    this.hasNotifiedEnRoute = false;
    this.lastSentEta = null;
    this.lastEtaSentAt = 0;
    
    logger.info('🛑 Stopped location tracking');
  }

  /**
   * Fallback: update collector_profiles directly without PostGIS
   */
  async fallbackUpdateLocation(position) {
    await supabase
      .from('collector_profiles')
      .update({
        current_latitude: position.latitude.toString(),
        current_longitude: position.longitude.toString(),
        // Keep the PostGIS column in step too, or the user app keeps reading the old point
        current_location: `SRID=4326;POINT(${position.longitude} ${position.latitude})`,
        location_updated_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', this.collectorId);
  }

  /**
   * Broadcast current location to database
   */
  async broadcastLocation() {
    if (!this.isTracking || !this.collectorId) return;

    try {
      // Keeps running when the collector leaves the navigation screen, so stop
      // once the job is finished, cancelled or handed to someone else
      this.broadcastCount += 1;
      if (this.broadcastCount % this.STATUS_CHECK_EVERY === 0 && !(await this.isJobStillActive())) {
        this.stopTracking();
        return;
      }

      // Get current GPS location
      const position = await this.getCurrentPosition();
      
      if (!position) {
        logger.warn('Could not get current position for broadcast');
        return;
      }

      // Update collector's current location in database
      // NOTE: Table is collector_profiles, not collectors
      // Use raw SQL via rpc to handle PostGIS geometry with explicit casting
      const { error: updateError } = await supabase.rpc('update_collector_location', {
        p_user_id: this.collectorId,
        p_longitude: position.longitude,
        p_latitude: position.latitude
      });

      if (updateError) {
        // Handle specific PostGIS ambiguity error gracefully
        if (updateError.code === '42725' || updateError.message?.includes('operator is not unique')) {
          if (!this.geometryErrorLogged) {
            logger.warn('⚠️ Location broadcast: PostGIS geometry operator issue. Using fallback.');
            this.geometryErrorLogged = true;
          }
          // Fallback: Update location fields directly (without PostGIS)
          await this.fallbackUpdateLocation(position);
          return;
        }
        
        // Handle RPC not found - function doesn't exist yet
        if (updateError.code === '42883' || updateError.message?.includes('function') || updateError.message?.includes('does not exist')) {
          if (!this.rpcErrorLogged) {
            logger.warn('⚠️ Location broadcast RPC not available. Falling back to direct update.');
            this.rpcErrorLogged = true;
          }
          // Fallback: Update location fields directly (without PostGIS)
          await this.fallbackUpdateLocation(position);
          return;
        }

        // Log other errors but don't spam
        if (!this.otherErrorLogged) {
          logger.error('Failed to broadcast location:', updateError);
          this.otherErrorLogged = true;
        }
        // Still try fallback for any other error
        await this.fallbackUpdateLocation(position);
      } else {
        // Only log occasionally to reduce console spam
        if (Math.random() < 0.1) {
          logger.debug('📡 Location broadcast successful');
        }
      }

      // Notify user that collector is en route (optional - first broadcast only)
      if (!this.hasNotifiedEnRoute) {
        await this.notifyUserEnRoute();
        this.hasNotifiedEnRoute = true;
      }

    } catch (error) {
      logger.error('Error broadcasting location:', error);
    }
  }

  async isJobStillActive() {
    const { data, error } = await supabase
      .from(this.requestTable)
      .select('status, collector_id')
      .eq('id', this.currentRequestId)
      .maybeSingle();
    if (error) return true; // network trouble: keep going, check again later
    return !!data
      && data.collector_id === this.collectorId
      && ['accepted', 'en_route', 'arrived'].includes(data.status);
  }

  /**
   * Get current GPS position
   */
  getCurrentPosition() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed
          });
        },
        (error) => {
          logger.warn('Geolocation error:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Notify user that collector is on the way
   */
  async notifyUserEnRoute() {
    try {
      // Get the pickup request to find user_id
      const { data: request } = await supabase
        .from(this.requestTable)
        .select('user_id, waste_type')
        .eq('id', this.currentRequestId)
        .single();

      if (!request || !request.user_id) return;

      // Get collector name
      const { data: collectorProfile } = await supabase
        .from('collector_profiles')
        .select('first_name, last_name')
        .eq('user_id', this.collectorId)
        .single();

      const collectorName = collectorProfile 
        ? `${collectorProfile.first_name} ${collectorProfile.last_name}`
        : 'Your collector';

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          title: 'Collector En Route 🚗',
          message: `${collectorName} is on the way to collect your ${request.waste_type || 'waste'}. You can track their location in real-time.`,
          type: 'collector_enroute',
          read: false
        });

      logger.info('✅ User notified - collector en route');
    } catch (error) {
      logger.error('Error notifying user en route:', error);
    }
  }

  /**
   * Update ETA for the user
   */
  async updateETA(etaMinutes) {
    try {
      if (!this.currentRequestId) return;

      // Routes are recalculated often; only tell the user about the first ETA,
      // a change of 5+ minutes, or a refresh after 10 minutes
      const now = Date.now();
      const isFirst = this.lastSentEta === null;
      const changedEnough = !isFirst && Math.abs(etaMinutes - this.lastSentEta) >= 5;
      const isDue = now - this.lastEtaSentAt >= 10 * 60 * 1000;
      if (!isFirst && !changedEnough && !isDue) return;
      this.lastSentEta = etaMinutes;
      this.lastEtaSentAt = now;

      const { data: request } = await supabase
        .from(this.requestTable)
        .select('user_id')
        .eq('id', this.currentRequestId)
        .single();

      if (!request?.user_id) return;

      // Create ETA update notification
      await supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          title: 'Updated ETA ⏰',
          message: `Your collector will arrive in approximately ${etaMinutes} minutes.`,
          type: 'eta_update',
          read: false
        });

      logger.info(`✅ ETA update sent: ${etaMinutes} minutes`);
    } catch (error) {
      logger.error('Error updating ETA:', error);
    }
  }
}

// Lazy singleton instance - only created when first accessed
let _locationBroadcastInstance = null;

function getLocationBroadcast() {
  if (!_locationBroadcastInstance) {
    _locationBroadcastInstance = new LocationBroadcastService();
  }
  return _locationBroadcastInstance;
}

// Use Proxy to delay initialization until first property access
export const locationBroadcast = new Proxy({}, {
  get(target, prop) {
    const instance = getLocationBroadcast();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  set(target, prop, value) {
    const instance = getLocationBroadcast();
    instance[prop] = value;
    return true;
  }
});
