import { supabase } from './supabase';
import { logger } from '../utils/logger';
import * as TrendiPayService from './trendiPayService';
import { getDeadheadShare } from '../utils/paymentCalculations';

// Feature flag for TrendiPay integration
const ENABLE_TRENDIPAY = import.meta.env.VITE_ENABLE_TRENDIPAY === 'true';

// ========================================
// OFFLINE CACHING CONFIGURATION
// ========================================
const CACHE_CONFIG = {
  EARNINGS_CACHE_KEY: 'trashdrop_earnings_cache',
  ANALYTICS_CACHE_KEY: 'trashdrop_earnings_analytics',
  CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes for fresh data
  OFFLINE_CACHE_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours for offline use
  MAX_CACHED_TRANSACTIONS: 100
};

// ========================================
// EARNINGS ANALYTICS TRACKER
// ========================================
class EarningsAnalytics {
  constructor(collectorId) {
    this.collectorId = collectorId;
    this.sessionStart = Date.now();
    this.events = [];
  }

  track(eventName, data = {}) {
    const event = {
      event: eventName,
      timestamp: new Date().toISOString(),
      sessionDuration: Date.now() - this.sessionStart,
      collectorId: this.collectorId,
      ...data
    };
    
    this.events.push(event);
    logger.debug(`📊 [Analytics] ${eventName}`, data);
    
    // Persist to localStorage for offline analysis
    this._persistEvent(event);
    
    return event;
  }

  trackEarningsFetch(source, duration, success, dataSize = 0) {
    return this.track('earnings_fetch', {
      source, // 'rpc', 'legacy', 'cache'
      durationMs: duration,
      success,
      dataSize,
      isOffline: !navigator.onLine
    });
  }

  trackCashout(amount, method, success, error = null) {
    return this.track('cashout_attempt', {
      amount,
      paymentMethod: method,
      success,
      error: error?.message || null
    });
  }

  trackDisbursement(amount, success, retryCount = 0, error = null) {
    return this.track('disbursement', {
      amount,
      success,
      retryCount,
      error: error?.message || null
    });
  }

  trackPageView(page, earningsData = null) {
    return this.track('page_view', {
      page,
      totalEarnings: earningsData?.totalEarnings || 0,
      pendingEarnings: earningsData?.pendingDisposalEarnings || 0,
      disposedEarnings: earningsData?.disposedEarnings || 0
    });
  }

  trackCacheHit(cacheAge, dataFreshness) {
    return this.track('cache_hit', {
      cacheAgeMs: cacheAge,
      dataFreshness // 'fresh', 'stale', 'offline'
    });
  }

  trackCacheMiss(reason) {
    return this.track('cache_miss', { reason });
  }

  trackError(errorType, errorMessage, context = {}) {
    logger.error(`❌ [Analytics Error] ${errorType}: ${errorMessage}`, context);
    return this.track('error', {
      errorType,
      errorMessage,
      ...context
    });
  }

  _persistEvent(event) {
    try {
      const key = `${CACHE_CONFIG.ANALYTICS_CACHE_KEY}_${this.collectorId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(event);
      
      // Keep only last 100 events
      const trimmed = existing.slice(-100);
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch (err) {
      // Silent fail - analytics shouldn't break the app
    }
  }

  getSessionEvents() {
    return this.events;
  }

  getPersistedEvents() {
    try {
      const key = `${CACHE_CONFIG.ANALYTICS_CACHE_KEY}_${this.collectorId}`;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  }

  generateSummary() {
    const events = this.getPersistedEvents();
    const fetchEvents = events.filter(e => e.event === 'earnings_fetch');
    const cashoutEvents = events.filter(e => e.event === 'cashout_attempt');
    const errorEvents = events.filter(e => e.event === 'error');
    
    return {
      totalFetches: fetchEvents.length,
      avgFetchDuration: fetchEvents.length > 0 
        ? Math.round(fetchEvents.reduce((sum, e) => sum + (e.durationMs || 0), 0) / fetchEvents.length)
        : 0,
      cacheHitRate: fetchEvents.length > 0
        ? Math.round((fetchEvents.filter(e => e.source === 'cache').length / fetchEvents.length) * 100)
        : 0,
      totalCashouts: cashoutEvents.length,
      successfulCashouts: cashoutEvents.filter(e => e.success).length,
      totalErrors: errorEvents.length,
      lastError: errorEvents[errorEvents.length - 1] || null
    };
  }
}

// ========================================
// OFFLINE CACHE MANAGER
// ========================================
class EarningsCacheManager {
  constructor(collectorId) {
    this.collectorId = collectorId;
    this.cacheKey = `${CACHE_CONFIG.EARNINGS_CACHE_KEY}_${collectorId}`;
  }

  async get() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return null;
      
      const { data, timestamp, version } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      const isOnline = navigator.onLine;
      
      // Determine cache validity based on online status
      const maxAge = isOnline 
        ? CACHE_CONFIG.CACHE_DURATION_MS 
        : CACHE_CONFIG.OFFLINE_CACHE_DURATION_MS;
      
      if (age > maxAge) {
        logger.debug(`📦 Cache expired (age: ${Math.round(age / 1000)}s, max: ${Math.round(maxAge / 1000)}s)`);
        return null;
      }
      
      logger.info(`📦 Cache hit (age: ${Math.round(age / 1000)}s, online: ${isOnline})`);
      return {
        data,
        timestamp,
        age,
        fromCache: true,
        freshness: age < CACHE_CONFIG.CACHE_DURATION_MS ? 'fresh' : 'stale'
      };
      
    } catch (error) {
      logger.warn('Cache read error:', error);
      this.clear();
      return null;
    }
  }

  set(data) {
    try {
      // Trim transactions to prevent storage overflow
      const trimmedData = {
        ...data,
        transactions: (data.transactions || []).slice(0, CACHE_CONFIG.MAX_CACHED_TRANSACTIONS)
      };
      
      const cacheEntry = {
        data: trimmedData,
        timestamp: Date.now(),
        version: '1.0',
        collectorId: this.collectorId
      };
      
      localStorage.setItem(this.cacheKey, JSON.stringify(cacheEntry));
      logger.debug(`📦 Earnings cached (${JSON.stringify(cacheEntry).length} bytes)`);
      return true;
      
    } catch (error) {
      logger.warn('Cache write error:', error);
      // Try to clear old data and retry
      this._clearOldCaches();
      return false;
    }
  }

  clear() {
    try {
      localStorage.removeItem(this.cacheKey);
      logger.debug('📦 Earnings cache cleared');
    } catch (error) {
      logger.warn('Cache clear error:', error);
    }
  }

  _clearOldCaches() {
    try {
      // Clear all earnings caches older than 24 hours
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_CONFIG.EARNINGS_CACHE_KEY)) {
          try {
            const { timestamp } = JSON.parse(localStorage.getItem(key) || '{}');
            if (Date.now() - timestamp > CACHE_CONFIG.OFFLINE_CACHE_DURATION_MS) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      logger.debug(`📦 Cleared ${keysToRemove.length} old cache entries`);
    } catch (error) {
      logger.warn('Error clearing old caches:', error);
    }
  }

  getStats() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return { exists: false };
      
      const { timestamp } = JSON.parse(cached);
      return {
        exists: true,
        age: Date.now() - timestamp,
        size: cached.length
      };
    } catch {
      return { exists: false };
    }
  }
}

// SOP v4.5.6 Payment Model Constants
const PAYMENT_SPLITS = {
  // Collector shares
  URGENT_COLLECTOR_SHARE: 0.75,      // 75% of urgent surcharge to collector
  SURGE_COLLECTOR_SHARE: 0.75,       // 75% of surge uplift to collector
  TIPS_COLLECTOR_SHARE: 1.0,         // 100% of tips to collector
  RECYCLABLES_COLLECTOR_SHARE: 0.60, // 60% of recyclables to collector
  RECYCLABLES_USER_SHARE: 0.25,      // 25% of recyclables to user
  DISTANCE_COLLECTOR_SHARE: 1.0,     // 100% of distance bonus to collector
  DEFAULT_DEADHEAD_SHARE: 0.87,      // Average of 85-92% for legacy data without deadhead info
  
  // Platform shares (App Bucket)
  URGENT_PLATFORM_SHARE: 0.25,       // 25% of urgent surcharge to platform
  SURGE_PLATFORM_SHARE: 0.25,        // 25% of surge uplift to platform
  RECYCLABLES_PLATFORM_SHARE: 0.15,  // 15% of recyclables to platform
  REQUEST_FEE_PLATFORM_SHARE: 1.0    // 100% of request fee to platform
};

/**
 * Calculate collector's earnings from a pickup request applying SOP v4.5.6 percentage shares
 * NOTE: Request fee (GHC 1.00) is EXCLUDED from bucket sharing - it's 100% platform revenue
 * @param {Object} pickup - Pickup request object
 * @returns {number} Collector's total earnings
 */
function calculateCollectorEarnings(pickup) {
  // If new payment model fields exist, use them directly (already calculated)
  if (pickup.collector_total_payout !== null && pickup.collector_total_payout !== undefined) {
    return pickup.collector_total_payout;
  }
  
  // Legacy data: Apply percentage sharing algorithm
  // IMPORTANT: Subtract request fee from base - it's 100% platform revenue, not shared
  const rawFee = pickup.fee || pickup.base_amount || 0;
  const requestFee = pickup.request_fee || 1.0; // Default GHC 1.00 request fee
  const baseFee = Math.max(0, rawFee - requestFee); // Exclude request fee from sharing
  if (baseFee === 0) return 0;
  
  // Get deadhead share based on distance (85-92%), or use default average
  const deadheadKm = pickup.deadhead_km || pickup.distance_km || 0;
  const deadheadShare = deadheadKm > 0 ? getDeadheadShare(deadheadKm) : PAYMENT_SPLITS.DEFAULT_DEADHEAD_SHARE;
  
  // Calculate core payout (base * deadhead share)
  let collectorTotal = baseFee * deadheadShare;
  
  // Add urgent bonus (75% of urgent surcharge)
  if (pickup.urgent_enabled && pickup.urgent_amount) {
    collectorTotal += pickup.urgent_amount * PAYMENT_SPLITS.URGENT_COLLECTOR_SHARE;
  }
  
  // Add surge bonus (75% of surge uplift)
  if (pickup.surge_multiplier && pickup.surge_multiplier > 1) {
    const surgeUplift = baseFee * (pickup.surge_multiplier - 1);
    collectorTotal += surgeUplift * PAYMENT_SPLITS.SURGE_COLLECTOR_SHARE;
  }
  
  // Add distance bonus (100% when urgent and >5km)
  if (pickup.distance_billed_km && pickup.distance_billed_km > 0) {
    const perKm = 0.06 * baseFee; // 6% per km
    collectorTotal += pickup.distance_billed_km * perKm * PAYMENT_SPLITS.DISTANCE_COLLECTOR_SHARE;
  }
  
  // Add tips (100%)
  if (pickup.tips) {
    collectorTotal += pickup.tips * PAYMENT_SPLITS.TIPS_COLLECTOR_SHARE;
  }
  
  // Add recyclables (60%)
  if (pickup.recycler_gross_payout) {
    collectorTotal += pickup.recycler_gross_payout * PAYMENT_SPLITS.RECYCLABLES_COLLECTOR_SHARE;
  }
  
  // Add loyalty cashback
  if (pickup.collector_loyalty_cashback) {
    collectorTotal += pickup.collector_loyalty_cashback;
  }
  
  return collectorTotal;
}

/**
 * Calculate collector's earnings from a digital bin applying SOP v4.5.6 percentage shares
 * @param {Object} bin - Digital bin object
 * @returns {number} Collector's total earnings
 */
function calculateBinCollectorEarnings(bin) {
  // If new payment model fields exist, use them directly
  if (bin.collector_total_payout !== null && bin.collector_total_payout !== undefined) {
    return bin.collector_total_payout;
  }
  
  // Legacy data: Apply default share
  const basePayout = bin.payout || bin.fee || 0;
  return basePayout * PAYMENT_SPLITS.DEFAULT_DEADHEAD_SHARE;
}

/**
 * Calculate platform earnings (App Bucket) from a pickup request applying SOP v4.5.6 percentage shares
 * @param {Object} pickup - Pickup request object
 * @returns {Object} Platform earnings breakdown
 */
function calculatePlatformEarnings(pickup) {
  // Request fee is ALWAYS 100% platform revenue (GHC 1.00 default)
  const requestFee = pickup.request_fee || 1.0;
  
  // If new payment model fields exist, calculate from stored values
  if (pickup.collector_total_payout !== null && pickup.collector_total_payout !== undefined) {
    const rawFee = pickup.base_amount || pickup.fee || 0;
    // Exclude request fee from base for core calculation (it's already accounted for separately)
    const baseFeeForSharing = Math.max(0, rawFee - requestFee);
    const collectorCore = pickup.collector_core_payout || 0;
    const collectorUrg = pickup.collector_urgent_payout || 0;
    const collectorSurge = pickup.collector_surge_payout || 0;
    const collectorRecyclables = pickup.collector_recyclables_payout || 0;
    
    // Platform gets the remainder of shared amounts
    const platformCore = baseFeeForSharing - collectorCore;
    const platformUrg = pickup.urgent_amount ? pickup.urgent_amount - collectorUrg : 0;
    const platformSurge = pickup.surge_amount ? pickup.surge_amount - collectorSurge : 0;
    const platformRecyclables = pickup.recycler_gross_payout ? 
      pickup.recycler_gross_payout * PAYMENT_SPLITS.RECYCLABLES_PLATFORM_SHARE : 0;
    
    return {
      platformCore,
      platformUrg,
      platformSurge,
      platformRecyclables,
      requestFee, // 100% to platform, not shared
      total: platformCore + platformUrg + platformSurge + platformRecyclables + requestFee
    };
  }
  
  // Legacy data: Apply percentage sharing algorithm
  // IMPORTANT: Exclude request fee from base - it's 100% platform revenue
  const rawFee = pickup.fee || pickup.base_amount || 0;
  const baseFee = Math.max(0, rawFee - requestFee); // Exclude request fee from sharing
  if (baseFee === 0) return { platformCore: 0, platformUrg: 0, platformSurge: 0, platformRecyclables: 0, requestFee, total: requestFee };
  
  const deadheadKm = pickup.deadhead_km || pickup.distance_km || 0;
  const deadheadShare = deadheadKm > 0 ? getDeadheadShare(deadheadKm) : PAYMENT_SPLITS.DEFAULT_DEADHEAD_SHARE;
  
  // Platform core = base * (1 - deadhead share) = 8-15%
  const platformCore = baseFee * (1 - deadheadShare);
  
  // Platform urgent = 25% of urgent surcharge
  let platformUrg = 0;
  if (pickup.urgent_enabled && pickup.urgent_amount) {
    platformUrg = pickup.urgent_amount * PAYMENT_SPLITS.URGENT_PLATFORM_SHARE;
  }
  
  // Platform surge = 25% of surge uplift
  let platformSurge = 0;
  if (pickup.surge_multiplier && pickup.surge_multiplier > 1) {
    const surgeUplift = baseFee * (pickup.surge_multiplier - 1);
    platformSurge = surgeUplift * PAYMENT_SPLITS.SURGE_PLATFORM_SHARE;
  }
  
  // Platform recyclables = 15%
  let platformRecyclables = 0;
  if (pickup.recycler_gross_payout) {
    platformRecyclables = pickup.recycler_gross_payout * PAYMENT_SPLITS.RECYCLABLES_PLATFORM_SHARE;
  }
  
  // Request fee already extracted at line 111 (100% to platform, not shared)
  return {
    platformCore,
    platformUrg,
    platformSurge,
    platformRecyclables,
    requestFee,
    total: platformCore + platformUrg + platformSurge + platformRecyclables + requestFee
  };
}

/**
 * Calculate platform earnings from a digital bin
 * @param {Object} bin - Digital bin object
 * @returns {Object} Platform earnings breakdown
 */
function calculateBinPlatformEarnings(bin) {
  const basePayout = bin.payout || bin.fee || 0;
  const platformShare = 1 - PAYMENT_SPLITS.DEFAULT_DEADHEAD_SHARE; // ~13%
  const platformCore = basePayout * platformShare;
  
  return {
    platformCore,
    platformUrg: 0,
    platformSurge: 0,
    platformRecyclables: 0,
    requestFee: 0,
    total: platformCore
  };
}

class EarningsService {
  constructor(collectorId) {
    this.collectorId = collectorId;
    this.cache = new EarningsCacheManager(collectorId);
    this.analytics = new EarningsAnalytics(collectorId);
    
    // Log service initialization
    logger.info(`💰 EarningsService initialized for collector: ${collectorId}`);
  }

  /**
   * Get earnings with offline caching support
   * Returns cached data when offline or for quick loads
   * @param {Object} options - Fetch options
   * @param {boolean} options.forceRefresh - Skip cache and fetch fresh data
   * @returns {Promise<Object>} Earnings data
   */
  async getEarningsWithCache(options = {}) {
    const { forceRefresh = false } = options;
    const startTime = Date.now();
    
    // Track page view
    this.analytics.trackPageView('earnings');
    
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = await this.cache.get();
      if (cached) {
        this.analytics.trackCacheHit(cached.age, cached.freshness);
        this.analytics.trackEarningsFetch('cache', Date.now() - startTime, true, 0);
        
        // If cache is stale but we're online, fetch in background
        if (cached.freshness === 'stale' && navigator.onLine) {
          this._refreshCacheInBackground();
        }
        
        return {
          success: true,
          data: cached.data,
          fromCache: true,
          cacheAge: cached.age
        };
      }
      
      this.analytics.trackCacheMiss(navigator.onLine ? 'expired_or_missing' : 'offline_no_cache');
    }
    
    // If offline and no cache, return error
    if (!navigator.onLine) {
      this.analytics.trackError('offline', 'No cached data available while offline');
      return {
        success: false,
        error: 'You are offline and no cached earnings data is available.',
        fromCache: false,
        isOffline: true
      };
    }
    
    // Fetch fresh data
    try {
      const result = await this.getEarningsDataOptimized(options);
      const duration = Date.now() - startTime;
      
      if (result.success !== false) {
        // Normalize data structure - legacy method returns { success, data: { stats, ... } }
        // RPC method returns flat data directly
        let normalizedData;
        if (result.success === true && result.data) {
          // Legacy format: { success: true, data: { stats: {...}, transactions: [...] } }
          // Flatten the stats into the top level for consistent access
          normalizedData = {
            ...result.data.stats,
            transactions: result.data.transactions || [],
            chartData: result.data.chartData || {},
            _source: 'legacy'
          };
        } else {
          // RPC format: flat data structure
          normalizedData = result;
        }
        
        // Cache the normalized data
        this.cache.set(normalizedData);
        this.analytics.trackEarningsFetch(
          normalizedData._source || 'legacy', 
          duration, 
          true, 
          JSON.stringify(normalizedData).length
        );
        
        return {
          success: true,
          data: normalizedData,
          fromCache: false
        };
      } else {
        throw new Error(result.error || 'Failed to fetch earnings');
      }
      
    } catch (error) {
      this.analytics.trackError('fetch_error', error.message);
      this.analytics.trackEarningsFetch('error', Date.now() - startTime, false, 0);
      
      // Try to return stale cache as fallback
      const staleCache = await this.cache.get();
      if (staleCache) {
        logger.warn('Using stale cache due to fetch error');
        return {
          success: true,
          data: staleCache.data,
          fromCache: true,
          cacheAge: staleCache.age,
          hadError: true
        };
      }
      
      return {
        success: false,
        error: error.message,
        fromCache: false
      };
    }
  }

  /**
   * Refresh cache in background without blocking UI
   * @private
   */
  async _refreshCacheInBackground() {
    logger.debug('🔄 Refreshing earnings cache in background...');
    try {
      const result = await this.getEarningsDataOptimized();
      if (result.success !== false) {
        this.cache.set(result);
        logger.debug('✅ Background cache refresh complete');
      }
    } catch (error) {
      logger.warn('Background cache refresh failed:', error.message);
    }
  }

  /**
   * Clear cached earnings data
   */
  clearCache() {
    this.cache.clear();
    this.analytics.track('cache_cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary() {
    return this.analytics.generateSummary();
  }

  /**
   * Fix #5: Optimized earnings data fetch using single RPC call
   * Falls back to legacy multi-query method if RPC not available
   * 
   * @param {Object} options - Options for fetching earnings
   * @param {Date} options.startDate - Start date for earnings period
   * @param {Date} options.endDate - End date for earnings period
   * @returns {Promise<Object>} Aggregated earnings data
   */
  async getEarningsDataOptimized(options = {}) {
    try {
      const { startDate, endDate } = options;
      
      // Try the optimized RPC function first
      const { data, error } = await supabase.rpc('get_collector_earnings_aggregate', {
        p_collector_id: this.collectorId,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null
      });
      
      if (error) {
        // RPC not available, fall back to legacy method
        logger.warn('Earnings RPC not available, using legacy method:', error.message);
        return this.getEarningsData();
      }
      
      logger.info('✅ Earnings fetched via optimized RPC');
      
      // Transform RPC response to match existing data structure
      const pickupEarnings = data.pickup_earnings || {};
      const digitalBinEarnings = data.digital_bin_earnings || {};
      const pendingEarnings = data.pending_earnings || {};
      const settlements = data.settlements || {};
      const jobCounts = data.job_counts || {};
      const loyaltyTier = data.loyalty_tier || { tier: 'Silver', cashback_rate: 0.01 };
      const tipsReceived = data.tips_received || { total: 0, count: 0 };
      
      // Calculate totals
      const totalPickupEarnings = parseFloat(pickupEarnings.total) || 0;
      const totalBinEarnings = parseFloat(digitalBinEarnings.total) || 0;
      const totalEarnings = totalPickupEarnings + totalBinEarnings;
      const pendingDisposalEarnings = parseFloat(pendingEarnings.total) || 0;
      const disposedEarnings = totalEarnings;
      
      // Platform share
      const platformShare = parseFloat(data.platform_share) || 0;
      const grossRevenue = totalEarnings + platformShare;
      
      // Settlement calculations
      const cashCollected = parseFloat(settlements.cash_collected) || 0;
      const digitalCollected = parseFloat(settlements.digital_collected) || 0;
      const netSettlement = cashCollected - platformShare;
      
      // Build transactions from items
      const transactions = [
        ...(pickupEarnings.items || []).map(item => ({
          id: item.id,
          type: 'pickup',
          description: `${item.waste_type || 'Waste'} pickup`,
          amount: parseFloat(item.collector_total_payout) || parseFloat(item.fee) * 0.87,
          date: item.disposed_at || item.created_at,
          status: item.status
        })),
        ...(digitalBinEarnings.items || []).map(item => ({
          id: item.id,
          type: 'digital_bin',
          description: `Digital bin - ${item.waste_type || 'Waste'}`,
          amount: parseFloat(item.collector_total_payout) || 0,
          date: item.disposed_at || item.created_at,
          status: item.status
        }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Build chart data
      const chartData = {
        week: (data.chart_data || []).slice(-7),
        month: data.chart_data || [],
        year: data.chart_data || []
      };
      
      return {
        totalEarnings,
        pendingDisposalEarnings,
        disposedEarnings,
        platformEarnings: platformShare,
        grossRevenue,
        revenueSplit: {
          collector: totalEarnings,
          platform: platformShare
        },
        paymentSettlement: {
          cashCollected,
          digitalCollected,
          platformShare,
          netSettlement,
          collectorOwes: netSettlement < 0,
          amountDue: Math.abs(netSettlement)
        },
        jobCounts: {
          pickedUp: jobCounts.total_picked_up || 0,
          disposed: jobCounts.total_disposed || 0,
          binsPickedUp: jobCounts.bins_picked_up || 0,
          binsDisposed: jobCounts.bins_disposed || 0
        },
        completionRate: parseFloat(data.completion_rate) || 100,
        weeklyEarnings: parseFloat(data.weekly_earnings) || 0,
        monthlyEarnings: parseFloat(data.monthly_earnings) || 0,
        loyaltyTier,
        tipsReceived: parseFloat(tipsReceived.total) || 0,
        transactions,
        chartData,
        // Breakdown by bucket type
        earningsBreakdown: {
          core: (parseFloat(pickupEarnings.core) || 0) + (parseFloat(digitalBinEarnings.core) || 0),
          urgent: (parseFloat(pickupEarnings.urgent) || 0) + (parseFloat(digitalBinEarnings.urgent) || 0),
          distance: (parseFloat(pickupEarnings.distance) || 0) + (parseFloat(digitalBinEarnings.distance) || 0),
          surge: (parseFloat(pickupEarnings.surge) || 0) + (parseFloat(digitalBinEarnings.surge) || 0),
          tips: (parseFloat(pickupEarnings.tips) || 0) + (parseFloat(digitalBinEarnings.tips) || 0),
          recyclables: (parseFloat(pickupEarnings.recyclables) || 0) + (parseFloat(digitalBinEarnings.recyclables) || 0),
          loyalty: (parseFloat(pickupEarnings.loyalty) || 0) + (parseFloat(digitalBinEarnings.loyalty) || 0)
        },
        _source: 'rpc_optimized',
        _generatedAt: data.generated_at
      };
      
    } catch (error) {
      logger.error('Error in optimized earnings fetch:', error);
      // Fall back to legacy method
      return this.getEarningsData();
    }
  }

  async getEarningsData() {
    try {
      // === PICKUP REQUESTS ===
      // Get ALL pickups for this collector (both picked_up and disposed)
      const { data: allPickups, error: pickupsError } = await supabase
        .from('pickup_requests')
        .select('*')
        .eq('collector_id', this.collectorId)
        .in('status', ['picked_up', 'disposed']);

      if (pickupsError) throw pickupsError;

      // Separate by status
      const pickedUpRequests = allPickups?.filter(p => p.status === 'picked_up') || [];
      const disposedRequests = allPickups?.filter(p => p.status === 'disposed') || [];

      // === DIGITAL BINS ===
      // Get digital bins for this collector (both picked_up and disposed)
      const { data: digitalBins, error: binsError } = await supabase
        .from('digital_bins')
        .select('*')
        .eq('collector_id', this.collectorId)
        .in('status', ['picked_up', 'disposed']);

      if (binsError) {
        logger.warn('Error fetching digital bins:', binsError);
      }

      // Separate digital bins by status
      const pickedUpBins = digitalBins?.filter(b => b.status === 'picked_up') || [];
      const disposedBins = digitalBins?.filter(b => b.status === 'disposed') || [];

      // === BIN PAYMENTS (for payment mode tracking) ===
      // Get payment records to determine payment mode (cash vs digital)
      const binIds = (digitalBins || []).map(b => b.id);
      let binPayments = [];
      if (binIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from('bin_payments')
          .select('digital_bin_id, payment_mode, total_bill, type, status')
          .in('digital_bin_id', binIds)
          .eq('type', 'collection')
          .eq('status', 'success');
        
        if (!paymentsError) {
          binPayments = payments || [];
        }
      }
      
      // Create a map of bin_id -> payment_mode
      const binPaymentModeMap = {};
      binPayments.forEach(p => {
        binPaymentModeMap[p.digital_bin_id] = p.payment_mode;
      });

      // === AUTHORITY ASSIGNMENTS ===
      // Get completed authority assignments
      const { data: authorityAssignments, error: assignmentsError } = await supabase
        .from('authority_assignments')
        .select('*')
        .eq('collector_id', this.collectorId)
        .in('status', ['completed', 'disposed']);

      if (assignmentsError) {
        logger.warn('Error fetching authority assignments:', assignmentsError);
      }

      // === CALCULATE COLLECTOR EARNINGS (SOP v4.5.6 Percentage Sharing) ===
      // Pickup requests earnings - apply percentage sharing algorithm
      const pickupPendingDisposal = pickedUpRequests.reduce((sum, p) => sum + calculateCollectorEarnings(p), 0);
      const pickupDisposedEarnings = disposedRequests.reduce((sum, p) => sum + calculateCollectorEarnings(p), 0);
      const totalPickupEarnings = pickupPendingDisposal + pickupDisposedEarnings;

      // Digital bin earnings - apply percentage sharing algorithm
      const binsPendingDisposal = pickedUpBins.reduce((sum, b) => sum + calculateBinCollectorEarnings(b), 0);
      const binsDisposedEarnings = disposedBins.reduce((sum, b) => sum + calculateBinCollectorEarnings(b), 0);
      const totalBinEarnings = binsPendingDisposal + binsDisposedEarnings;

      // Authority assignment earnings
      const assignmentEarnings = authorityAssignments?.reduce((sum, a) => sum + (a.payment || 0), 0) || 0;

      // Total collector earnings from all sources
      const totalEarnings = totalPickupEarnings + totalBinEarnings + assignmentEarnings;
      const pendingDisposalEarnings = pickupPendingDisposal + binsPendingDisposal;
      const disposedEarnings = pickupDisposedEarnings + binsDisposedEarnings + assignmentEarnings;

      // === CALCULATE PLATFORM EARNINGS (App Bucket) ===
      // Pickup requests platform earnings
      const pickupPlatformEarnings = allPickups?.reduce((sum, p) => sum + calculatePlatformEarnings(p).total, 0) || 0;
      
      // Digital bin platform earnings
      const binPlatformEarnings = (digitalBins || []).reduce((sum, b) => sum + calculateBinPlatformEarnings(b).total, 0);
      
      // Total platform earnings (authority assignments are 100% to collector, no platform share)
      const totalPlatformEarnings = pickupPlatformEarnings + binPlatformEarnings;
      
      // Calculate gross revenue (what user paid)
      const grossRevenue = totalEarnings + totalPlatformEarnings;

      // === PAYMENT MODE TRACKING (Cash vs Digital) ===
      // Track what collector owes platform (cash payments) vs what platform owes collector (digital payments)
      // Cash: Collector received full amount, owes platform its commission
      // Digital (momo/e_cash): Platform received full amount, owes collector their share
      
      let cashCollected = 0;           // Total cash collected by collector
      let cashPlatformDue = 0;         // Platform's share from cash payments (collector owes this)
      let digitalCollected = 0;        // Total digital payments received by platform
      let digitalCollectorDue = 0;     // Collector's share from digital payments (platform owes this)
      
      // Track pickup requests by payment mode (using payment_type field if available)
      allPickups?.forEach(p => {
        const paymentMode = p.payment_mode || p.payment_type || 'digital'; // Default to digital
        const collectorEarnings = calculateCollectorEarnings(p);
        const platformEarnings = calculatePlatformEarnings(p).total;
        const grossAmount = collectorEarnings + platformEarnings;
        
        if (paymentMode === 'cash') {
          cashCollected += grossAmount;
          cashPlatformDue += platformEarnings; // Collector owes platform this amount
        } else {
          // momo, e_cash, or other digital payments
          digitalCollected += grossAmount;
          digitalCollectorDue += collectorEarnings; // Platform owes collector this amount
        }
      });
      
      // Track digital bins by payment mode (from bin_payments)
      (digitalBins || []).forEach(b => {
        const paymentMode = binPaymentModeMap[b.id] || 'digital'; // Default to digital
        const collectorEarnings = calculateBinCollectorEarnings(b);
        const platformEarnings = calculateBinPlatformEarnings(b).total;
        const grossAmount = collectorEarnings + platformEarnings;
        
        if (paymentMode === 'cash') {
          cashCollected += grossAmount;
          cashPlatformDue += platformEarnings; // Collector owes platform this amount
        } else {
          // momo, e_cash, or other digital payments
          digitalCollected += grossAmount;
          digitalCollectorDue += collectorEarnings; // Platform owes collector this amount
        }
      });
      
      // Net settlement: positive = collector owes platform, negative = platform owes collector
      const netSettlement = cashPlatformDue - digitalCollectorDue;

      // Job counts
      const totalPickedUpJobs = pickedUpRequests.length + pickedUpBins.length;
      const totalDisposedJobs = disposedRequests.length + disposedBins.length + (authorityAssignments?.length || 0);
      const completedJobs = totalPickedUpJobs + totalDisposedJobs;
      const avgPerJob = completedJobs > 0 ? totalEarnings / completedJobs : 0;

      // === CALCULATE REAL RATING ===
      // Get ratings from completed requests that have ratings
      const ratingsData = [...(allPickups || []), ...(authorityAssignments || [])]
        .filter(item => item.rating !== null && item.rating !== undefined)
        .map(item => item.rating);
      
      const rating = ratingsData.length > 0 
        ? ratingsData.reduce((sum, r) => sum + r, 0) / ratingsData.length 
        : 0;

      // === CALCULATE REAL COMPLETION RATE ===
      // Get total accepted jobs (including expired/cancelled)
      const { data: allAcceptedJobs, error: acceptedError } = await supabase
        .from('pickup_requests')
        .select('id, status')
        .eq('collector_id', this.collectorId)
        .in('status', ['accepted', 'picked_up', 'disposed', 'expired', 'cancelled']);

      let completionRate = 0;
      if (!acceptedError && allAcceptedJobs && allAcceptedJobs.length > 0) {
        const completedCount = allAcceptedJobs.filter(j => 
          j.status === 'picked_up' || j.status === 'disposed'
        ).length;
        completionRate = Math.round((completedCount / allAcceptedJobs.length) * 100);
      }

      // === CALCULATE WEEKLY & MONTHLY EARNINGS ===
      const now = new Date();
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      // Combine all items with timestamps - using percentage sharing algorithm
      const allItemsWithTimestamps = [
        ...allPickups.map(p => ({ 
          amount: calculateCollectorEarnings(p), 
          timestamp: p.picked_up_at || p.disposed_at || p.updated_at 
        })),
        ...(digitalBins || []).map(b => ({ 
          amount: calculateBinCollectorEarnings(b), 
          timestamp: b.picked_up_at || b.disposed_at || b.updated_at 
        })),
        ...(authorityAssignments || []).map(a => ({ 
          amount: a.payment || 0, 
          timestamp: a.completed_at || a.updated_at 
        }))
      ];

      const weeklyEarnings = allItemsWithTimestamps
        .filter(item => item.timestamp && new Date(item.timestamp) > weekAgo)
        .reduce((sum, item) => sum + item.amount, 0);

      const monthlyEarnings = allItemsWithTimestamps
        .filter(item => item.timestamp && new Date(item.timestamp) > monthAgo)
        .reduce((sum, item) => sum + item.amount, 0);

      // === FORMAT TRANSACTIONS (with SOP v4.5.6 percentage sharing) ===
      const transactions = [
        // Pickup requests
        ...allPickups.map(pickup => ({
          id: pickup.id,
          type: 'pickup_request',
          amount: calculateCollectorEarnings(pickup),
          status: pickup.status,
          date: pickup.picked_up_at || pickup.disposed_at || pickup.updated_at,
          location: pickup.location,
          note: pickup.status === 'picked_up' ? 'Pending disposal' : 'Disposed'
        })),
        // Digital bins
        ...(digitalBins || []).map(bin => ({
          id: bin.id,
          type: 'digital_bin',
          amount: calculateBinCollectorEarnings(bin),
          status: bin.status,
          date: bin.picked_up_at || bin.disposed_at || bin.updated_at,
          location: bin.location_id,
          note: bin.status === 'picked_up' ? 'Pending disposal' : 'Disposed'
        })),
        // Authority assignments
        ...(authorityAssignments || []).map(assignment => ({
          id: assignment.id,
          type: 'authority_assignment',
          amount: assignment.payment || 0,
          status: 'completed',
          date: assignment.completed_at || assignment.updated_at,
          location: assignment.location,
          note: assignment.title || 'Authority Assignment'
        }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      // === GENERATE CHART DATA ===
      const generateChartData = (items) => {
        const today = new Date();
        
        // Week data (last 7 days)
        const weekData = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today - i * 24 * 60 * 60 * 1000);
          const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
          const dayEarnings = items
            .filter(item => item.timestamp && new Date(item.timestamp).toDateString() === date.toDateString())
            .reduce((sum, item) => sum + item.amount, 0);
          return { label: dayName, amount: dayEarnings };
        }).reverse();

        // Month data (last 4 weeks)
        const monthData = Array.from({ length: 4 }, (_, i) => {
          const weekStart = new Date(today - (i + 1) * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = new Date(today - i * 7 * 24 * 60 * 60 * 1000);
          const weekEarnings = items
            .filter(item => {
              if (!item.timestamp) return false;
              const itemDate = new Date(item.timestamp);
              return itemDate >= weekStart && itemDate < weekEnd;
            })
            .reduce((sum, item) => sum + item.amount, 0);
          return { label: `W${4-i}`, amount: weekEarnings };
        }).reverse();

        // Year data (last 12 months)
        const yearData = Array.from({ length: 12 }, (_, i) => {
          const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
          const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
          const monthEarnings = items
            .filter(item => {
              if (!item.timestamp) return false;
              const itemDate = new Date(item.timestamp);
              return itemDate >= monthStart && itemDate <= monthEnd;
            })
            .reduce((sum, item) => sum + item.amount, 0);
          return { label: monthName, amount: monthEarnings };
        }).reverse();

        return { week: weekData, month: monthData, year: yearData };
      };

      const chartData = generateChartData(allItemsWithTimestamps);

      logger.info('📊 Earnings data fetched:', {
        totalEarnings,
        totalPlatformEarnings,
        grossRevenue,
        pendingDisposalEarnings,
        disposedEarnings,
        completedJobs,
        rating,
        completionRate,
        paymentMode: {
          cashCollected,
          cashPlatformDue,
          digitalCollected,
          digitalCollectorDue,
          netSettlement
        }
      });

      return {
        success: true,
        data: {
          transactions,
          chartData,
          stats: {
            // Collector earnings
            totalEarnings,
            pendingDisposalEarnings,
            disposedEarnings,
            // Breakdown by source (collector)
            pickupRequestEarnings: totalPickupEarnings,
            digitalBinEarnings: totalBinEarnings,
            authorityAssignmentEarnings: assignmentEarnings,
            // Platform earnings (App Bucket)
            platformEarnings: totalPlatformEarnings,
            pickupPlatformEarnings,
            binPlatformEarnings,
            // Gross revenue (user paid)
            grossRevenue,
            // Collector share percentage
            collectorSharePercent: grossRevenue > 0 ? Math.round((totalEarnings / grossRevenue) * 100) : 0,
            platformSharePercent: grossRevenue > 0 ? Math.round((totalPlatformEarnings / grossRevenue) * 100) : 0,
            // Job counts
            completedJobs,
            pendingDisposalJobs: totalPickedUpJobs,
            disposedJobs: totalDisposedJobs,
            avgPerJob,
            // Performance metrics (real data)
            rating,
            completionRate,
            // Time-based earnings
            weeklyEarnings,
            monthlyEarnings,
            // Payment mode tracking (cash vs digital settlement)
            paymentModeBreakdown: {
              cash: {
                collected: cashCollected,           // Total cash collector received from users
                platformDue: cashPlatformDue        // Platform's share collector owes
              },
              digital: {
                collected: digitalCollected,        // Total digital payments platform received
                collectorDue: digitalCollectorDue   // Collector's share platform owes
              },
              // Reconciliation: Platform deducts commission from what it owes collector
              // Only if platform owes less than commission due, collector must pay back difference
              reconciliation: {
                // Amount platform will deduct from collector's digital payout
                commissionDeducted: Math.min(cashPlatformDue, digitalCollectorDue),
                // Net payout after deduction (platform pays this to collector)
                netPayoutToCollector: Math.max(0, digitalCollectorDue - cashPlatformDue),
                // Only if collector owes more than platform owes, collector must pay this back via MoMo
                collectorMustPayBack: Math.max(0, cashPlatformDue - digitalCollectorDue),
                // Whether collector needs to make a payment to platform
                requiresPayback: cashPlatformDue > digitalCollectorDue
              },
              // Legacy fields for compatibility
              netSettlement,
              settlementDirection: netSettlement > 0 ? 'collector_owes_platform' : 
                                   netSettlement < 0 ? 'platform_owes_collector' : 'settled'
            }
          }
        }
      };

    } catch (error) {
      logger.error('Error fetching earnings data:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  async processWithdrawal(amount, paymentDetails) {
    try {
      // In production, this would integrate with a payment gateway
      // For now, just record the withdrawal in our database
      const { error } = await supabase
        .from('withdrawals')
        .insert({
          collector_id: this.collectorId,
          amount,
          payment_method: paymentDetails.method,
          payment_details: paymentDetails,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      return {
        success: true,
        message: 'Withdrawal request submitted successfully'
      };

    } catch (error) {
      logger.error('Error processing withdrawal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get detailed earnings breakdown by bucket type (SOP v4.5.6)
   * Falls back to legacy fee calculation if new fields unavailable
   * Includes both picked_up (pending disposal) and disposed items
   * 
   * @returns {Promise<Object>} Earnings breakdown by bucket type
   */
  async getDetailedEarningsBreakdown() {
    try {
      // Get ALL pickups (both picked_up and disposed) with all fields
      const { data: allPickups, error: pickupsError } = await supabase
        .from('pickup_requests')
        .select('*')
        .eq('collector_id', this.collectorId)
        .in('status', ['picked_up', 'disposed']);

      if (pickupsError) throw pickupsError;

      // Get digital bins (both picked_up and disposed)
      const { data: digitalBins, error: binsError } = await supabase
        .from('digital_bins')
        .select('*')
        .eq('collector_id', this.collectorId)
        .in('status', ['picked_up', 'disposed']);

      if (binsError) {
        logger.warn('Error fetching digital bins for breakdown:', binsError);
      }

      // Aggregate by bucket type
      const buckets = {
        core: 0,
        urgent: 0,
        distance: 0,
        surge: 0,
        tips: 0,
        recyclables: 0,
        loyalty: 0
      };

      // Process pickup requests with SOP v4.5.6 percentage sharing
      allPickups?.forEach(pickup => {
        // Use new fields if available
        if (pickup.collector_core_payout !== null && pickup.collector_core_payout !== undefined) {
          buckets.core += pickup.collector_core_payout || 0;
          buckets.urgent += pickup.collector_urgent_payout || 0;
          buckets.distance += pickup.collector_distance_payout || 0;
          buckets.surge += pickup.collector_surge_payout || 0;
          buckets.tips += pickup.collector_tips || 0;
          buckets.recyclables += pickup.collector_recyclables_payout || 0;
          buckets.loyalty += pickup.collector_loyalty_cashback || 0;
        } else {
          // Legacy: Apply SOP v4.5.6 percentage sharing algorithm
          // IMPORTANT: Exclude request fee (GHC 1.00) from bucket sharing - it's 100% platform revenue
          const rawFee = pickup.fee || pickup.base_amount || 0;
          const requestFee = pickup.request_fee || 1.0; // Default GHC 1.00 request fee
          const baseFee = Math.max(0, rawFee - requestFee); // Exclude request fee from sharing
          const deadheadKm = pickup.deadhead_km || pickup.distance_km || 0;
          const deadheadShare = deadheadKm > 0 ? getDeadheadShare(deadheadKm) : PAYMENT_SPLITS.DEFAULT_DEADHEAD_SHARE;
          
          // Core payout with deadhead share (request fee excluded)
          buckets.core += baseFee * deadheadShare;
          
          // Apply other percentage splits for legacy data
          if (pickup.urgent_enabled && pickup.urgent_amount) {
            buckets.urgent += pickup.urgent_amount * PAYMENT_SPLITS.URGENT_COLLECTOR_SHARE;
          }
          if (pickup.surge_multiplier && pickup.surge_multiplier > 1) {
            buckets.surge += baseFee * (pickup.surge_multiplier - 1) * PAYMENT_SPLITS.SURGE_COLLECTOR_SHARE;
          }
          if (pickup.tips) {
            buckets.tips += pickup.tips * PAYMENT_SPLITS.TIPS_COLLECTOR_SHARE;
          }
          if (pickup.recycler_gross_payout) {
            buckets.recyclables += pickup.recycler_gross_payout * PAYMENT_SPLITS.RECYCLABLES_COLLECTOR_SHARE;
          }
        }
      });

      // Process digital bins with SOP v4.5.6 percentage sharing
      digitalBins?.forEach(bin => {
        if (bin.collector_core_payout !== null && bin.collector_core_payout !== undefined) {
          buckets.core += bin.collector_core_payout || 0;
          buckets.urgent += bin.collector_urgent_payout || 0;
          buckets.distance += bin.collector_distance_payout || 0;
          buckets.surge += bin.collector_surge_payout || 0;
          buckets.tips += bin.collector_tips || 0;
          buckets.recyclables += bin.collector_recyclables_payout || 0;
          buckets.loyalty += bin.collector_loyalty_cashback || 0;
        } else {
          // Legacy: Apply default deadhead share (87%)
          const basePayout = bin.payout || bin.fee || 0;
          buckets.core += basePayout * PAYMENT_SPLITS.DEFAULT_DEADHEAD_SHARE;
        }
      });

      const total = Object.values(buckets).reduce((sum, val) => sum + val, 0);

      // Calculate percentages
      const breakdown = Object.keys(buckets).map(type => ({
        type,
        amount: buckets[type],
        percentage: total > 0 ? (buckets[type] / total) * 100 : 0
      }));

      // Separate counts by status
      const pendingDisposalCount = (allPickups?.filter(p => p.status === 'picked_up').length || 0) + 
                                   (digitalBins?.filter(b => b.status === 'picked_up').length || 0);
      const disposedCount = (allPickups?.filter(p => p.status === 'disposed').length || 0) + 
                           (digitalBins?.filter(b => b.status === 'disposed').length || 0);

      return {
        success: true,
        data: {
          buckets,
          total,
          jobCount: (allPickups?.length || 0) + (digitalBins?.length || 0),
          pendingDisposalCount,
          disposedCount,
          breakdown
        }
      };

    } catch (error) {
      logger.error('Error fetching detailed earnings breakdown:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Get payout transactions with type breakdown
   * 
   * @param {string} [timeframe='30d'] - Timeframe for transactions (7d, 30d, 90d)
   * @returns {Promise<Object>} Transactions grouped by type
   */
  async getPayoutTransactions(timeframe = '30d') {
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      const days = parseInt(timeframe) || 30;
      startDate.setDate(endDate.getDate() - days);

      const { data: transactions, error } = await supabase
        .from('payout_transactions')
        .select('*')
        .eq('collector_id', this.collectorId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by transaction type
      const byType = {};
      transactions?.forEach(tx => {
        if (!byType[tx.transaction_type]) {
          byType[tx.transaction_type] = 0;
        }
        byType[tx.transaction_type] += tx.amount || 0;
      });

      return {
        success: true,
        data: {
          transactions: transactions || [],
          byType
        }
      };

    } catch (error) {
      logger.error('Error fetching payout transactions:', error);
      return {
        success: false,
        error: error.message,
        data: { transactions: [], byType: {} }
      };
    }
  }

  /**
   * Get current loyalty tier information
   * 
   * @returns {Promise<Object>} Loyalty tier details
   */
  async getLoyaltyTier() {
    try {
      // Get current month (first day)
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthStr = currentMonth.toISOString().split('T')[0];

      const { data: tier, error } = await supabase
        .from('collector_loyalty_tiers')
        .select('*')
        .eq('collector_id', this.collectorId)
        .eq('month', currentMonthStr)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Default to Silver if no tier found
      const tierData = tier || {
        tier: 'Silver',
        cashback_rate: 0.01,
        monthly_cap: 100,
        cashback_earned: 0,
        csat_score: 0,
        completion_rate: 0,
        recyclables_percentage: 0
      };

      return {
        success: true,
        data: {
          ...tierData,
          remaining: (tierData.monthly_cap || 0) - (tierData.cashback_earned || 0)
        }
      };

    } catch (error) {
      logger.error('Error fetching loyalty tier:', error);
      return {
        success: false,
        error: error.message,
        data: {
          tier: 'Silver',
          cashback_rate: 0.01,
          monthly_cap: 100,
          cashback_earned: 0,
          remaining: 100
        }
      };
    }
  }

  /**
   * Get tips received (all-time and by timeframe)
   * 
   * @param {string} [timeframe='30d'] - Timeframe for tips
   * @returns {Promise<Object>} Tips summary
   */
  async getTipsReceived(timeframe = '30d') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      const days = parseInt(timeframe) || 30;
      startDate.setDate(endDate.getDate() - days);

      const { data: tips, error } = await supabase
        .from('collector_tips')
        .select('*')
        .eq('collector_id', this.collectorId)
        .eq('status', 'confirmed')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const total = tips?.reduce((sum, tip) => sum + (tip.amount || 0), 0) || 0;
      const count = tips?.length || 0;
      const average = count > 0 ? total / count : 0;

      const byType = {
        pre_checkout: 0,
        post_completion: 0
      };

      tips?.forEach(tip => {
        if (tip.tip_type === 'pre_checkout') {
          byType.pre_checkout += tip.amount || 0;
        } else {
          byType.post_completion += tip.amount || 0;
        }
      });

      return {
        success: true,
        data: {
          total,
          count,
          average,
          byType,
          tips: tips || []
        }
      };

    } catch (error) {
      logger.error('Error fetching tips:', error);
      return {
        success: false,
        error: error.message,
        data: { total: 0, count: 0, average: 0, byType: {}, tips: [] }
      };
    }
  }

  /**
   * Process digital bin disbursement (cashout)
   * Phase 3: Records disbursement, validates against available balance
   * Phase 4: Will integrate TrendiPay API call
   * 
   * @param {number} amount - Amount to disburse in GHS
   * @param {Object} paymentDetails - MoMo details {momoNumber, momoProvider}
   * @returns {Promise<Object>} Result with success status
   */
  async processDigitalBinDisbursement(amount, paymentDetails) {
    try {
      logger.info('Processing digital bin disbursement:', { collectorId: this.collectorId, amount });

      // Step 1: Validate amount
      if (!amount || amount <= 0) {
        throw new Error('Invalid withdrawal amount');
      }

      // Step 2: Get collector profile ID
      const { data: collectorProfile, error: profileError } = await supabase
        .from('collector_profiles')
        .select('id')
        .eq('user_id', this.collectorId)
        .single();

      if (profileError || !collectorProfile) {
        throw new Error('Collector profile not found');
      }

      // Step 3: Validate cashout amount using RPC function
      const { data: validation, error: validationError } = await supabase
        .rpc('validate_cashout', {
          p_collector_id: this.collectorId,
          p_amount: amount
        });

      if (validationError) {
        throw new Error(`Validation error: ${validationError.message}`);
      }

      if (!validation.valid) {
        // Provide clear feedback about why withdrawal failed
        const available = validation.available || 0;
        if (available === 0) {
          throw new Error('No funds available for withdrawal. You must dispose your collected waste at a facility before you can withdraw earnings.');
        } else if (amount > available) {
          throw new Error(`Insufficient balance. Available: ₵${available.toFixed(2)}. Only disposed bins can be withdrawn - dispose your pending collections first.`);
        }
        throw new Error(validation.error || 'Insufficient balance');
      }

      logger.info('Cashout validation passed:', validation);

      // Step 4: Get all undisbursed bins for this collector
      const { data: undisbursedBins, error: binsError } = await supabase
        .from('digital_bins')
        .select('id, collector_total_payout')
        .eq('collector_id', this.collectorId)
        .eq('status', 'disposed')
        .not('id', 'in', `(
          SELECT digital_bin_id 
          FROM bin_payments 
          WHERE type='disbursement' 
            AND status='success'
        )`);

      if (binsError) {
        throw new Error(`Error fetching bins: ${binsError.message}`);
      }

      logger.info(`Found ${undisbursedBins?.length || 0} undisbursed bins`);

      // Step 5: Create disbursement record(s)
      // For simplicity, create one disbursement record representing the aggregated payout
      // Link it to the first bin (or create a separate tracking mechanism)
      
      const disbursementRecord = {
        digital_bin_id: undisbursedBins?.[0]?.id || null, // Representative bin
        collector_id: collectorProfile.id,
        type: 'disbursement',
        collector_share: amount,
        platform_share: 0, // Platform already took their share during disposal
        payment_mode: 'momo',
        collector_account_number: paymentDetails.momoNumber,
        collector_account_name: paymentDetails.accountName || 'Collector',
        client_rswitch: paymentDetails.momoProvider || 'mtn',
        currency: 'GHS',
        status: 'pending', // Phase 4: will become 'success' after TrendiPay confirms
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: disbursement, error: disbursementError } = await supabase
        .from('bin_payments')
        .insert([disbursementRecord])
        .select()
        .single();

      if (disbursementError) {
        throw new Error(`Failed to create disbursement: ${disbursementError.message}`);
      }

      logger.info('Disbursement record created:', disbursement.id);

      // Phase 4: Call TrendiPay disbursement API
      if (ENABLE_TRENDIPAY) {
        logger.info('Calling TrendiPay disbursement API...');
        
        const gatewayResult = await TrendiPayService.initiateDisbursement({
          reference: disbursement.id,
          accountNumber: paymentDetails.momoNumber,
          rSwitch: paymentDetails.momoProvider,
          amount: amount,
          description: `TrashDrop collector payout (${undisbursedBins?.length || 0} bins)`,
          currency: 'GHS'
        });

        if (!gatewayResult.success) {
          // Update disbursement record with error
          await supabase
            .from('bin_payments')
            .update({ 
              status: 'failed',
              gateway_error: gatewayResult.error
            })
            .eq('id', disbursement.id);

          throw new Error(gatewayResult.error || 'Disbursement gateway error');
        }

        // Update disbursement record with gateway details
        const { error: updateError } = await supabase
          .from('bin_payments')
          .update({ 
            status: gatewayResult.status, // Will be 'pending' initially
            gateway_reference: gatewayResult.gatewayReference,
            gateway_transaction_id: gatewayResult.transactionId
          })
          .eq('id', disbursement.id);

        if (updateError) {
          logger.warn('Failed to update gateway reference:', updateError);
        }

        logger.info('TrendiPay disbursement initiated:', {
          disbursementId: disbursement.id,
          transactionId: gatewayResult.transactionId,
          status: gatewayResult.status
        });

        return {
          success: true,
          disbursementId: disbursement.id,
          transactionId: gatewayResult.transactionId,
          amount: amount,
          message: gatewayResult.message || 'Withdrawal initiated successfully',
          status: gatewayResult.status,
          binsIncluded: undisbursedBins?.length || 0
        };
      } else {
        // Stub mode: Mark as success immediately for testing
        logger.warn('TrendiPay disabled - using stub mode');
        
        const { error: updateError } = await supabase
          .from('bin_payments')
          .update({ 
            status: 'success',
            gateway_reference: `stub_${Date.now()}`
          })
          .eq('id', disbursement.id);

        if (updateError) {
          logger.warn('Failed to update disbursement status:', updateError);
        }

        return {
          success: true,
          disbursementId: disbursement.id,
          amount: amount,
          message: 'Withdrawal processed successfully (stub mode)',
          binsIncluded: undisbursedBins?.length || 0
        };
      }

    } catch (error) {
      logger.error('Error processing digital bin disbursement:', error);
      return {
        success: false,
        error: error.message || 'Failed to process withdrawal'
      };
    }
  }

  /**
   * Fix #6: Retry failed disbursement
   * Attempts to retry a previously failed disbursement
   * 
   * @param {string} disbursementId - ID of the failed disbursement to retry
   * @param {Object} paymentDetails - Updated payment details (optional)
   * @returns {Promise<Object>} Result with success status
   */
  async retryFailedDisbursement(disbursementId, paymentDetails = null) {
    try {
      logger.info('Retrying failed disbursement:', { disbursementId, collectorId: this.collectorId });

      // Step 1: Fetch the failed disbursement record
      const { data: disbursement, error: fetchError } = await supabase
        .from('bin_payments')
        .select('*')
        .eq('id', disbursementId)
        .eq('type', 'disbursement')
        .eq('status', 'failed')
        .single();

      if (fetchError || !disbursement) {
        throw new Error('Failed disbursement not found or already processed');
      }

      // Step 2: Verify ownership
      const { data: collectorProfile } = await supabase
        .from('collector_profiles')
        .select('id')
        .eq('user_id', this.collectorId)
        .single();

      if (!collectorProfile || disbursement.collector_id !== collectorProfile.id) {
        throw new Error('Unauthorized: This disbursement belongs to another collector');
      }

      // Step 3: Use updated payment details or existing ones
      const momoNumber = paymentDetails?.momoNumber || disbursement.collector_account_number;
      const momoProvider = paymentDetails?.momoProvider || disbursement.client_rswitch;
      const amount = disbursement.collector_share;

      // Step 4: Increment retry count
      const retryCount = (disbursement.retry_count || 0) + 1;
      const maxRetries = 3;

      if (retryCount > maxRetries) {
        throw new Error(`Maximum retry attempts (${maxRetries}) exceeded. Please contact support.`);
      }

      // Step 5: Update record to pending and increment retry count
      await supabase
        .from('bin_payments')
        .update({ 
          status: 'pending',
          retry_count: retryCount,
          gateway_error: null,
          updated_at: new Date().toISOString(),
          collector_account_number: momoNumber,
          client_rswitch: momoProvider
        })
        .eq('id', disbursementId);

      logger.info(`Retry attempt ${retryCount}/${maxRetries} for disbursement:`, disbursementId);

      // Step 6: Call TrendiPay disbursement API
      if (ENABLE_TRENDIPAY) {
        const gatewayResult = await TrendiPayService.initiateDisbursement({
          reference: `${disbursementId}_retry${retryCount}`,
          accountNumber: momoNumber,
          rSwitch: momoProvider,
          amount: amount,
          description: `TrashDrop payout retry #${retryCount}`,
          currency: 'GHS'
        });

        if (!gatewayResult.success) {
          // Update with new error
          await supabase
            .from('bin_payments')
            .update({ 
              status: 'failed',
              gateway_error: gatewayResult.error,
              updated_at: new Date().toISOString()
            })
            .eq('id', disbursementId);

          throw new Error(gatewayResult.error || 'Disbursement retry failed');
        }

        // Update with success
        await supabase
          .from('bin_payments')
          .update({ 
            status: gatewayResult.status,
            gateway_reference: gatewayResult.gatewayReference,
            gateway_transaction_id: gatewayResult.transactionId,
            updated_at: new Date().toISOString()
          })
          .eq('id', disbursementId);

        logger.info('✅ Disbursement retry successful:', {
          disbursementId,
          transactionId: gatewayResult.transactionId,
          retryCount
        });

        return {
          success: true,
          disbursementId,
          transactionId: gatewayResult.transactionId,
          amount,
          message: `Withdrawal retry #${retryCount} initiated successfully`,
          status: gatewayResult.status,
          retryCount
        };
      } else {
        // Stub mode
        await supabase
          .from('bin_payments')
          .update({ 
            status: 'success',
            gateway_reference: `stub_retry_${Date.now()}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', disbursementId);

        return {
          success: true,
          disbursementId,
          amount,
          message: `Retry #${retryCount} processed successfully (stub mode)`,
          retryCount
        };
      }

    } catch (error) {
      logger.error('Error retrying disbursement:', error);
      return {
        success: false,
        error: error.message || 'Failed to retry withdrawal'
      };
    }
  }

  /**
   * Fix #6: Get all failed disbursements for this collector
   * Returns list of failed disbursements that can be retried
   * 
   * @returns {Promise<Object>} List of failed disbursements
   */
  async getFailedDisbursements() {
    try {
      const { data: collectorProfile } = await supabase
        .from('collector_profiles')
        .select('id')
        .eq('user_id', this.collectorId)
        .single();

      if (!collectorProfile) {
        return { success: true, disbursements: [] };
      }

      const { data: failed, error } = await supabase
        .from('bin_payments')
        .select('id, collector_share, gateway_error, retry_count, created_at, updated_at, collector_account_number, client_rswitch')
        .eq('collector_id', collectorProfile.id)
        .eq('type', 'disbursement')
        .eq('status', 'failed')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const maxRetries = 3;
      const disbursements = (failed || []).map(d => ({
        ...d,
        canRetry: (d.retry_count || 0) < maxRetries,
        retriesRemaining: maxRetries - (d.retry_count || 0)
      }));

      return {
        success: true,
        disbursements,
        totalFailed: disbursements.length,
        canRetryCount: disbursements.filter(d => d.canRetry).length
      };

    } catch (error) {
      logger.error('Error fetching failed disbursements:', error);
      return {
        success: false,
        error: error.message,
        disbursements: []
      };
    }
  }
}

export const createEarningsService = (collectorId) => {
  return new EarningsService(collectorId);
};

export default EarningsService;
