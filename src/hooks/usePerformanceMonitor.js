import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '../utils/logger';

/**
 * Enhanced performance monitoring hook with analytics integration
 */
export const usePerformanceMonitor = (operationName, options = {}) => {
  const {
    threshold = 1000, // ms threshold for slow operations warning
    reportToAnalytics = false,
    enableStats = true
  } = options;
  
  const operationStack = useRef([]);
  const [measurements, setMeasurements] = useState([]);
  
  const start = useCallback((label = 'default') => {
    const opId = `${operationName}:${label}:${Date.now()}`;
    const startTime = performance.now();
    
    operationStack.current.push({
      id: opId,
      label,
      startTime,
      operationName
    });
    
    return opId;
  }, [operationName]);

  const end = useCallback((opId) => {
    if (operationStack.current.length === 0) {
      logger.warn(`⚠️ No active ${operationName} operations to end`);
      return null;
    }

    const endTime = performance.now();
    let operation;
    
    if (opId) {
      // Find specific operation
      const index = operationStack.current.findIndex(op => op.id === opId);
      if (index === -1) {
        logger.warn(`⚠️ Operation ${opId} not found in stack`);
        return null;
      }
      operation = operationStack.current[index];
      operationStack.current.splice(index, 1);
    } else {
      // End most recent operation
      operation = operationStack.current.pop();
    }
    
    const duration = endTime - operation.startTime;
    
    // Log performance with appropriate level
    if (duration > threshold) {
      logger.warn(
        `⚠️ Slow ${operationName} operation (${operation.label}): ${duration.toFixed(2)}ms`
      );
    } else {
      logger.debug(
        `⚡ ${operationName} (${operation.label}) completed in ${duration.toFixed(2)}ms`
      );
    }
    
    const newMeasurement = {
      id: operation.id,
      operationName,
      label: operation.label,
      duration,
      timestamp: new Date().toISOString(),
      isSlow: duration > threshold
    };
    
    if (enableStats) {
      setMeasurements(prev => {
        const updated = [...prev, newMeasurement];
        // Keep only last 50 measurements to prevent memory bloat
        return updated.slice(-50);
      });
    }
    
    // Send to analytics if enabled
    if (reportToAnalytics) {
      // Future: Send to analytics service
      logger.debug(`📊 Analytics: ${operationName} ${operation.label} - ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }, [operationName, threshold, reportToAnalytics, enableStats]);

  // Get performance statistics
  const getStats = useCallback(() => {
    if (measurements.length === 0) return null;
    
    const durations = measurements.map(m => m.duration);
    const slowOperations = measurements.filter(m => m.isSlow);
    
    return {
      count: measurements.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      median: durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)],
      slowCount: slowOperations.length,
      slowPercentage: (slowOperations.length / measurements.length) * 100,
      recentMeasurements: measurements.slice(-10), // Last 10 measurements
      measurements
    };
  }, [measurements]);

  // Get current active operations
  const getActiveOperations = useCallback(() => {
    return operationStack.current.map(op => ({
      id: op.id,
      label: op.label,
      operationName: op.operationName,
      duration: performance.now() - op.startTime
    }));
  }, []);

  // Clear all measurements
  const clearStats = useCallback(() => {
    setMeasurements([]);
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      const activeOps = operationStack.current;
      if (activeOps.length > 0) {
        logger.warn(`⚠️ ${operationName} performance monitor cleanup`);
        logger.warn(`Found ${activeOps.length} unclosed operations:`);
        activeOps.forEach((op, index) => {
          const currentDuration = performance.now() - op.startTime;
          logger.warn(`  ${index + 1}. ${op.label} (running for ${currentDuration.toFixed(2)}ms)`);
        });
        
        // Auto-close operations
        activeOps.forEach(op => {
          const duration = performance.now() - op.startTime;
          logger.debug(`🔄 Auto-closing ${op.label}: ${duration.toFixed(2)}ms`);
        });
        operationStack.current = [];
      }
    };
  }, [operationName]);

  return { 
    start, 
    end, 
    getStats, 
    getActiveOperations,
    clearStats,
    measurements,
    hasActiveOperations: operationStack.current.length > 0
  };
};

/**
 * Hook for timing async operations with automatic cleanup
 */
export const useAsyncPerformanceMonitor = (operationName, options = {}) => {
  const monitor = usePerformanceMonitor(operationName, options);
  
  const timeAsync = useCallback(async (asyncFn, label = 'async') => {
    const opId = monitor.start(label);
    
    try {
      const result = await asyncFn();
      monitor.end(opId);
      return result;
    } catch (error) {
      monitor.end(opId);
      throw error;
    }
  }, [monitor]);
  
  return {
    ...monitor,
    timeAsync
  };
};

/**
 * Global performance monitor for app-wide metrics
 */
class GlobalPerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = [];
  }
  
  record(category, operation, duration, metadata = {}) {
    const key = `${category}:${operation}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const metric = {
      duration,
      timestamp: Date.now(),
      ...metadata
    };
    
    this.metrics.get(key).push(metric);
    
    // Keep only last 100 measurements per operation
    const measurements = this.metrics.get(key);
    if (measurements.length > 100) {
      this.metrics.set(key, measurements.slice(-100));
    }
    
    // Notify observers
    this.notifyObservers(category, operation, metric);
  }
  
  getMetrics(category) {
    const categoryMetrics = {};
    
    for (const [key, measurements] of this.metrics.entries()) {
      if (key.startsWith(category + ':')) {
        const operation = key.replace(category + ':', '');
        const durations = measurements.map(m => m.duration);
        
        categoryMetrics[operation] = {
          count: measurements.length,
          average: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          recent: measurements.slice(-5)
        };
      }
    }
    
    return categoryMetrics;
  }
  
  subscribe(observer) {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }
  
  notifyObservers(category, operation, metric) {
    this.observers.forEach(observer => {
      try {
        observer(category, operation, metric);
      } catch (error) {
        logger.error('Error in performance observer:', error);
      }
    });
  }
}

// Global instance
export const globalPerformanceMonitor = new GlobalPerformanceMonitor();

// Hook to use global performance monitor
export const useGlobalPerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({});
  
  useEffect(() => {
    const unsubscribe = globalPerformanceMonitor.subscribe((category, operation, metric) => {
      setMetrics(prev => ({
        ...prev,
        [`${category}:${operation}`]: metric
      }));
    });
    
    return unsubscribe;
  }, []);
  
  return {
    record: globalPerformanceMonitor.record.bind(globalPerformanceMonitor),
    getMetrics: globalPerformanceMonitor.getMetrics.bind(globalPerformanceMonitor),
    metrics
  };
};
