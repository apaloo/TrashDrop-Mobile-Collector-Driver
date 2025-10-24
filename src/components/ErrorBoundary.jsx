import React, { Component } from 'react';
import Toast from './Toast';
import { logger } from '../utils/logger';

/**
 * Enhanced error boundary component with analytics and detailed error reporting
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Enhanced error logging with more details
    logger.error('Component Error:', error.message);
    logger.error('Component Stack:', errorInfo.componentStack);
    logger.error('Error Stack:', error.stack);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Send to analytics/error reporting service (future implementation)
    this.reportError(error, errorInfo);
  }
  
  reportError = (error, errorInfo) => {
    // Future: Send to error monitoring service like Sentry
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // For now, just log to console with structured data
    console.groupCollapsed('🚨 Error Report');
    console.table(errorReport);
    console.groupEnd();
  };

  render() {
    const { hasError, error } = this.state;
    const { fallback, children } = this.props;
    
    if (hasError) {
      // You can render any custom fallback UI
      if (fallback) {
        return fallback(error);
      }
      
      return (
        <div className="p-4 flex flex-col items-center justify-center min-h-[400px]" role="alert" aria-live="assertive">
          <div className="text-center max-w-md">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <svg className="h-8 w-8 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-semibold text-red-600 mb-4">
              Something went wrong
            </h2>
            
            {this.props.fallbackUI || (
              <>
                <p className="mb-6 text-gray-700">
                  We encountered an error while processing your request. Please try again.
                </p>
                
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    aria-label="Reload page"
                  >
                    Reload Page
                  </button>
                  
                  <button
                    onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                    className="px-6 py-3 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
                
                {error && process.env.NODE_ENV === 'development' && (
                  <details className="mt-6 p-4 border border-gray-300 rounded-lg text-left">
                    <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                      Technical Details (Development)
                    </summary>
                    <div className="mt-3 space-y-2">
                      <div>
                        <strong className="text-xs text-gray-500">Error Message:</strong>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                          {error.message}
                        </pre>
                      </div>
                      <div>
                        <strong className="text-xs text-gray-500">Stack Trace:</strong>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                          {error.stack}
                        </pre>
                      </div>
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
          
          <Toast
            message="An error occurred. Please try again."
            type="error"
            onClose={() => this.setState({ hasError: false })}
          />
        </div>
      );
    }

    return children;
  }
}

/**
 * Error fallback component for use with React Error Boundary
 */
export const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return (
    <div className="p-4 bg-red-50 rounded-md">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Error</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error?.message || 'An unexpected error occurred'}</p>
          </div>
          {resetErrorBoundary && (
            <div className="mt-4">
              <button
                onClick={resetErrorBoundary}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;
