/**
 * Enhanced Status Button Component - Uber-like Online/Offline Toggle
 * Provides comprehensive status management with animations and feedback
 */

import React, { useState, useEffect } from 'react';
import { statusService, COLLECTOR_STATUS, STATUS_CONFIG } from '../services/statusService';
import Toast from './Toast';
import { logger } from '../utils/logger';

const StatusButton = ({ className = '', showSessionInfo = false }) => {
  const [statusInfo, setStatusInfo] = useState(statusService.getStatus());
  const [isChanging, setIsChanging] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // Subscribe to status changes
    const unsubscribe = statusService.addStatusListener((statusChange) => {
      setStatusInfo(statusService.getStatus());
      
      // Show toast notification
      const config = STATUS_CONFIG[statusChange.status];
      setToast({
        message: `Status changed to ${config.label}`,
        type: statusChange.status === COLLECTOR_STATUS.ONLINE ? 'success' : 'info',
        show: true
      });
    });

    // Update status info periodically
    const interval = setInterval(() => {
      setStatusInfo(statusService.getStatus());
    }, 30000); // Update every 30 seconds

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleStatusToggle = async () => {
    if (isChanging) return;

    try {
      setIsChanging(true);
      await statusService.toggleStatus();
    } catch (error) {
      logger.error('❌ Error toggling status:', error);
      setToast({
        message: 'Failed to change status. Please try again.',
        type: 'error',
        show: true
      });
    } finally {
      setIsChanging(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (isChanging || newStatus === statusInfo.status) return;

    try {
      setIsChanging(true);
      await statusService.setStatus(newStatus);
      setShowDetails(false);
    } catch (error) {
      logger.error('❌ Error changing status:', error);
      setToast({
        message: 'Failed to change status. Please try again.',
        type: 'error',
        show: true
      });
    } finally {
      setIsChanging(false);
    }
  };

  const formatSessionTime = (startTime) => {
    if (!startTime) return '--:--';
    
    const now = new Date();
    const diff = now - new Date(startTime);
    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const config = statusInfo.config;

  return (
    <>
      <div className={`relative ${className}`}>
        {/* Main Status Button */}
        <div className="bg-white p-2 rounded-md shadow">
          <div className="flex items-center space-x-2">
            {/* Status Indicator with Pulse Animation */}
            <div className="relative">
                <button 
                  onClick={handleStatusToggle}
                  disabled={isChanging}
                  className={`
                    px-3 py-1 rounded-full text-white text-xs font-medium
                    transition-all duration-300 transform
                    ${config.color}
                    ${isChanging ? 'opacity-70 cursor-wait scale-95' : 'hover:scale-105 active:scale-95'}
                    disabled:cursor-not-allowed
                  `}
                >
                  <div className="flex items-center space-x-1">
                    {/* Status Dot with Pulse */}
                    <div className="relative">
                      <div className={`w-2 h-2 rounded-full bg-white opacity-90`} />
                      {statusInfo.isOnline && (
                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-white animate-ping opacity-30" />
                      )}
                    </div>
                    
                    {/* Status Text */}
                    <span>
                      {isChanging ? 'Updating...' : config.label}
                    </span>
                  </div>
                </button>

                {/* Loading Spinner */}
                {isChanging && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
            </div>

            {/* Options Button */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Status options"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>

          {/* Session Info - Compact */}
          {showSessionInfo && statusInfo.isOnline && statusInfo.sessionStart && (
            <div className="mt-1 pt-1 border-t border-gray-100">
              <div className="flex items-center text-xs text-gray-500 space-x-2">
                <div className="flex items-center space-x-1">
                  <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatSessionTime(statusInfo.sessionStart)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                  <span>Active</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Options Dropdown */}
        {showDetails && (
          <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-100 z-50" style={{ marginRight: '-0.5rem' }}>
            <div className="p-3">
              <h4 className="text-xs font-medium text-gray-900 mb-2">Change Status</h4>
              
              {/* Status Options */}
              <div className="space-y-1">
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={isChanging || status === statusInfo.status}
                    className={`
                      w-full flex items-center justify-between p-2 rounded text-left
                      transition-all duration-200
                      ${status === statusInfo.status 
                        ? 'bg-gray-100 border border-gray-300' 
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200'
                      }
                      disabled:cursor-not-allowed disabled:opacity-50
                    `}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${config.color}`} />
                      <div>
                        <div className="text-xs font-medium text-gray-900">{config.label}</div>
                        <div className="text-xs text-gray-500">{config.description}</div>
                      </div>
                    </div>
                    
                    {status === statusInfo.status && (
                      <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {/* Session Statistics - Compact */}
              {statusInfo.isOnline && statusInfo.sessionStart && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <h5 className="text-xs font-medium text-gray-700 mb-1">Session</h5>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="bg-green-50 p-1 rounded">
                      <div className="font-medium text-green-700 text-xs">Duration</div>
                      <div className="text-green-600 text-xs">{formatSessionTime(statusInfo.sessionStart)}</div>
                    </div>
                    <div className="bg-blue-50 p-1 rounded">
                      <div className="font-medium text-blue-700 text-xs">Requests</div>
                      <div className="text-blue-600 text-xs">{statusInfo.sessionStats.requestsAccepted}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={() => setShowDetails(false)}
                className="w-full mt-2 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Click Outside Overlay */}
        {showDetails && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDetails(false)}
          />
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          show={toast.show}
          onClose={() => setToast(null)}
          duration={3000}
        />
      )}
    </>
  );
};

export default StatusButton;
