/**
 * Centralized Logger Utility
 * 
 * Provides controlled logging based on environment.
 * Debug logs only appear in development mode.
 * Production logs are limited to info, warn, and error.
 * 
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.debug('Detailed debug info');
 *   logger.info('General information');
 *   logger.warn('Warning message');
 *   logger.error('Error occurred', error);
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

/**
 * Performance-aware logger with automatic grouping
 */
class Logger {
  constructor() {
    this.groups = new Map();
  }

  /**
   * Debug logs - only in development
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    if (isDevelopment) {
      console.log(...args);
    }
  }

  /**
   * Info logs - always shown
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    console.log(...args);
  }

  /**
   * Warning logs - always shown
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    console.warn(...args);
  }

  /**
   * Error logs - always shown
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    console.error(...args);
  }

  /**
   * Time a operation (development only)
   * @param {string} label - Timer label
   */
  time(label) {
    if (isDevelopment) {
      console.time(label);
    }
  }

  /**
   * End timing operation (development only)
   * @param {string} label - Timer label
   */
  timeEnd(label) {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  }

  /**
   * Grouped console logs (development only)
   * @param {string} label - Group label
   * @param {Function} callback - Function containing logs
   */
  group(label, callback) {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  }

  /**
   * Table output (development only)
   * @param {any} data - Data to display in table
   */
  table(data) {
    if (isDevelopment) {
      console.table(data);
    }
  }

  /**
   * Context-specific loggers
   */
  get auth() {
    return {
      debug: (...args) => this.debug('🔐', ...args),
      info: (...args) => this.info('🔐', ...args),
      warn: (...args) => this.warn('🔐', ...args),
      error: (...args) => this.error('🔐', ...args),
    };
  }

  get perf() {
    return {
      debug: (...args) => this.debug('⚡', ...args),
      info: (...args) => this.info('⚡', ...args),
      warn: (...args) => this.warn('⚡', ...args),
      error: (...args) => this.error('⚡', ...args),
    };
  }

  get api() {
    return {
      debug: (...args) => this.debug('🌐', ...args),
      info: (...args) => this.info('🌐', ...args),
      warn: (...args) => this.warn('🌐', ...args),
      error: (...args) => this.error('🌐', ...args),
    };
  }

  get map() {
    return {
      debug: (...args) => this.debug('🗺️', ...args),
      info: (...args) => this.info('🗺️', ...args),
      warn: (...args) => this.warn('🗺️', ...args),
      error: (...args) => this.error('🗺️', ...args),
    };
  }

  get cache() {
    return {
      debug: (...args) => this.debug('💾', ...args),
      info: (...args) => this.info('💾', ...args),
      warn: (...args) => this.warn('💾', ...args),
      error: (...args) => this.error('💾', ...args),
    };
  }

  /**
   * Production-safe assertion
   * @param {boolean} condition - Condition to assert
   * @param {string} message - Error message if assertion fails
   */
  assert(condition, message) {
    if (!condition) {
      this.error('Assertion failed:', message);
      if (isDevelopment) {
        throw new Error(message);
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for backward compatibility
export default logger;

// Environment info (useful for debugging)
if (isDevelopment) {
  console.log('🔧 Logger initialized in DEVELOPMENT mode');
} else {
  console.log('🚀 Logger initialized in PRODUCTION mode');
}
