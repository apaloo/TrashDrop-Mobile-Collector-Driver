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

// Create a black dustbin icon for digital bins
const createDigitalBinIcon = () => {
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64">
      <!-- Wheels -->
      <circle cx="12" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      <circle cx="36" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      
      <!-- Wheel highlights -->
      <circle cx="12" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      <circle cx="36" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      
      <!-- Bin body - Black with dark gray outline -->
      <path fill="#000000" stroke="#1F2937" stroke-width="1.5" 
            d="M40,16h-4v-2c0-1.1-0.9-2-2-2H14c-1.1,0-2,0.9-2,2v2H8v32c0,4.4,3.6,8,8,8h16c4.4,0,8-3.6,8-8V16H40z M18,16v-2h12v2H18z"/>
      
      <!-- Bin lid -->
      <path fill="#1F2937" stroke="#1F2937" stroke-width="1.5" 
            d="M40,16H8c-1.1,0-2-0.9-2-2v-2c0-1.1,0.9-2,2-2h32c1.1,0,2,0.9,2,2v2C42,15.1,41.1,16,40,16z"/>
      
      <!-- Lid handle -->
      <rect x="20" y="10" width="8" height="2" rx="1" fill="#9CA3AF"/>
      
      <!-- Digital indicator (D for Digital) -->
      <path fill="#FFFFFF" d="M18,24 L30,24 Q32,24 32,26 L32,34 Q32,36 30,36 L18,36 Q16,36 16,34 L16,26 Q16,24 18,24 Z"/>
      <text x="24" y="32" font-size="8" text-anchor="middle" fill="#000000" font-weight="bold" font-family="Arial, sans-serif">D</text>
      
      <!-- Type indicator -->
      <circle cx="38" cy="12" r="6" fill="white" stroke="#1F2937" stroke-width="1.5"/>
      <text x="38" y="15" font-size="8" text-anchor="middle" fill="#1F2937" font-weight="bold" font-family="Arial, sans-serif">
        D
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
export const digitalBinMarkerIcon = createDigitalBinIcon(); // Black for digital bins

// Function to get the appropriate icon based on stop type
export const getStopIcon = (stop) => {
  if (!stop) return assignmentMarkerIcon;
  return stop.type === 'request' ? requestMarkerIcon : assignmentMarkerIcon;
};

// Calculate bearing/heading between two GPS coordinates
export const calculateBearing = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;
  
  const dLng = toRad(lng2 - lng1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360; // Normalize to 0-360
};

// 3D Tricycle image URL - uses the high-quality 3D rendered tricycle image
const TRICYCLE_IMAGE_URL = '/icons/tricycle-3d.png';

// Icon size for accessibility (larger for vision impaired users)
const TRICYCLE_ICON_SIZE = 100; // Increased for better visibility

// Preload the tricycle image for faster rendering
const preloadTricycleImage = () => {
  const img = new Image();
  img.src = TRICYCLE_IMAGE_URL;
};
preloadTricycleImage();

// Cache for tricycle icons - only two directions needed (left/right)
const tricycleIconCache = {
  left: null,
  right: null
};

// Function to create a 3D tricycle icon for user location with heading rotation
// Uses the actual 3D rendered tricycle image with rotation support
// OPTIMIZED: Returns cached icon for left/right direction to avoid recreating on every render
export const createTricycleIcon = (heading = 0) => {
  // Determine direction - only left or right
  const direction = (heading >= 0 && heading < 180) ? 'right' : 'left';
  
  // Return cached icon if available
  if (tricycleIconCache[direction]) {
    return tricycleIconCache[direction];
  }
  // The tricycle image faces LEFT by default
  // User requirement: tricycle should ONLY face LEFT or RIGHT (horizontal)
  // If heading is 0-180° (eastward/right direction) → face RIGHT (horizontal flip)
  // If heading is 180-360° (westward/left direction) → face LEFT (no flip)
  const shouldFaceRight = heading >= 0 && heading < 180;
  
  // For horizontal flip in SVG: translate to right edge, then scale(-1, 1)
  const flipTransform = shouldFaceRight 
    ? `translate(${TRICYCLE_ICON_SIZE}, 0) scale(-1, 1)` 
    : '';
  
  // Direction arrow points right when facing right, left when facing left
  const arrowPoints = shouldFaceRight
    ? `${TRICYCLE_ICON_SIZE - 2},${TRICYCLE_ICON_SIZE/2} ${TRICYCLE_ICON_SIZE - 12},${TRICYCLE_ICON_SIZE/2 - 6} ${TRICYCLE_ICON_SIZE - 8},${TRICYCLE_ICON_SIZE/2} ${TRICYCLE_ICON_SIZE - 12},${TRICYCLE_ICON_SIZE/2 + 6}`
    : `2,${TRICYCLE_ICON_SIZE/2} 12,${TRICYCLE_ICON_SIZE/2 - 6} 8,${TRICYCLE_ICON_SIZE/2} 12,${TRICYCLE_ICON_SIZE/2 + 6}`;
  
  const svgHtml = `
    <div style="position: relative; width: ${TRICYCLE_ICON_SIZE}px; height: ${TRICYCLE_ICON_SIZE}px;">
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${TRICYCLE_ICON_SIZE} ${TRICYCLE_ICON_SIZE}" width="${TRICYCLE_ICON_SIZE}" height="${TRICYCLE_ICON_SIZE}">
        <defs>
          <!-- Drop shadow for 3D effect -->
          <filter id="tricycleShadowLeaflet" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.35"/>
          </filter>
        </defs>
        
        <!-- Flip wrapper - flips tricycle horizontally when facing right -->
        <g transform="${flipTransform}" filter="url(#tricycleShadowLeaflet)">
          <!-- 3D Tricycle Image -->
          <image 
            href="${TRICYCLE_IMAGE_URL}" 
            x="4" 
            y="4" 
            width="${TRICYCLE_ICON_SIZE - 8}" 
            height="${TRICYCLE_ICON_SIZE - 8}"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
        
        <!-- Pulsing GPS accuracy ring -->
        <circle cx="${TRICYCLE_ICON_SIZE/2}" cy="${TRICYCLE_ICON_SIZE/2}" r="${TRICYCLE_ICON_SIZE/2 - 4}" fill="none" stroke="#22C55E" stroke-width="3" opacity="0.5">
          <animate attributeName="r" values="${TRICYCLE_ICON_SIZE/2 - 8};${TRICYCLE_ICON_SIZE/2 - 2};${TRICYCLE_ICON_SIZE/2 - 8}" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite"/>
        </circle>
        
        <!-- Direction indicator arrow (points in direction of travel) -->
        <polygon 
          points="${arrowPoints}" 
          fill="#22C55E" 
          stroke="#16A34A" 
          stroke-width="1"
        />
      </svg>
    </div>`;

  const icon = L.divIcon({
    html: svgHtml,
    className: 'user-location-marker z-[1000]',
    iconSize: [TRICYCLE_ICON_SIZE, TRICYCLE_ICON_SIZE],
    iconAnchor: [TRICYCLE_ICON_SIZE/2, TRICYCLE_ICON_SIZE/2],
    popupAnchor: [0, -TRICYCLE_ICON_SIZE/2]
  });
  
  // Cache the icon for this direction
  tricycleIconCache[direction] = icon;
  
  return icon;
};

// Create a default tricycle icon (facing left) for initial display
export const tricycleIcon = createTricycleIcon(270);
