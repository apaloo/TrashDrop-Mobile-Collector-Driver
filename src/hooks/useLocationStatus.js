import { useCallback, useEffect, useRef, useState } from 'react';
import { hasAndroidLayer, noteAndroidLayer, openLocationDialog } from '../utils/androidLayer';

// Read at start-up, before the app changes the address
noteAndroidLayer();

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const RECHECK_MS = 60000;
const AFTER_DIALOG_WAIT_MS = 1500;
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
 * location?" dialog without the collector leaving the app. The installed
 * Android app opens Google's own dialog instead (see utils/androidLayer).
 */
export const useLocationStatus = () => {
  const [problem, setProblem] = useState(null);
  const [checking, setChecking] = useState(false);
  const [tappedAndStillOff, setTappedAndStillOff] = useState(false);
  const mounted = useRef(true);
  const problemRef = useRef(null);
  problemRef.current = problem;
  const dialogOpened = useRef(false);

  const check = useCallback(({ fromTap = false, afterDialog = false } = {}) => {
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
        if ((fromTap || afterDialog) && next) setTappedAndStillOff(true);
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
      const afterDialog = dialogOpened.current;
      if (afterDialog) {
        // Back from Google's dialog: give the phone a moment to switch on
        dialogOpened.current = false;
        await new Promise((resolve) => setTimeout(resolve, AFTER_DIALOG_WAIT_MS));
      }
      if (mounted.current) check({ afterDialog });
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

  const turnOn = useCallback(() => {
    // The installed app can open Google's own dialog. Otherwise the request
    // from this tap gives Chrome the chance to show its dialog.
    if (problemRef.current === 'off' && hasAndroidLayer()) {
      dialogOpened.current = true;
      openLocationDialog();
      return;
    }
    check({ fromTap: true });
  }, [check]);

  return { problem, checking, tappedAndStillOff, turnOn };
};

export default useLocationStatus;
