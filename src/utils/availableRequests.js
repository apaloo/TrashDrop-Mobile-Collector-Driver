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

/** [lat, lng] from an array, {lat, lng} or {latitude, longitude}; null if unusable */
export const toLatLng = (value) => {
  if (!value) return null;
  let lat;
  let lng;
  if (Array.isArray(value)) {
    [lat, lng] = value;
  } else if (typeof value === 'object') {
    lat = value.lat ?? value.latitude;
    lng = value.lng ?? value.longitude;
  }
  lat = Number(lat);
  lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
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
