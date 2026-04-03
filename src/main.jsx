import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { logger } from './utils/logger'

// CRITICAL: Performance logging and aggressive startup optimization
const startupStartTime = Date.now();
logger.debug('⚡ main.jsx loading started at:', startupStartTime);

// CSS styling - loaded synchronously for immediate rendering
import './index.css'
import './styles/mapStyles.css' // Global map styles for z-index management
import App from './App.jsx' // Using real App with proper credentials
import ErrorBoundary from './components/ErrorBoundary.jsx'

const renderStartTime = Date.now();
logger.debug('⚡ Starting React render at:', renderStartTime);
logger.debug(`⚡ Critical Path completed in ${renderStartTime - startupStartTime}ms`);

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
  
  // DEFERRED: Register Service Worker AFTER first paint (non-blocking)
  setTimeout(async () => {
    try {
      const { registerSW } = await import('virtual:pwa-register');
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          logger.info('🔄 New version available! Updating...');
          updateSW(true).then(() => window.location.reload());
        },
        onOfflineReady() {
          logger.info('✅ App ready to work offline');
        },
        onRegisteredSW(swUrl, registration) {
          logger.info('✅ Service Worker registered:', swUrl);
          let checkCount = 0;
          const interval = setInterval(() => {
            checkCount++;
            if (checkCount >= 10) { clearInterval(interval); return; }
            registration?.update().then(() => {
              logger.debug(`🔄 SW update check ${checkCount}/10`);
            });
          }, 30000);
        },
        onRegisterError(error) {
          logger.error('❌ Service Worker registration error:', error);
        }
      });
    } catch (err) {
      logger.warn('⚠️ Service Worker registration deferred or failed:', err);
    }
  }, 500);
}
