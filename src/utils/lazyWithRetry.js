import React from 'react';
import { logger } from './logger';

/**
 * Wraps React.lazy() imports with retry logic and offline resilience.
 * If the initial dynamic import fails, it retries once (after a short delay)
 * and reuses the last successfully loaded module while offline so the UI stays visible.
 */
export const lazyWithRetry = (loader) => {
  let cachedModule = null;

  return React.lazy(async () => {
    try {
      if (cachedModule) {
        return cachedModule;
      }

      const module = await loader();
      cachedModule = module;
      return module;
    } catch (error) {
      logger.warn('⚠️ Lazy loader failed, attempting retry...', error);

      // If we already loaded this module before, keep showing it (especially offline)
      if (cachedModule && !navigator.onLine) {
        logger.info('📴 Offline – reusing cached module for lazy import');
        return cachedModule;
      }

      // Wait briefly to give the dev server/network time to recover
      await new Promise((resolve) => setTimeout(resolve, 500));

      const module = await loader();
      cachedModule = module;
      return module;
    }
  });
};

/**
 * Prefetches a list of lazy loader functions when the browser is idle and online.
 */
export const prefetchLazyRoutes = (loaders = []) => {
  if (!Array.isArray(loaders) || loaders.length === 0) return;
  if (!navigator.onLine) {
    logger.debug('📴 Skipping route prefetch – offline');
    return;
  }

  const runPrefetch = () => {
    loaders.forEach((loader) => {
      loader()
        .then(() => logger.debug('🚀 Prefetched lazy route'))
        .catch((error) => logger.warn('⚠️ Failed to prefetch lazy route', error));
    });
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(runPrefetch, { timeout: 2000 });
  } else {
    setTimeout(runPrefetch, 1000);
  }
};
