import React, { useState, useEffect, useCallback } from 'react';
import { useFilters } from '../context/FilterContext';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../context/AuthContext';
import { useRequestSession } from '../hooks/useRequestSession';
import RequestCard from '../components/RequestCard';
import Toast from '../components/Toast';
import { getCurrentLocation } from '../utils/geoUtils';
import { logger } from '../utils/logger';

/**
 * Enhanced Request Page with session management and real-time updates
 * Features:
 * - Persistent filtering across navigation/refresh
 * - 5-minute request reservations
 * - 10-hour assignment timeouts
 * - Real-time conflict resolution
 * - Session-based state management
 */
const EnhancedRequestPage = () => {
  const { user } = useAuth();
  const { filters, updateFilteredRequests } = useFilters();
  
  // Enhanced session management
  const {
    isInitialized,
    error: sessionError,
    notifications,
    availableRequests,
    acceptedRequests,
    completedRequests,
    filterCriteria,
    hasUnreadNotifications,
    unreadNotificationCount,
    hasActiveFilter,
    // Actions
    filterRequests,
    acceptRequest,
    updateRequestStatus,
    refreshAllRequests,
    loadNotifications,
    markNotificationRead,
    clearFilter
  } = useRequestSession(user?.id);

  // Local state
  const [activeTab, setActiveTab] = useState('available');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState({});

  // Toast helper functions
  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    setToast({ show: true, message, type, duration });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }));
  }, []);

  // Get user location on mount
  useEffect(() => {
    const getUserLocation = async () => {
      try {
        const location = await getCurrentLocation();
        setUserLocation(location);
      } catch (error) {
        logger.warn('Could not get user location:', error);
        // Fallback to Accra, Ghana
        setUserLocation({ lat: 5.6037, lng: -0.1870 });
      }
    };

    getUserLocation();
  }, []);

  // Handle tab changes
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  // Handle applying filters
  const handleApplyFilters = useCallback(async (newFilters) => {
    setIsLoading(true);
    setFilterModalOpen(false);
    
    try {
      const result = await filterRequests({
        ...newFilters,
        userLocation: userLocation
      });
      
      if (result.success) {
        showToast(`Found ${result.requests?.length || 0} matching requests`, 'success');
        updateFilteredRequests(result.requests || []);
      } else {
        showToast(result.error || 'Failed to apply filters', 'error');
      }
    } catch (error) {
      showToast('Error applying filters', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [filterRequests, userLocation, showToast, updateFilteredRequests]);

  // Handle clearing filters
  const handleClearFilters = useCallback(() => {
    clearFilter();
    setTempFilters({});
    showToast('Filters cleared', 'info');
    updateFilteredRequests([]);
  }, [clearFilter, showToast, updateFilteredRequests]);

  // Handle accepting a request
  const handleAcceptRequest = useCallback(async (requestId) => {
    setIsLoading(true);
    
    try {
      const result = await acceptRequest(requestId);
      
      if (result.success) {
        showToast('Request accepted successfully!', 'success');
        setActiveTab('accepted'); // Switch to accepted tab
        await refreshAllRequests(); // Refresh all data
      } else {
        showToast(result.error || 'Failed to accept request', 'error');
      }
    } catch (error) {
      showToast('Error accepting request', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [acceptRequest, showToast, refreshAllRequests]);

  // Handle request status updates (pickup, disposal)
  const handleStatusUpdate = useCallback(async (requestId, newStatus, additionalData = {}) => {
    setIsLoading(true);
    
    try {
      const result = await updateRequestStatus(requestId, newStatus, additionalData);
      
      if (result.success) {
        const statusMessages = {
          'picked_up': 'Request marked as picked up!',
          'disposed': 'Request completed successfully!'
        };
        
        showToast(statusMessages[newStatus] || 'Status updated', 'success');
        await refreshAllRequests();
      } else {
        showToast(result.error || 'Failed to update status', 'error');
      }
    } catch (error) {
      showToast('Error updating status', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [updateRequestStatus, showToast, refreshAllRequests]);

  // Handle opening directions
  const handleOpenDirections = useCallback((requestId, location) => {
    if (location && location.coordinates) {
      const [lng, lat] = location.coordinates;
      const url = `https://maps.google.com/?q=${lat},${lng}`;
      window.open(url, '_blank');
    } else {
      showToast('Location coordinates not available', 'error');
    }
  }, [showToast]);

  // Handle notification click
  const handleNotificationClick = useCallback(async (notification) => {
    if (!notification.read_at) {
      await markNotificationRead(notification.id);
    }
    
    // Handle different notification types
    if (notification.notification_type === 'request_unavailable') {
      showToast('Request is no longer available', 'info');
    } else if (notification.notification_type === 'assignment_expired') {
      showToast('Assignment has expired and returned to pool', 'warning');
      await refreshAllRequests();
    }
  }, [markNotificationRead, showToast, refreshAllRequests]);

  // Refresh data periodically
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      refreshAllRequests();
    }, 2 * 60 * 1000); // Refresh every 2 minutes

    return () => clearInterval(interval);
  }, [isInitialized, refreshAllRequests]);

  // Show session error if initialization failed
  if (sessionError && !isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavBar title="Requests" />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-red-600 mb-4">Failed to initialize request session</p>
            <p className="text-gray-600">{sessionError}</p>
            <button 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getTabRequests = (tab) => {
    switch (tab) {
      case 'available':
        return availableRequests;
      case 'accepted':
        return acceptedRequests;
      case 'completed':
        return completedRequests;
      default:
        return [];
    }
  };

  const getTabCount = (tab) => getTabRequests(tab).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavBar 
        title="Requests" 
        showNotificationBadge={hasUnreadNotifications}
        notificationCount={unreadNotificationCount}
        onNotificationClick={() => setShowNotifications(true)}
      />
      
      <main className="pb-20">
        {/* Filter Bar */}
        <div className="bg-white border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setFilterModalOpen(true)}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 2v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filter</span>
                {hasActiveFilter && (
                  <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                )}
              </button>
              
              {hasActiveFilter && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg"
                >
                  Clear
                </button>
              )}
            </div>
            
            <div className="text-sm text-gray-600">
              {availableRequests.length > 0 && (
                <span>{availableRequests.length} requests reserved</span>
              )}
            </div>
          </div>
          
          {hasActiveFilter && (
            <div className="mt-2 text-xs text-blue-600">
              Active filters: {Object.keys(filterCriteria).join(', ')}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b">
          <nav className="flex">
            {[
              { id: 'available', label: 'Available', count: getTabCount('available') },
              { id: 'accepted', label: 'Accepted', count: getTabCount('accepted') },
              { id: 'completed', label: 'Completed', count: getTabCount('completed') }
            ].map(tab => (
              <button
                key={tab.id}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Loading State */}
        {(isLoading || !isInitialized) && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">
              {!isInitialized ? 'Initializing session...' : 'Loading...'}
            </span>
          </div>
        )}

        {/* Request Lists */}
        <div className="px-4 py-6">
          {/* Available Requests */}
          {activeTab === 'available' && (
            <div>
              {availableRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">
                    {hasActiveFilter 
                      ? 'No requests match your current filters' 
                      : 'No available requests. Apply filters to see matching requests.'
                    }
                  </p>
                  {!hasActiveFilter && (
                    <button
                      onClick={() => setFilterModalOpen(true)}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      Apply Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {availableRequests.map(request => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onAccept={handleAcceptRequest}
                      onOpenDirections={handleOpenDirections}
                      showReservationTimer={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Accepted Requests */}
          {activeTab === 'accepted' && (
            <div>
              {acceptedRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">You haven't accepted any requests yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {acceptedRequests.map(request => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onOpenDirections={handleOpenDirections}
                      onStatusUpdate={handleStatusUpdate}
                      showAssignmentTimer={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Completed Requests */}
          {activeTab === 'completed' && (
            <div>
              {completedRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">You haven't completed any requests yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedRequests.map(request => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onOpenDirections={handleOpenDirections}
                      showCompletionDetails={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <BottomNavBar activeTab="request" />

      {/* Filter Modal */}
      {filterModalOpen && (
        <FilterModal
          isOpen={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          filters={tempFilters}
          onFiltersChange={setTempFilters}
          onApply={() => handleApplyFilters(tempFilters)}
          currentLocation={userLocation}
        />
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <NotificationModal
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onNotificationClick={handleNotificationClick}
        />
      )}

      {/* Toast Notification */}
      {toast.show && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={hideToast}
          duration={toast.duration}
        />
      )}
    </div>
  );
};

// Filter Modal Component
const FilterModal = ({ isOpen, onClose, filters, onFiltersChange, onApply, currentLocation }) => {
  if (!isOpen) return null;

  const handleFilterChange = (key, value) => {
    onFiltersChange(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Filter Requests</h3>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Waste Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Waste Type
            </label>
            <select
              value={filters.waste_type || ''}
              onChange={(e) => handleFilterChange('waste_type', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Types</option>
              <option value="plastic">Plastic</option>
              <option value="paper">Paper</option>
              <option value="metal">Metal</option>
              <option value="glass">Glass</option>
              <option value="organic">Organic</option>
            </select>
          </div>

          {/* Minimum Fee Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Fee (GHS)
            </label>
            <input
              type="number"
              value={filters.min_fee || ''}
              onChange={(e) => handleFilterChange('min_fee', parseFloat(e.target.value) || 0)}
              className="w-full p-2 border border-gray-300 rounded-lg"
              placeholder="0"
              min="0"
              step="0.5"
            />
          </div>

          {/* Distance Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Distance (km)
            </label>
            <input
              type="number"
              value={filters.max_distance || ''}
              onChange={(e) => handleFilterChange('max_distance', parseFloat(e.target.value) || 0)}
              className="w-full p-2 border border-gray-300 rounded-lg"
              placeholder="10"
              min="1"
              max="50"
            />
          </div>
        </div>

        <div className="p-4 border-t flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

// Notification Modal Component
const NotificationModal = ({ isOpen, onClose, notifications, onNotificationClick }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Notifications</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No notifications
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  !notification.read_at ? 'bg-blue-50' : ''
                }`}
                onClick={() => onNotificationClick(notification)}
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    !notification.read_at ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedRequestPage;
