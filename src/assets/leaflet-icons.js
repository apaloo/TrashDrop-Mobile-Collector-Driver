import L from 'leaflet';

// Import marker icons for proper Vite asset handling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Create dustbin icon
export const dustbinIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H8v2h1v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9h1V7zm-10-2h4v2h-4V5zm7 20H11V9h10v14z" fill="#3b82f6"/>
      <path d="M13 11h2v12h-2zM17 11h2v12h-2z" fill="#fff"/>
    </svg>
  `)}`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

export { markerIcon2x, markerIcon, markerShadow };
