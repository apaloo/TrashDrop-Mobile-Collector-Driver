/**
 * Which requests a collector sees as "available": one rule for the Map and
 * the Request page.
 *
 * - Off-Duty: none.
 * - On-Duty: requests inside the search radius around the collector's
 *   position, narrowed by the waste type / minimum payment / priority filters.
 *   Pickup requests must still be pending; digital bins skip that check (they
 *   are fetched already filtered by status).
 */

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 10;

/**
 * [lng, lat] from PostGIS EWKB/WKB hex, which is how Supabase returns a
 * geography column (e.g. pickup_requests.coordinates): "0101000020E6100000..."
 */
const pointFromWkbHex = (hex) => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 42) return null;
  const bytes = new Uint8Array(hex.match(/../g).map((b) => parseInt(b, 16)));
  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const type = view.getUint32(1, littleEndian);
  if ((type & 0xff) !== 1) return null; // not a Point
  const offset = type & 0x20000000 ? 9 : 5; // skip the SRID when present
  if (bytes.length < offset + 16) return null;
  return [view.getFloat64(offset, littleEndian), view.getFloat64(offset + 8, littleEndian)];
};

/**
 * [lat, lng] from any coordinate format the apps use; null if unusable:
 * [lat, lng], {lat, lng}, {latitude, longitude}, GeoJSON Point, {x, y},
 * WKT "POINT(lng lat)" (optionally "SRID=4326;...") and EWKB hex.
 */
export const toLatLng = (value) => {
  if (!value) return null;
  let lat;
  let lng;
  if (Array.isArray(value)) {
    [lat, lng] = value;
  } else if (typeof value === 'string') {
    const wkt = value.match(/^\s*(?:SRID=\d+;)?POINT\s*\(\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s*\)\s*$/i);
    const point = wkt ? [wkt[1], wkt[2]] : pointFromWkbHex(value.trim());
    if (!point) return null;
    [lng, lat] = point;
  } else if (typeof value === 'object') {
    if (value.type === 'Point' && Array.isArray(value.coordinates)) {
      [lng, lat] = value.coordinates;
    } else if (value.x !== undefined && value.y !== undefined) {
      lng = value.x;
      lat = value.y;
    } else {
      lat = value.lat ?? value.latitude;
      lng = value.lng ?? value.longitude;
    }
  }
  lat = Number(lat);
  lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
};

/** Great-circle distance in km between two [lat, lng] points */
export const distanceKm = ([lat1, lng1], [lat2, lng2]) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** The position the Map page last saved, as [lat, lng], or null */
export const getCachedPosition = () => {
  try {
    return toLatLng(JSON.parse(localStorage.getItem('userLastPosition')));
  } catch {
    return null;
  }
};

const wasteTypeOf = (request) => request.waste_type || request.type;

/**
 * Filter requests by the collector's duty status, position and filters.
 * Returns [{ request, distanceKm }] nearest first; the requests are not changed.
 */
export const filterAvailableRequests = (requests, { isOnDuty, position, filters = {} } = {}) => {
  const origin = toLatLng(position);
  if (!isOnDuty || !origin || !Array.isArray(requests)) return [];

  const radiusKm = parseFloat(filters.searchRadius) || DEFAULT_RADIUS_KM;
  const activeFilter = filters.activeFilter || 'all';
  const wasteTypes = Array.isArray(filters.wasteTypes) ? filters.wasteTypes : [];
  const minPayment = parseFloat(filters.minPayment) || 0;
  const priority = filters.priority || 'all';

  return requests
    .map((request) => {
      if (!request) return null;
      if (request.source_type !== 'digital_bin' && request.status !== 'pending') return null;

      const target = toLatLng(request.coordinates);
      if (!target) return null;
      const km = distanceKm(origin, target);
      if (!(km <= radiusKm)) return null;

      if (activeFilter !== 'all' && wasteTypeOf(request) !== activeFilter) return null;
      if (wasteTypes.length > 0 && !wasteTypes.includes('All Types') && !wasteTypes.includes(wasteTypeOf(request))) return null;
      if (minPayment > 0 && (parseFloat(request.fee) || 0) < minPayment) return null;
      if (priority !== 'all' && request.priority !== priority) return null;

      return { request, distanceKm: km };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);
};
