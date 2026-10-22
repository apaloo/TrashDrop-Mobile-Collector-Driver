/**
 * Job lists saved on the phone, so collectors can still see their accepted and
 * picked-up jobs when the connection drops (common on their routes).
 *
 * Stored per screen ("requests", "assignments") and per user in localStorage,
 * and cleared on sign out because phones can be shared.
 */

const PREFIX = 'td_offline_jobs_v1:';
const keyFor = (scope, userId) => `${PREFIX}${scope}:${userId}`;

export const saveJobs = (scope, userId, data) => {
  if (!userId) return;
  try {
    localStorage.setItem(keyFor(scope, userId), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Storage full or blocked: the lists still work online
  }
};

/** { savedAt, data } or null */
export const loadJobs = (scope, userId) => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(keyFor(scope, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed : null;
  } catch {
    return null;
  }
};

/** Remove every saved job list (all screens, all users) */
export const clearAllJobs = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
};

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** "09:15" today, otherwise "21 Oct, 09:15" */
export const savedAtLabel = (savedAt) => {
  if (!savedAt) return '';
  const d = new Date(savedAt);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
};
