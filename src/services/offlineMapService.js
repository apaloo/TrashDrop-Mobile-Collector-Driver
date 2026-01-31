/**
 * Offline Map Service
 * 
 * Provides tile caching and offline map support for navigation.
 * Uses IndexedDB to store map tiles for offline use in areas with poor connectivity.
 * 
 * Key features:
 * - Caches map tiles along the route when online
 * - Serves cached tiles when offline
 * - Caches route polyline for offline display
 * - Manages cache expiration and storage limits
 */

import { logger } from '../utils/logger';

const DB_NAME = 'trashdrop-offline-maps';
const DB_VERSION = 1;
const TILE_STORE = 'map-tiles';
const ROUTE_STORE = 'cached-routes';
const MAX_CACHE_SIZE_MB = 100; // Maximum cache size in MB
const TILE_EXPIRY_DAYS = 7; // Tiles expire after 7 days
const ROUTE_EXPIRY_HOURS = 24; // Routes expire after 24 hours

class OfflineMapService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.cacheStats = {
      tilesCount: 0,
      sizeBytes: 0
    };
  }

  /**
   * Initialize IndexedDB for tile storage
   */
  async initialize() {
    if (this.isInitialized) return true;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        logger.error('❌ Failed to open offline map database:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isInitialized = true;
        logger.info('✅ Offline map database initialized');
        this.updateCacheStats();
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create tile store with compound key (z, x, y)
        if (!db.objectStoreNames.contains(TILE_STORE)) {
          const tileStore = db.createObjectStore(TILE_STORE, { keyPath: 'key' });
          tileStore.createIndex('timestamp', 'timestamp', { unique: false });
          tileStore.createIndex('zoom', 'zoom', { unique: false });
        }

        // Create route store
        if (!db.objectStoreNames.contains(ROUTE_STORE)) {
          const routeStore = db.createObjectStore(ROUTE_STORE, { keyPath: 'id' });
          routeStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        logger.info('📦 Offline map database schema created');
      };
    });
  }

  /**
   * Generate tile key from coordinates
   */
  getTileKey(z, x, y) {
    return `${z}/${x}/${y}`;
  }

  /**
   * Convert lat/lng to tile coordinates
   */
  latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y, z: zoom };
  }

  /**
   * Get tiles needed for a bounding box at given zoom levels
   */
  getTilesForBounds(bounds, minZoom = 13, maxZoom = 17) {
    const tiles = [];
    
    for (let z = minZoom; z <= maxZoom; z++) {
      const nwTile = this.latLngToTile(bounds.north, bounds.west, z);
      const seTile = this.latLngToTile(bounds.south, bounds.east, z);
      
      for (let x = Math.min(nwTile.x, seTile.x); x <= Math.max(nwTile.x, seTile.x); x++) {
        for (let y = Math.min(nwTile.y, seTile.y); y <= Math.max(nwTile.y, seTile.y); y++) {
          tiles.push({ z, x, y });
        }
      }
    }
    
    return tiles;
  }

  /**
   * Get tiles needed along a route with buffer
   */
  getTilesForRoute(routeCoordinates, bufferKm = 0.5) {
    if (!routeCoordinates || routeCoordinates.length === 0) return [];

    // Calculate bounding box with buffer
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    routeCoordinates.forEach(coord => {
      const lat = coord.lat || coord[0];
      const lng = coord.lng || coord[1];
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    // Add buffer (roughly 0.009 degrees per km at equator)
    const bufferDeg = bufferKm * 0.009;
    const bounds = {
      north: maxLat + bufferDeg,
      south: minLat - bufferDeg,
      east: maxLng + bufferDeg,
      west: minLng - bufferDeg
    };

    return this.getTilesForBounds(bounds);
  }

  /**
   * Fetch and cache a single tile
   */
  async cacheTile(z, x, y, tileUrl = null) {
    if (!this.isInitialized) await this.initialize();

    const key = this.getTileKey(z, x, y);
    
    // Check if tile already cached and not expired
    const existing = await this.getTile(z, x, y);
    if (existing && !this.isTileExpired(existing)) {
      return existing;
    }

    // Fetch tile from OpenStreetMap
    const url = tileUrl || `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch tile: ${response.status}`);
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      const tileData = {
        key,
        zoom: z,
        x,
        y,
        data: arrayBuffer,
        timestamp: Date.now(),
        size: arrayBuffer.byteLength
      };

      // Store in IndexedDB
      await this.storeTile(tileData);
      
      return tileData;
    } catch (error) {
      logger.warn(`⚠️ Failed to cache tile ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Store tile in IndexedDB
   */
  async storeTile(tileData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TILE_STORE], 'readwrite');
      const store = transaction.objectStore(TILE_STORE);
      const request = store.put(tileData);

      request.onsuccess = () => {
        this.cacheStats.tilesCount++;
        this.cacheStats.sizeBytes += tileData.size;
        resolve(true);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Get tile from IndexedDB
   */
  async getTile(z, x, y) {
    if (!this.isInitialized) await this.initialize();

    const key = this.getTileKey(z, x, y);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TILE_STORE], 'readonly');
      const store = transaction.objectStore(TILE_STORE);
      const request = store.get(key);

      request.onsuccess = (event) => {
        resolve(event.target.result || null);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Get tile as blob URL for display
   */
  async getTileUrl(z, x, y) {
    const tile = await this.getTile(z, x, y);
    if (tile && tile.data) {
      const blob = new Blob([tile.data], { type: 'image/png' });
      return URL.createObjectURL(blob);
    }
    return null;
  }

  /**
   * Check if tile is expired
   */
  isTileExpired(tile) {
    const expiryMs = TILE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - tile.timestamp > expiryMs;
  }

  /**
   * Cache tiles for a route with progress callback
   */
  async cacheRouteArea(routeCoordinates, onProgress = null) {
    if (!this.isInitialized) await this.initialize();
    if (!navigator.onLine) {
      logger.warn('⚠️ Cannot cache tiles while offline');
      return { success: false, cached: 0, total: 0 };
    }

    const tiles = this.getTilesForRoute(routeCoordinates);
    const total = tiles.length;
    let cached = 0;
    let failed = 0;

    logger.info(`📦 Caching ${total} tiles for offline navigation...`);

    // Cache tiles in batches to avoid overwhelming the browser
    const batchSize = 10;
    for (let i = 0; i < tiles.length; i += batchSize) {
      const batch = tiles.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (tile) => {
        try {
          await this.cacheTile(tile.z, tile.x, tile.y);
          cached++;
        } catch (error) {
          failed++;
        }
      }));

      if (onProgress) {
        onProgress({
          cached,
          failed,
          total,
          percent: Math.round((cached + failed) / total * 100)
        });
      }

      // Small delay to prevent rate limiting
      if (i + batchSize < tiles.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info(`✅ Tile caching complete: ${cached}/${total} tiles cached (${failed} failed)`);
    
    return { success: true, cached, failed, total };
  }

  /**
   * Save route for offline use
   */
  async saveRoute(routeId, routeData) {
    if (!this.isInitialized) await this.initialize();

    const route = {
      id: routeId,
      ...routeData,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ROUTE_STORE], 'readwrite');
      const store = transaction.objectStore(ROUTE_STORE);
      const request = store.put(route);

      request.onsuccess = () => {
        logger.info(`💾 Route ${routeId} saved for offline use`);
        resolve(true);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Get saved route
   */
  async getRoute(routeId) {
    if (!this.isInitialized) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ROUTE_STORE], 'readonly');
      const store = transaction.objectStore(ROUTE_STORE);
      const request = store.get(routeId);

      request.onsuccess = (event) => {
        const route = event.target.result;
        if (route) {
          // Check if expired
          const expiryMs = ROUTE_EXPIRY_HOURS * 60 * 60 * 1000;
          if (Date.now() - route.timestamp > expiryMs) {
            logger.info(`⏰ Route ${routeId} expired, removing...`);
            this.deleteRoute(routeId);
            resolve(null);
          } else {
            resolve(route);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Delete a saved route
   */
  async deleteRoute(routeId) {
    if (!this.isInitialized) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([ROUTE_STORE], 'readwrite');
      const store = transaction.objectStore(ROUTE_STORE);
      const request = store.delete(routeId);

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Update cache statistics
   */
  async updateCacheStats() {
    if (!this.isInitialized) return;

    return new Promise((resolve) => {
      const transaction = this.db.transaction([TILE_STORE], 'readonly');
      const store = transaction.objectStore(TILE_STORE);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        this.cacheStats.tilesCount = countRequest.result;
        
        // Estimate size (we'd need to iterate for exact size)
        // Average tile is about 20KB
        this.cacheStats.sizeBytes = this.cacheStats.tilesCount * 20000;
        
        resolve(this.cacheStats);
      };

      countRequest.onerror = () => {
        resolve(this.cacheStats);
      };
    });
  }

  /**
   * Clear expired tiles
   */
  async clearExpiredTiles() {
    if (!this.isInitialized) await this.initialize();

    const expiryMs = TILE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - expiryMs;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TILE_STORE], 'readwrite');
      const store = transaction.objectStore(TILE_STORE);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTime);
      
      let deletedCount = 0;
      const cursorRequest = index.openCursor(range);

      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          logger.info(`🧹 Cleared ${deletedCount} expired tiles`);
          resolve(deletedCount);
        }
      };

      cursorRequest.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Clear all cached data
   */
  async clearAll() {
    if (!this.isInitialized) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TILE_STORE, ROUTE_STORE], 'readwrite');
      
      transaction.objectStore(TILE_STORE).clear();
      transaction.objectStore(ROUTE_STORE).clear();

      transaction.oncomplete = () => {
        this.cacheStats = { tilesCount: 0, sizeBytes: 0 };
        logger.info('🧹 All offline map data cleared');
        resolve(true);
      };

      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Get cache info
   */
  getCacheInfo() {
    return {
      ...this.cacheStats,
      sizeMB: (this.cacheStats.sizeBytes / (1024 * 1024)).toFixed(2),
      maxSizeMB: MAX_CACHE_SIZE_MB
    };
  }

  /**
   * Check if we have cached tiles for an area
   */
  async hasCachedTilesForArea(lat, lng, radiusKm = 1) {
    if (!this.isInitialized) await this.initialize();

    const bounds = {
      north: lat + (radiusKm * 0.009),
      south: lat - (radiusKm * 0.009),
      east: lng + (radiusKm * 0.009),
      west: lng - (radiusKm * 0.009)
    };

    const tiles = this.getTilesForBounds(bounds, 15, 15); // Check at zoom 15
    
    for (const tile of tiles) {
      const cached = await this.getTile(tile.z, tile.x, tile.y);
      if (cached && !this.isTileExpired(cached)) {
        return true;
      }
    }
    
    return false;
  }
}

// Export singleton instance
export const offlineMapService = new OfflineMapService();
export default offlineMapService;
