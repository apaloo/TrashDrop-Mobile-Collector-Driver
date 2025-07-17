import React from 'react';

/**
 * Reusable loading indicator component with different sizes and styles
 */
const LoadingIndicator = ({ size = 'md', color = 'primary', fullScreen = false, text = null }) => {
  // Size classes
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };
  
  // Color classes
  const colorClasses = {
    primary: 'border-green-500',
    secondary: 'border-blue-500',
    white: 'border-white',
    gray: 'border-gray-300'
  };
  
  // Container classes
  const containerClasses = fullScreen 
    ? 'fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50' 
    : 'flex items-center justify-center';
  
  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center">
        <div className={`animate-spin rounded-full ${sizeClasses[size]} border-b-2 ${colorClasses[color]}`}></div>
        {text && <p className="mt-3 text-gray-600">{text}</p>}
      </div>
    </div>
  );
};

/**
 * Full-screen loading overlay
 */
export const FullScreenLoading = ({ text = 'Loading...' }) => (
  <LoadingIndicator size="lg" fullScreen={true} text={text} />
);

/**
 * Inline loading indicator for buttons or small containers
 */
export const InlineLoading = ({ color = 'primary' }) => (
  <LoadingIndicator size="sm" color={color} />
);

/**
 * Loading indicator for sections or cards
 */
export const SectionLoading = ({ text = 'Loading...' }) => (
  <div className="py-8">
    <LoadingIndicator size="md" text={text} />
  </div>
);

export default LoadingIndicator;
