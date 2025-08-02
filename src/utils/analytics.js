import { globalPerformanceMonitor } from '../hooks/usePerformanceMonitor';

/**
 * Analytics utility for tracking user events and performance
 */
class Analytics {
  constructor() {
    this.isEnabled = true;
    this.queue = [];
    this.flushInterval = null;
    this.userId = null;
    this.sessionId = this.generateSessionId();
    
    // Start auto-flush
    this.startAutoFlush();
  }
  
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  setUserId(userId) {
    this.userId = userId;
  }
  
  enable() {
    this.isEnabled = true;
  }
  
  disable() {
    this.isEnabled = false;
  }
  
  // Track user events
  trackEvent(eventName, properties = {}, options = {}) {
    if (!this.isEnabled) return;
    
    const event = {
      type: 'event',
      name: eventName,
      properties: {
        ...properties,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        url: window.location.href,
        userAgent: navigator.userAgent,
        offline: !navigator.onLine,
        ...this.getDeviceInfo()
      },
      options
    };
    
    this.queue.push(event);
    console.log(`📊 Event tracked: ${eventName}`, event.properties);
    
    // Flush immediately for high priority events
    if (options.immediate) {
      this.flush();
    }
  }
  
  // Track performance metrics
  trackPerformance(category, operation, duration, metadata = {}) {
    if (!this.isEnabled) return;
    
    const performanceEvent = {
      type: 'performance',
      category,
      operation,
      duration,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        offline: !navigator.onLine
      }
    };
    
    this.queue.push(performanceEvent);
    
    // Also record in global performance monitor
    globalPerformanceMonitor.record(category, operation, duration, metadata);
    
    console.log(`⚡ Performance tracked: ${category}.${operation} - ${duration.toFixed(2)}ms`);
  }
  
  // Track navigation events
  trackNavigation(from, to, method = 'unknown') {
    this.trackEvent('navigation', {
      from,
      to,
      method,
      timestamp: Date.now()
    });
  }
  
  // Track errors
  trackError(error, context = {}) {
    const errorEvent = {
      type: 'error',
      message: error.message,
      stack: error.stack,
      name: error.name,
      context: {
        ...context,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        url: window.location.href,
        userAgent: navigator.userAgent
      }
    };
    
    this.queue.push(errorEvent);
    console.error('🚨 Error tracked:', errorEvent);
    
    // Errors should be sent immediately
    this.flush();
  }
  
  // Get device information
  getDeviceInfo() {
    return {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      connectionType: navigator.connection?.effectiveType || 'unknown',
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }
  
  // Start auto-flush timer
  startAutoFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush every 30 seconds
    this.flushInterval = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, 30000);
  }
  
  // Flush events to server
  async flush() {
    if (this.queue.length === 0) return;
    
    const events = [...this.queue];
    this.queue = [];
    
    try {
      // In a real implementation, send to analytics service
      console.groupCollapsed(`📊 Analytics flush: ${events.length} events`);
      events.forEach(event => {
        console.log(event);
      });
      console.groupEnd();
      
      // Mock API call - replace with actual analytics service
      // await fetch('/api/analytics', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ events })
      // });
      
    } catch (error) {
      console.error('Failed to send analytics:', error);
      // Re-queue events for retry
      this.queue.unshift(...events);
    }
  }
  
  // Cleanup
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    this.flush();
  }
}

// Global analytics instance
const analytics = new Analytics();

// Export convenience functions
export const trackEvent = (eventName, properties, options) => 
  analytics.trackEvent(eventName, properties, options);

export const trackPerformance = (category, operation, duration, metadata) =>
  analytics.trackPerformance(category, operation, duration, metadata);

export const trackNavigation = (from, to, method) =>
  analytics.trackNavigation(from, to, method);

export const trackError = (error, context) =>
  analytics.trackError(error, context);

export const setUserId = (userId) =>
  analytics.setUserId(userId);

export const enableAnalytics = () =>
  analytics.enable();

export const disableAnalytics = () =>
  analytics.disable();

// Navigation tracking helper for React Router
export const withNavigationTracking = (WrappedComponent) => {
  return function NavigationTrackedComponent(props) {
    const location = props.location;
    const prevLocation = React.useRef(location);
    
    React.useEffect(() => {
      if (prevLocation.current && prevLocation.current.pathname !== location.pathname) {
        trackNavigation(prevLocation.current.pathname, location.pathname, 'route');
      }
      prevLocation.current = location;
    }, [location]);
    
    return React.createElement(WrappedComponent, props);
  };
};

// Performance tracking decorators
export const withPerformanceTracking = (category, operation) => {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const startTime = performance.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - startTime;
        trackPerformance(category, operation, duration, { success: true });
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        trackPerformance(category, operation, duration, { success: false, error: error.message });
        throw error;
      }
    };
    
    return descriptor;
  };
};

// Hook for component-level analytics
export const useAnalytics = () => {
  return {
    trackEvent,
    trackPerformance,
    trackNavigation,
    trackError,
    track: trackEvent // Alias for convenience
  };
};

// Auto-track page views
if (typeof window !== 'undefined') {
  // Track initial page load
  analytics.trackEvent('page_view', {
    page: window.location.pathname,
    title: document.title,
    referrer: document.referrer
  });
  
  // Track page unload
  window.addEventListener('beforeunload', () => {
    analytics.flush();
  });
  
  // Track visibility changes
  document.addEventListener('visibilitychange', () => {
    analytics.trackEvent('visibility_change', {
      visible: !document.hidden
    });
  });
}

export default analytics;
