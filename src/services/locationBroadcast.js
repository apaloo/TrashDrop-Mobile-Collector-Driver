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
    this.collectorId = null;
    this.BROADCAST_INTERVAL = 10000; // 10 seconds
  }

  /**
   * Start broadcasting location for an active pickup request
   */
  async startTracking(requestId, collectorId) {
    if (this.isTracking) {
      logger.warn('Location tracking already active');
      return;
    }

    this.currentRequestId = requestId;
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
    
    logger.info('🛑 Stopped location tracking');
  }

  /**
   * Broadcast current location to database
   */
  async broadcastLocation() {
    if (!this.isTracking || !this.collectorId) return;

    try {
      // Get current GPS location
      const position = await this.getCurrentPosition();
      
      if (!position) {
        logger.warn('Could not get current position for broadcast');
        return;
      }

      // Update collector's current location in database
      const { error: updateError } = await supabase
        .from('collectors')
        .update({
          current_location: {
            lat: position.latitude,
            lng: position.longitude,
            accuracy: position.accuracy,
            timestamp: new Date().toISOString(),
            active_request_id: this.currentRequestId,
            heading: position.heading || null,
            speed: position.speed || null
          },
          last_active: new Date().toISOString()
        })
        .eq('id', this.collectorId);

      if (updateError) {
        logger.error('Failed to broadcast location:', updateError);
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
        .from('pickup_requests')
        .select('user_id, waste_type, location')
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

      const { data: request } = await supabase
        .from('pickup_requests')
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

// Export singleton instance
export const locationBroadcast = new LocationBroadcastService();
