import React, { useState, useEffect } from 'react';

/**
 * Toast notification component for user feedback
 */
const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
  const [visible, setVisible] = useState(true);
  
  // Reset visible state when message changes (new toast)
  useEffect(() => {
    setVisible(true);
  }, [message]);
  
  useEffect(() => {
    // Reset timer whenever message, duration, or onClose changes
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) {
        setTimeout(onClose, 300); // Allow transition to complete
      }
    }, duration);
    
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);
  
  // Toast styling based on type
  const getToastStyles = () => {
    const baseStyles = "fixed top-20 left-1/2 transform -translate-x-1/2 py-2 px-4 rounded-md shadow-lg z-[99999] transition-opacity duration-300 flex items-center";
    
    const typeStyles = {
      info: "bg-blue-100 text-blue-800 border-l-4 border-blue-500",
      success: "bg-green-100 text-green-800 border-l-4 border-green-500",
      warning: "bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500",
      error: "bg-red-100 text-red-800 border-l-4 border-red-500",
      offline: "bg-gray-100 text-gray-800 border-l-4 border-gray-500",
    };
    
    return `${baseStyles} ${typeStyles[type] || typeStyles.info} ${visible ? 'opacity-100' : 'opacity-0'}`;
  };
  
  // Icons for different toast types
  const getToastIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        );
      case 'offline':
        return (
          <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a5 5 0 010-7.072m-3.183 1.757a3 3 0 010 3.558"></path>
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
    }
  };

  return (
    <div className={getToastStyles()} style={{position: 'fixed', zIndex: 99999}}>
      {getToastIcon()}
      <span>{message}</span>
      <button 
        onClick={() => {
          setVisible(false);
          if (onClose) {
            setTimeout(onClose, 300);
          }
        }}
        className="ml-3 text-gray-500 hover:text-gray-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  );
};

export default Toast;
