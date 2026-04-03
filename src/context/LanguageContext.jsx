import { createContext, useState, useContext, useCallback, useEffect } from 'react';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguageByCode,
  getBcp47,
  getSavedLanguage,
  saveLanguage,
  LANGUAGE_STORAGE_KEY
} from '../config/languageConfig';
import { getPhrase, translateNavInstruction } from '../locales/navigationPhrases';
import { logger } from '../utils/logger';
import { audioAlertService } from '../services/audioAlertService';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getSavedLanguage);

  // Sync from localStorage on mount (in case another tab changed it)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === LANGUAGE_STORAGE_KEY && e.newValue) {
        setLanguageState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Change language and persist
  const setLanguage = useCallback((code) => {
    const langObj = getLanguageByCode(code);
    if (!langObj) {
      logger.warn(`Unsupported language code: ${code}, falling back to ${DEFAULT_LANGUAGE}`);
      return;
    }
    logger.info(`🌍 Language changed to: ${langObj.label} (${code})`);
    setLanguageState(code);
    saveLanguage(code);
    // Keep audioAlertService in sync
    audioAlertService.setLanguage(code);
  }, []);

  // Convenience: get a navigation phrase in the current language
  const t = useCallback((key, vars = {}) => {
    return getPhrase(key, language, vars);
  }, [language]);

  // Convenience: translate a Google Maps navigation step
  const translateStep = useCallback((step) => {
    return translateNavInstruction(step, language);
  }, [language]);

  // Current language metadata
  const currentLanguage = getLanguageByCode(language);
  const bcp47 = getBcp47(language);

  const value = {
    language,               // current code e.g. 'tw'
    setLanguage,            // change language
    currentLanguage,        // full language object
    bcp47,                  // BCP-47 tag for Web Speech API
    supportedLanguages: SUPPORTED_LANGUAGES,
    t,                      // translate phrase key
    translateStep,          // translate nav step
    getPhrase: (key, vars) => getPhrase(key, language, vars)
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
