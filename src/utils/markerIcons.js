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

// Function to create a tricycle icon for user location
export const createTricycleIcon = () => {
  return L.divIcon({
    html: `
    <div style="position: relative; width: 60px; height: 60px; filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.3));">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="60" height="36" style="transform: scale(1.5); transform-origin: center;">
        <!-- Shadow effect -->
        <ellipse cx="50" cy="55" rx="30" ry="5" fill="rgba(0,0,0,0.2)" filter="url(#shadow)"/>
        
        <!-- Glow effect -->
        <defs>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <filter id="shadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
            <feOffset in="blur" dx="0" dy="2" result="offsetBlur"/>
            <feComponentTransfer in="offsetBlur" result="shadow">
              <feFuncA type="linear" slope="0.2"/>
            </feComponentTransfer>
            <feComposite in="SourceGraphic" in2="shadow" operator="over"/>
          </filter>
        </defs>
        
        <!-- Main tricycle -->
        <g filter="url(#glow)">
          <!-- Cargo area with 3D effect -->
          <path d="M65,40 L90,40 Q95,40 95,35 L95,30 Q95,25 90,25 L65,25 Q60,25 60,30 L60,35 Q60,40 65,40 Z" 
                fill="#1d4ed8" stroke="#1e40af" stroke-width="1.5" stroke-linejoin="round"/>
          <!-- Side panel for 3D effect -->
          <path d="M90,40 L95,35 L95,30 L90,25 L90,40 Z" fill="#1e40af" stroke="#1e40af" stroke-width="1"/>
          
          <!-- Wheels with highlights -->
          <!-- Front wheel -->
          <circle cx="20" cy="45" r="12" fill="#1f2937" stroke="#111827" stroke-width="2.5"/>
          <circle cx="20" cy="45" r="10" fill="none" stroke="#4b5563" stroke-width="1" stroke-dasharray="1,3"/>
          
          <!-- Back wheel -->
          <circle cx="80" cy="45" r="10" fill="#1f2937" stroke="#111827" stroke-width="2.5"/>
          <circle cx="80" cy="45" r="8" fill="none" stroke="#4b5563" stroke-width="1" stroke-dasharray="1,3"/>
          
          <!-- Frame -->
          <path d="M30,25 L40,40 L60,40" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
          
          <!-- Handlebar -->
          <path d="M20,25 L20,35 Q20,20 30,25 L35,25" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
          
          <!-- Seat -->
          <rect x="40" y="25" width="10" height="5" rx="1" fill="#1f2937" stroke="#111827" stroke-width="1"/>
          
          <!-- Driver indicator with pulse effect -->
          <g style="animation: pulse 2s infinite;">
            <circle cx="45" cy="20" r="6" fill="#22c55e" stroke="#fff" stroke-width="1.5"/>
            <circle cx="45" cy="20" r="3" fill="#fff"/>
          </g>
        </g>
        
        <style>
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }
        </style>
      </svg>
    </div>`,
    className: 'user-location-marker z-[1000]',
    iconSize: [60, 60],
    iconAnchor: [30, 30],
    popupAnchor: [0, -30]
  });
};

// Create a single instance of the tricycle icon for better performance
export const tricycleIcon = createTricycleIcon();
