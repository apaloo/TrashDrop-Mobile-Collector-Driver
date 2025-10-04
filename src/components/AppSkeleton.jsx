import React from 'react';

const AppSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Skeleton */}
      <div className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Loading Map Area */}
        <div className="flex-1 relative bg-gray-100">
          {/* Map Loading Animation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-4 text-gray-600 font-medium">⚡ Starting TrashDrop...</p>
              <p className="mt-2 text-sm text-gray-500">Getting your location and loading data</p>
            </div>
          </div>

          {/* Fake Map Pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="grid grid-cols-4 h-full">
              {Array.from({ length: 16 }).map((_, i) => (
                <div 
                  key={i} 
                  className="border border-gray-200 bg-gradient-to-br from-green-50 to-blue-50 animate-pulse"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>

          {/* Fake Markers */}
          <div className="absolute top-1/4 left-1/3 w-4 h-4 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute top-1/2 right-1/4 w-4 h-4 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-1/3 left-1/2 w-4 h-4 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '1.5s' }}></div>

          {/* Filter Skeleton */}
          <div className="absolute bottom-20 left-4 right-4">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-6 w-12 bg-primary rounded-full animate-pulse"></div>
              </div>
              <div className="h-2 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Skeleton */}
      <div className="bg-white border-t px-4 py-2">
        <div className="flex justify-around">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center py-2">
              <div className="h-6 w-6 bg-gray-200 rounded animate-pulse mb-1"></div>
              <div className="h-3 w-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="absolute top-20 left-4 right-4">
        <div className="bg-white rounded-lg shadow-sm p-3 mb-2 opacity-90">
          <div className="flex items-center text-sm text-gray-600">
            <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
            <span>Services starting...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppSkeleton;
