import React, { lazy, Suspense } from 'react';

/**
 * Loading fallback component shown while lazy-loaded components are loading
 */
export const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
  </div>
);

/**
 * Creates a lazy-loaded component with a loading fallback
 * @param {Function} importFunc - Import function that returns a promise (e.g., () => import('./Component'))
 * @param {React.Component} [customFallback] - Optional custom fallback component
 * @returns {React.Component} - Lazy-loaded component with suspense
 */
export const lazyLoad = (importFunc, customFallback = null) => {
  const LazyComponent = lazy(importFunc);
  
  return (props) => (
    <Suspense fallback={customFallback || <LoadingFallback />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

/**
 * Creates a lazy-loaded route component with a loading fallback
 * @param {Function} importFunc - Import function that returns a promise (e.g., () => import('./Page'))
 * @returns {React.Component} - Lazy-loaded route component with suspense
 */
export const lazyLoadRoute = (importFunc) => {
  return lazyLoad(importFunc);
};

/**
 * Creates a lazy-loaded modal component with a loading fallback
 * @param {Function} importFunc - Import function that returns a promise (e.g., () => import('./Modal'))
 * @returns {React.Component} - Lazy-loaded modal component with suspense
 */
export const lazyLoadModal = (importFunc) => {
  const ModalFallback = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto"></div>
        <p className="text-center mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
  
  return lazyLoad(importFunc, <ModalFallback />);
};
