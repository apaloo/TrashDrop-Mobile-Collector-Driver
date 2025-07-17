import React, { useState, useEffect, useRef } from 'react';

/**
 * Pull-to-refresh component for mobile interfaces
 * @param {Object} props - Component props
 * @param {Function} props.onRefresh - Function to call when refresh is triggered
 * @param {React.ReactNode} props.children - Child components
 * @param {number} props.pullThreshold - Distance in pixels required to trigger refresh (default: 80)
 * @param {string} props.loadingText - Text to display while refreshing (default: 'Refreshing...')
 */
const PullToRefresh = ({ 
  onRefresh, 
  children, 
  pullThreshold = 80,
  loadingText = 'Refreshing...'
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  
  // Handle touch events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleTouchStart = (e) => {
      // Only enable pull-to-refresh when scrolled to top
      if (container.scrollTop === 0) {
        startYRef.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };
    
    const handleTouchMove = (e) => {
      if (!isPulling) return;
      
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startYRef.current);
      
      // Apply resistance to make pull feel natural
      const pullWithResistance = Math.min(distance * 0.5, pullThreshold * 1.5);
      
      setPullDistance(pullWithResistance);
      
      // Prevent default scrolling when pulling
      if (distance > 0) {
        e.preventDefault();
      }
    };
    
    const handleTouchEnd = () => {
      if (!isPulling) return;
      
      if (pullDistance >= pullThreshold) {
        // Trigger refresh
        setIsRefreshing(true);
        setPullDistance(0);
        
        // Call onRefresh and reset when done
        Promise.resolve(onRefresh())
          .finally(() => {
            setIsRefreshing(false);
            setIsPulling(false);
          });
      } else {
        // Reset without refreshing
        setPullDistance(0);
        setIsPulling(false);
      }
    };
    
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, pullThreshold, onRefresh]);
  
  // Calculate progress percentage for indicator
  const progress = Math.min(100, (pullDistance / pullThreshold) * 100);
  
  return (
    <div 
      ref={containerRef} 
      className="h-full overflow-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Pull indicator */}
      <div 
        className="flex items-center justify-center transition-transform duration-200"
        style={{ 
          height: `${pullDistance}px`,
          transform: isPulling ? 'none' : 'translateY(-100%)',
          opacity: isPulling ? 1 : 0
        }}
      >
        {isRefreshing ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500 mr-2"></div>
            <span className="text-sm text-gray-600">{loadingText}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg 
              className="w-6 h-6 text-green-500 transition-transform duration-200"
              style={{ transform: `rotate(${Math.min(180, progress * 1.8)}deg)` }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
            </svg>
            <span className="text-xs text-gray-500 mt-1">
              {progress >= 100 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        )}
      </div>
      
      {/* Main content */}
      <div>
        {children}
      </div>
      
      {/* Loading overlay when refreshing */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 flex items-center justify-center bg-white bg-opacity-80 py-2 z-10">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500 mr-2"></div>
          <span className="text-sm text-gray-600">{loadingText}</span>
        </div>
      )}
    </div>
  );
};

export default PullToRefresh;
