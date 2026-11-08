import React, { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

const INSTALL_PROMPT_KEY = 'trashdrop_install_prompt_shown';
const INSTALL_PROMPT_DISMISSED_KEY = 'trashdrop_install_prompt_dismissed';
const INSTALL_PROMPT_DISMISSED_TIMESTAMP = 'trashdrop_install_prompt_dismissed_at';
const INSTALL_PROMPT_VERSION_KEY = 'trashdrop_install_prompt_version';
const REPROMPT_DELAY_DAYS = 7;
// How long a tap waits for the browser to say it can install. The tap only
// stays valid for the install dialog for about five seconds.
const INSTALL_READY_WAIT_MS = 3000;

// Bump this on every deploy where you want the prompt to re-appear
const APP_VERSION = '3.2.0';

const resetPromptState = () => {
  localStorage.removeItem(INSTALL_PROMPT_KEY);
  localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
  localStorage.removeItem(INSTALL_PROMPT_DISMISSED_TIMESTAMP);
  localStorage.setItem(INSTALL_PROMPT_VERSION_KEY, APP_VERSION);
};

/**
 * InstallPrompt Component
 *
 * Tapping install opens the browser's own install dialog wherever the browser
 * offers one. Where it doesn't (iOS Safari, some Android browsers, or the
 * browser isn't ready yet) the steps to install by hand replace the benefits
 * list, so the tap always visibly does something.
 *
 * The buttons sit outside the scrolling area so they stay on screen on short
 * phones.
 */
const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const deferredPromptRef = useRef(null);
  const installReadyRef = useRef(null);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );

  // Version-based reset
  useEffect(() => {
    const saved = localStorage.getItem(INSTALL_PROMPT_VERSION_KEY);
    if (saved !== APP_VERSION) {
      logger.info(`📱 New app version ${APP_VERSION} (was ${saved}) – resetting install prompt`);
      resetPromptState();
    }
  }, []);

  // Keep the browser's install offer until the collector taps install
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      installReadyRef.current?.();
      logger.info('📥 Native install prompt captured');
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      logger.info('✅ App was installed successfully');
      setShowPrompt(false);
      localStorage.setItem(INSTALL_PROMPT_KEY, 'installed');
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  // Show prompt logic
  useEffect(() => {
    if (isStandalone) return;
    if (localStorage.getItem(INSTALL_PROMPT_KEY) === 'installed') return;

    const hasDismissed = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY);
    const dismissedAt = localStorage.getItem(INSTALL_PROMPT_DISMISSED_TIMESTAMP);
    if (hasDismissed === 'true' && dismissedAt) {
      const days = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < REPROMPT_DELAY_DAYS) return;
      localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
      localStorage.removeItem(INSTALL_PROMPT_DISMISSED_TIMESTAMP);
    }

    const timer = setTimeout(() => {
      setShowPrompt(true);
      localStorage.setItem(INSTALL_PROMPT_KEY, 'shown');
      logger.info('📱 Showing install prompt');
    }, 2000);
    return () => clearTimeout(timer);
  }, [isStandalone]);

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    try {
      // The browser can announce it's ready a moment after this screen appears
      if (!deferredPromptRef.current) {
        await new Promise((resolve) => {
          installReadyRef.current = resolve;
          setTimeout(resolve, INSTALL_READY_WAIT_MS);
        });
        installReadyRef.current = null;
      }

      const installOffer = deferredPromptRef.current;
      if (!installOffer) {
        setShowManualInstructions(true);
        return;
      }

      deferredPromptRef.current = null;
      await installOffer.prompt();
      const { outcome } = await installOffer.userChoice;
      logger.info(`📥 Native install result: ${outcome}`);
      if (outcome === 'accepted') {
        localStorage.setItem(INSTALL_PROMPT_KEY, 'installed');
        setShowPrompt(false);
      }
    } catch (err) {
      logger.error('❌ Native prompt error:', err);
      setShowManualInstructions(true);
    } finally {
      setIsInstalling(false);
    }
  }, []);

  // "Open App": use it in the browser this time. Asks again on the next visit.
  const handleOpenApp = useCallback(() => {
    localStorage.setItem(INSTALL_PROMPT_KEY, 'shown');
    setShowPrompt(false);
    logger.info('📱 User chose to continue in browser');
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_TIMESTAMP, Date.now().toString());
    setShowPrompt(false);
    setShowManualInstructions(false);
    logger.info(`📱 User skipped install prompt, re-prompt in ${REPROMPT_DELAY_DAYS} days`);
  }, []);

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed inset-0 h-[100dvh] z-[9999] bg-gradient-to-b from-green-600 to-green-800 flex flex-col">
      <div data-testid="install-scroll" className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div className="min-h-full flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="w-24 h-24 mx-auto mb-4 bg-white rounded-2xl shadow-lg flex items-center justify-center">
          <img
            src="/logo.svg"
            alt="TrashDrop"
            className="w-20 h-20 object-contain"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
          <div className="hidden w-20 h-20 items-center justify-center text-4xl">🚛</div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">TrashDrop Carter</h1>
        <p className="text-green-100 text-lg">Your waste collection companion</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            {isAndroid ? (
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
          </div>
          <h2 className="text-xl font-bold text-td-ink mb-2">
            {isAndroid ? 'Welcome to TrashDrop' : 'Install TrashDrop'}
          </h2>
          <p className="text-td-sage text-sm">
            {isAndroid
              ? 'Add TrashDrop Carter to your phone for fast loading, offline access, and instant pickup notifications.'
              : 'Install our app for the best experience with faster loading, offline access, and push notifications.'}
          </p>
        </div>

        {/* Benefits */}
        {!showManualInstructions && (
        <div className="space-y-3">
          {[
            { icon: 'M13 10V3L4 14h7v7l9-11h-7z', text: 'Lightning-fast loading times' },
            { icon: 'M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414', text: 'Works offline — no internet needed' },
            { icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', text: 'Get notified of new pickups' },
            { icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', text: 'Easy access from home screen' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center text-sm text-td-ink">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
              </div>
              <span>{text}</span>
            </div>
          ))}
        </div>
        )}

        {/* Steps to install by hand, when the browser can't do it for us */}
        {showManualInstructions && (
          <div className="p-4 bg-td-tonal rounded-xl border border-td-border">
            <h3 className="font-semibold text-blue-800 mb-2 text-sm">Add to Home Screen:</h3>
            {isIOS ? (
              <div className="text-sm text-td-forest space-y-2">
                <p>1. Tap the <strong>Share</strong> button <span className="inline-block bg-td-tonal px-1.5 py-0.5 rounded text-xs">↑</span> at the bottom of Safari</p>
                <p>2. Scroll down and tap <strong>"Add to Home Screen"</strong></p>
                <p>3. Tap <strong>"Add"</strong> in the top right</p>
              </div>
            ) : isAndroid ? (
              <div className="text-sm text-td-forest space-y-2">
                <p>1. Tap the <strong>menu</strong> button <span className="inline-block bg-td-tonal px-1.5 py-0.5 rounded text-xs">⋮</span> in your browser</p>
                <p>2. Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></p>
                <p>3. Tap <strong>"Add"</strong> to confirm</p>
                <p className="mt-2 text-xs text-td-forest bg-td-tonal rounded-lg p-2">
                  <strong>Tip:</strong> If you see a security warning, tap <strong>"More details"</strong> then <strong>"Install anyway"</strong>. The app is safe — the warning is about Chrome's packaging, not your data.
                </p>
              </div>
            ) : (
              <div className="text-sm text-td-forest space-y-2">
                <p>1. Click the <strong>install icon</strong> in your browser's address bar</p>
                <p>2. Or open browser menu → <strong>"Install TrashDrop Carter"</strong></p>
              </div>
            )}
          </div>
        )}

      </div>

      {!isAndroid && (
        <p className="mt-6 text-green-200 text-xs text-center max-w-xs">
          You can always install later from your browser menu
        </p>
      )}
      </div>
      </div>

      {/* Always on screen, whatever the phone's height */}
      <div className="shrink-0 bg-white rounded-t-2xl px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="space-y-3 max-w-sm mx-auto">
          {!showManualInstructions ? (
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isInstalling ? 'Getting ready…' : isAndroid ? 'Add to Home Screen' : 'Install App'}
            </button>
          ) : (
            <button
              onClick={isAndroid ? handleOpenApp : handleDismiss}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors duration-200"
            >
              Done
            </button>
          )}

          {!showManualInstructions && (
            <button
              onClick={isAndroid ? handleOpenApp : handleDismiss}
              disabled={isInstalling}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-td-ink font-medium rounded-xl transition-colors duration-200 text-sm disabled:opacity-50"
            >
              {isAndroid ? 'Open App' : 'Maybe Later'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
