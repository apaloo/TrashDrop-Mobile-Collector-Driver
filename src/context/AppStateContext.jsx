/**
 * App State Context
 * Provides centralized state management with persistence for PWA crash/idle recovery
 * Works alongside existing contexts without replacing them
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { statePersistence } from '../services/statePersistence';
import { logger } from '../utils/logger';
import { debounce } from 'lodash';
import { saveLastPage, getLastPage } from '../utils/pagePersistence'; // Add for validation

const AppStateContext = createContext();

// Protected routes that should be restored (not login/signup)
const RESTORABLE_ROUTES = ['/map', '/request', '/assign', '/earnings', '/profile', '/route-optimization'];

// CRITICAL: Synchronous localStorage keys for immediate route restoration
const LAST_ROUTE_KEY = 'trashdrop_last_route';
const LAST_ROUTE_TIME_KEY = 'trashdrop_last_route_time';
const ROUTE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper: Synchronously save current route (called on every navigation)
const saveRouteSync = (route) => {
  if (route && RESTORABLE_ROUTES.some(r => route.startsWith(r))) {
    try {
      localStorage.setItem(LAST_ROUTE_KEY, route);
      localStorage.setItem(LAST_ROUTE_TIME_KEY, Date.now().toString());
    } catch (e) {
      // localStorage might be full, ignore
    }
  }
};

// Helper: Synchronously get last saved route (for immediate restoration)
const getLastRouteSync = () => {
  try {
    const route = localStorage.getItem(LAST_ROUTE_KEY);
    const timeStr = localStorage.getItem(LAST_ROUTE_TIME_KEY);
    
    if (!route || !timeStr) return null;
    
    // Check if route is expired (older than 24 hours)
    const savedTime = parseInt(timeStr, 10);
    if (Date.now() - savedTime > ROUTE_EXPIRY_MS) {
      localStorage.removeItem(LAST_ROUTE_KEY);
      localStorage.removeItem(LAST_ROUTE_TIME_KEY);
      return null;
    }
    
    // Validate route is in allowed list
    if (RESTORABLE_ROUTES.some(r => route.startsWith(r))) {
      return route;
    }
    return null;
  } catch (e) {
    return null;
  }
};

// ENHANCED: Navigation modal state persistence (synchronous)
const NAV_MODAL_STATE_KEY = 'trashdrop_nav_modal_state';
const NAV_MODAL_TIME_KEY = 'trashdrop_nav_modal_time';
const NAV_MODAL_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

const saveNavigationModalStateSync = (state) => {
  try {
    if (state && state.isOpen) {
      localStorage.setItem(NAV_MODAL_STATE_KEY, JSON.stringify(state));
      localStorage.setItem(NAV_MODAL_TIME_KEY, Date.now().toString());
    } else {
      localStorage.removeItem(NAV_MODAL_STATE_KEY);
      localStorage.removeItem(NAV_MODAL_TIME_KEY);
    }
  } catch (e) {
    // localStorage might be full, ignore
  }
};

const getNavigationModalState = () => {
  try {
    const stateStr = localStorage.getItem(NAV_MODAL_STATE_KEY);
    const timeStr = localStorage.getItem(NAV_MODAL_TIME_KEY);
    
    if (!stateStr || !timeStr) return null;
    
    // Check expiry (2 hours)
    const savedTime = parseInt(timeStr, 10);
    if (Date.now() - savedTime > NAV_MODAL_EXPIRY_MS) {
      localStorage.removeItem(NAV_MODAL_STATE_KEY);
      localStorage.removeItem(NAV_MODAL_TIME_KEY);
      return null;
    }
    
    return JSON.parse(stateStr);
  } catch (e) {
    return null;
  }
};

// ENHANCED: User location persistence (synchronous)
const USER_LOCATION_KEY = 'trashdrop_user_location';
const USER_LOCATION_TIME_KEY = 'trashdrop_user_location_time';
const USER_LOCATION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

const saveUserLocationSync = (location) => {
  try {
    if (location && location.lat && location.lng) {
      localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(location));
      localStorage.setItem(USER_LOCATION_TIME_KEY, Date.now().toString());
    } else {
      localStorage.removeItem(USER_LOCATION_KEY);
      localStorage.removeItem(USER_LOCATION_TIME_KEY);
    }
  } catch (e) {
    // localStorage might be full, ignore
  }
};

const getCurrentUserLocation = () => {
  try {
    const locationStr = localStorage.getItem(USER_LOCATION_KEY);
    const timeStr = localStorage.getItem(USER_LOCATION_TIME_KEY);
    
    if (!locationStr || !timeStr) return null;
    
    // Check expiry (30 minutes)
    const savedTime = parseInt(timeStr, 10);
    if (Date.now() - savedTime > USER_LOCATION_EXPIRY_MS) {
      localStorage.removeItem(USER_LOCATION_KEY);
      localStorage.removeItem(USER_LOCATION_TIME_KEY);
      return null;
    }
    
    return JSON.parse(locationStr);
  } catch (e) {
    return null;
  }
};

export const AppStateProvider = ({ children }) => {
  const location = useLocation();
  const [isRestoring, setIsRestoring] = useState(true);
  const hasRestored = useRef(false);
  const isInitialMount = useRef(true);
  
  // CRITICAL: Get last route synchronously on first render (before any async operations)
  const initialRouteRef = useRef(getLastRouteSync());
  const hasLoggedRouteRestoration = useRef(false);
  
  // Log for debugging - only once on mount
  useEffect(() => {
    if (initialRouteRef.current && !hasLoggedRouteRestoration.current) {
      hasLoggedRouteRestoration.current = true;
      logger.info('🔄 Found saved route for restoration:', initialRouteRef.current);
    }
  }, []);

  // App-wide state that needs persistence
  const [appState, setAppState] = useState({
    lastRoute: null,
    activeTab: null,
    activeModal: null,
    activeModalData: null, // Add for complete modal rehydration
    activeTaskId: null,
    activeTaskData: null,
    navigationState: null,
    formDrafts: {},
    // Enhanced metadata for better restoration
    sessionMetadata: {
      lastBackgroundedAt: null,
      lastRestoredAt: null,
      restorationCount: 0
    }
  });

  // Initialize persistence service and restore state on mount
  useEffect(() => {
    const initAndRestore = async () => {
      if (hasRestored.current) return;
      hasRestored.current = true;

      try {
        // Initialize persistence service
        await statePersistence.initialize();

        // Load saved state
        const savedState = await statePersistence.loadState(
          statePersistence.KEYS.APP_STATE
        );

        if (savedState) {
          logger.info('🔄 Restoring app state from persistence...');
          setAppState(prev => ({
            ...prev,
            ...savedState,
            // Don't restore navigation state here - let the navigation component handle it
            navigationState: savedState.navigationState
          }));
        }
      } catch (error) {
        logger.error('Failed to restore app state:', error);
      } finally {
        setIsRestoring(false);
      }
    };

    initAndRestore();
  }, []);

  // Persist state on changes (debounced)
  useEffect(() => {
    if (isRestoring || isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    statePersistence.saveState(statePersistence.KEYS.APP_STATE, appState);
  }, [appState, isRestoring]);

  // Track route changes for restoration
  useEffect(() => {
    if (isRestoring) return;
    
    // Only save restorable routes
    if (RESTORABLE_ROUTES.some(route => location.pathname.startsWith(route))) {
      // CRITICAL: Save to localStorage IMMEDIATELY (synchronous) for fast restoration
      saveRouteSync(location.pathname);
      
      // Also update React state for consistency
      setAppState(prev => {
        if (prev.lastRoute !== location.pathname) {
          return { ...prev, lastRoute: location.pathname };
        }
        return prev;
      });
    }
  }, [location.pathname, isRestoring]);

  // Handle visibility change (app going to background) - ENHANCED for PWA restoration
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.info('📱 App backgrounded - executing comprehensive state flush');
        
        // CRITICAL LAYER 1: Save current route to localStorage IMMEDIATELY (synchronous)
        saveRouteSync(location.pathname);
        
        // CRITICAL LAYER 2: Save modal state if navigation modal is open
        const navModalState = getNavigationModalState();
        if (navModalState && navModalState.isOpen) {
          saveNavigationModalStateSync(navModalState);
        }
        
        // CRITICAL LAYER 3: Save user location if available
        const userLocation = getCurrentUserLocation();
        if (userLocation) {
          saveUserLocationSync(userLocation);
        }
        
        // LAYER 4: Save full app state to IndexedDB (async, best effort)
        statePersistence.saveEmergencyState({
          ...appState,
          lastRoute: location.pathname,
          navigationModalState: navModalState,
          userLocation: userLocation,
          backgroundedAt: Date.now(),
          sessionMetadata: {
            ...appState.sessionMetadata,
            lastBackgroundedAt: Date.now()
          }
        });
        
        logger.debug('✅ Comprehensive state flush completed');
      } else {
        // App returning to foreground - could refresh critical data here
        logger.debug('📱 App foregrounded - checking state integrity');
        
        // Update restoration metadata
        setAppState(prev => ({
          ...prev,
          sessionMetadata: {
            ...prev.sessionMetadata,
            lastRestoredAt: Date.now(),
            restorationCount: (prev.sessionMetadata.restorationCount || 0) + 1
          }
        }));
        
        // Verify state integrity after resume
        const restoredRoute = getLastRouteSync();
        if (restoredRoute && restoredRoute !== location.pathname) {
          logger.warn('⚠️ Route mismatch detected - may need to redirect');
        }
      }
    };

    const handleBeforeUnload = () => {
      // CRITICAL: Save route synchronously first
      saveRouteSync(location.pathname);
      // Save state before page unload
      statePersistence.saveEmergencyState(appState);
    };

    const handlePageHide = (event) => {
      // CRITICAL: Save route synchronously first (iOS Safari)
      saveRouteSync(location.pathname);
      // iOS Safari uses pagehide instead of beforeunload
      statePersistence.saveEmergencyState(appState);
      if (!event.persisted) {
        logger.debug('📱 Page hiding (not cached) - route & state saved');
      }
    };

    // Page Lifecycle API - freeze event (modern browsers)
    // Fired when page is being frozen (app switching, tab discarding)
    const handleFreeze = () => {
      // CRITICAL: Save route synchronously first
      saveRouteSync(location.pathname);
      statePersistence.saveEmergencyState(appState);
      logger.debug('🧊 App frozen - route & state saved');
    };

    // Resume event - when app returns from frozen state
    const handleResume = () => {
      logger.debug('🔄 App resumed from frozen state');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    // Page Lifecycle API events (if supported)
    if ('onfreeze' in document) {
      document.addEventListener('freeze', handleFreeze);
      document.addEventListener('resume', handleResume);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      if ('onfreeze' in document) {
        document.removeEventListener('freeze', handleFreeze);
        document.removeEventListener('resume', handleResume);
      }
    };
  }, [appState, location.pathname]);

  // Periodic auto-save as safety net (every 30 seconds when active)
  useEffect(() => {
    if (isRestoring) return;
    
    const autoSaveInterval = setInterval(() => {
      if (!document.hidden) {
        statePersistence.saveState(statePersistence.KEYS.APP_STATE, appState);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [appState, isRestoring]);

  // State update functions with debounced persistence
  const setActiveModal = useCallback((modal, modalData = null) => {
    setAppState(prev => ({ 
      ...prev, 
      activeModal: modal,
      activeModalData: modalData
    }));
    
    // DEBOUNCED: Save modal state changes immediately (critical for navigation modal)
    if (modal === 'navigation' && modalData) {
      debouncedSaveNavigationModalState({
        isOpen: true,
        ...modalData
      });
    } else if (!modal) {
      debouncedSaveNavigationModalState(null);
    }
  }, []);

  // Debounced navigation modal state saver (third layer protection)
  const debouncedSaveNavigationModalState = useCallback(
    debounce((state) => {
      saveNavigationModalStateSync(state);
    }, 500), // 500ms debounce
    []
  );

  const clearActiveModal = useCallback(() => {
    setAppState(prev => ({ 
      ...prev, 
      activeModal: null,
      activeModalData: null
    }));
    debouncedSaveNavigationModalState(null);
  }, []);

  const setActiveTask = useCallback((taskId, taskData = null) => {
    setAppState(prev => ({ 
      ...prev, 
      activeTaskId: taskId,
      activeTaskData: taskData
    }));
  }, []);

  const clearActiveTask = useCallback(() => {
    setAppState(prev => ({ 
      ...prev, 
      activeTaskId: null,
      activeTaskData: null
    }));
  }, []);

  const setNavigationState = useCallback((navState) => {
    setAppState(prev => ({ ...prev, navigationState: navState }));
    // Save navigation state immediately as it's critical
    if (navState) {
      statePersistence.saveState(
        statePersistence.KEYS.NAVIGATION_STATE,
        navState,
        true
      );
    }
  }, []);

  const clearNavigationState = useCallback(async () => {
    setAppState(prev => ({ ...prev, navigationState: null }));
    await statePersistence.clearState(statePersistence.KEYS.NAVIGATION_STATE);
  }, []);

  const setActiveTab = useCallback((tab) => {
    setAppState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const saveFormDraft = useCallback((formId, data) => {
    setAppState(prev => ({
      ...prev,
      formDrafts: { ...prev.formDrafts, [formId]: data }
    }));
  }, []);

  const getFormDraft = useCallback((formId) => {
    return appState.formDrafts[formId] || null;
  }, [appState.formDrafts]);

  const clearFormDraft = useCallback((formId) => {
    setAppState(prev => {
      const { [formId]: _, ...rest } = prev.formDrafts;
      return { ...prev, formDrafts: rest };
    });
  }, []);

  const clearAllState = useCallback(async () => {
    // Clear IndexedDB state
    await statePersistence.clearAllState();
    
    // CRITICAL: Also clear synchronous localStorage route keys
    try {
      localStorage.removeItem(LAST_ROUTE_KEY);
      localStorage.removeItem(LAST_ROUTE_TIME_KEY);
      localStorage.removeItem(NAV_MODAL_STATE_KEY);
      localStorage.removeItem(NAV_MODAL_TIME_KEY);
      localStorage.removeItem(USER_LOCATION_KEY);
      localStorage.removeItem(USER_LOCATION_TIME_KEY);
    } catch (e) {
      // Ignore localStorage errors
    }
    
    // Clear the ref so it doesn't restore old route
    initialRouteRef.current = null;
    
    setAppState({
      lastRoute: null,
      activeTab: null,
      activeModal: null,
      activeModalData: null,
      activeTaskId: null,
      activeTaskData: null,
      navigationState: null,
      formDrafts: {},
      sessionMetadata: {
        lastBackgroundedAt: null,
        lastRestoredAt: null,
        restorationCount: 0
      }
    });
    
    logger.debug('🗑️ All state cleared including route persistence');
  }, []);

  // VALIDATION: Test restoration data integrity
  const validateRestorationData = useCallback(() => {
    const validation = {
      timestamp: Date.now(),
      results: {
        lastPage: null,
        navModalState: null,
        userLocation: null,
        routeIntegrity: false,
        navModalIntegrity: false,
        userLocationIntegrity: false,
        overallIntegrity: false
      }
    };

    try {
      // Test 1: Check getLastPage() from pagePersistence
      const lastPage = getLastPage();
      validation.results.lastPage = lastPage;
      
      // Test 2: Check navigation modal state
      const navModalState = getNavigationModalState();
      validation.results.navModalState = navModalState;
      
      // Test 3: Check user location
      const userLocation = getCurrentUserLocation();
      validation.results.userLocation = userLocation;
      
      // Test 4: Validate route integrity
      if (lastPage && RESTORABLE_ROUTES.some(route => lastPage.startsWith(route))) {
        validation.results.routeIntegrity = true;
      }
      
      // Test 5: Validate nav modal integrity
      if (navModalState && navModalState.isOpen && navModalState.destination) {
        validation.results.navModalIntegrity = true;
      }
      
      // Test 6: Validate user location integrity
      if (userLocation && userLocation.lat && userLocation.lng) {
        validation.results.userLocationIntegrity = true;
      }
      
      // Test 7: Overall integrity
      validation.results.overallIntegrity = validation.results.routeIntegrity;
      
      logger.info('🔍 State restoration validation:', validation);
      return validation;
    } catch (error) {
      logger.error('❌ State restoration validation failed:', error);
      validation.error = error.message;
      return validation;
    }
  }, []);

  // Get restored route (for use by router)
  // CRITICAL: Check localStorage FIRST (synchronous), then fall back to React state
  const getRestoredRoute = useCallback(() => {
    // Priority 1: Check synchronous localStorage (most reliable for app restart)
    const syncRoute = initialRouteRef.current || getLastRouteSync();
    if (syncRoute) {
      logger.debug('🔄 Restoring route from localStorage:', syncRoute);
      return syncRoute;
    }
    
    // Priority 2: Check React state (from IndexedDB restoration)
    if (appState.lastRoute && RESTORABLE_ROUTES.some(route => 
      appState.lastRoute.startsWith(route)
    )) {
      logger.debug('🔄 Restoring route from state:', appState.lastRoute);
      return appState.lastRoute;
    }
    
    logger.debug('🔄 No route to restore, using default');
    return null;
  }, [appState.lastRoute]);

  return (
    <AppStateContext.Provider value={{
      // State
      appState,
      isRestoring,
      
      // Route restoration
      getRestoredRoute,
      
      // Tab management
      setActiveTab,
      activeTab: appState.activeTab,
      
      // Modal management
      setActiveModal,
      clearActiveModal,
      activeModal: appState.activeModal,
      activeModalData: appState.activeModalData,
      
      // Task management
      setActiveTask,
      clearActiveTask,
      activeTaskId: appState.activeTaskId,
      activeTaskData: appState.activeTaskData,
      
      // Navigation state
      setNavigationState,
      clearNavigationState,
      navigationState: appState.navigationState,
      
      // Form drafts
      saveFormDraft,
      getFormDraft,
      clearFormDraft,
      
      // Validation and testing
      validateRestorationData,
      
      // Clear all
      clearAllState
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
};

// Global testing function for manual validation (accessible from browser console)
window.validatePWARestoration = () => {
  try {
    const validation = {
      timestamp: Date.now(),
      localStorage: {},
      results: {
        lastPage: null,
        navModalState: null,
        userLocation: null,
        routeIntegrity: false,
        navModalIntegrity: false,
        userLocationIntegrity: false,
        overallIntegrity: false
      }
    };

    // Check localStorage contents
    validation.localStorage.lastRoute = localStorage.getItem('trashdrop_last_route');
    validation.localStorage.lastRouteTime = localStorage.getItem('trashdrop_last_route_time');
    validation.localStorage.navModalState = localStorage.getItem('trashdrop_nav_modal_state');
    validation.localStorage.navModalTime = localStorage.getItem('trashdrop_nav_modal_time');
    validation.localStorage.userLocation = localStorage.getItem('trashdrop_user_location');
    validation.localStorage.userLocationTime = localStorage.getItem('trashdrop_user_location_time');
    validation.localStorage.lastPage = localStorage.getItem('trashdrop_last_page');

    // Test pagePersistence
    try {
      const pageData = localStorage.getItem('trashdrop_last_page');
      if (pageData) {
        const parsed = JSON.parse(pageData);
        validation.results.lastPage = parsed.pathname;
        if (parsed.timestamp && (Date.now() - parsed.timestamp < 30 * 60 * 1000)) { // 30 min expiry
          validation.results.routeIntegrity = ['/map', '/request', '/assign', '/earnings', '/profile', '/route-optimization'].some(route => parsed.pathname.startsWith(route));
        }
      }
    } catch (e) {
      console.warn('Failed to parse last page data:', e);
    }

    // Test nav modal state
    try {
      const navStateStr = localStorage.getItem('trashdrop_nav_modal_state');
      if (navStateStr) {
        const navState = JSON.parse(navStateStr);
        validation.results.navModalState = navState;
        if (navState.isOpen && navState.destination) {
          validation.results.navModalIntegrity = true;
        }
      }
    } catch (e) {
      console.warn('Failed to parse nav modal state:', e);
    }

    // Test user location
    try {
      const locStr = localStorage.getItem('trashdrop_user_location');
      if (locStr) {
        const location = JSON.parse(locStr);
        validation.results.userLocation = location;
        if (location.lat && location.lng) {
          validation.results.userLocationIntegrity = true;
        }
      }
    } catch (e) {
      console.warn('Failed to parse user location:', e);
    }

    validation.results.overallIntegrity = validation.results.routeIntegrity;

    console.group('🔍 PWA State Restoration Validation');
    console.log('Timestamp:', new Date(validation.timestamp));
    console.log('LocalStorage Contents:', validation.localStorage);
    console.log('Validation Results:', validation.results);
    console.log('✅ Overall Integrity:', validation.results.overallIntegrity ? 'PASS' : 'FAIL');
    console.groupEnd();

    return validation;
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return { error: error.message, timestamp: Date.now() };
  }
};

// Global function to simulate app backgrounding (for testing)
window.simulateAppBackgrounding = () => {
  console.log('📱 Simulating app backgrounding...');
  if (typeof document !== 'undefined' && document.hidden !== undefined) {
    // Trigger visibility change event
    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    console.log('✅ Visibility change event dispatched');
  } else {
    console.warn('❌ Cannot simulate backgrounding in this environment');
  }
};

// Global function to simulate app foregrounding
window.simulateAppForegrounding = () => {
  console.log('📱 Simulating app foregrounding...');
  if (typeof document !== 'undefined' && document.hidden !== undefined) {
    // Trigger visibility change event
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    console.log('✅ Visibility change event dispatched');
  } else {
    console.warn('❌ Cannot simulate foregrounding in this environment');
  }
};

export default AppStateContext;
