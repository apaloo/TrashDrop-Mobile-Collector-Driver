/**
 * Shared rules for the Route page (RouteOptimizer, RouteStatistics, ItemList).
 */

// Jobs a collector is working on: accepted, on the way, or arrived
export const ACTIVE_JOB_STATUSES = ['accepted', 'en_route', 'arrived'];
export const isActiveJob = (job) => !!job && ACTIVE_JOB_STATUSES.includes(job.status);

// A stop further than this from the collector is almost certainly a wrong
// location (daily collection routes stay well under it)
export const FAR_STOP_KM = 100;

/** "850 m" under 1 km, otherwise "12.3 km" (input in km) */
export const formatDistanceKm = (km) => {
  if (!Number.isFinite(km)) return '';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
};

/** "45 min", "2 h", "14 h 14 min" */
export const formatDuration = (minutes) => {
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};
