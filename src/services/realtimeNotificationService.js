/**
 * Realtime Notification Service
 * Uses Supabase Realtime to listen for new pickup requests and trigger
 * audio/vibration alerts even when app is in foreground but not focused.
 */

import { supabase } from './supabase.js';
import { audioAlertService } from './audioAlertService.js';
import { logger } from '../utils/logger.js';
import { calculateDistance } from '../utils/geoUtils.js';

class RealtimeNotificationService {
  constructor() {
    this.channel = null;
    this.collectorId = null;
    this.collectorLocation = null;
    this.searchRadius = 5; // km, default radius
    this.isListening = false;
    this.callbacks = new Set();
    this.lastNotificationTime = 0;
    this.NOTIFICATION_COOLDOWN = 3000; // 3 seconds between alerts
    this.audioInitialized = false;
  }

  /**
   * Initialize the notification service
   * @param {string} collectorId - The collector's user ID
   * @param {Object} options - Configuration options
   */
  async initialize(collectorId, options = {}) {
    if (this.isListening && this.collectorId === collectorId) {
      logger.debug('RealtimeNotificationService already initialized');
      return;
    }

    this.collectorId = collectorId;
    this.searchRadius = options.searchRadius || 5;
    
    // Try to initialize audio (will need user interaction)
    try {
      await audioAlertService.initialize();
      this.audioInitialized = true;
      logger.info('🔊 Audio alerts initialized for notifications');
    } catch (error) {
      logger.warn('⚠️ Audio initialization deferred - requires user interaction');
    }

    await this.setupRealtimeSubscription();
    
    logger.info('🔔 RealtimeNotificationService initialized', {
      collectorId,
      searchRadius: this.searchRadius
    });
  }

  /**
   * Update collector's current location for proximity filtering
   * @param {Object} location - {lat, lng}
   */
  updateLocation(location) {
    this.collectorLocation = location;
  }

  /**
   * Update search radius
   * @param {number} radiusKm - Search radius in kilometers
   */
  updateSearchRadius(radiusKm) {
    this.searchRadius = radiusKm;
    logger.debug('Search radius updated:', radiusKm, 'km');
  }

  /**
   * Register a callback for new request notifications
   * @param {Function} callback - Called with (request, distance) when new request arrives
   * @returns {Function} Unsubscribe function
   */
  onNewRequest(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Setup Supabase Realtime subscription for pickup requests
   */
  async setupRealtimeSubscription() {
    // Cleanup existing subscription
    if (this.channel) {
      await supabase.removeChannel(this.channel);
    }

    try {
      this.channel = supabase
        .channel('new_request_alerts')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'pickup_requests',
          filter: 'status=eq.available'
        }, (payload) => this.handleNewRequest(payload))
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'digital_bins',
          filter: 'status=eq.available'
        }, (payload) => this.handleNewDigitalBin(payload))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.isListening = true;
            logger.info('✅ Subscribed to new request alerts');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.isListening = false;
            logger.warn('⚠️ Request alert subscription closed, attempting reconnect...');
            this.scheduleReconnect();
          }
        });

    } catch (error) {
      logger.error('Failed to setup realtime subscription:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle new pickup request from realtime subscription
   */
  async handleNewRequest(payload) {
    const newRequest = payload.new;
    
    if (!newRequest || newRequest.collector_id) {
      return; // Skip if already assigned
    }

    logger.debug('📥 New pickup request received:', newRequest.id);

    // Check if within search radius
    const distance = this.calculateDistanceToRequest(newRequest);
    
    if (distance !== null && distance > this.searchRadius) {
      logger.debug(`Request ${newRequest.id} is ${distance.toFixed(1)}km away, outside ${this.searchRadius}km radius`);
      return;
    }

    // Trigger alert
    await this.triggerNewRequestAlert(newRequest, distance, 'pickup_request');
  }

  /**
   * Handle new digital bin from realtime subscription
   */
  async handleNewDigitalBin(payload) {
    const newBin = payload.new;
    
    if (!newBin || newBin.collector_id) {
      return;
    }

    logger.debug('📥 New digital bin available:', newBin.id);

    const distance = this.calculateDistanceToRequest(newBin);
    
    if (distance !== null && distance > this.searchRadius) {
      logger.debug(`Digital bin ${newBin.id} is ${distance.toFixed(1)}km away, outside radius`);
      return;
    }

    await this.triggerNewRequestAlert(newBin, distance, 'digital_bin');
  }

  /**
   * Calculate distance from collector to request
   * @returns {number|null} Distance in km, or null if location unknown
   */
  calculateDistanceToRequest(request) {
    if (!this.collectorLocation) {
      return null; // Can't filter by distance without location
    }

    let requestCoords = request.coordinates;
    
    // Parse coordinates if needed
    if (typeof requestCoords === 'string') {
      try {
        requestCoords = JSON.parse(requestCoords);
      } catch (e) {
        return null;
      }
    }
    
    if (Array.isArray(requestCoords)) {
      requestCoords = { lat: requestCoords[0], lng: requestCoords[1] };
    }

    if (!requestCoords || !requestCoords.lat || !requestCoords.lng) {
      return null;
    }

    return calculateDistance(this.collectorLocation, requestCoords);
  }

  /**
   * Trigger audio/vibration alert for new request
   */
  async triggerNewRequestAlert(request, distance, sourceType) {
    // Cooldown to prevent alert spam
    const now = Date.now();
    if (now - this.lastNotificationTime < this.NOTIFICATION_COOLDOWN) {
      logger.debug('Skipping alert due to cooldown');
      return;
    }
    this.lastNotificationTime = now;

    // Ensure audio is initialized (may require user interaction)
    if (!this.audioInitialized) {
      try {
        await audioAlertService.initialize();
        this.audioInitialized = true;
      } catch (error) {
        logger.warn('Could not initialize audio for alert');
      }
    }

    // Determine alert message
    const wasteType = request.waste_type || 'general';
    const location = request.location || 'nearby';
    const fee = request.fee ? `₵${request.fee}` : '';
    const distanceText = distance !== null ? `${distance.toFixed(1)} kilometers away` : 'nearby';
    const typeLabel = sourceType === 'digital_bin' ? 'digital bin' : 'pickup request';

    const message = `New ${wasteType} ${typeLabel} ${distanceText}. ${fee ? `Fee: ${fee}.` : ''} ${location}.`;

    logger.info('🔔 Triggering new request alert:', message);

    // Play alert sound + vibration + TTS
    try {
      // Strong vibration pattern for attention
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }

      // Play attention-grabbing sound
      await audioAlertService.playNewRequestAlert();

      // Speak the notification
      await audioAlertService.speak(message, {
        rate: 0.9,
        pitch: 1.1,
        volume: 1.0
      });

    } catch (error) {
      logger.error('Error playing notification alert:', error);
    }

    // Notify registered callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(request, distance, sourceType);
      } catch (err) {
        logger.error('Error in notification callback:', err);
      }
    });

    // Show browser notification if permitted (as backup)
    this.showBrowserNotification(message, request);
  }

  /**
   * Show browser notification as backup
   */
  async showBrowserNotification(message, request) {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification('New Pickup Request! 🚛', {
          body: message,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: `request-${request.id}`,
          requireInteraction: true,
          vibrate: [200, 100, 200]
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto-close after 10 seconds
        setTimeout(() => notification.close(), 10000);
      } catch (error) {
        logger.warn('Could not show browser notification:', error);
      }
    } else if (Notification.permission === 'default') {
      // Request permission for next time
      Notification.requestPermission();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    setTimeout(() => {
      if (!this.isListening && this.collectorId) {
        logger.info('🔄 Attempting to reconnect notification service...');
        this.setupRealtimeSubscription();
      }
    }, 5000);
  }

  /**
   * Manually trigger audio initialization (call after user interaction)
   */
  async initializeAudio() {
    try {
      await audioAlertService.initialize();
      this.audioInitialized = true;
      logger.info('🔊 Audio alerts manually initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize audio:', error);
      return false;
    }
  }

  /**
   * Test the notification alert (for debugging)
   */
  async testAlert() {
    const mockRequest = {
      id: 'test-' + Date.now(),
      waste_type: 'recyclable',
      location: 'Test Location',
      fee: 25,
      coordinates: this.collectorLocation || { lat: 5.6, lng: -0.2 }
    };

    await this.triggerNewRequestAlert(mockRequest, 0.5, 'pickup_request');
  }

  /**
   * Cleanup and stop listening
   */
  async destroy() {
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    this.isListening = false;
    this.callbacks.clear();
    this.collectorId = null;
    
    logger.info('🔕 RealtimeNotificationService destroyed');
  }
}

// Singleton instance
export const realtimeNotificationService = new RealtimeNotificationService();

export default realtimeNotificationService;
