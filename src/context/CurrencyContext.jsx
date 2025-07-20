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
        
        // First try to get from localStorage (cached value)
        const storedCurrency = localStorage.getItem('trashdrop_currency');
        if (storedCurrency) {
          console.log('[Currency] Using cached currency from localStorage');
          setCurrency(JSON.parse(storedCurrency));
        } else {
          console.log('[Currency] No cached currency found in localStorage');
        }
        
        // Then try to get fresh location if geolocation is available
        if (navigator.geolocation) {
          const geolocationOptions = {
            enableHighAccuracy: false, // Set to false to avoid network location provider errors
            timeout: 5000, // 5 seconds timeout
            maximumAge: 1000 * 60 * 60 // 1 hour cache
          };
          
          console.log('[Currency] Attempting to get current position...');
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                console.log('[Currency] Position obtained, detecting currency...');
                const { latitude, longitude } = position.coords;
                const detectedCurrency = await getCurrencyFromCoordinates([latitude, longitude]);
                console.log('[Currency] Detected currency:', detectedCurrency.code);
                setCurrency(detectedCurrency);
                // Store in local storage for offline use
                localStorage.setItem('trashdrop_currency', JSON.stringify(detectedCurrency));
                console.log('[Currency] Currency saved to localStorage');
              } catch (error) {
                console.warn('[Currency] Error processing location data:', error);
                // Continue with default or stored currency
              } finally {
                setIsLoading(false);
              }
            },
            (error) => {
              console.warn('Error getting location:', error.message);
              // If we have a stored currency, use it, otherwise use default
              if (!storedCurrency) {
                setCurrency(CURRENCY_MAP.GH); // Default to Ghana Cedi
              }
              setIsLoading(false);
            },
            geolocationOptions
          );
        } else {
          // Geolocation not supported
          console.warn('Geolocation is not supported by this browser');
          if (!storedCurrency) {
            setCurrency(CURRENCY_MAP.GH); // Default to Ghana Cedi
          }
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
