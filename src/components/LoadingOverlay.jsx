import React from 'react';

const LoadingOverlay = ({ show, message = 'Loading...' }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
        <div className="animate-spin w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full"></div>
        <span className="text-gray-700">{message}</span>
      </div>
    </div>
  );
};

export default LoadingOverlay;
