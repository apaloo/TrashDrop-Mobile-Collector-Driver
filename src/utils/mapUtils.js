import L from 'leaflet';
import 'leaflet.offline';
import localforage from 'localforage';

/**
 * Initialize offline map storage
 */
export const initOfflineMapStorage = () => {
  // Configure localforage for storing map tiles
  localforage.config({
    name: 'trashdrop-maps',
    storeName: 'map_tiles',
    description: 'Offline map tiles for TrashDrop'
  });
};

/**
 * Create a tile layer that supports offline caching
 * @param {Object} options - Options for the tile layer
 * @returns {Object} - Leaflet tile layer with offline support
 */
export const createOfflineTileLayer = (options = {}) => {
  const defaultOptions = {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: ['a', 'b', 'c'],
    minZoom: 10,
    maxZoom: 18,
    crossOrigin: true
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Create offline-enabled tile layer
  return L.tileLayer.offline(
    mergedOptions.url, 
    {
      attribution: mergedOptions.attribution,
      subdomains: mergedOptions.subdomains,
      minZoom: mergedOptions.minZoom,
      maxZoom: mergedOptions.maxZoom,
      crossOrigin: mergedOptions.crossOrigin
    }
  );
};

/**
 * Save map tiles for offline use
 * @param {Object} map - Leaflet map instance
 * @param {Object} layer - Leaflet tile layer with offline support
 * @param {Function} onProgress - Progress callback function
 * @param {Function} onSuccess - Success callback function
 * @param {Function} onError - Error callback function
 */
export const saveMapTilesForOffline = (map, layer, onProgress, onSuccess, onError) => {
  if (!map || !layer) {
    if (onError) onError(new Error('Map or layer not provided'));
    return;
  }

  // Get current map bounds
  const bounds = map.getBounds();
  const zoom = {
    min: Math.max(map.getZoom() - 1, 10), // Cache current zoom level and one level down
    max: Math.min(map.getZoom() + 1, 18)  // Cache current zoom level and one level up
  };

  // Save tiles within bounds and zoom levels
  layer.saveTiles(
    bounds,
    zoom.min,
    zoom.max,
    onProgress,
    onSuccess,
    onError
  );
};

/**
 * Get the number of cached tiles
 * @param {Object} layer - Leaflet tile layer with offline support
 * @param {Function} callback - Callback function with tile count
 */
export const getCachedTileCount = (layer, callback) => {
  if (!layer) {
    callback(0);
    return;
  }

  layer.getTileUrls(
    null, // null means all tiles
    null,
    null,
    (urls) => {
      callback(urls.length);
    }
  );
};

/**
 * Clear all cached map tiles
 * @param {Object} layer - Leaflet tile layer with offline support
 * @param {Function} onSuccess - Success callback function
 * @param {Function} onError - Error callback function
 */
export const clearCachedTiles = (layer, onSuccess, onError) => {
  if (!layer) {
    if (onError) onError(new Error('Layer not provided'));
    return;
  }

  layer.deleteTiles(
    () => {
      if (onSuccess) onSuccess();
    },
    (error) => {
      if (onError) onError(error);
    }
  );
};

/**
 * Create a lightweight tile layer for faster initial loading
 * @returns {Object} - Leaflet tile layer
 */
export const createLightweightTileLayer = () => {
  return L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      minZoom: 10,
      maxZoom: 18
    }
  );
};

/**
 * Optimize map performance
 * @param {Object} map - Leaflet map instance
 */
export const optimizeMapPerformance = (map) => {
  if (!map) return;

  // Disable animations for better performance on mobile
  map.options.fadeAnimation = false;
  map.options.zoomAnimation = false;
  map.options.markerZoomAnimation = false;

  // Limit max bounds to improve performance (roughly Ghana and surrounding area)
  const southWest = L.latLng(3.0, -5.0);
  const northEast = L.latLng(12.0, 2.0);
  const bounds = L.latLngBounds(southWest, northEast);
  map.setMaxBounds(bounds);
  
  // Set min/max zoom for better performance
  map.options.minZoom = 10;
  map.options.maxZoom = 18;
};
