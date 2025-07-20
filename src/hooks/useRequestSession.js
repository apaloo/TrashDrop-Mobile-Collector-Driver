import { useState, useEffect, useCallback, useRef } from 'react';
import { requestManager } from '../services/requestManagement.js';

/**
 * Custom hook for managing collector request sessions
 * Handles session persistence across navigation and page refreshes
 */
export const useRequestSession = (collectorId) => {
  const [sessionData, setSessionData] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [availableRequests, setAvailableRequests] = useState([]);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [completedRequests, setCompletedRequests] = useState([]);
  
  const filterCriteria = useRef({});
  const sessionKey = 'trashdrop_request_session';

  /**
   * Load persisted session data from localStorage
   */
  const loadPersistedSession = useCallback(() => {
    try {
      const stored = localStorage.getItem(sessionKey);
      if (stored) {
        const session = JSON.parse(stored);
        if (session.collectorId === collectorId) {
          setSessionData(session);
          filterCriteria.current = session.filterCriteria || {};
          return session;
        }
      }
    } catch (error) {
      console.error('Error loading persisted session:', error);
    }
    return null;
  }, [collectorId]);

  /**
   * Persist session data to localStorage
   */
  const persistSession = useCallback((data) => {
    try {
      const sessionToStore = {
        collectorId,
        filterCriteria: filterCriteria.current,
        timestamp: Date.now(),
        ...data
      };
      localStorage.setItem(sessionKey, JSON.stringify(sessionToStore));
      setSessionData(sessionToStore);
    } catch (error) {
      console.error('Error persisting session:', error);
    }
  }, [collectorId]);

  /**
   * Initialize the request management service
   */
  const initializeService = useCallback(async () => {
    if (!collectorId || isInitialized) return;

    try {
      setError(null);
      
      // Load any persisted session data
      loadPersistedSession();
      
      // Initialize the request manager
      await requestManager.initialize(collectorId);
      
      setIsInitialized(true);
      
      // Load initial notifications
      await loadNotifications();
      
      console.log('Request session initialized for collector:', collectorId);
    } catch (err) {
      setError(err.message);
      console.error('Error initializing request session:', err);
    }
  }, [collectorId, isInitialized, loadPersistedSession]);

  /**
   * Apply filters and get available requests
   */
  const filterRequests = useCallback(async (newFilterCriteria = {}) => {
    if (!isInitialized) return { success: false, error: 'Service not initialized' };

    try {
      setError(null);
      
      // Update filter criteria
      filterCriteria.current = { ...filterCriteria.current, ...newFilterCriteria };
      
      // Filter and reserve requests
      const result = await requestManager.filterAndReserveRequests(filterCriteria.current);
      
      if (result.success) {
        setAvailableRequests(result.requests);
        persistSession({ lastFilterTime: Date.now() });
      } else {
        setError(result.error);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [isInitialized, persistSession]);

  /**
   * Accept a request
   */
  const acceptRequest = useCallback(async (requestId) => {
    if (!isInitialized) return { success: false, error: 'Service not initialized' };

    try {
      setError(null);
      
      const result = await requestManager.acceptRequest(requestId);
      
      if (result.success) {
        // Remove from available requests
        setAvailableRequests(prev => prev.filter(req => req.id !== requestId));
        
        // Add to accepted requests
        setAcceptedRequests(prev => [result.request, ...prev]);
        
        // Update persisted session
        persistSession({ lastAcceptTime: Date.now() });
      } else {
        setError(result.error);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [isInitialized, persistSession]);

  /**
   * Load requests by status
   */
  const loadRequestsByStatus = useCallback(async (status) => {
    if (!isInitialized) return;

    try {
      const result = await requestManager.getRequestsByStatus(status);
      
      if (result.success) {
        switch (status) {
          case 'available':
            setAvailableRequests(result.requests);
            break;
          case 'accepted':
            setAcceptedRequests(result.requests);
            break;
          case 'completed':
            setCompletedRequests(result.requests);
            break;
        }
      }
    } catch (error) {
      console.error(`Error loading ${status} requests:`, error);
    }
  }, [isInitialized]);

  /**
   * Load all request statuses
   */
  const refreshAllRequests = useCallback(async () => {
    await Promise.all([
      loadRequestsByStatus('available'),
      loadRequestsByStatus('accepted'),
      loadRequestsByStatus('completed')
    ]);
  }, [loadRequestsByStatus]);

  /**
   * Update request status
   */
  const updateRequestStatus = useCallback(async (requestId, status, additionalData = {}) => {
    if (!isInitialized) return { success: false, error: 'Service not initialized' };

    try {
      const result = await requestManager.updateRequestStatus(requestId, status, additionalData);
      
      if (result.success) {
        // Refresh requests to get updated state
        await refreshAllRequests();
      }
      
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [isInitialized, refreshAllRequests]);

  /**
   * Load notifications
   */
  const loadNotifications = useCallback(async (unreadOnly = false) => {
    if (!isInitialized) return;

    try {
      const result = await requestManager.getNotifications(unreadOnly);
      
      if (result.success) {
        setNotifications(result.notifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [isInitialized]);

  /**
   * Mark notification as read
   */
  const markNotificationRead = useCallback(async (notificationId) => {
    if (!isInitialized) return;

    try {
      const result = await requestManager.markNotificationRead(notificationId);
      
      if (result.success) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, read_at: new Date().toISOString() }
              : notif
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [isInitialized]);

  /**
   * Clear current filter and reset available requests
   */
  const clearFilter = useCallback(() => {
    filterCriteria.current = {};
    setAvailableRequests([]);
    persistSession({ lastClearTime: Date.now() });
  }, [persistSession]);

  /**
   * Setup event listeners for real-time updates
   */
  useEffect(() => {
    if (!isInitialized) return;

    const handleRequestUnavailable = (event) => {
      const { requestId, message } = event.detail;
      
      // Remove from available requests
      setAvailableRequests(prev => prev.filter(req => req.id !== requestId));
      
      // Add notification
      setNotifications(prev => [{
        id: `local_${Date.now()}`,
        message,
        created_at: new Date().toISOString(),
        notification_type: 'request_unavailable',
        read_at: null
      }, ...prev]);
    };

    const handleNewNotification = (event) => {
      const notification = event.detail;
      setNotifications(prev => [notification, ...prev]);
    };

    window.addEventListener('requestUnavailable', handleRequestUnavailable);
    window.addEventListener('newNotification', handleNewNotification);

    return () => {
      window.removeEventListener('requestUnavailable', handleRequestUnavailable);
      window.removeEventListener('newNotification', handleNewNotification);
    };
  }, [isInitialized]);

  /**
   * Initialize service when component mounts or collectorId changes
   */
  useEffect(() => {
    if (collectorId) {
      initializeService();
    }

    // Cleanup on unmount
    return () => {
      if (isInitialized) {
        requestManager.destroy();
      }
    };
  }, [collectorId, initializeService]);

  /**
   * Auto-refresh requests periodically
   */
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      // Only refresh if we have active filters
      if (Object.keys(filterCriteria.current).length > 0) {
        filterRequests();
      }
      loadNotifications(true); // Load unread notifications
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [isInitialized, filterRequests, loadNotifications]);

  return {
    // State
    sessionData,
    isInitialized,
    error,
    notifications,
    availableRequests,
    acceptedRequests,
    completedRequests,
    filterCriteria: filterCriteria.current,
    
    // Actions
    filterRequests,
    acceptRequest,
    updateRequestStatus,
    refreshAllRequests,
    loadNotifications,
    markNotificationRead,
    clearFilter,
    
    // Computed values
    hasUnreadNotifications: notifications.some(n => !n.read_at),
    unreadNotificationCount: notifications.filter(n => !n.read_at).length,
    hasActiveFilter: Object.keys(filterCriteria.current).length > 0
  };
};
