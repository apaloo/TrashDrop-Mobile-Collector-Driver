import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
// CSS styling
import './index.css'
import App from './App.jsx' // Using real App with proper credentials
// import MockAuthContextApp from './MockAuthContextApp.jsx' // Mock auth no longer needed
// import AuthContextApp from './AuthContextApp.jsx' // Testing component
// import RouterApp from './RouterApp.jsx' // Testing component
// import MinimalApp from './MinimalApp.jsx' // Testing component
// import SimpleApp from './SimpleApp.jsx' // Testing component

// Register service worker for PWA functionality
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
