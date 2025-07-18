import React, { createContext, useState, useEffect, useContext } from 'react';
import { getCurrencyFromCoordinates, CURRENCY_MAP } from '../utils/currencyUtils';

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

  // Update currency based on user location
  useEffect(() => {
    const updateCurrencyFromLocation = async () => {
      try {
        setIsLoading(true);
        
        // Get user's current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              const detectedCurrency = await getCurrencyFromCoordinates([latitude, longitude]);
              setCurrency(detectedCurrency);
              setIsLoading(false);
              
              // Store in local storage for offline use
              localStorage.setItem('trashdrop_currency', JSON.stringify(detectedCurrency));
            },
            (error) => {
              console.error('Error getting location:', error);
              // Try to get from localStorage if available
              const storedCurrency = localStorage.getItem('trashdrop_currency');
              if (storedCurrency) {
                setCurrency(JSON.parse(storedCurrency));
              }
              setIsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 3600000 } // 1 hour cache
          );
        } else {
          // Geolocation not supported
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error in currency detection:', error);
        setIsLoading(false);
      }
    };

    updateCurrencyFromLocation();
  }, []);

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
