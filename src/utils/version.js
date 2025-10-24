/**
 * Version management and cache busting
 */

export const APP_VERSION = '1.1.0'; // Increment this on breaking changes

/**
 * Check if cached version matches current version
 * Forces reload if version mismatch detected
 */
export const checkVersion = () => {
  const cachedVersion = localStorage.getItem('app_version');
  
  if (cachedVersion && cachedVersion !== APP_VERSION) {
    console.log(`🔄 Version mismatch: ${cachedVersion} → ${APP_VERSION}`);
    console.log('Clearing cache and reloading...');
    
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Clear service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.unregister());
      });
    }
    
    // Update version
    localStorage.setItem('app_version', APP_VERSION);
    
    // Force reload after cache clear
    setTimeout(() => {
      window.location.reload(true);
    }, 500);
    
    return false; // Prevent app from continuing
  }
  
  // Update version if first run
  if (!cachedVersion) {
    localStorage.setItem('app_version', APP_VERSION);
  }
  
  return true; // Version OK
};

/**
 * Force clear all caches (for troubleshooting)
 */
export const forceClearCache = async () => {
  console.log('🧹 Force clearing all caches...');
  
  // Clear localStorage (except version)
  const version = localStorage.getItem('app_version');
  localStorage.clear();
  if (version) localStorage.setItem('app_version', version);
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Clear all caches
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
    console.log(`✅ Cleared ${names.length} caches`);
  }
  
  // Unregister service workers
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
    console.log(`✅ Unregistered ${registrations.length} service workers`);
  }
  
  console.log('✅ Cache cleared successfully!');
  
  // Reload
  setTimeout(() => {
    window.location.reload(true);
  }, 1000);
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.forceClearCache = forceClearCache;
  window.APP_VERSION = APP_VERSION;
}
