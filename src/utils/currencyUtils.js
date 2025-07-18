/**
 * Currency utilities for TrashDrop Carter App
 * Provides functions for determining currency based on location
 */

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
    return CURRENCY_MAP.DEFAULT;
  }
  
  try {
    const [latitude, longitude] = coordinates;
    
    // Use reverse geocoding to get country
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch location data');
    }
    
    const data = await response.json();
    const countryCode = data.address?.country_code?.toUpperCase();
    
    if (countryCode && CURRENCY_MAP[countryCode]) {
      return CURRENCY_MAP[countryCode];
    }
    
    // Default to Ghana if country not found or not supported
    return CURRENCY_MAP.GH;
  } catch (error) {
    console.error('Error determining currency from location:', error);
    // Default to Ghana if there's an error
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
