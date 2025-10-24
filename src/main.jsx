import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { logger } from './utils/logger'
import { checkVersion } from './utils/version'

// CRITICAL: Check version before anything else
if (!checkVersion()) {
  // Version mismatch detected - will reload automatically
  throw new Error('Version mismatch - reloading');
}

// CRITICAL: Performance logging and aggressive startup optimization
const startupStartTime = Date.now();
const criticalPathStartTime = Date.now();
logger.debug('⚡ main.jsx loading started at:', startupStartTime);

// CRITICAL: Mark app as ready for immediate interaction
if (typeof window !== 'undefined') {
  // Tell browser the app is interactive immediately
  window.dispatchEvent(new Event('app-ready'));
  
  // Add performance markers
  if (window.performance && window.performance.mark) {
    window.performance.mark('app-startup-begin');
  }
}

// CSS styling - loaded synchronously for immediate rendering
import './index.css'
import './styles/mapStyles.css' // Global map styles for z-index management
import App from './App.jsx' // Using real App with proper credentials
// import MockAuthContextApp from './MockAuthContextApp.jsx' // Mock auth no longer needed
// import AuthContextApp from './AuthContextApp.jsx' // Testing component
// import RouterApp from './RouterApp.jsx' // Testing component
// import MinimalApp from './MinimalApp.jsx' // Testing component
// import SimpleApp from './SimpleApp.jsx' // Testing component

// Register service worker for PWA functionality - IMMEDIATE with auto-update
setTimeout(() => {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Force immediate reload for critical fixes
      logger.info('🔄 New version available - reloading...');
      updateSW(true);
    },
    onOfflineReady() {
      // Notify user that app is ready for offline use
      logger.info('App ready to work offline')
      // In a real app, you might want to show a toast notification  
    },
    onRegistered(registration) {
      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60000);
      }
    }
  })
}, 1000); // Register SW after 1 second

const renderStartTime = Date.now();
logger.debug('⚡ Starting React render at:', renderStartTime);
logger.debug(`⚡ Critical Path completed in ${renderStartTime - criticalPathStartTime}ms`);

// CRITICAL: Immediate render without waiting
const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// CRITICAL: Render immediately for under 2-second startup
root.render(<App />);

// Performance markers and timing
const renderInitiatedTime = Date.now();
logger.debug('⚡ React render initiated at:', renderInitiatedTime);
logger.info(`🚀 App Startup Total: ${renderInitiatedTime - startupStartTime}ms`);

// CRITICAL: Hide static splash screen and show React app
if (typeof window !== 'undefined') {
  // Immediately mark body as react-loaded to hide splash
  document.body.classList.add('react-loaded');
  
  // Remove the splash screen element completely after a brief delay
  setTimeout(() => {
    const splashElement = document.getElementById('instant-splash');
    if (splashElement) {
      splashElement.remove();
      logger.debug('🗑️ Static splash screen removed');
    }
  }, 100);
  
  // Use requestAnimationFrame to ensure DOM is painted
  requestAnimationFrame(() => {
    if (window.performance && window.performance.mark) {
      window.performance.mark('app-render-complete');
    }
    logger.debug('🎨 First paint completed at:', Date.now());
    
    // Dispatch event that app is fully interactive
    window.dispatchEvent(new Event('app-interactive'));
    
    // Reset body overflow for normal scrolling
    document.body.style.overflow = 'auto';
  });
}
