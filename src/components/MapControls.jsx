import React from 'react';

/**
 * MapControls component - Provides overlay UI elements for the Map
 * This separates the UI controls from the map rendering components
 */
const MapControls = ({ lastUpdated, isRefreshing, refreshData, requestCount }) => {
  if (!lastUpdated) return null;

  // Format time as HH:MM:SS
  const formatTime = (date) => {
    // Handle both Date objects and strings
    if (typeof date === 'string') {
      return date; // If it's already a formatted string, return as is
    }
    
    // Ensure it's a valid Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid time';
    }
    
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const seconds = dateObj.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="absolute z-10 top-2 left-2 bg-white bg-opacity-80 px-2 py-1 text-xs rounded-md" style={{ color: 'rgb(10, 10, 10)' }}>
      <div className="flex items-center">
        <span className="mr-2">Last updated: {formatTime(lastUpdated)}</span>
        <button
          onClick={refreshData}
          className="text-blue-600 flex items-center"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <div className="animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full mr-1"></div>
              <span>Refreshing</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </>
          )}
        </button>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {requestCount} pickup requests available
      </div>
    </div>
  );
};

export default MapControls;
