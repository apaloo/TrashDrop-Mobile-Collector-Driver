import { useCallback, useEffect, useRef, useState } from 'react';

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const RECHECK_MS = 60000;
const OPTIONS = { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 };

const readPermission = async () => {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status?.state || 'unknown';
  } catch (err) {
    return 'unknown';
  }
};

/** null when the error says nothing about being off (a slow GPS fix, say) */
export const problemFromError = (error, permission) => {
  if (error?.code === PERMISSION_DENIED && permission === 'denied') return 'blocked';
  // A phone with location off can report either code, while the site is allowed
  if (error?.code === PERMISSION_DENIED || error?.code === POSITION_UNAVAILABLE) return 'off';
  return null;
};

/**
 * Is location usable? problem is null | 'off' | 'blocked'.
 *
 * Rechecks when the collector comes back to the app and every minute, so the
 * warning clears by itself. turnOn() must run straight from a tap: a location
 * request made from a tap is what lets Android Chrome show its own "Turn on
 * location?" dialog without the collector leaving the app.
 */
export const useLocationStatus = () => {
  const [problem, setProblem] = useState(null);
  const [checking, setChecking] = useState(false);
  const [tappedAndStillOff, setTappedAndStillOff] = useState(false);
  const mounted = useRef(true);

  const check = useCallback(({ fromTap = false } = {}) => {
    if (!navigator.geolocation?.getCurrentPosition) return;
    if (fromTap) setChecking(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        if (!mounted.current) return;
        setProblem(null);
        setChecking(false);
        setTappedAndStillOff(false);
      },
      async (error) => {
        const permission = await readPermission();
        if (!mounted.current) return;
        const next = problemFromError(error, permission);
        if (next) setProblem(next);
        setChecking(false);
        if (fromTap && next) setTappedAndStillOff(true);
      },
      OPTIONS
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Never open the "allow location?" question without a tap
    const autoCheck = async () => {
      if (document.visibilityState !== 'visible') return;
      if ((await readPermission()) === 'prompt') return;
      if (mounted.current) check();
    };
    autoCheck();
    const timer = setInterval(autoCheck, RECHECK_MS);
    document.addEventListener('visibilitychange', autoCheck);
    window.addEventListener('focus', autoCheck);
    let status = null;
    Promise.resolve()
      .then(() => navigator.permissions?.query?.({ name: 'geolocation' }))
      .then((s) => { status = s; if (s) s.onchange = autoCheck; })
      .catch(() => {});
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', autoCheck);
      window.removeEventListener('focus', autoCheck);
      if (status) status.onchange = null;
    };
  }, [check]);

  const turnOn = useCallback(() => check({ fromTap: true }), [check]);

  return { problem, checking, tappedAndStillOff, turnOn };
};

export default useLocationStatus;
