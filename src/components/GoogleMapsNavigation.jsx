import { useEffect, useRef, useState } from 'react';
import { logger } from '../utils/logger';
import { audioAlertService } from '../services/audioAlertService';
import { offlineMapService } from '../services/offlineMapService';
import OfflineNavigationMap from './OfflineNavigationMap';

// Google Maps API Key from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ============================================
// Custom SVG Icon Generators for Google Maps
// (Matching the Request map icons from markerIcons.js)
// ============================================

// Calculate bearing/heading between two GPS coordinates
const calculateBearing = (lat1, lng1, lat2, lng2) => {
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

// 3D Tricycle image URLs - dual images for horizontal and vertical movement
const TRICYCLE_HORIZONTAL_URL = '/icons/tricycle-3d.png';    // Side view, faces LEFT by default
const TRICYCLE_VERTICAL_URL = '/icons/tricycle-3d-2.png';    // Top-down view, faces UP by default

// Icon display size on the map (px). Reduced from 130 for better map legibility.
const TRICYCLE_ICON_SIZE = 78;
// Anchor at center (0.5, 0.5) so the icon rotates around its midpoint
// and the GPS coordinate sits exactly at the icon's center on the road.
const TRICYCLE_ANCHOR_X = TRICYCLE_ICON_SIZE / 2; // 39
const TRICYCLE_ANCHOR_Y = TRICYCLE_ICON_SIZE / 2; // 39

// Minimum speed (m/s) before we update heading rotation (2 km/h ≈ 0.56 m/s)
// This prevents the icon from spinning erratically while the vehicle is stationary
const MIN_SPEED_FOR_HEADING = 0.56;

// Cache for the loaded tricycle images (horizontal and vertical)
let tricycleHorizontalCache = null;
let tricycleVerticalCache = null;
let tricycleImagesLoading = false;
const rotatedImageCache = new Map(); // Cache rotated images by heading

// Determine which image and flip to use based on compass heading
// Compass: 0°=North(up), 90°=East(right), 180°=South(down), 270°=West(left)
// Returns: { isVertical: boolean, shouldFlip: boolean }
const getImageOrientation = (heading) => {
  // Normalize heading to 0-360
  const h = ((heading % 360) + 360) % 360;
  
  // Quadrant logic (compass bearing → screen direction):
  // 315-45°  (North-ish) → Vertical image, no flip  (faces UP)
  // 45-135°  (East-ish)  → Horizontal image, flip   (faces RIGHT)
  // 135-225° (South-ish) → Vertical image, flip     (faces DOWN)
  // 225-315° (West-ish)  → Horizontal image, no flip(faces LEFT)
  
  if (h >= 315 || h < 45) {
    // North → vertical image, faces up
    return { isVertical: true, shouldFlip: false };
  } else if (h >= 45 && h < 135) {
    // East → horizontal image, flip to face right
    return { isVertical: false, shouldFlip: true };
  } else if (h >= 135 && h < 225) {
    // South → vertical image, flip to face down
    return { isVertical: true, shouldFlip: true };
  } else {
    // West (225-315) → horizontal image, no flip (faces left)
    return { isVertical: false, shouldFlip: false };
  }
};

// Load both tricycle images and cache them
const loadTricycleImages = () => {
  return new Promise((resolve, reject) => {
    if (tricycleHorizontalCache && tricycleVerticalCache) {
      resolve({ horizontal: tricycleHorizontalCache, vertical: tricycleVerticalCache });
      return;
    }
    if (tricycleImagesLoading) {
      // Wait for existing load to complete
      const checkInterval = setInterval(() => {
        if (tricycleHorizontalCache && tricycleVerticalCache) {
          clearInterval(checkInterval);
          resolve({ horizontal: tricycleHorizontalCache, vertical: tricycleVerticalCache });
        }
      }, 50);
      return;
    }
    tricycleImagesLoading = true;
    
    let loadedCount = 0;
    const checkComplete = () => {
      loadedCount++;
      if (loadedCount === 2) {
        tricycleImagesLoading = false;
        resolve({ horizontal: tricycleHorizontalCache, vertical: tricycleVerticalCache });
      }
    };
    
    // Load horizontal image
    const imgH = new Image();
    imgH.crossOrigin = 'anonymous';
    imgH.onload = () => {
      tricycleHorizontalCache = imgH;
      checkComplete();
    };
    imgH.onerror = (err) => {
      tricycleImagesLoading = false;
      reject(err);
    };
    imgH.src = TRICYCLE_HORIZONTAL_URL;
    
    // Load vertical image
    const imgV = new Image();
    imgV.crossOrigin = 'anonymous';
    imgV.onload = () => {
      tricycleVerticalCache = imgV;
      checkComplete();
    };
    imgV.onerror = (err) => {
      tricycleImagesLoading = false;
      reject(err);
    };
    imgV.src = TRICYCLE_VERTICAL_URL;
  });
};

// Create rotated tricycle icon using canvas (for Google Maps)
// Returns a data URL of the rotated image
// Uses dual-image system: horizontal image for East/West, vertical image for North/South
// PLUS fine canvas rotation so the icon aligns precisely with the route bearing
const createRotatedTricycleUrl = async (heading = 270) => {
  // Round heading to nearest 3 degrees for caching (good balance of smoothness vs memory)
  const roundedHeading = Math.round(heading / 3) * 3;
  
  // Check cache first
  if (rotatedImageCache.has(roundedHeading)) {
    return rotatedImageCache.get(roundedHeading);
  }
  
  try {
    const images = await loadTricycleImages();
    const { isVertical, shouldFlip } = getImageOrientation(heading);
    
    // Select the appropriate image
    const img = isVertical ? images.vertical : images.horizontal;
    
    // Determine the base compass angle of the chosen image+flip combination
    // Horizontal image faces LEFT (West=270°), flipped faces RIGHT (East=90°)
    // Vertical image faces UP (North=0°), flipped faces DOWN (South=180°)
    let baseAngle;
    if (!isVertical && !shouldFlip) baseAngle = 270;   // West (left)
    else if (!isVertical && shouldFlip) baseAngle = 90; // East (right)
    else if (isVertical && !shouldFlip) baseAngle = 0;  // North (up)
    else baseAngle = 180;                                // South (down)
    
    // Fine rotation: difference between actual heading and the base angle
    // This is always within ±45° thanks to the quadrant selection
    let fineRotation = heading - baseAngle;
    // Normalize to -180..+180
    while (fineRotation > 180) fineRotation -= 360;
    while (fineRotation < -180) fineRotation += 360;
    // Clamp to ±45° as safety net (prevents ugly distortion)
    fineRotation = Math.max(-45, Math.min(45, fineRotation));
    
    // Convert to radians for canvas
    const fineRotationRad = fineRotation * Math.PI / 180;
    
    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = TRICYCLE_ICON_SIZE;
    canvas.height = TRICYCLE_ICON_SIZE;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, TRICYCLE_ICON_SIZE, TRICYCLE_ICON_SIZE);
    
    const half = TRICYCLE_ICON_SIZE / 2;
    const imgSize = TRICYCLE_ICON_SIZE - 8;
    
    ctx.save();
    // Move origin to center for rotation
    ctx.translate(half, half);
    // Apply fine rotation (aligns with route bearing)
    ctx.rotate(fineRotationRad);
    // Apply flip if needed
    if (shouldFlip) {
      if (isVertical) {
        ctx.scale(1, -1);   // Vertical flip (face down)
      } else {
        ctx.scale(-1, 1);   // Horizontal flip (face right)
      }
    }
    // Draw image centered at origin
    ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
    ctx.restore();
    
    // Get data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    // Cache it
    rotatedImageCache.set(roundedHeading, dataUrl);
    
    return dataUrl;
  } catch (error) {
    console.error('Failed to create rotated tricycle icon:', error);
    // Return fallback - horizontal image URL
    return TRICYCLE_HORIZONTAL_URL;
  }
};

// Synchronous version that uses cached image or returns placeholder
// This is used for initial render before async image loads
const createTricycleSvgUrl = (heading = 270) => {
  // Round heading for cache lookup
  const roundedHeading = Math.round(heading / 5) * 5;
  
  // If we have a cached rotated image, use it
  if (rotatedImageCache.has(roundedHeading)) {
    return rotatedImageCache.get(roundedHeading);
  }
  
  // Trigger async load for next time
  createRotatedTricycleUrl(heading);
  
  // Return a simple direction arrow SVG as placeholder while image loads
  // Uses same quadrant logic as canvas for 4-directional arrows
  const { isVertical, shouldFlip } = getImageOrientation(heading);
  
  // Arrow points in the direction of travel (4 directions)
  let arrowPoints;
  const size = TRICYCLE_ICON_SIZE;
  const half = size / 2;
  
  if (isVertical) {
    if (shouldFlip) {
      // Down arrow (South)
      arrowPoints = `${half},${size - 2} ${half - 8},${size - 14} ${half},${size - 10} ${half + 8},${size - 14}`;
    } else {
      // Up arrow (North)
      arrowPoints = `${half},2 ${half - 8},14 ${half},10 ${half + 8},14`;
    }
  } else {
    if (shouldFlip) {
      // Right arrow (East)
      arrowPoints = `${size - 2},${half} ${size - 14},${half - 8} ${size - 10},${half} ${size - 14},${half + 8}`;
    } else {
      // Left arrow (West)
      arrowPoints = `2,${half} 14,${half - 8} 10,${half} 14,${half + 8}`;
    }
  }
  
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TRICYCLE_ICON_SIZE} ${TRICYCLE_ICON_SIZE}" width="${TRICYCLE_ICON_SIZE}" height="${TRICYCLE_ICON_SIZE}">
      <!-- Pulsing GPS accuracy ring -->
      <circle cx="${TRICYCLE_ICON_SIZE/2}" cy="${TRICYCLE_ICON_SIZE/2}" r="${TRICYCLE_ICON_SIZE/2 - 4}" fill="none" stroke="#22C55E" stroke-width="3" opacity="0.5">
        <animate attributeName="r" values="${TRICYCLE_ICON_SIZE/2 - 8};${TRICYCLE_ICON_SIZE/2 - 2};${TRICYCLE_ICON_SIZE/2 - 8}" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite"/>
      </circle>
      
      <!-- Blue location dot -->
      <circle cx="${TRICYCLE_ICON_SIZE/2}" cy="${TRICYCLE_ICON_SIZE/2}" r="12" fill="#3B82F6" stroke="#fff" stroke-width="3"/>
      
      <!-- Direction indicator arrow (4 directions) -->
      <polygon 
        points="${arrowPoints}" 
        fill="#22C55E" 
        stroke="#16A34A" 
        stroke-width="1.5"
      />
    </svg>
  `;
  
  const svgBase64 = btoa(unescape(encodeURIComponent(svgTemplate)));
  return `data:image/svg+xml;base64,${svgBase64}`;
};

// Create dustbin SVG icon for destination (matches Leaflet dustbin icons)
const createDustbinSvgUrl = (wasteType, sourceType) => {
  // Determine color based on waste type (same logic as Map.jsx)
  const typeColorMap = {
    recyclable: 'request',
    organic: 'assignment',
    hazardous: 'request',
    electronic: 'assignment',
    general: 'assignment',
    plastic: 'request',
    paper: 'assignment',
    metal: 'request',
    glass: 'assignment'
  };
  
  // Digital bins are always black
  if (sourceType === 'digital_bin') {
    return createDigitalBinSvgUrl();
  }
  
  const iconType = typeColorMap[wasteType?.toLowerCase()] || 'assignment';
  
  const colors = {
    request: {
      main: '#EF4444', // Red-500
      dark: '#DC2626', // Red-600
      badge: 'R'
    },
    assignment: {
      main: '#3B82F6', // Blue-500
      dark: '#2563EB', // Blue-600
      badge: 'A'
    }
  };
  
  const currentColor = colors[iconType];
  
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
      
      <!-- Type indicator -->
      <circle cx="38" cy="12" r="6" fill="white" stroke="${currentColor.dark}" stroke-width="1.5"/>
      <text x="38" y="15" font-size="8" text-anchor="middle" fill="${currentColor.dark}" font-weight="bold" font-family="Arial, sans-serif">
        ${currentColor.badge}
      </text>
    </svg>
  `;
  
  const svgBase64 = btoa(unescape(encodeURIComponent(svgTemplate)));
  return `data:image/svg+xml;base64,${svgBase64}`;
};

// Create black dustbin SVG for digital bins
const createDigitalBinSvgUrl = () => {
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64">
      <!-- Wheels -->
      <circle cx="12" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      <circle cx="36" cy="56" r="4" fill="#1F2937" stroke="#111827" stroke-width="1.5"/>
      
      <!-- Wheel highlights -->
      <circle cx="12" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      <circle cx="36" cy="56" r="2" fill="#4B5563" opacity="0.7"/>
      
      <!-- Bin body - Black -->
      <path fill="#000000" stroke="#1F2937" stroke-width="1.5" 
            d="M40,16h-4v-2c0-1.1-0.9-2-2-2H14c-1.1,0-2,0.9-2,2v2H8v32c0,4.4,3.6,8,8,8h16c4.4,0,8-3.6,8-8V16H40z M18,16v-2h12v2H18z"/>
      
      <!-- Bin lid -->
      <path fill="#1F2937" stroke="#1F2937" stroke-width="1.5" 
            d="M40,16H8c-1.1,0-2-0.9-2-2v-2c0-1.1,0.9-2,2-2h32c1.1,0,2,0.9,2,2v2C42,15.1,41.1,16,40,16z"/>
      
      <!-- Lid handle -->
      <rect x="20" y="10" width="8" height="2" rx="1" fill="#9CA3AF"/>
      
      <!-- Digital indicator -->
      <path fill="#FFFFFF" d="M18,24 L30,24 Q32,24 32,26 L32,34 Q32,36 30,36 L18,36 Q16,36 16,34 L16,26 Q16,24 18,24 Z"/>
      <text x="24" y="32" font-size="8" text-anchor="middle" fill="#000000" font-weight="bold" font-family="Arial, sans-serif">D</text>
      
      <!-- Type indicator -->
      <circle cx="38" cy="12" r="6" fill="white" stroke="#1F2937" stroke-width="1.5"/>
      <text x="38" y="15" font-size="8" text-anchor="middle" fill="#1F2937" font-weight="bold" font-family="Arial, sans-serif">
        D
      </text>
    </svg>
  `;
  
  const svgBase64 = btoa(unescape(encodeURIComponent(svgTemplate)));
  return `data:image/svg+xml;base64,${svgBase64}`;
};

if (!GOOGLE_MAPS_API_KEY) {
  logger.error('❌ VITE_GOOGLE_MAPS_API_KEY is not set. Please add it to your .env file or Netlify environment variables.');
}

const GoogleMapsNavigation = ({ 
  userLocation, 
  destination,
  destinationName = '', // Name of destination for arrival announcement
  waypoints = [], // Array of waypoint coordinates [{lat, lng}, ...]
  navigationControlRef, // Ref to expose navigation control functions
  onMapReady,
  onRouteCalculated,
  onError,
  onNavigationStop, // Callback when navigation ends
  wasteType = 'general', // Waste type for destination icon color
  sourceType = 'pickup_request', // Source type (pickup_request or digital_bin)
  isArrived = false // When true, zoom out to show both user and destination markers
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const waypointMarkersRef = useRef([]); // Store waypoint markers
  
  // Store callbacks in refs to avoid infinite loops in useEffect
  const onMapReadyRef = useRef(onMapReady);
  const onRouteCalculatedRef = useRef(onRouteCalculated);
  const onErrorRef = useRef(onError);
  
  // Keep refs updated with latest callbacks
  onMapReadyRef.current = onMapReady;
  onRouteCalculatedRef.current = onRouteCalculated;
  onErrorRef.current = onError;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [navigationSteps, setNavigationSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [isFollowMode, setIsFollowMode] = useState(true); // Auto-follow user by default
  const [isTrackUp, setIsTrackUpState] = useState(false); // Track-Up (heading-up) vs North-Up orientation
  const isTrackUpRef = useRef(false); // Ref mirror for use inside GPS watchPosition callback
  const wasEverTrackUpRef = useRef(false); // Guard: only reset camera when transitioning FROM track-up
  const [mapInitialized, setMapInitialized] = useState(false); // Track if map has been initialized
  const gpsWatchIdRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  const routeCalculatedForRef = useRef(null); // Track destination for which route was calculated
  const lastUserLocationRef = useRef(null); // Track last user location for smooth updates
  const [currentHeading, setCurrentHeading] = useState(270); // Default to 270° (west/left) - will be updated to route direction
  const previousPositionRef = useRef(null); // Track previous position for heading calculation
  const walkingPolylineRef = useRef(null); // Dotted walking line from route endpoint to bin

  // Atomically update both state and ref for track-up mode
  const setTrackUp = (enabled) => {
    setIsTrackUpState(enabled);
    isTrackUpRef.current = enabled;
  };

  // --- Road snapping & dynamic rerouting state ---
  const routePolylineRef = useRef(null);       // Stores the decoded polyline path [{lat, lng}, ...]
  const lastRerouteTimeRef = useRef(0);        // Debounce rerouting (min 10s between re-routes)
  const isReroutingRef = useRef(false);        // Prevents concurrent reroute requests
  const REROUTE_DISTANCE_THRESHOLD = 20;       // meters off-route before triggering reroute
  const REROUTE_COOLDOWN_MS = 10000;           // minimum ms between reroute requests

  // Find the closest point on the route polyline to a given GPS position.
  // Returns { point: {lat, lng}, distance: number (meters), segmentIndex: number }
  const snapToPolyline = (userLat, userLng) => {
    const path = routePolylineRef.current;
    if (!path || path.length < 2 || !window.google?.maps?.geometry) return null;

    const userLatLng = new window.google.maps.LatLng(userLat, userLng);
    let minDist = Infinity;
    let closestPoint = null;
    let closestSegment = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const a = new window.google.maps.LatLng(path[i].lat, path[i].lng);
      const b = new window.google.maps.LatLng(path[i + 1].lat, path[i + 1].lng);

      // Project userLatLng onto segment a-b
      const projected = projectPointOnSegment(userLatLng, a, b);
      const dist = window.google.maps.geometry.spherical.computeDistanceBetween(userLatLng, projected);

      if (dist < minDist) {
        minDist = dist;
        closestPoint = { lat: projected.lat(), lng: projected.lng() };
        closestSegment = i;
      }
    }

    return { point: closestPoint, distance: minDist, segmentIndex: closestSegment };
  };

  // Project a point onto a line segment (returns the closest LatLng on segment a-b)
  const projectPointOnSegment = (p, a, b) => {
    const geometry = window.google.maps.geometry.spherical;
    const headingAB = geometry.computeHeading(a, b);
    const headingAP = geometry.computeHeading(a, p);
    const distAB = geometry.computeDistanceBetween(a, b);
    const distAP = geometry.computeDistanceBetween(a, p);

    // Projection scalar along segment a-b
    const angle = (headingAP - headingAB) * Math.PI / 180;
    let projectedDist = distAP * Math.cos(angle);

    // Clamp to segment bounds
    projectedDist = Math.max(0, Math.min(distAB, projectedDist));

    return geometry.computeOffset(a, projectedDist, headingAB);
  };

  // Trigger a dynamic reroute from the user's current position to the destination
  const triggerReroute = (fromLat, fromLng) => {
    const now = Date.now();
    if (isReroutingRef.current) return;
    if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN_MS) return;

    isReroutingRef.current = true;
    lastRerouteTimeRef.current = now;

    const destLat = Array.isArray(destination) ? destination[0] : destination?.lat;
    const destLng = Array.isArray(destination) ? destination[1] : destination?.lng;
    if (!destLat || !destLng) { isReroutingRef.current = false; return; }

    logger.info(`🔄 Rerouting from (${fromLat.toFixed(5)}, ${fromLng.toFixed(5)}) — driver is off-route`);

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: fromLat, lng: fromLng },
        destination: { lat: destLat, lng: destLng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        isReroutingRef.current = false;
        if (status === window.google.maps.DirectionsStatus.OK && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);

          // Re-apply track-up camera after setDirections resets tilt/heading
          if (isTrackUpRef.current && mapInstanceRef.current && window.google?.maps?.event) {
            window.google.maps.event.addListenerOnce(mapInstanceRef.current, 'idle', () => {
              if (isTrackUpRef.current) {
                mapInstanceRef.current.setTilt(45);
                mapInstanceRef.current.setHeading(currentHeading);
                if (mapInstanceRef.current.getZoom() < 18) mapInstanceRef.current.setZoom(18);
              }
            });
          }

          // Update stored polyline path from new route
          const overviewPath = result.routes[0]?.overview_path;
          if (overviewPath) {
            routePolylineRef.current = overviewPath.map(p => ({ lat: p.lat(), lng: p.lng() }));
          }

          // Update navigation steps from new route
          const allSteps = [];
          result.routes[0].legs.forEach((leg, legIndex) => {
            leg.steps.forEach((step, stepIndex) => {
              allSteps.push({
                legIndex, stepIndex,
                instruction: step.instructions,
                distance: step.distance.text,
                distanceValue: step.distance.value,
                duration: step.duration.text,
                maneuver: step.maneuver || 'continue',
                startLocation: step.start_location,
                endLocation: step.end_location
              });
            });
          });
          setNavigationSteps(allSteps);
          setCurrentStepIndex(0);

          logger.info('✅ Reroute complete — new route displayed');
        } else {
          logger.warn('⚠️ Reroute failed:', status);
        }
      }
    );
  };

  // Helper function to check if Google Maps API is fully loaded
  const isGoogleMapsFullyLoaded = () => {
    return window.google && 
           window.google.maps && 
           window.google.maps.Map && 
           typeof window.google.maps.Map === 'function';
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateGPSDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Voice announcement function using audio alert service
  const announceInstruction = (instruction, distance) => {
    audioAlertService.announceNavigation(instruction, distance);
  };

  // Arrival announcement with sound and vibration
  const announceArrival = (locationName) => {
    audioAlertService.announceArrival(locationName || 'pickup location', {
      playSound: true,
      vibrate: true,
      speak: true,
      repeat: true,       // Repeat if not acknowledged
      repeatInterval: 15000 // Every 15 seconds
    });
  };

  // Preload tricycle images on mount (both horizontal and vertical)
  useEffect(() => {
    loadTricycleImages().then(() => {
      logger.debug('✅ Tricycle images preloaded (horizontal + vertical)');
    }).catch((err) => {
      logger.warn('Failed to preload tricycle images:', err);
    });
  }, []);

  // Load Google Maps API
  useEffect(() => {
    if (isGoogleMapsFullyLoaded()) {
      setIsInitialized(true);
      return;
    }

    const loadGoogleMaps = async () => {
      try {
        // Check if script already exists
        if (document.querySelector('script[src*="maps.googleapis.com"]')) {
          // Wait for it to load
          let attempts = 0;
          const checkLoaded = setInterval(() => {
            if (isGoogleMapsFullyLoaded()) {
              clearInterval(checkLoaded);
              setIsInitialized(true);
              logger.info('✅ Google Maps API already loaded');
            } else if (attempts++ > 50) {
              clearInterval(checkLoaded);
              const error = 'Google Maps API failed to load';
              setHasError(true);
              setErrorMessage(error);
              if (onErrorRef.current) onErrorRef.current(error);
            }
          }, 100);
          return;
        }

        // Load new script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry&loading=async`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          // Wait for google.maps.Map constructor to be fully available
          const checkInterval = setInterval(() => {
            if (isGoogleMapsFullyLoaded()) {
              clearInterval(checkInterval);
              setIsInitialized(true);
              logger.info('✅ Google Maps API loaded successfully');
            }
          }, 100);
        };

        script.onerror = () => {
          const error = 'Failed to load Google Maps API';
          setHasError(true);
          setErrorMessage(error);
          if (onErrorRef.current) onErrorRef.current(error);
          logger.error('❌ Google Maps API loading error');
        };

        document.head.appendChild(script);
      } catch (error) {
        logger.error('❌ Error loading Google Maps:', error);
        setHasError(true);
        setErrorMessage(error.message);
        if (onErrorRef.current) onErrorRef.current(error.message);
      }
    };

    loadGoogleMaps();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOfflineMode(false);
      logger.info('🌐 Back online');
    };
    
    const handleOffline = () => {
      setIsOfflineMode(true);
      logger.info('📵 Gone offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cached route if offline
  useEffect(() => {
    if (!isOfflineMode || navigationSteps.length > 0) return;
    
    try {
      const cachedData = localStorage.getItem('cachedNavigationRoute');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        
        // Check if cache is expired (24 hours)
        if (parsedData.expiresAt > Date.now()) {
          logger.info('📦 Loading cached route for offline navigation');
          setNavigationSteps(parsedData.steps || []);
          setIsLoading(false);
          setHasError(false);
          
          if (onRouteCalculated && parsedData.routeInfo) {
            onRouteCalculated(parsedData.routeInfo);
          }
        } else {
          logger.info('⚠️ Cached route expired');
          localStorage.removeItem('cachedNavigationRoute');
        }
      }
    } catch (error) {
      logger.error('Error loading cached route:', error);
    }
  }, [isOfflineMode, navigationSteps.length, onRouteCalculated]);

  // Initialize map when API is ready
  useEffect(() => {
    if (!isInitialized || !mapRef.current || !userLocation || !destination) {
      return;
    }

    // Create a destination key to check if we've already calculated this route
    const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
    const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
    const destinationKey = `${destLat.toFixed(6)},${destLng.toFixed(6)}`;
    
    // Skip if route already calculated for this destination
    const shouldCalculateRoute = routeCalculatedForRef.current !== destinationKey;

    try {
      // Initialize map if not already done
      if (!mapInstanceRef.current) {
        logger.info('🗺️ Initializing Google Maps...');
        
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: userLocation.lat, lng: userLocation.lng },
          zoom: 15,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy', // Allow single-finger zoom/pan for non-tech-savvy users
        });

        mapInstanceRef.current = map;
        
        if (onMapReadyRef.current) {
          onMapReadyRef.current(map);
        }

        logger.info('✅ Google Maps initialized successfully');
      }

      const map = mapInstanceRef.current;

      // Only calculate route if destination changed (prevents infinite loop)
      if (!shouldCalculateRoute) {
        logger.debug('📍 Skipping route calculation - already calculated for this destination');
        setIsLoading(false);
        return;
      }

      // --- First-time or destination-changed: create markers & clear old state ---
      // Clear existing markers
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.setMap(null);
      }
      // Clear existing waypoint markers
      if (waypointMarkersRef.current && waypointMarkersRef.current.length > 0) {
        waypointMarkersRef.current.forEach(marker => marker.setMap(null));
        waypointMarkersRef.current = [];
      }
      // Clear walking polyline
      if (walkingPolylineRef.current) {
        walkingPolylineRef.current.setMap(null);
        walkingPolylineRef.current = null;
      }

      // Calculate initial heading from user position to destination
      const initialHeading = calculateBearing(
        userLocation.lat, userLocation.lng,
        destLat, destLng
      );
      setCurrentHeading(initialHeading);
      
      // Add user location marker (3D tricycle icon with heading rotation)
      previousPositionRef.current = { lat: userLocation.lat, lng: userLocation.lng };
      
      // Try to use modern AdvancedMarkerElement if available
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        const userPin = document.createElement('div');
        userPin.innerHTML = '🛵';
        userPin.style.fontSize = '32px';
        userPin.style.transform = `rotate(${initialHeading}deg)`;
        userPin.style.transition = 'transform 0.3s ease';
        
        userMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: userLocation.lat, lng: userLocation.lng },
          map: map,
          content: userPin,
          title: 'Your Location',
        });
      } else {
        // Fallback to legacy Marker
        userMarkerRef.current = new window.google.maps.Marker({
          position: { lat: userLocation.lat, lng: userLocation.lng },
          map: map,
          title: 'Your Location',
          icon: {
            url: createTricycleSvgUrl(initialHeading),
            scaledSize: new window.google.maps.Size(TRICYCLE_ICON_SIZE, TRICYCLE_ICON_SIZE),
            anchor: new window.google.maps.Point(TRICYCLE_ANCHOR_X, TRICYCLE_ANCHOR_Y),
          },
        });
      }
      
      // Async: load real rotated tricycle image to replace SVG placeholder
      createRotatedTricycleUrl(initialHeading).then((url) => {
        if (userMarkerRef.current) {
          userMarkerRef.current.setIcon({
            url: url,
            scaledSize: new window.google.maps.Size(TRICYCLE_ICON_SIZE, TRICYCLE_ICON_SIZE),
            anchor: new window.google.maps.Point(TRICYCLE_ANCHOR_X, TRICYCLE_ANCHOR_Y),
          });
        }
      });

      // Destination marker (dustbin icon)
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        const destPin = document.createElement('div');
        destPin.innerHTML = '🗑️';
        destPin.style.fontSize = '32px';
        
        destMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: destLat, lng: destLng },
          map: map,
          content: destPin,
          title: destinationName || 'Destination',
        });
      } else {
        // Fallback to legacy Marker
        destMarkerRef.current = new window.google.maps.Marker({
          position: { lat: destLat, lng: destLng },
          map: map,
          title: destinationName || 'Destination',
          icon: {
            url: createDustbinSvgUrl(wasteType, sourceType),
            scaledSize: new window.google.maps.Size(48, 64),
            anchor: new window.google.maps.Point(24, 64),
          },
        });
      }
      
      // Add waypoint markers (intermediate stops along the route)
      if (waypoints && waypoints.length > 0) {
        logger.info(`📍 Adding ${waypoints.length} waypoint markers to map`);
        waypointMarkersRef.current = waypoints.map((wp, index) => {
          const wpLat = wp.lat;
          const wpLng = wp.lng;
          
          // Try to use modern AdvancedMarkerElement if available
          if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
            const wpPin = document.createElement('div');
            wpPin.innerHTML = '📍';
            wpPin.style.fontSize = '24px';
            
            return new window.google.maps.marker.AdvancedMarkerElement({
              position: { lat: wpLat, lng: wpLng },
              map: map,
              content: wpPin,
              title: `Stop ${index + 1}`,
            });
          } else {
            // Fallback to legacy Marker
            return new window.google.maps.Marker({
              position: { lat: wpLat, lng: wpLng },
              map: map,
              title: `Stop ${index + 1}`,
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="8" fill="#4A90E2" stroke="white" stroke-width="2"/>
                    <circle cx="12" cy="12" r="3" fill="white"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(24, 24),
                anchor: new window.google.maps.Point(12, 12),
              },
            });
          }
        });
      }

      // Initialize Directions Service and Renderer
      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          map: map,
          suppressMarkers: true, // We'll use our custom markers
          polylineOptions: {
            strokeColor: '#4285F4',
            strokeWeight: 5,
            strokeOpacity: 0.8,
          },
        });
      }

      // Calculate and display route
      const directionsService = new window.google.maps.DirectionsService();
      
      // Prepare waypoints for Google Maps API
      const formattedWaypoints = waypoints.map(wp => ({
        location: { lat: wp.lat, lng: wp.lng },
        stopover: true
      }));
      
      const hasWaypoints = formattedWaypoints.length > 0;
      logger.info(`🛣️ Calculating route with ${hasWaypoints ? formattedWaypoints.length + ' waypoints' : 'direct path'}...`);
      
      const directionsRequest = {
        origin: { lat: userLocation.lat, lng: userLocation.lng },
        destination: { lat: destLat, lng: destLng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      };
      
      // Add waypoints if present
      if (hasWaypoints) {
        directionsRequest.waypoints = formattedWaypoints;
        directionsRequest.optimizeWaypoints = false; // Use our optimized order
      }
      
      // Mark that we're calculating for this destination
      routeCalculatedForRef.current = destinationKey;
      
      directionsService.route(
        directionsRequest,
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            directionsRendererRef.current.setDirections(result);

            // Re-apply track-up camera after setDirections resets tilt/heading
            if (isTrackUpRef.current && mapInstanceRef.current && window.google?.maps?.event) {
              window.google.maps.event.addListenerOnce(mapInstanceRef.current, 'idle', () => {
                if (isTrackUpRef.current) {
                  mapInstanceRef.current.setTilt(45);
                  mapInstanceRef.current.setHeading(currentHeading);
                  if (mapInstanceRef.current.getZoom() < 18) mapInstanceRef.current.setZoom(18);
                }
              });
            }
            
            // Extract route information
            const route = result.routes[0];
            
            // Store the overview polyline path for road-snapping & off-route detection
            if (route.overview_path) {
              routePolylineRef.current = route.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
              logger.debug(`📐 Stored route polyline with ${routePolylineRef.current.length} points for snapping`);
            }
            
            // Calculate total distance and duration across all legs
            let totalDistance = 0;
            let totalDuration = 0;
            let totalSteps = 0;
            
            // Extract all navigation steps from all legs
            const allSteps = [];
            route.legs.forEach((leg, legIndex) => {
              totalDistance += leg.distance.value; // in meters
              totalDuration += leg.duration.value; // in seconds
              
              leg.steps.forEach((step, stepIndex) => {
                allSteps.push({
                  legIndex,
                  stepIndex,
                  instruction: step.instructions,
                  distance: step.distance.text,
                  distanceValue: step.distance.value,
                  duration: step.duration.text,
                  maneuver: step.maneuver || 'continue',
                  startLocation: step.start_location,
                  endLocation: step.end_location
                });
              });
              
              totalSteps += leg.steps.length;
            });
            
            // Store navigation steps for turn-by-turn
            setNavigationSteps(allSteps);
            
            const routeInfo = {
              distance: `${(totalDistance / 1000).toFixed(1)} km`,
              duration: `${Math.round(totalDuration / 60)} min`,
              steps: totalSteps,
              legs: route.legs.length
            };
            
            // Cache route data for offline use
            try {
              const offlineRouteData = {
                steps: allSteps,
                routeInfo,
                timestamp: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
              };
              localStorage.setItem('cachedNavigationRoute', JSON.stringify(offlineRouteData));
              logger.info('💾 Route cached for offline navigation');
            } catch (error) {
              logger.warn('Failed to cache route:', error);
            }
            
            logger.info('✅ Route calculated successfully:', routeInfo);
            logger.info(`📍 Extracted ${allSteps.length} navigation steps`);
            
            // --- Draw dotted walking line from last road point to bin ---
            // Google's Directions API includes the off-road final approach in
            // BOTH overview_path AND lastLeg.end_location, so comparing either
            // to the destination always gives ~0m. Instead, we scan backward
            // through overview_path to find the last point that is meaningfully
            // away from the destination — that's the real road endpoint.
            const actualDestLat = Array.isArray(destination) ? destination[0] : destination?.lat;
            const actualDestLng = Array.isArray(destination) ? destination[1] : destination?.lng;
            const overviewPath = route.overview_path;
            
            if (overviewPath && overviewPath.length >= 2 && mapInstanceRef.current && actualDestLat && actualDestLng) {
              // Scan backward to find the last road point (first point > 8m from destination)
              let roadEndLat = null;
              let roadEndLng = null;
              for (let i = overviewPath.length - 1; i >= 0; i--) {
                const pt = overviewPath[i];
                const ptLat = typeof pt.lat === 'function' ? pt.lat() : pt.lat;
                const ptLng = typeof pt.lng === 'function' ? pt.lng() : pt.lng;
                const distFromDest = calculateGPSDistance(ptLat, ptLng, actualDestLat, actualDestLng);
                if (distFromDest > 8) {
                  roadEndLat = ptLat;
                  roadEndLng = ptLng;
                  logger.info(`🚶 Found road point at index ${i}/${overviewPath.length - 1}, ${distFromDest.toFixed(1)}m from bin`);
                  break;
                }
              }
              
              if (roadEndLat !== null) {
                const walkDist = calculateGPSDistance(roadEndLat, roadEndLng, actualDestLat, actualDestLng);
                logger.info(`🚶 Walking gap: ${walkDist.toFixed(1)}m (road: ${roadEndLat.toFixed(6)},${roadEndLng.toFixed(6)} → bin: ${actualDestLat.toFixed(6)},${actualDestLng.toFixed(6)})`);
                
                // Draw walking line if gap > 15m (smaller gaps mean bin is basically on the road)
                if (walkDist > 15) {
                  // Remove old walking polyline
                  if (walkingPolylineRef.current) {
                    walkingPolylineRef.current.setMap(null);
                  }
                  
                  walkingPolylineRef.current = new window.google.maps.Polyline({
                    path: [
                      { lat: roadEndLat, lng: roadEndLng },
                      { lat: actualDestLat, lng: actualDestLng }
                    ],
                    map: mapInstanceRef.current,
                    strokeColor: '#F97316',
                    strokeOpacity: 0,
                    strokeWeight: 3,  // Must be >0 for icons to render on all browsers
                    icons: [{
                      icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 5,
                        fillColor: '#F97316',
                        fillOpacity: 1,
                        strokeColor: '#EA580C',
                        strokeWeight: 1,
                      },
                      offset: '0',
                      repeat: '14px'
                    }],
                    zIndex: 100
                  });
                  
                  logger.info(`🚶 Walking line drawn: ${walkDist.toFixed(0)}m from last road point to bin`);
                } else {
                  logger.info(`🚶 No walking line needed — road point is only ${walkDist.toFixed(1)}m from bin`);
                }
              } else {
                logger.info('🚶 All overview_path points are within 8m of destination — bin is on the road');
              }
            } else {
              logger.warn('🚶 Could not evaluate walking line — missing overview_path or destination');
            }
            
            if (onRouteCalculatedRef.current) {
              onRouteCalculatedRef.current(routeInfo);
            }
            
            setIsLoading(false);
          } else {
            const error = `Directions request failed: ${status}`;
            logger.error('❌ Routing error:', error);
            setHasError(true);
            setErrorMessage(error);
            if (onErrorRef.current) onErrorRef.current(error);
            setIsLoading(false);
          }
        }
      );

    } catch (error) {
      logger.error('❌ Error initializing Google Maps:', error);
      setHasError(true);
      setErrorMessage(error.message);
      if (onErrorRef.current) onErrorRef.current(error.message);
      setIsLoading(false);
    }
  }, [isInitialized, userLocation, destination, waypoints, wasteType, sourceType]);

  // Calculate heading towards next point on the route (route-aware heading)
  const getRouteBasedHeading = (userLat, userLng) => {
    // Priority 1: If we have navigation steps, point towards next step's start/end location
    if (navigationSteps.length > 0 && currentStepIndex < navigationSteps.length) {
      const currentStep = navigationSteps[currentStepIndex];
      if (currentStep?.endLocation) {
        const endLat = typeof currentStep.endLocation.lat === 'function' 
          ? currentStep.endLocation.lat() 
          : currentStep.endLocation.lat;
        const endLng = typeof currentStep.endLocation.lng === 'function' 
          ? currentStep.endLocation.lng() 
          : currentStep.endLocation.lng;
        
        if (endLat && endLng) {
          return calculateBearing(userLat, userLng, endLat, endLng);
        }
      }
    }
    
    // Priority 2: Point towards destination
    if (destination) {
      const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
      const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
      return calculateBearing(userLat, userLng, destLat, destLng);
    }
    
    return null; // No route info available
  };

  // Real-time marker position update with heading-based rotation (separate from route calculation)
  useEffect(() => {
    if (!mapInstanceRef.current || !userMarkerRef.current || !userLocation) {
      return;
    }

    // Check if location actually changed significantly (>3m) to avoid jitter
    const lastLoc = lastUserLocationRef.current;
    if (lastLoc) {
      const distance = calculateGPSDistance(
        lastLoc.lat, lastLoc.lng,
        userLocation.lat, userLocation.lng
      );
      if (distance < 3) {
        return; // Skip tiny movements (GPS noise)
      }
    }

    // --- Heading / bearing determination ---
    // Priority 1: Route-based heading (aligns icon with the blue route line)
    // Priority 2: GPS-reported heading (device compass/bearing)
    // Priority 3: Movement-based heading (calculated from consecutive positions)
    // Stationary hold: only when speed is explicitly reported < threshold
    let newHeading = currentHeading;
    let headingSource = 'unchanged';
    
    const speed = userLocation.speed ?? null; // m/s from Geolocation API or null
    const gpsHeading = userLocation.heading ?? null; // degrees from Geolocation API or null
    
    // Determine if the driver is moving:
    // - If speed is reported: use the 2 km/h threshold
    // - If speed is NOT reported (null, common from getCurrentLocation): infer from position delta
    let isMoving;
    const prevPos = previousPositionRef.current;
    if (speed !== null) {
      isMoving = speed >= MIN_SPEED_FOR_HEADING;
    } else if (prevPos) {
      const movedDist = calculateGPSDistance(prevPos.lat, prevPos.lng, userLocation.lat, userLocation.lng);
      isMoving = movedDist >= 3; // Moved ≥3m between updates → in motion
    } else {
      isMoving = true; // First position update — assume moving to set initial heading
    }
    
    // Priority 1: Route-based heading (best visual alignment with blue route line)
    if (isMoving) {
      const routeHeading = getRouteBasedHeading(userLocation.lat, userLocation.lng);
      if (routeHeading !== null) {
        newHeading = routeHeading;
        headingSource = 'route';
      }
    }
    
    // Priority 2: GPS-reported heading (if route heading not available)
    if (headingSource === 'unchanged' && isMoving && gpsHeading !== null && gpsHeading >= 0) {
      newHeading = gpsHeading;
      headingSource = 'GPS-bearing';
    }
    
    // Priority 3: Movement vector (fallback)
    if (headingSource === 'unchanged' && isMoving && prevPos) {
      const moveDist = calculateGPSDistance(
        prevPos.lat, prevPos.lng,
        userLocation.lat, userLocation.lng
      );
      if (moveDist >= 3) {
        newHeading = calculateBearing(
          prevPos.lat, prevPos.lng,
          userLocation.lat, userLocation.lng
        );
        headingSource = 'movement';
      }
    }
    
    // Stationary: only when speed is explicitly reported as < threshold
    if (headingSource === 'unchanged' && speed !== null && speed < MIN_SPEED_FOR_HEADING) {
      headingSource = 'stationary-hold';
    }
    
    if (headingSource !== 'unchanged' && headingSource !== 'stationary-hold') {
      setCurrentHeading(newHeading);
    }
    
    // Update previous position for next heading calculation
    previousPositionRef.current = { lat: userLocation.lat, lng: userLocation.lng };

    // --- Road snapping & off-route detection ---
    let displayLat = userLocation.lat;
    let displayLng = userLocation.lng;
    let offRouteDistance = 0;

    const snapResult = snapToPolyline(userLocation.lat, userLocation.lng);
    if (snapResult && snapResult.point) {
      offRouteDistance = snapResult.distance;

      if (offRouteDistance <= REROUTE_DISTANCE_THRESHOLD) {
        // Within tolerance — snap marker to the road (polyline)
        displayLat = snapResult.point.lat;
        displayLng = snapResult.point.lng;
      } else {
        // Off-route by >20m — keep raw GPS position and trigger reroute
        logger.info(`⚠️ Off-route by ${offRouteDistance.toFixed(0)}m (threshold: ${REROUTE_DISTANCE_THRESHOLD}m) — requesting reroute`);
        triggerReroute(userLocation.lat, userLocation.lng);
      }
    }

    // Update marker position (snapped or raw)
    userMarkerRef.current.setPosition({ lat: displayLat, lng: displayLng });
    
    // Update marker icon with new heading rotation (async load)
    // In Track-Up mode the map itself rotates, so the icon should face "up" (0°)
    const iconHeading = isTrackUp ? 0 : newHeading;
    createRotatedTricycleUrl(iconHeading).then((url) => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setIcon({
          url: url,
          scaledSize: new window.google.maps.Size(TRICYCLE_ICON_SIZE, TRICYCLE_ICON_SIZE),
          anchor: new window.google.maps.Point(TRICYCLE_ANCHOR_X, TRICYCLE_ANCHOR_Y),
        });
      }
    });
    
    // Store last location
    lastUserLocationRef.current = { lat: userLocation.lat, lng: userLocation.lng };

    // Auto-pan map to follow user in follow mode
    if (isFollowMode && mapInstanceRef.current) {
      const map = mapInstanceRef.current;

      if (isTrackUp) {
        // Track-Up: rotate map so travel direction faces top, 3D tilt, higher zoom
        map.setHeading(newHeading);
        map.setTilt(45);
        const currentZoom = map.getZoom();
        if (currentZoom < 18) map.setZoom(18);
      } else {
        // North-Up: standard zoom, flat
        const navigationZoom = 17;
        const currentZoom = map.getZoom();
        if (currentZoom < navigationZoom - 1) {
          map.setZoom(navigationZoom);
        }
      }
      
      // Smoothly pan to snapped position
      map.panTo({ lat: displayLat, lng: displayLng });
    }

    logger.debug(`📍 Marker updated | Heading: ${newHeading.toFixed(1)}° (${headingSource}) | Speed: ${speed !== null ? (speed * 3.6).toFixed(1) + ' km/h' : 'N/A'} | Off-route: ${offRouteDistance.toFixed(0)}m`);
  }, [userLocation, isFollowMode, isTrackUp, currentHeading, navigationSteps, currentStepIndex, destination]);

  // GPS tracking for auto-advance navigation
  useEffect(() => {
    if (!isNavigating || navigationSteps.length === 0) {
      // Stop GPS tracking when not navigating
      if (gpsWatchIdRef.current) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      return;
    }

    // Start GPS tracking
    logger.info('📍 Starting GPS tracking for auto-advance...');
    
    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const gpsSpeed = position.coords.speed; // m/s or null
        const gpsBearing = position.coords.heading; // degrees or null
        
        setCurrentPosition({ lat: userLat, lng: userLng, speed: gpsSpeed, heading: gpsBearing });

        // --- Heading determination (same priority as marker update useEffect) ---
        // Priority 1: Route-based (aligns with blue line)
        // Priority 2: GPS bearing
        // Priority 3: Movement vector
        let heading = currentHeading;
        let headingUpdated = false;
        
        const prevPos = previousPositionRef.current;
        const isMoving = gpsSpeed !== null
          ? gpsSpeed >= MIN_SPEED_FOR_HEADING
          : (prevPos ? calculateGPSDistance(prevPos.lat, prevPos.lng, userLat, userLng) >= 3 : true);
        
        if (isMoving) {
          // Priority 1: Route-based heading
          const routeHeading = getRouteBasedHeading(userLat, userLng);
          if (routeHeading !== null) {
            heading = routeHeading;
            headingUpdated = true;
          }
          // Priority 2: GPS bearing
          if (!headingUpdated && gpsBearing !== null && gpsBearing >= 0) {
            heading = gpsBearing;
            headingUpdated = true;
          }
          // Priority 3: Movement vector
          if (!headingUpdated && prevPos) {
            const movementDistance = calculateGPSDistance(prevPos.lat, prevPos.lng, userLat, userLng);
            if (movementDistance >= 3) {
              heading = calculateBearing(prevPos.lat, prevPos.lng, userLat, userLng);
              headingUpdated = true;
            }
          }
        }
        if (headingUpdated) setCurrentHeading(heading);
        previousPositionRef.current = { lat: userLat, lng: userLng };

        // --- Road snapping & off-route detection (same as marker update useEffect) ---
        let displayLat = userLat;
        let displayLng = userLng;

        const snapResult = snapToPolyline(userLat, userLng);
        if (snapResult && snapResult.point) {
          if (snapResult.distance <= REROUTE_DISTANCE_THRESHOLD) {
            displayLat = snapResult.point.lat;
            displayLng = snapResult.point.lng;
          } else {
            // Off-route — trigger reroute
            triggerReroute(userLat, userLng);
          }
        }

        // Update user marker on map with snapped position + heading rotation
        if (userMarkerRef.current && mapInstanceRef.current) {
          userMarkerRef.current.setPosition({ lat: displayLat, lng: displayLng });
          // In Track-Up mode icon faces "up" (0°) since the map rotates
          const gpsIconHeading = isTrackUpRef.current ? 0 : heading;
          createRotatedTricycleUrl(gpsIconHeading).then((url) => {
            if (userMarkerRef.current) {
              userMarkerRef.current.setIcon({
                url: url,
                scaledSize: new window.google.maps.Size(TRICYCLE_ICON_SIZE, TRICYCLE_ICON_SIZE),
                anchor: new window.google.maps.Point(TRICYCLE_ANCHOR_X, TRICYCLE_ANCHOR_Y),
              });
            }
          });

          // Track-Up camera: rotate map bearing + tilt during active navigation
          if (isTrackUpRef.current) {
            const map = mapInstanceRef.current;
            map.setHeading(heading);
            map.setTilt(45);
            map.panTo({ lat: displayLat, lng: displayLng });
          }
        }

        // Check if we've reached the next step location
        const currentStep = navigationSteps[currentStepIndex];
        if (currentStep && currentStep.endLocation) {
          // Handle both Google Maps LatLng objects (methods) and plain objects (properties)
          const endLat = typeof currentStep.endLocation.lat === 'function' 
            ? currentStep.endLocation.lat() 
            : currentStep.endLocation.lat;
          const endLng = typeof currentStep.endLocation.lng === 'function' 
            ? currentStep.endLocation.lng() 
            : currentStep.endLocation.lng;
          
          const distanceToNextPoint = calculateGPSDistance(
            userLat,
            userLng,
            endLat,
            endLng
          );

          logger.debug(`Distance to next point: ${distanceToNextPoint.toFixed(0)}m`);

          // Auto-advance when within 30 meters of the step endpoint
          if (distanceToNextPoint < 30) {
            if (currentStepIndex < navigationSteps.length - 1) {
              logger.info(`✅ Reached waypoint! Advancing to step ${currentStepIndex + 2}`);
              
              const nextIndex = currentStepIndex + 1;
              setCurrentStepIndex(nextIndex);
              
              // Announce next instruction
              const nextStep = navigationSteps[nextIndex];
              if (nextStep) {
                announceInstruction(nextStep.instruction, nextStep.distance);
              }
            } else {
              // Reached final destination
              logger.info('🎉 Destination reached!');
              
              // Use enhanced arrival alert with sound and vibration
              announceArrival(destinationName || 'pickup location');
              setIsNavigating(false);
              
              // Notify parent
              if (onNavigationStop) {
                onNavigationStop();
              }
            }
          }
          // Voice announcement when 200m away from turn
          else if (distanceToNextPoint < 200 && distanceToNextPoint > 150) {
            const distanceText = `${Math.round(distanceToNextPoint)} meters`;
            announceInstruction(currentStep.instruction, distanceText);
          }
        }
      },
      (error) => {
        logger.error('GPS tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );

    // Cleanup GPS tracking
    return () => {
      if (gpsWatchIdRef.current) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      // Stop any ongoing speech
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isNavigating, navigationSteps, currentStepIndex]);

  // Expose navigation control functions to parent
  useEffect(() => {
    if (navigationControlRef) {
      navigationControlRef.current = {
        startNavigation: async () => {
          if (navigationSteps.length > 0) {
            // Initialize audio service (requires user interaction)
            await audioAlertService.initialize();
            audioAlertService.resetArrivalState();
            
            setIsNavigating(true);
            setCurrentStepIndex(0);
            setIsFollowMode(true);
            
            // Activate Track-Up (heading-up) mode for active guidance
            setTrackUp(true);
            
            logger.info('🧭 Starting turn-by-turn navigation (Track-Up enabled)');
            
            // Announce first instruction
            const firstStep = navigationSteps[0];
            if (firstStep) {
              announceInstruction(firstStep.instruction, firstStep.distance);
            }
          } else {
            logger.warn('⚠️ No navigation steps available');
          }
        },
        stopNavigation: () => {
          setIsNavigating(false);
          
          // Revert to North-Up flat orientation
          setTrackUp(false);
          
          logger.info('⏹️ Navigation stopped (North-Up restored)');
          
          // Stop audio alerts and acknowledge arrival
          audioAlertService.acknowledgeArrival();
          audioAlertService.stopSpeaking();
        },
        acknowledgeArrival: () => {
          audioAlertService.acknowledgeArrival();
        },
        hasSteps: () => navigationSteps.length > 0,
        enableTrackUp: () => {
          setTrackUp(true);
          setIsFollowMode(true);
          // Apply camera settings directly (don't rely solely on useEffect)
          // Use refs to avoid stale closure values
          if (mapInstanceRef.current) {
            const map = mapInstanceRef.current;
            map.setTilt(45);
            if (map.getZoom() < 18) map.setZoom(18);
            // Pan to last known position if available
            const lastPos = lastUserLocationRef.current || previousPositionRef.current;
            if (lastPos) {
              map.panTo({ lat: lastPos.lat, lng: lastPos.lng });
            }
            // Heading will be updated by GPS tracking on next position update
          }
          logger.info('🧭 Track-Up enabled via parent control');
        },
        disableTrackUp: () => {
          setTrackUp(false);
          logger.info('🧭 Track-Up disabled via parent control');
        }
      };
    }
  }, [navigationSteps, navigationControlRef]);

  // Zoom out to show both user marker and bin marker on arrival
  useEffect(() => {
    if (!isArrived || !mapInstanceRef.current) return;

    // Disable follow mode so the zoom-out isn't overridden by auto-pan
    setIsFollowMode(false);

    const map = mapInstanceRef.current;
    const bounds = new window.google.maps.LatLngBounds();

    // Include user location
    if (userLocation) {
      bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
    }

    // Include destination
    const destLat = Array.isArray(destination) ? destination[0] : destination?.lat;
    const destLng = Array.isArray(destination) ? destination[1] : destination?.lng;
    if (destLat && destLng) {
      bounds.extend({ lat: destLat, lng: destLng });
    }

    // Fit bounds with padding so both markers are comfortably visible
    map.fitBounds(bounds, { top: 60, bottom: 60, left: 40, right: 40 });

    // Cap the zoom so it doesn't zoom in too much if markers are very close
    const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
      if (map.getZoom() > 18) {
        map.setZoom(18);
      }
    });

    logger.info('🔍 Map zoomed out to show both user and bin markers on arrival');

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [isArrived, destination, userLocation]);

  // Handle track-up mode transitions — animate camera when toggling orientation
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    let idleListener = null;

    if (isTrackUp) {
      wasEverTrackUpRef.current = true;

      const applyTrackUpCamera = () => {
        map.setTilt(45);
        map.setHeading(currentHeading);
        const currentZoom = map.getZoom();
        if (currentZoom < 18) map.setZoom(18);
        if (userLocation) {
          map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
        }
      };

      // Apply immediately
      applyTrackUpCamera();

      // Re-apply after map settles — guards against setDirections()/fitBounds()
      // asynchronously resetting tilt/heading after our initial application
      if (window.google?.maps?.event) {
        idleListener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
          if (isTrackUpRef.current) {
            applyTrackUpCamera();
          }
        });
      }

      logger.info('🧭 Track-Up mode enabled: heading-up with 3D tilt');
    } else if (wasEverTrackUpRef.current) {
      // Only reset camera when transitioning FROM track-up (not on initial mount)
      wasEverTrackUpRef.current = false;
      map.setTilt(0);
      map.setHeading(0);
      logger.info('🧭 North-Up mode restored');
    }

    return () => {
      if (idleListener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(idleListener);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTrackUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.setMap(null);
      }
      // Clean up waypoint markers
      if (waypointMarkersRef.current && waypointMarkersRef.current.length > 0) {
        waypointMarkersRef.current.forEach(marker => marker.setMap(null));
        waypointMarkersRef.current = [];
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      // Clean up walking polyline (dotted line to bin)
      if (walkingPolylineRef.current) {
        walkingPolylineRef.current.setMap(null);
        walkingPolylineRef.current = null;
      }
      // Cleanup audio alerts
      audioAlertService.acknowledgeArrival();
      audioAlertService.stopSpeaking();
      // Note: Google Maps instance cleanup is automatic when DOM element is removed
    };
  }, []);

  // Cache route for offline use when calculated
  useEffect(() => {
    if (navigationSteps.length > 0 && navigator.onLine) {
      const cacheRouteData = async () => {
        try {
          await offlineMapService.initialize();
          
          // Extract polyline coordinates from navigation steps
          const polylineCoords = navigationSteps.map(step => ({
            lat: step.startLocation?.lat?.() || step.startLocation?.lat,
            lng: step.startLocation?.lng?.() || step.startLocation?.lng
          })).filter(coord => coord.lat && coord.lng);
          
          // Add end location of last step
          const lastStep = navigationSteps[navigationSteps.length - 1];
          if (lastStep?.endLocation) {
            polylineCoords.push({
              lat: lastStep.endLocation.lat?.() || lastStep.endLocation.lat,
              lng: lastStep.endLocation.lng?.() || lastStep.endLocation.lng
            });
          }
          
          // Serialize navigation steps to plain objects (remove Google Maps functions)
          const serializedSteps = navigationSteps.map(step => ({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            startLocation: step.startLocation ? {
              lat: typeof step.startLocation.lat === 'function' ? step.startLocation.lat() : step.startLocation.lat,
              lng: typeof step.startLocation.lng === 'function' ? step.startLocation.lng() : step.startLocation.lng
            } : null,
            endLocation: step.endLocation ? {
              lat: typeof step.endLocation.lat === 'function' ? step.endLocation.lat() : step.endLocation.lat,
              lng: typeof step.endLocation.lng === 'function' ? step.endLocation.lng() : step.endLocation.lng
            } : null
          }));
          
          // Save route data
          await offlineMapService.saveRoute('current-navigation', {
            steps: serializedSteps,
            polylineCoords,
            destination,
            destinationName,
            userLocation
          });
          
          // Cache tiles along the route
          if (polylineCoords.length > 0) {
            logger.info('📦 Caching tiles for offline navigation...');
            let lastLoggedPercent = -1; // Track last logged percentage to avoid spam
            await offlineMapService.cacheRouteArea(polylineCoords, (progress) => {
              // Only log at 25%, 50%, 75%, 100% milestones (not every batch)
              const milestone = Math.floor(progress.percent / 25) * 25;
              if (milestone > lastLoggedPercent && milestone <= 100) {
                lastLoggedPercent = milestone;
                logger.debug(`📦 Tile caching: ${milestone}% (${progress.cached}/${progress.total})`);
              }
            });
          }
        } catch (error) {
          logger.warn('Failed to cache route for offline use:', error);
        }
      };
      
      cacheRouteData();
    }
  }, [navigationSteps, destination, destinationName, userLocation]);

  // Render offline map when Google Maps fails to load (API error or offline)
  // This provides a fallback navigation experience using Leaflet/OpenStreetMap
  if (hasError || (isOfflineMode && !isInitialized)) {
    logger.info('📵 Rendering offline navigation map (Google Maps unavailable)');
    
    return (
      <OfflineNavigationMap
        userLocation={userLocation}
        destination={destination}
        destinationName={destinationName}
        routeCoordinates={[]}
        navigationSteps={navigationSteps}
        currentStepIndex={currentStepIndex}
        wasteType={wasteType}
        isNavigating={isNavigating}
        onMapReady={onMapReady}
      />
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map and route...</p>
          </div>
        </div>
      )}
      
      {/* Hands-Free Navigation Overlay - Compact */}
      {isNavigating && navigationSteps.length > 0 && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Current Instruction - Compact Design */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-blue-600 to-blue-500 text-white shadow-lg pointer-events-auto">
            <div className="px-3 py-2">
              {/* Progress and Distance - Single Row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <div className="bg-white bg-opacity-20 rounded-full px-2 py-0.5">
                    <span className="text-xs font-bold">
                      {currentStepIndex + 1}/{navigationSteps.length}
                    </span>
                  </div>
                  <svg className="h-4 w-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs opacity-90">GPS Active</span>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {navigationSteps[currentStepIndex]?.distance}
                  </div>
                </div>
              </div>
              
              {/* Main Instruction - Compact */}
              <div 
                className="text-base font-semibold leading-tight"
                dangerouslySetInnerHTML={{ 
                  __html: navigationSteps[currentStepIndex]?.instruction || 'Continue on route' 
                }}
              />
              
              {/* Next Step Preview - Very Compact, Single Line */}
              {currentStepIndex < navigationSteps.length - 1 && (
                <div className="bg-white bg-opacity-10 rounded px-2 py-1 mt-1 flex items-center">
                  <span className="text-xs opacity-75 mr-2">THEN</span>
                  <span 
                    className="text-xs opacity-90 truncate"
                    dangerouslySetInnerHTML={{ 
                      __html: navigationSteps[currentStepIndex + 1]?.instruction || 'Continue' 
                    }}
                  />
                </div>
              )}
            </div>
            
            {/* Exit Button - Top Right Corner */}
            <button
              onClick={() => {
                setIsNavigating(false);
                // Revert to North-Up flat orientation
                setTrackUp(false);
                if (window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                // Notify parent
                if (onNavigationStop) {
                  onNavigationStop();
                }
              }}
              className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full shadow-lg transition-colors"
              title="Exit Navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Auto-Advance Indicator with Offline Status */}
          <div className={`absolute bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full shadow-lg pointer-events-auto flex items-center space-x-2 ${
            isOfflineMode ? 'bg-orange-500' : 'bg-green-500'
          } text-white`}>
            <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {isOfflineMode ? 'Offline Navigation Active' : 'Auto-Navigation Active'}
            </span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isOfflineMode ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
        </div>
      )}
      
      {/* Map Control Buttons - Positioned to avoid Google Maps native controls */}
      {!isLoading && (
        <div className="absolute bottom-4 left-4 z-10 flex flex-col space-y-2">
          {/* Recenter / Follow Mode Toggle */}
          <button
            onClick={() => {
              if (!isFollowMode) {
                // Switching to follow mode - recenter and zoom in
                setIsFollowMode(true);
                if (mapInstanceRef.current && userLocation) {
                  const map = mapInstanceRef.current;
                  if (isTrackUp) {
                    // Re-enter track-up: higher zoom, 3D tilt, heading rotation
                    map.setZoom(18);
                    map.setHeading(currentHeading);
                    map.setTilt(45);
                  } else {
                    map.setZoom(17);
                  }
                  map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
                }
              } else {
                // Switching to overview mode - fit bounds to show entire route
                setIsFollowMode(false);
                // Flatten to North-Up for overview
                if (isTrackUp) {
                  setTrackUp(false);
                }
                if (mapInstanceRef.current && userLocation && destination) {
                  const bounds = new window.google.maps.LatLngBounds();
                  bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
                  const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
                  const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
                  bounds.extend({ lat: destLat, lng: destLng });
                  mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
                }
              }
            }}
            className={`p-3 rounded-full shadow-lg transition-all ${
              isFollowMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            title={isFollowMode ? 'Show full route (Overview)' : 'Follow my location'}
          >
            {isFollowMode ? (
              // Crosshairs icon - currently following
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
            ) : (
              // Location arrow icon - click to follow
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          
          {/* Track-Up / North-Up Orientation Toggle */}
          <button
            onClick={() => {
              const newTrackUp = !isTrackUp;
              setTrackUp(newTrackUp);
              // When enabling track-up, also enable follow mode
              if (newTrackUp) {
                setIsFollowMode(true);
              }
            }}
            className={`p-3 rounded-full shadow-lg transition-all ${
              isTrackUp
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            title={isTrackUp ? 'Switch to North-Up' : 'Switch to Track-Up (heading-up)'}
          >
            {isTrackUp ? (
              // Compass needle icon — track-up active
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2, 15 14, 12 11, 9 14" fill="currentColor" stroke="none" />
                <polygon points="12 22, 9 14, 12 13, 15 14" fill="none" stroke="currentColor" />
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" />
              </svg>
            ) : (
              // North arrow icon — north-up (default)
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L12 22" />
                <path d="M12 2L8 8" />
                <path d="M12 2L16 8" />
                <text x="12" y="20" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">N</text>
              </svg>
            )}
          </button>

          {/* Overview button - quick access to see full route */}
          {isFollowMode && (
            <button
              onClick={() => {
                if (mapInstanceRef.current && userLocation && destination) {
                  const bounds = new window.google.maps.LatLngBounds();
                  bounds.extend({ lat: userLocation.lat, lng: userLocation.lng });
                  const destLat = Array.isArray(destination) ? destination[0] : destination.lat;
                  const destLng = Array.isArray(destination) ? destination[1] : destination.lng;
                  bounds.extend({ lat: destLat, lng: destLng });
                  mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
                  setIsFollowMode(false);
                  // Temporarily disable track-up for overview
                  setTrackUp(false);
                }
              }}
              className="p-3 rounded-full shadow-lg bg-white text-gray-700 hover:bg-gray-100 transition-all"
              title="View full route"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </button>
          )}
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

export default GoogleMapsNavigation;
