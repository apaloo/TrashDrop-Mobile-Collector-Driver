/**
 * Marker icon utilities for map components
 * Creates SVG-based marker icons for the map
 */

import L from 'leaflet';

// Base64 encoded SVG marker icons
const createMarkerIcon = (color) => {
  // Create SVG marker with specified color
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path fill="${color}" stroke="#ffffff" stroke-width="1" d="M12 0c-4.4 0-8 3.6-8 8 0 1.5 0.4 2.9 1.1 4.1 0.9 1.6 6.9 9.8 6.9 9.8s6-8.3 6.9-9.8c0.7-1.2 1.1-2.6 1.1-4.1 0-4.4-3.6-8-8-8z"/>
      <circle fill="#ffffff" cx="12" cy="8" r="3.5"/>
    </svg>
  `;
  
  // Convert SVG to data URL
  const svgBase64 = btoa(svgTemplate);
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
  
  return L.icon({
    iconUrl: dataUrl,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36]
  });
};

// Create icons with different colors
export const startMarkerIcon = createMarkerIcon('#22c55e'); // Green
export const assignmentMarkerIcon = createMarkerIcon('#3b82f6'); // Blue
export const requestMarkerIcon = createMarkerIcon('#ef4444'); // Red

// Function to get the appropriate icon based on stop type
export const getStopIcon = (stop) => {
  if (!stop) return assignmentMarkerIcon;
  return stop.type === 'request' ? requestMarkerIcon : assignmentMarkerIcon;
};
