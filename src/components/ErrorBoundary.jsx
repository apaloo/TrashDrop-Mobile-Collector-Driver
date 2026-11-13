import React, { Component } from 'react';
import Toast from './Toast';
import { logger } from '../utils/logger';
import { captureError } from '../utils/monitoring';

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

    this.lastGoodChildren = null;
  }

  static getDerivedStateFromError() {
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
    // Error monitoring (Sentry); does nothing until VITE_SENTRY_DSN is set
    captureError(error, { componentStack: errorInfo?.componentStack, tags: { boundary: 'app' } });

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

    // Keep a snapshot of the last successfully rendered tree so we can fall back to it
    if (!hasError) {
      this.lastGoodChildren = children;
    }

    const isChunkLoadFailure = error?.message?.includes('Failed to fetch dynamically imported module');
    
    if (hasError) {
      // If we previously rendered a good tree, keep showing it (useful when a lazy chunk can’t load)
      if (this.lastGoodChildren && isChunkLoadFailure) {
        logger.warn('⚠️ Keeping previous UI while lazy chunk reloads');
        return this.lastGoodChildren;
      }
      
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
                <p className="mb-6 text-td-ink">
                  We encountered an error while processing your request. Please try again.
                </p>
                
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    aria-label="Reload page"
                  >
                    Reload Page
                  </button>
                  
                  <button
                    onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                    className="px-6 py-3 text-td-forest border border-td-forest rounded-lg hover:bg-green-100 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
                
                {error && import.meta.env.DEV && (
                  <details className="mt-6 p-4 border border-td-border-strong rounded-lg text-left">
                    <summary className="text-sm text-td-sage cursor-pointer hover:text-td-ink">
                      Technical Details (Development)
                    </summary>
                    <div className="mt-3 space-y-2">
                      <div>
                        <strong className="text-xs text-td-sage">Error Message:</strong>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                          {error.message}
                        </pre>
                      </div>
                      <div>
                        <strong className="text-xs text-td-sage">Stack Trace:</strong>
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

export default ErrorBoundary;
