import React from 'react';
import '../styles/mapSkeleton.css';

const MapSkeleton = ({ className = "w-full h-full", showControls = true }) => {
  return (
    <div className={`${className} bg-gray-100 relative rounded-lg overflow-hidden`}>
      {/* Fake map background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-blue-50 to-gray-100" />
      
      {/* Fake road patterns */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-0 right-0 h-0.5 bg-gray-300 opacity-40" />
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300 opacity-40" />
        <div className="absolute top-3/4 left-0 right-0 h-0.5 bg-gray-300 opacity-40" />
        <div className="absolute top-0 bottom-0 left-1/4 w-0.5 bg-gray-300 opacity-40" />
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-300 opacity-40" />
        <div className="absolute top-0 bottom-0 right-1/4 w-0.5 bg-gray-300 opacity-40" />
      </div>
      
      {/* Fake markers with different colors and positions */}
      <div className="absolute top-1/4 left-1/3 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-6 h-6 bg-blue-500 rounded-full animate-pulse shadow-lg relative">
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-500 rotate-45"></div>
        </div>
      </div>
      
      <div className="absolute top-1/2 right-1/4 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-6 h-6 bg-green-500 rounded-full animate-pulse shadow-lg relative" style={{ animationDelay: '0.2s' }}>
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-500 rotate-45"></div>
        </div>
      </div>
      
      <div className="absolute bottom-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-6 h-6 bg-red-500 rounded-full animate-pulse shadow-lg relative" style={{ animationDelay: '0.4s' }}>
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-red-500 rotate-45"></div>
        </div>
      </div>
      
      <div className="absolute top-3/5 left-1/5 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-6 h-6 bg-purple-500 rounded-full animate-pulse shadow-lg relative" style={{ animationDelay: '0.6s' }}>
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-purple-500 rotate-45"></div>
        </div>
      </div>
      
      <div className="absolute top-1/6 right-1/3 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-6 h-6 bg-yellow-500 rounded-full animate-pulse shadow-lg relative" style={{ animationDelay: '0.8s' }}>
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-yellow-500 rotate-45"></div>
        </div>
      </div>
      
      {showControls && (
        <>
          {/* Fake zoom controls */}
          <div className="absolute top-4 right-4 space-y-1">
            <div className="w-8 h-8 bg-white rounded shadow-md animate-pulse border border-gray-200" />
            <div className="w-8 h-8 bg-white rounded shadow-md animate-pulse border border-gray-200" style={{ animationDelay: '0.1s' }} />
          </div>
          
          {/* Fake recenter button */}
          <div className="absolute bottom-6 right-4">
            <div className="w-10 h-10 bg-blue-600 rounded-full shadow-lg animate-pulse opacity-80" style={{ animationDelay: '0.3s' }} />
          </div>
        </>
      )}
      
      {/* Loading overlay with subtle animation */}
      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-2 text-gray-600 text-sm font-medium">Loading Map...</p>
        </div>
      </div>
      
      {/* Subtle shimmer effect */}
      <div 
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 shimmer-effect" 
        style={{ 
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
        }} 
      />
    </div>
  );
};

export default MapSkeleton;
