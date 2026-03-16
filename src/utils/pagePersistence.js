/**
 * Page Persistence Utility
 * Saves and restores the last visited page to handle app resume from background
 */

const PAGE_PERSISTENCE_KEY = 'trashdrop_last_page';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export const saveLastPage = (pathname) => {
  try {
    const pageData = {
      pathname,
      timestamp: Date.now()
    };
    localStorage.setItem(PAGE_PERSISTENCE_KEY, JSON.stringify(pageData));
  } catch (error) {
    console.warn('Failed to save last page:', error);
  }
};

export const getLastPage = () => {
  try {
    const stored = localStorage.getItem(PAGE_PERSISTENCE_KEY);
    if (!stored) return null;
    
    const pageData = JSON.parse(stored);
    
    // Check if data is too old
    if (Date.now() - pageData.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(PAGE_PERSISTENCE_KEY);
      return null;
    }
    
    return pageData.pathname;
  } catch (error) {
    console.warn('Failed to get last page:', error);
    return null;
  }
};

export const clearLastPage = () => {
  try {
    localStorage.removeItem(PAGE_PERSISTENCE_KEY);
  } catch (error) {
    console.warn('Failed to clear last page:', error);
  }
};
