import React from 'react';
import { useOffline } from '../contexts/OfflineContext';

/**
 * Component that displays an offline status indicator and sync status
 */
const OfflineIndicator = () => {
  const { online, offlineQueue, syncing } = useOffline();
  
  // If online and no pending items, don't show anything
  if (online && offlineQueue.length === 0 && !syncing) {
    return null;
  }
  
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 p-2 text-sm font-medium text-white ${online ? 'bg-blue-600' : 'bg-red-600'}`}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center">
          {!online && (
            <>
              <div className="w-3 h-3 rounded-full bg-white mr-2 animate-pulse"></div>
              <span>You are offline</span>
            </>
          )}
          
          {online && offlineQueue.length > 0 && (
            <>
              <div className={`w-3 h-3 rounded-full mr-2 ${syncing ? 'bg-yellow-300 animate-pulse' : 'bg-white'}`}></div>
              <span>
                {syncing 
                  ? `Syncing ${offlineQueue.length} pending ${offlineQueue.length === 1 ? 'action' : 'actions'}...` 
                  : `${offlineQueue.length} pending ${offlineQueue.length === 1 ? 'action' : 'actions'} to sync`}
              </span>
            </>
          )}
        </div>
        
        {online && offlineQueue.length > 0 && !syncing && (
          <button 
            className="bg-white text-blue-600 px-3 py-1 rounded-md text-xs font-medium"
            onClick={() => useOffline().syncOfflineActions()}
          >
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
