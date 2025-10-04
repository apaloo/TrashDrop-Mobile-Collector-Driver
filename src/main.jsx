import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
// CSS styling
import './index.css'
import './styles/mapStyles.css' // Global map styles for z-index management
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
    console.log('🔄 New app version available!');
    const updateConfirm = confirm('🚀 TrashDrop Carter has been updated!\n\nNew features and improvements are available.\nWould you like to reload now?');
    if (updateConfirm) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    // Notify user that app is ready for offline use
    console.log('✅ TrashDrop Carter ready to work offline');
    
    // Show toast notification for offline readiness
    setTimeout(() => {
      if (!localStorage.getItem('offline-ready-shown')) {
        alert('📶 TrashDrop Carter is now ready to work offline!\n\nYou can use the app even without internet connection.');
        localStorage.setItem('offline-ready-shown', 'true');
      }
    }, 3000);
  },
  immediate: true, // Register immediately for faster offline capability
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
