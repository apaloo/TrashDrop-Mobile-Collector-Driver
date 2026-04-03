/**
 * Language Configuration for TrashDrop Collector App
 * 
 * Supported languages for voice navigation based on Ghana's major languages.
 * Aligned with Google WAXAL dataset language codes for future TTS model integration.
 * 
 * Language choice is independent of work region — a collector in Greater Accra
 * may speak Ewe, Dagbani, or any other language.
 */

// All supported voice navigation languages
export const SUPPORTED_LANGUAGES = [
  {
    code: 'tw',
    label: 'Twi (Akan)',
    nativeLabel: 'Twi',
    bcp47: 'ak-GH',
    waxalCode: 'aka',
    flag: '🇬🇭',
    description: 'Ashanti Twi'
  },
  {
    code: 'fan',
    label: 'Fante (Akan)',
    nativeLabel: 'Fante',
    bcp47: 'ak-GH',
    waxalCode: 'aka',
    flag: '🇬🇭',
    description: 'Central/Western Fante'
  },
  {
    code: 'ee',
    label: 'Ewe',
    nativeLabel: 'Eʋegbe',
    bcp47: 'ee-GH',
    waxalCode: 'ewe',
    flag: '🇬🇭',
    description: 'Volta / Greater Accra'
  },
  {
    code: 'dag',
    label: 'Dagbani',
    nativeLabel: 'Dagbanli',
    bcp47: 'dag-GH',
    waxalCode: 'dag',
    flag: '🇬🇭',
    description: 'Northern Ghana'
  },
  {
    code: 'gaa',
    label: 'Ga',
    nativeLabel: 'Gã',
    bcp47: 'gaa-GH',
    waxalCode: 'gaa',
    flag: '🇬🇭',
    description: 'Greater Accra'
  },
  {
    code: 'ha',
    label: 'Hausa',
    nativeLabel: 'Hausa',
    bcp47: 'ha-GH',
    waxalCode: 'hau',
    flag: '🇬🇭',
    description: 'Northern / Zongo communities'
  },
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    bcp47: 'en-GH',
    waxalCode: null,
    flag: '🇬🇧',
    description: 'Official language'
  }
];

// Default language
export const DEFAULT_LANGUAGE = 'tw';

// Quick lookup by code
export const getLanguageByCode = (code) =>
  SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES.find(l => l.code === 'en');

// Get BCP-47 tag for Web Speech API
export const getBcp47 = (code) => getLanguageByCode(code)?.bcp47 || 'en-GH';

// Get display label (e.g. "Twi (Akan)")
export const getLanguageLabel = (code) => getLanguageByCode(code)?.label || 'English';

// Get native label (e.g. "Twi")
export const getNativeLabel = (code) => getLanguageByCode(code)?.nativeLabel || 'English';

// localStorage key
export const LANGUAGE_STORAGE_KEY = 'preferred_language';

// Read saved preference (localStorage first, then default)
export const getSavedLanguage = () =>
  localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_LANGUAGE;

// Persist preference
export const saveLanguage = (code) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
};
