import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

// CRITICAL: Performance logging and aggressive startup optimization
console.time('🚀 App Startup Total');
console.time('⚡ Critical Path');
console.log('⚡ main.jsx loading started at:', Date.now());

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
      console.log('App ready to work offline')
      // In a real app, you might want to show a toast notification  
    },
  })
}, 2000); // Register SW after 2 seconds to not block initial startup

console.log('⚡ Starting React render at:', Date.now());
console.timeEnd('⚡ Critical Path');

// CRITICAL: Immediate render without waiting
const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

// CRITICAL: Render immediately for under 2-second startup
root.render(<App />);

// Performance markers and timing
console.log('⚡ React render initiated at:', Date.now());
console.timeEnd('🚀 App Startup Total');

// CRITICAL: Mark app as fully rendered
if (typeof window !== 'undefined') {
  // Use requestAnimationFrame to ensure DOM is painted
  requestAnimationFrame(() => {
    if (window.performance && window.performance.mark) {
      window.performance.mark('app-render-complete');
    }
    console.log('🎨 First paint completed at:', Date.now());
    
    // Dispatch event that app is fully interactive
    window.dispatchEvent(new Event('app-interactive'));
  });
}
