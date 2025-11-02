import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { logger } from './utils/logger'

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
import ErrorBoundary from './components/ErrorBoundary.jsx'
// import MockAuthContextApp from './MockAuthContextApp.jsx' // Mock auth no longer needed
// import AuthContextApp from './AuthContextApp.jsx' // Testing component
// import RouterApp from './RouterApp.jsx' // Testing component
// import MinimalApp from './MinimalApp.jsx' // Testing component
// import SimpleApp from './SimpleApp.jsx' // Testing component

// Register service worker for PWA functionality - DEFERRED to not block startup
setTimeout(() => {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Show a notification or prompt to the user about available update
      if (confirm('New content available. Reload?')) {
        updateSW(true)
      }
    },
    onOfflineReady() {
      // Notify user that app is ready for offline use
      logger.info('App ready to work offline')
      // In a real app, you might want to show a toast notification  
    },
  })
}, 2000); // Register SW after 2 seconds to not block initial startup

const renderStartTime = Date.now();
logger.debug('⚡ Starting React render at:', renderStartTime);
logger.debug(`⚡ Critical Path completed in ${renderStartTime - criticalPathStartTime}ms`);

// CRITICAL: Immediate render without waiting
const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// Add global error handler to catch unhandled errors
window.addEventListener('error', (event) => {
  logger.error('🚨 Global Error:', event.error?.message || event.message);
  logger.error('Stack:', event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('🚨 Unhandled Promise Rejection:', event.reason);
});

// CRITICAL: Render immediately with error boundary
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Performance markers and timing
const renderInitiatedTime = Date.now();
logger.debug('⚡ React render initiated at:', renderInitiatedTime);
logger.info(`🚀 App Startup Total: ${renderInitiatedTime - startupStartTime}ms`);

// CRITICAL: Hide static splash screen and show React app
if (typeof window !== 'undefined') {
  // IMMEDIATE: Mark body as react-loaded AND restore scrolling
  document.body.classList.add('react-loaded');
  document.body.style.overflow = 'auto'; // CRITICAL: Restore immediately
  
  logger.debug('✅ Splash removed, scrolling restored');
  
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
  });
}
