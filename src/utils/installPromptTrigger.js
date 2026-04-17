/**
 * Install Prompt Trigger Utility
 * Provides functions to manually trigger or reset the install prompt
 * Useful for QR code flows or debugging
 */

const INSTALL_PROMPT_KEY = 'trashdrop_install_prompt_shown';
const INSTALL_PROMPT_DISMISSED_KEY = 'trashdrop_install_prompt_dismissed';
const INSTALL_PROMPT_DISMISSED_TIMESTAMP = 'trashdrop_install_prompt_dismissed_at';

/**
 * Reset install prompt state to force it to show again
 * Call this after QR code scan or when you want to re-show the prompt
 */
export const resetInstallPrompt = () => {
  localStorage.removeItem(INSTALL_PROMPT_KEY);
  localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
  localStorage.removeItem(INSTALL_PROMPT_DISMISSED_TIMESTAMP);
  console.log('🔄 Install prompt state reset - will show on next page load');
};

/**
 * Force install prompt to show immediately by reloading the page
 * Best used after QR code scan on new device
 */
export const forceShowInstallPrompt = () => {
  resetInstallPrompt();
  // Reload to trigger the prompt
  window.location.reload();
};

/**
 * Check if install prompt should be shown based on current state
 * @returns {boolean} - true if prompt should show
 */
export const shouldShowInstallPrompt = () => {
  // Check if app is already installed
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone === true ||
                      document.referrer.includes('android-app://');
  
  if (isStandalone) {
    return false;
  }

  // Check if permanently installed
  const hasShown = localStorage.getItem(INSTALL_PROMPT_KEY);
  if (hasShown === 'installed') {
    return false;
  }

  // Check if dismissed recently
  const hasDismissed = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY);
  const dismissedAt = localStorage.getItem(INSTALL_PROMPT_DISMISSED_TIMESTAMP);
  
  if (hasDismissed === 'true' && dismissedAt) {
    const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
    const REPROMPT_DELAY_DAYS = 7;
    
    if (daysSinceDismissed < REPROMPT_DELAY_DAYS) {
      return false;
    }
  }

  return true;
};

/**
 * Check if this is the user's first visit (useful for onboarding)
 * @returns {boolean}
 */
export const isFirstVisit = () => {
  const hasShown = localStorage.getItem(INSTALL_PROMPT_KEY);
  return !hasShown;
};

/**
 * Mark app as installed (call this after successful PWA installation)
 */
export const markAsInstalled = () => {
  localStorage.setItem(INSTALL_PROMPT_KEY, 'installed');
  localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
  localStorage.removeItem(INSTALL_PROMPT_DISMISSED_TIMESTAMP);
  console.log('✅ App marked as installed');
};
