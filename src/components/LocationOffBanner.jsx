import React from 'react';
import { useLocationStatus } from '../hooks/useLocationStatus';

const isIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent || '');

const helpFor = (problem) => {
  if (problem === 'blocked') {
    return isIPhone()
      ? 'Open Settings, then Safari, then Location, and choose Allow.'
      : 'Press and hold the TrashDrop icon, tap App info, then Permissions, then Location, and choose Allow.';
  }
  return isIPhone()
    ? 'Open Settings, then Privacy & Security, then Location Services, and turn it on.'
    : 'Swipe down from the top of your screen and tap Location.';
};

/**
 * One tap to turn location on, in the style of Uber's banner. It clears by
 * itself as soon as location works again.
 */
const LocationOffBanner = () => {
  const { problem, checking, tappedAndStillOff, turnOn } = useLocationStatus();
  if (!problem) return null;

  const title = problem === 'blocked'
    ? 'Location is blocked. Tap to allow'
    : 'Location is off. Tap to turn on';

  return (
    <div
      className="fixed inset-x-3 z-[2100]"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        onClick={turnOn}
        disabled={checking}
        className="w-full rounded-2xl bg-amber-400 px-4 py-3 text-left text-gray-900 shadow-lg active:scale-[0.99] transition"
      >
        <span className="flex items-center gap-3">
          <svg className="h-6 w-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s-7-6.1-7-11.5A7 7 0 0119 9.5C19 14.9 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span className="flex-1 text-[15px] font-semibold">{checking ? 'Checking your location…' : title}</span>
          {!checking && <span className="text-xl leading-none" aria-hidden="true">›</span>}
        </span>
        {tappedAndStillOff && !checking && (
          <span className="mt-1 block pl-9 text-[13px]">{helpFor(problem)}</span>
        )}
      </button>
    </div>
  );
};

export default LocationOffBanner;
