import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

const INSTALL_PROMPT_KEY = 'trashdrop_install_prompt_shown';
const INSTALL_PROMPT_DISMISSED_KEY = 'trashdrop_install_prompt_dismissed';

/**
 * InstallPrompt Component
 * Shows a full-screen prompt to install the app on first launch.
 * Uses the beforeinstallprompt event for native PWA installation.
 */
const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Check if app is already installed (running in standalone mode)
  useEffect(() => {
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.navigator.standalone === true ||
                        document.referrer.includes('android-app://');
      setIsStandalone(standalone);
      if (standalone) {
        logger.debug('📱 App is running in standalone mode (already installed)');
      }
    };
    
    checkStandalone();
  }, []);

  // Capture the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e);
      logger.debug('📥 Install prompt captured and ready');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      logger.info('✅ App was installed successfully');
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.setItem(INSTALL_PROMPT_KEY, 'installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Determine whether to show the prompt on first visit
  useEffect(() => {
    // Don't show if already in standalone mode (installed)
    if (isStandalone) {
      return;
    }

    // Check if user has already dismissed or installed
    const hasShown = localStorage.getItem(INSTALL_PROMPT_KEY);
    const hasDismissed = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY);
    
    if (hasShown === 'installed' || hasDismissed === 'true') {
      logger.debug('📱 Install prompt already handled, not showing');
      return;
    }

    // Show the prompt after a brief delay to let the app load
    const timer = setTimeout(() => {
      setShowPrompt(true);
      localStorage.setItem(INSTALL_PROMPT_KEY, 'shown');
      logger.info('📱 Showing install prompt for first-time user');
    }, 1000);

    return () => clearTimeout(timer);
  }, [isStandalone]);

  // Handle install button click
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      // Fallback: Show manual installation instructions
      logger.warn('📥 No deferred prompt available, showing instructions');
      alert(
        'To install this app:\n\n' +
        '📱 iPhone/iPad: Tap the Share button, then "Add to Home Screen"\n\n' +
        '📱 Android: Tap the menu (⋮), then "Add to Home Screen" or "Install App"'
      );
      handleDismiss();
      return;
    }

    setIsInstalling(true);

    try {
      // Show the native install prompt
      deferredPrompt.prompt();
      
      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;
      
      logger.info(`📥 User response to install prompt: ${outcome}`);
      
      if (outcome === 'accepted') {
        logger.info('✅ User accepted the install prompt');
        localStorage.setItem(INSTALL_PROMPT_KEY, 'installed');
      } else {
        logger.info('❌ User dismissed the install prompt');
        localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
      }
      
      // Clear the deferred prompt
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      logger.error('❌ Error showing install prompt:', error);
    } finally {
      setIsInstalling(false);
    }
  }, [deferredPrompt]);

  // Handle dismiss/skip
  const handleDismiss = useCallback(() => {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'true');
    setShowPrompt(false);
    logger.info('📱 User skipped install prompt');
  }, []);

  // Don't render if not showing
  if (!showPrompt || isStandalone) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-green-600 to-green-800 flex flex-col items-center justify-center p-6">
      {/* Logo and App Name */}
      <div className="mb-8 text-center">
        <div className="w-24 h-24 mx-auto mb-4 bg-white rounded-2xl shadow-lg flex items-center justify-center">
          <img 
            src="/logo.png" 
            alt="TrashDrop" 
            className="w-20 h-20 object-contain"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="hidden w-20 h-20 items-center justify-center text-4xl">
            🚛
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">TrashDrop Collector</h1>
        <p className="text-green-100 text-lg">Your waste collection companion</p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Install TrashDrop</h2>
          <p className="text-gray-600 text-sm">
            Install our app for the best experience with faster loading, offline access, and push notifications.
          </p>
        </div>

        {/* Benefits List */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center text-sm text-gray-700">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span>Lightning-fast loading times</span>
          </div>
          <div className="flex items-center text-sm text-gray-700">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
            </div>
            <span>Works offline - no internet needed</span>
          </div>
          <div className="flex items-center text-sm text-gray-700">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <span>Get notified of new pickups</span>
          </div>
          <div className="flex items-center text-sm text-gray-700">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span>Easy access from home screen</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isInstalling ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
          
          <button
            onClick={handleDismiss}
            disabled={isInstalling}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors duration-200 disabled:opacity-50"
          >
            Maybe Later
          </button>
        </div>
      </div>

      {/* Footer Note */}
      <p className="mt-6 text-green-200 text-xs text-center max-w-xs">
        You can always install later from your browser menu
      </p>
    </div>
  );
};

export default InstallPrompt;
