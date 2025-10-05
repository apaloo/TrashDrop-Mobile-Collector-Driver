import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

// Performance logging to debug startup delays
console.time('🚀 App Startup Total');
console.log('⚡ main.jsx loading started at:', Date.now());

// CSS styling
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

createRoot(document.getElementById('root')).render(
  // REMOVED StrictMode to prevent double initialization in development
  <App />
)

console.log('⚡ React render initiated at:', Date.now());
console.timeEnd('🚀 App Startup Total');
