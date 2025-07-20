import React, { useState, useEffect } from 'react';

/**
 * Enhanced RequestCard with reservation and assignment timer support
 * Features:
 * - Reservation countdown timer (5 minutes)
 * - Assignment countdown timer (10 hours)  
 * - Real-time status updates
 * - Visual indicators for different states
 */
const EnhancedRequestCard = ({
  request,
  onAccept,
  onOpenDirections,
  onStatusUpdate,
  showReservationTimer = false,
  showAssignmentTimer = false,
  showCompletionDetails = false
}) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  // Calculate time remaining
  useEffect(() => {
    let targetTime = null;
    
    if (showReservationTimer && request.reserved_until) {
      targetTime = new Date(request.reserved_until);
    } else if (showAssignmentTimer && request.assignment_expires_at) {
      targetTime = new Date(request.assignment_expires_at);
    }
    
    if (!targetTime) return;

    const updateTimer = () => {
      const now = new Date();
      const difference = targetTime - now;
      
      if (difference <= 0) {
        setTimeLeft(null);
        setIsExpired(true);
        return;
      }
      
      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      if (showReservationTimer) {
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [request.reserved_until, request.assignment_expires_at, showReservationTimer, showAssignmentTimer]);

  const formatCurrency = (amount) => {
    return `GHS ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'picked_up':
        return 'bg-yellow-100 text-yellow-800';
      case 'disposed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWasteTypeIcon = (wasteType) => {
    const icons = {
      plastic: '♻️',
      paper: '📄',
      metal: '🔩',
      glass: '🥤',
      organic: '🥬',
      general: '🗑️'
    };
    return icons[wasteType] || icons.general;
  };

  return (
    <div className={`bg-white rounded-lg shadow-md border ${isExpired ? 'border-red-300 opacity-75' : 'border-gray-200'} p-4 mb-4`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{getWasteTypeIcon(request.waste_type)}</span>
          <div>
            <h3 className="font-semibold text-gray-900 capitalize">
              {request.waste_type || 'General'} Waste
            </h3>
            <p className="text-sm text-gray-600">ID: {request.id?.slice(-8) || 'Unknown'}</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
            {request.status?.replace('_', ' ')?.toUpperCase()}
          </div>
          
          {/* Timer Display */}
          {(showReservationTimer || showAssignmentTimer) && timeLeft && (
            <div className={`mt-1 text-xs px-2 py-1 rounded ${
              showReservationTimer 
                ? 'bg-orange-100 text-orange-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              ⏱️ {timeLeft} left
            </div>
          )}
          
          {isExpired && (
            <div className="mt-1 text-xs px-2 py-1 rounded bg-red-100 text-red-800">
              ⚠️ Expired
            </div>
          )}
        </div>
      </div>

      {/* Location & Fee */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-gray-600">{request.location || 'Location not specified'}</span>
          </div>
          
          <div className="font-semibold text-green-600">
            {formatCurrency(request.fee)}
          </div>
        </div>
        
        {request.special_instructions && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800">
            💡 {request.special_instructions}
          </div>
        )}
      </div>

      {/* Completion Details */}
      {showCompletionDetails && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Picked up:</span>
              <p className="font-medium">{formatDate(request.picked_up_at)}</p>
            </div>
            <div>
              <span className="text-gray-600">Disposed:</span>
              <p className="font-medium">{formatDate(request.disposed_at)}</p>
            </div>
          </div>
          
          {request.points_earned && (
            <div className="mt-2 text-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                🎯 +{request.points_earned} points earned
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* Available Status Actions */}
        {request.status === 'available' && (
          <>
            <button
              onClick={() => onOpenDirections(request.id, request)}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              📍 Directions
            </button>
            <button
              onClick={() => onAccept(request.id)}
              disabled={isExpired}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                isExpired 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isExpired ? '❌ Expired' : '✅ Accept'}
            </button>
          </>
        )}

        {/* Accepted Status Actions */}
        {request.status === 'accepted' && (
          <>
            <button
              onClick={() => onOpenDirections(request.id, request)}
              className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
            >
              🧭 Navigate
            </button>
            <button
              onClick={() => onStatusUpdate(request.id, 'picked_up')}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              📦 Mark Picked Up
            </button>
          </>
        )}

        {/* Picked Up Status Actions */}
        {request.status === 'picked_up' && (
          <>
            <button
              onClick={() => onOpenDirections(request.id, { coordinates: [36.8219, -1.2921] })} // Disposal site
              className="flex-1 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 text-sm font-medium"
            >
              🏭 To Disposal Site
            </button>
            <button
              onClick={() => onStatusUpdate(request.id, 'disposed')}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              ♻️ Mark Disposed
            </button>
          </>
        )}

        {/* Completed Status */}
        {request.status === 'disposed' && (
          <div className="flex-1 text-center">
            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-green-100 text-green-800 text-sm font-medium">
              ✅ Completed Successfully
            </span>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Created: {formatDate(request.created_at)}</span>
          {request.accepted_at && (
            <span>Accepted: {formatDate(request.accepted_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedRequestCard;
