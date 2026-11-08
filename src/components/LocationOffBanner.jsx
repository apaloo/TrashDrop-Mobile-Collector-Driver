import React, { useState } from 'react';
import { useLocationStatus } from '../hooks/useLocationStatus';

const isIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent || '');

const turnOnHelp = () => (isIPhone()
  ? 'Open Settings, then Privacy & Security, then Location Services, and turn it on.'
  : 'Swipe down from the top of your screen and tap Location.');

// A site that's been blocked can't ask again: only the collector can undo it
const allowSteps = () => (isIPhone()
  ? [
    'Open Settings, then Privacy & Security, then Location Services.',
    'Tap Safari Websites and choose While Using the App.',
    'Come back to TrashDrop.',
  ]
  : [
    'Open Chrome and tap the three dots at the top right.',
    'Tap Settings, then Site settings, then Location.',
    `Under Blocked, tap ${window.location.hostname} and choose Allow.`,
    'Come back to TrashDrop.',
  ]);

/**
 * One tap to turn location on, in the style of Uber's banner. It clears by
 * itself as soon as location works again.
 */
const LocationOffBanner = () => {
  const { problem, checking, tappedAndStillOff, turnOn } = useLocationStatus();
  const [showAllowSteps, setShowAllowSteps] = useState(false);
  if (!problem) return null;

  const handleTap = () => {
    if (problem === 'blocked') setShowAllowSteps(true);
    turnOn();
  };

  const title = problem === 'blocked'
    ? 'Location is blocked. Tap to allow'
    : 'Location is off. Tap to turn on';

  return (
    <>
    <div
      className="fixed inset-x-3 z-[2100]"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        onClick={handleTap}
        disabled={checking}
        className="w-full whitespace-normal rounded-2xl bg-amber-400 px-4 py-3 text-left text-gray-900 shadow-lg active:scale-[0.99] transition"
      >
        <span className="flex items-center gap-3">
          <svg className="h-6 w-6 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21s-7-6.1-7-11.5A7 7 0 0119 9.5C19 14.9 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span className="flex-1 text-[15px] font-semibold">{checking ? 'Checking your location…' : title}</span>
          {!checking && <span className="text-xl leading-none" aria-hidden="true">›</span>}
        </span>
        {problem === 'off' && tappedAndStillOff && !checking && (
          <span className="mt-1 block pl-9 text-[13px]">{turnOnHelp()}</span>
        )}
      </button>
    </div>

    {problem === 'blocked' && showAllowSteps && (
      <div className="fixed inset-0 z-[3000] flex items-end justify-center">
        <button type="button" aria-label="Close" tabIndex={-1} onClick={() => setShowAllowSteps(false)} className="absolute inset-0 bg-black/50" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="allow-location-title"
          className="relative w-full max-w-md rounded-t-3xl bg-white px-5 pt-5"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <h2 id="allow-location-title" className="text-xl font-bold text-td-ink">Allow location for TrashDrop</h2>
          <p className="mt-1 text-[15px] text-td-sage">It was blocked, so it can only be turned back on in settings.</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] text-td-ink">
            {allowSteps().map((step) => <li key={step}>{step}</li>)}
          </ol>
          <p className="mt-3 text-sm text-td-sage">This message goes away by itself once location is allowed.</p>
          <button
            type="button"
            autoFocus
            onClick={() => setShowAllowSteps(false)}
            className="mt-4 h-12 w-full rounded-full bg-primary text-[16px] font-bold text-white"
          >
            Got it
          </button>
        </div>
      </div>
    )}
    </>
  );
};

export default LocationOffBanner;
