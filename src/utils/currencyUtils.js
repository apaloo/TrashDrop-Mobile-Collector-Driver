/**
 * Currency utilities for TrashDrop Carter App
 * Provides functions for determining currency based on location
 */

import { logger } from './logger';

// Map of country codes to currency details
export const CURRENCY_MAP = {
  // Africa
  'GH': { code: 'GHS', symbol: '₵', name: 'Ghana Cedi' },
  'NG': { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  'KE': { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  'ZA': { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  'EG': { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  
  // Default/fallback
  'DEFAULT': { code: 'USD', symbol: '$', name: 'US Dollar' },
};

/**
 * Get currency details based on coordinates
 * Uses reverse geocoding to determine country
 * 
 * @param {Array} coordinates - [latitude, longitude]
 * @returns {Promise<Object>} Currency details object
 */
export const getCurrencyFromCoordinates = async (coordinates) => {
  if (!coordinates || !coordinates[0] || !coordinates[1]) {
    logger.warn('Invalid coordinates provided, using default currency');
    return CURRENCY_MAP.GH; // Default to Ghana Cedi
  }
  
  const [latitude, longitude] = coordinates;
  
  try {
    // Use reverse geocoding to get country
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TrashDrop-Mobile-App', // Required by Nominatim usage policy
          'Accept': 'application/json'
        }
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      logger.warn(`Geocoding API returned status ${response.status}`);
      return CURRENCY_MAP.GH; // Default to Ghana Cedi
    }
    
    const data = await response.json();
    const countryCode = data.address?.country_code?.toUpperCase();
    
    if (countryCode && CURRENCY_MAP[countryCode]) {
      return CURRENCY_MAP[countryCode];
    }
    
    logger.warn(`No currency mapping found for country code: ${countryCode}`);
    return CURRENCY_MAP.GH; // Default to Ghana Cedi if country not found or not supported
  } catch (error) {
    // Reduce error logging frequency to prevent spam - only log meaningful errors
    if (Math.random() < 0.05) { // Further reduced to 5%
      // Only log if error has meaningful information
      if (error.name === 'AbortError') {
        logger.warn('[Currency] Request timeout - using Ghana Cedi fallback');
      } else if (error.message) {
        logger.warn('[Currency] Network error:', error.message);
      } else {
        logger.warn('[Currency] Location detection failed - using Ghana Cedi fallback');
      }
    }
    // Always default to Ghana if there's an error
    return CURRENCY_MAP.GH;
  }
};

/**
 * Format amount with the appropriate currency symbol
 * 
 * @param {number} amount - Amount to format
 * @param {Object} currency - Currency details object
 * @returns {string} Formatted amount with currency symbol
 */
export const formatCurrency = (amount, currency = CURRENCY_MAP.GH) => {
  if (amount === undefined || amount === null) {
    amount = 0;
  }
  
  return `${currency.symbol}${parseFloat(amount).toFixed(2)}`;
};
