import React, { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

const INSTALL_PROMPT_KEY = 'trashdrop_install_prompt_shown';
const INSTALL_PROMPT_DISMISSED_KEY = 'trashdrop_install_prompt_dismissed';
const INSTALL_PROMPT_DISMISSED_TIMESTAMP = 'trashdrop_install_prompt_dismissed_at';
const INSTALL_PROMPT_VERSION_KEY = 'trashdrop_install_prompt_version';
const REPROMPT_DELAY_DAYS = 7;

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
 * Platform-aware install strategy:
 * - **Android**: Does NOT trigger Chrome's native install prompt (which creates
 *   a WebAPK scanned by Google Play Protect).  Instead, offers "Open App" to
 *   continue in the browser — the full PWA experience works identically via
 *   the service worker without installation.  A secondary link shows manual
 *   home-screen instructions for users who want an icon.
 * - **iOS / Desktop**: Uses the native beforeinstallprompt when available,
 *   falling back to manual instructions.
 */
const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const deferredPromptRef = useRef(null);

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

  // Capture native prompt (iOS/desktop only — we never call .prompt() on Android)
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      if (!isAndroid) {
        deferredPromptRef.current = e;
        logger.info('📥 Native install prompt captured');
      }
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
  }, [isAndroid]);

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

  // Install handler — safe: never calls native prompt on Android
  const handleInstall = useCallback(async () => {
    if (isAndroid) {
      // Skip native prompt entirely to avoid WebAPK → Play Protect scan.
      // Show manual add-to-homescreen instructions instead.
      setShowManualInstructions(true);
      return;
    }

    // iOS / Desktop: try native prompt
    if (deferredPromptRef.current) {
      setIsInstalling(true);
      try {
        deferredPromptRef.current.prompt();
        const { outcome } = await deferredPromptRef.current.userChoice;
        logger.info(`📥 Native install result: ${outcome}`);
        if (outcome === 'accepted') {
          localStorage.setItem(INSTALL_PROMPT_KEY, 'installed');
          setShowPrompt(false);
          return;
        }
      } catch (err) {
        logger.error('❌ Native prompt error:', err);
      } finally {
        deferredPromptRef.current = null;
        setIsInstalling(false);
      }
    }

    setShowManualInstructions(true);
  }, [isAndroid]);

  // "Open App" — primary CTA on Android: just dismiss and use in browser
  const handleOpenApp = useCallback(() => {
    localStorage.setItem(INSTALL_PROMPT_KEY, 'shown');
    setShowPrompt(false);
    logger.info('📱 User chose to continue in browser (Android – skipping WebAPK)');
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
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-green-600 to-green-800 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-24 h-24 mx-auto mb-4 bg-white rounded-2xl shadow-lg flex items-center justify-center">
          <img
            src="/logo.png"
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
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
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
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {isAndroid ? 'Welcome to TrashDrop' : 'Install TrashDrop'}
          </h2>
          <p className="text-gray-600 text-sm">
            {isAndroid
              ? 'Your app is ready! Enjoy fast loading, offline access, and instant pickup notifications — all from your browser.'
              : 'Install our app for the best experience with faster loading, offline access, and push notifications.'}
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          {[
            { icon: 'M13 10V3L4 14h7v7l9-11h-7z', text: 'Lightning-fast loading times' },
            { icon: 'M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414', text: 'Works offline — no internet needed' },
            { icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', text: 'Get notified of new pickups' },
            { icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', text: 'Easy access from home screen' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center text-sm text-gray-700">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
              </div>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Manual instructions (non-Android or when user explicitly asks) */}
        {showManualInstructions && (
          <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-2 text-sm">Add to Home Screen:</h3>
            {isIOS ? (
              <div className="text-sm text-blue-700 space-y-2">
                <p>1. Tap the <strong>Share</strong> button <span className="inline-block bg-blue-100 px-1.5 py-0.5 rounded text-xs">↑</span> at the bottom of Safari</p>
                <p>2. Scroll down and tap <strong>"Add to Home Screen"</strong></p>
                <p>3. Tap <strong>"Add"</strong> in the top right</p>
              </div>
            ) : isAndroid ? (
              <div className="text-sm text-blue-700 space-y-2">
                <p>1. Tap the <strong>menu</strong> button <span className="inline-block bg-blue-100 px-1.5 py-0.5 rounded text-xs">⋮</span> in your browser</p>
                <p>2. Tap <strong>"Add to Home screen"</strong></p>
                <p>3. Tap <strong>"Add"</strong> to confirm</p>
                <p className="mt-2 text-xs text-blue-600 bg-blue-100 rounded-lg p-2">
                  <strong>Tip:</strong> If you see a security warning, tap <strong>"More details"</strong> then <strong>"Install anyway"</strong>. The app is safe — the warning is about Chrome's packaging, not your data.
                </p>
              </div>
            ) : (
              <div className="text-sm text-blue-700 space-y-2">
                <p>1. Click the <strong>install icon</strong> in your browser's address bar</p>
                <p>2. Or open browser menu → <strong>"Install TrashDrop Carter"</strong></p>
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          {isAndroid ? (
            <>
              {/* Android: primary = open app in browser (no WebAPK, no Play Protect) */}
              <button
                onClick={handleOpenApp}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                Open App
              </button>

              {!showManualInstructions ? (
                <button
                  onClick={() => setShowManualInstructions(true)}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors duration-200 text-sm"
                >
                  Add to Home Screen
                </button>
              ) : (
                <button
                  onClick={handleDismiss}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors duration-200 text-sm"
                >
                  Done
                </button>
              )}
            </>
          ) : (
            <>
              {/* iOS / Desktop: native install or manual instructions */}
              {!showManualInstructions ? (
                <button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isInstalling ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Installing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Install App
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleDismiss}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors duration-200"
                >
                  Got it, I'll install now
                </button>
              )}

              <button
                onClick={handleDismiss}
                disabled={isInstalling}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors duration-200 disabled:opacity-50"
              >
                Maybe Later
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-green-200 text-xs text-center max-w-xs">
        {isAndroid
          ? 'Bookmark this page for quick access anytime'
          : 'You can always install later from your browser menu'}
      </p>
    </div>
  );
};

export default InstallPrompt;
