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

export const AppStateProvider = ({ children }) => {
  const location = useLocation();
  const [isRestoring, setIsRestoring] = useState(true);
  const hasRestored = useRef(false);
  const isInitialMount = useRef(true);

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
        // Save state immediately when app goes to background
        statePersistence.saveEmergencyState(appState);
        logger.debug('📱 App backgrounded - state saved');
      }
    };

    const handleBeforeUnload = () => {
      // Save state before page unload
      statePersistence.saveEmergencyState(appState);
    };

    const handlePageHide = () => {
      // iOS Safari uses pagehide instead of beforeunload
      statePersistence.saveEmergencyState(appState);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [appState]);

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
    await statePersistence.clearAllState();
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
  }, []);

  // Get restored route (for use by router)
  const getRestoredRoute = useCallback(() => {
    if (appState.lastRoute && RESTORABLE_ROUTES.some(route => 
      appState.lastRoute.startsWith(route)
    )) {
      return appState.lastRoute;
    }
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
