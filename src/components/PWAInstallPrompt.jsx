import React, { useState, useEffect } from 'react';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed/standalone
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://');
      
      setIsStandalone(isStandaloneMode);
      
      // If already installed, don't show prompt
      if (isStandaloneMode) {
        localStorage.setItem('pwa-installed', 'true');
        return;
      }

      // Check if user has seen prompt before
      const hasSeenPrompt = localStorage.getItem('pwa-prompt-seen');
      const hasDeclined = localStorage.getItem('pwa-declined');
      const isInstalled = localStorage.getItem('pwa-installed');

      // Force show prompt for first-time users or if never declined
      if (!hasSeenPrompt && !hasDeclined && !isInstalled) {
        // Show prompt after 2 seconds to let page load
        setTimeout(() => {
          setShowCustomPrompt(true);
          localStorage.setItem('pwa-prompt-seen', 'true');
        }, 2000);
      }
    };

    checkStandalone();

    // Listen for native install prompt
    const handleBeforeInstallPrompt = (e) => {
      console.log('💡 PWA install prompt available');
      e.preventDefault(); // Prevent default prompt
      setDeferredPrompt(e);
      
      // If user hasn't declined and not installed, show our custom prompt
      const hasDeclined = localStorage.getItem('pwa-declined');
      const isInstalled = localStorage.getItem('pwa-installed');
      
      if (!hasDeclined && !isInstalled) {
        setTimeout(() => {
          setShowCustomPrompt(true);
          localStorage.setItem('pwa-prompt-seen', 'true');
        }, 2000);
      }
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      console.log('✅ PWA successfully installed');
      setShowCustomPrompt(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa-installed', 'true');
      localStorage.removeItem('pwa-declined');
      
      // Show success message
      setTimeout(() => {
        alert('🎉 TrashDrop Carter installed successfully! You can now use it offline.');
      }, 500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Use native prompt if available
      console.log('📱 Showing native install prompt');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ User accepted install');
        localStorage.setItem('pwa-installed', 'true');
      } else {
        console.log('❌ User declined install');
        localStorage.setItem('pwa-declined', Date.now().toString());
      }
      
      setDeferredPrompt(null);
      setShowCustomPrompt(false);
    } else {
      // Manual installation instructions
      showManualInstallInstructions();
    }
  };

  const handleLaterClick = () => {
    console.log('⏰ User chose "Maybe Later"');
    setShowCustomPrompt(false);
    // Don't set declined flag, allow prompt to show again later
  };

  const handleDeclineClick = () => {
    console.log('❌ User declined install');
    setShowCustomPrompt(false);
    localStorage.setItem('pwa-declined', Date.now().toString());
  };

  const showManualInstallInstructions = () => {
    const userAgent = navigator.userAgent;
    let instructions = '';

    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      instructions = `
📱 To install TrashDrop Carter on iOS:
1. Tap the Share button (□↑) at the bottom
2. Scroll down and tap "Add to Home Screen"
3. Tap "Add" to confirm
      `;
    } else if (userAgent.includes('Android')) {
      instructions = `
📱 To install TrashDrop Carter on Android:
1. Tap the menu (⋮) in your browser
2. Select "Add to Home screen" or "Install app"
3. Tap "Add" or "Install"
      `;
    } else {
      instructions = `
💻 To install TrashDrop Carter:
1. Look for the install icon (⬇️) in your browser's address bar
2. Click it and select "Install"
3. Or use browser menu → "Install TrashDrop Carter"
      `;
    }

    alert(instructions);
    setShowCustomPrompt(false);
  };

  // Force show prompt for testing (remove in production)
  const forceShowPrompt = () => {
    localStorage.removeItem('pwa-prompt-seen');
    localStorage.removeItem('pwa-declined');
    localStorage.removeItem('pwa-installed');
    setShowCustomPrompt(true);
  };

  // Add global function for testing
  if (typeof window !== 'undefined') {
    window.showInstallPrompt = forceShowPrompt;
  }

  // Don't render if already installed
  if (isStandalone || !showCustomPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pwa-backdrop">
      {/* Install Prompt Modal */}
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 pwa-modal">
        {/* Header with App Icon */}
        <div className="mb-4 text-center">
          <div className="mb-3 flex justify-center">
            <img 
              src="/icons/logo-02.jpg" 
              alt="TrashDrop Carter" 
              className="h-16 w-16 rounded-2xl shadow-lg"
            />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Install TrashDrop Carter
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Get the full app experience with offline access and faster loading
          </p>
        </div>

        {/* Benefits List */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center space-x-3">
            <span className="text-green-500">⚡</span>
            <span className="text-sm text-gray-700">Works offline</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-green-500">📱</span>
            <span className="text-sm text-gray-700">Easy access from home screen</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-green-500">🚀</span>
            <span className="text-sm text-gray-700">Faster loading times</span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-green-500">🔔</span>
            <span className="text-sm text-gray-700">Push notifications</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleInstallClick}
            className="w-full rounded-lg bg-green-600 px-4 py-3 text-white font-medium hover:bg-green-700 active:scale-95 transition-all duration-200 shadow-lg"
          >
            🚀 Install Now
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={handleLaterClick}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 active:scale-95 transition-all duration-200"
            >
              Maybe Later
            </button>
            <button
              onClick={handleDeclineClick}
              className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 active:scale-95 transition-all duration-200"
            >
              No Thanks
            </button>
          </div>
        </div>

        {/* Fine Print */}
        <p className="mt-4 text-xs text-gray-500 text-center">
          You can uninstall anytime from your device settings
        </p>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
