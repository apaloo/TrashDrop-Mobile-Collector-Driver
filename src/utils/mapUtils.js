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
