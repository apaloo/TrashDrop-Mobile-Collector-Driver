import React, { createContext, useState, useEffect, useContext } from 'react';
import { getCurrencyFromCoordinates, CURRENCY_MAP } from '../utils/currencyUtils';
import { logger } from '../utils/logger';

// Create the currency context
const CurrencyContext = createContext();

/**
 * Currency Provider Component
 * Manages currency state based on user location
 */
export const CurrencyProvider = ({ children }) => {
  // Default to Ghana Cedi
  const [currency, setCurrency] = useState(CURRENCY_MAP.GH);
  const [isLoading, setIsLoading] = useState(true);

  // Update currency based on user location - NON-BLOCKING approach
  useEffect(() => {
    const updateCurrencyFromLocation = async () => {
      try {
        // IMMEDIATE: Start with cached currency or default to avoid blocking
        const storedCurrency = localStorage.getItem('trashdrop_currency');
        if (storedCurrency) {
          logger.debug('[Currency] ⚡ Using cached currency immediately');
          setCurrency(JSON.parse(storedCurrency));
          setIsLoading(false); // Stop loading immediately with cached data
        } else {
          logger.debug('[Currency] ⚡ Using default currency immediately (Ghana)');
          setCurrency(CURRENCY_MAP.GH); // Default to Ghana Cedi immediately
          setIsLoading(false); // Stop loading immediately with default
        }
        
        // BACKGROUND: Try to get location without blocking startup
        if (navigator.geolocation) {
          const geolocationOptions = {
            enableHighAccuracy: false,
            timeout: 2000, // Reduced to 2 seconds to prevent blocking
            maximumAge: 1000 * 60 * 60 // 1 hour cache
          };
          
          // Set up timeout to prevent infinite waiting
          const timeoutId = setTimeout(() => {
            logger.debug('[Currency] 🏃 Location timeout - keeping current currency');
          }, 2000);
          
          logger.debug('[Currency] 🔍 Getting location in background (non-blocking)...');
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                clearTimeout(timeoutId);
                logger.debug('[Currency] 📍 Background location obtained, updating currency...');
                const { latitude, longitude } = position.coords;
                try {
                  const detectedCurrency = await getCurrencyFromCoordinates([latitude, longitude]);
                  
                  // Only update if different from current
                  if (detectedCurrency && detectedCurrency.code !== currency.code) {
                    logger.debug('[Currency] 💱 Updating currency to:', detectedCurrency.code);
                    setCurrency(detectedCurrency);
                    localStorage.setItem('trashdrop_currency', JSON.stringify(detectedCurrency));
                  } else {
                    logger.debug('[Currency] ✅ Currency unchanged, keeping current');
                  }
                } catch (currencyError) {
                  // Only log occasionally and with meaningful messages
                  if (Math.random() < 0.05) {
                    logger.warn('[Currency] ⚠️ Currency detection failed - keeping current currency');
                  }
                  // Keep current currency - don't change anything
                }
              } catch (error) {
                clearTimeout(timeoutId);
                // Only log occasionally to prevent spam
                if (Math.random() < 0.05) {
                  logger.warn('[Currency] ⚠️ Background location processing failed - keeping current currency');
                }
                // Keep current currency - don't change anything
              }
            },
            (error) => {
              clearTimeout(timeoutId);
              // Only log geolocation errors once to reduce console spam
              if (!window.currencyGeoErrorLogged) {
                const errorMessages = {
                  1: 'Permission denied',
                  2: 'Position unavailable', 
                  3: 'Timeout'
                };
                logger.warn(`[Currency] 🚫 Background location failed (${errorMessages[error.code] || 'Unknown'}) - keeping current currency`);
                window.currencyGeoErrorLogged = true;
              }
              // Keep current currency - don't change anything
            },
            geolocationOptions
          );
        } else {
          logger.warn('[Currency] 🚫 Geolocation not supported - using current currency');
        }
      } catch (error) {
        logger.error('[Currency] 💥 Error in currency detection:', error);
        // Ensure we have a currency set even if everything fails
        if (!currency) {
          setCurrency(CURRENCY_MAP.GH);
        }
        setIsLoading(false);
      }
    };

    updateCurrencyFromLocation();
  }, []); // Empty dependency array - run only once

  // Manual currency override (could be used in settings)
  const setCurrencyOverride = (currencyCode) => {
    if (CURRENCY_MAP[currencyCode]) {
      setCurrency(CURRENCY_MAP[currencyCode]);
      localStorage.setItem('trashdrop_currency', JSON.stringify(CURRENCY_MAP[currencyCode]));
    }
  };

  return (
    <CurrencyContext.Provider value={{ 
      currency, 
      isLoading,
      setCurrencyOverride
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

// Custom hook for using the currency context
export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
