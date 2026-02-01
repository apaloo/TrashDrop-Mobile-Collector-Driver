/**
 * App State Context
 * Provides centralized state management with persistence for PWA crash/idle recovery
 * Works alongside existing contexts without replacing them
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { statePersistence } from '../services/statePersistence';
import { logger } from '../utils/logger';

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
    activeTaskId: null,
    activeTaskData: null,
    navigationState: null,
    formDrafts: {}
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

  // Handle visibility change (app going to background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // CRITICAL: Save current route to localStorage FIRST (synchronous, guaranteed)
        saveRouteSync(location.pathname);
        
        // Then save full state to IndexedDB (async)
        statePersistence.saveEmergencyState(appState);
        logger.debug('📱 App backgrounded - route & state saved');
      } else {
        // App returning to foreground - could refresh critical data here
        logger.debug('📱 App foregrounded - checking state');
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

  // State update functions
  const setActiveTab = useCallback((tab) => {
    setAppState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const setActiveModal = useCallback((modal, modalData = null) => {
    setAppState(prev => ({ 
      ...prev, 
      activeModal: modal,
      activeModalData: modalData
    }));
  }, []);

  const clearActiveModal = useCallback(() => {
    setAppState(prev => ({ 
      ...prev, 
      activeModal: null,
      activeModalData: null
    }));
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
      formDrafts: {}
    });
    
    logger.debug('🗑️ All state cleared including route persistence');
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

export default AppStateContext;
