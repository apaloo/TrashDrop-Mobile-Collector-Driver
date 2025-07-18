/**
 * Marker icon utilities for map components
 * Creates SVG-based marker icons for the map
 */

import L from 'leaflet';

// Base64 encoded SVG marker icons for dustbins with wheels and recycling symbol
const createDustbinIcon = (color, type) => {
  // Define colors based on type
  const colors = {
    start: {
      main: '#10B981', // Green-500
      dark: '#059669', // Green-600
      light: '#34D399' // Green-400
    },
    assignment: {
      main: '#3B82F6', // Blue-500
      dark: '#2563EB', // Blue-600
      light: '#60A5FA' // Blue-400
    },
    request: {
      main: '#EF4444', // Red-500
      dark: '#DC2626', // Red-600
      light: '#F87171' // Red-400
    }
  };

  const currentColor = type === 'start' ? colors.start : (type === 'request' ? colors.request : colors.assignment);
  
  // Create SVG dustbin with specified color and type
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64">
      <!-- Wheels -->
      <circle cx="12" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      <circle cx="36" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      
      <!-- Wheel highlights -->
      <circle cx="12" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      <circle cx="36" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      
      <!-- Bin body -->
      <path fill="${currentColor.main}" stroke="${currentColor.dark}" stroke-width="1.5" 
            d="M40,16h-4v-2c0-1.1-0.9-2-2-2H14c-1.1,0-2,0.9-2,2v2H8v32c0,4.4,3.6,8,8,8h16c4.4,0,8-3.6,8-8V16H40z M18,16v-2h12v2H18z"/>
      
      <!-- Bin lid -->
      <path fill="${currentColor.dark}" stroke="${currentColor.dark}" stroke-width="1.5" 
            d="M40,16H8c-1.1,0-2-0.9-2-2v-2c0-1.1,0.9-2,2-2h32c1.1,0,2,0.9,2,2v2C42,15.1,41.1,16,40,16z"/>
      
      <!-- Lid handle -->
      <rect x="20" y="10" width="8" height="2" rx="1" fill="#9CA3AF"/>
      
      <!-- Recycling symbol -->
      <path fill="#FFFFFF" d="M24,24c-0.3,0-0.5,0.1-0.7,0.3l-4,4c-0.4,0.4-0.4,1,0,1.4l4,4c0.2,0.2,0.4,0.3,0.7,0.3s0.5-0.1,0.7-0.3l4-4c0.4-0.4,0.4-1,0-1.4l-4-4C24.5,24.1,24.3,24,24,24z M24,30.6L21.4,28l2.6-2.6l2.6,2.6L24,30.6z"/>
      <path fill="#FFFFFF" d="M24,26c-0.3,0-0.5,0.1-0.7,0.3l-2,2c-0.4,0.4-0.4,1,0,1.4l2,2c0.2,0.2,0.4,0.3,0.7,0.3s0.5-0.1,0.7-0.3l2-2c0.4-0.4,0.4-1,0-1.4l-2-2C24.5,26.1,24.3,26,24,26z M24,29.6l-0.6-0.6l0.6-0.6l0.6,0.6L24,29.6z"/>
      
      <!-- Type indicator -->
      <circle cx="38" cy="12" r="6" fill="white" stroke="${currentColor.dark}" stroke-width="1.5"/>
      <text x="38" y="15" font-size="8" text-anchor="middle" fill="${currentColor.dark}" font-weight="bold" font-family="Arial, sans-serif">
        ${type === 'start' ? 'S' : (type === 'request' ? 'R' : 'A')}
      </text>
    </svg>
  `;
  
  // Convert SVG to data URL
  const svgBase64 = btoa(unescape(encodeURIComponent(svgTemplate)));
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
  
  return L.icon({
    iconUrl: dataUrl,
    iconSize: [48, 64],
    iconAnchor: [24, 64],
    popupAnchor: [0, -64]
  });
};

// Create dustbin icons for different types
export const startMarkerIcon = createDustbinIcon('#22c55e', 'start'); // Green
export const assignmentMarkerIcon = createDustbinIcon('#3b82f6', 'assignment'); // Blue
export const requestMarkerIcon = createDustbinIcon('#ef4444', 'request'); // Red

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
