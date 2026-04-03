/**
 * Audio Alert Service
 * Provides loud audio alerts and vibration for driving safety
 * Used for arrival notifications and critical alerts
 */

import { logger } from '../utils/logger';
import { getSavedLanguage, getBcp47 } from '../config/languageConfig';
import { getPhrase, translateNavInstruction } from '../locales/navigationPhrases';

class AudioAlertService {
  constructor() {
    this.audioContext = null;
    this.isInitialized = false;
    this.arrivalSound = null;
    this.alertSound = null;
    this.isSpeaking = false;
    this.currentLanguage = getSavedLanguage();
    
    // TTS settings for driving
    this.ttsSettings = {
      rate: 0.85,      // Slower for clarity while driving
      pitch: 1.1,      // Slightly higher pitch for attention
      volume: 1.0      // Maximum volume
    };
    
    // Vibration patterns (in milliseconds)
    this.vibrationPatterns = {
      arrival: [300, 100, 300, 100, 500],      // Strong pattern for arrival
      alert: [200, 100, 200],                   // Quick alert
      urgent: [500, 200, 500, 200, 500, 200, 500] // Urgent/repeated
    };
  }

  /**
   * Initialize the audio service (must be called after user interaction)
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Create AudioContext for sound effects
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume AudioContext if suspended (required by browsers)
      if (this.audioContext.state === 'suspended') {
        // Don't auto-resume - wait for user interaction
        logger.warn('AudioContext suspended - waiting for user interaction');
        return false;
      }

      // Pre-generate arrival sound
      this.arrivalSound = this.createArrivalTone();
      this.alertSound = this.createAlertTone();

      this.isInitialized = true;
      logger.info('🔊 Audio alert service initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize audio service:', error);
      return false;
    }
  }

  /**
   * Resume AudioContext on user interaction
   * Call this when user interacts with the page (click, tap, etc.)
   */
  async resumeOnUserInteraction() {
    if (!this.audioContext) {
      return await this.initialize();
    }
    
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        logger.info('🔊 AudioContext resumed on user interaction');
        
        // Complete initialization if not already done
        if (!this.isInitialized) {
          this.arrivalSound = this.createArrivalTone();
          this.alertSound = this.createAlertTone();
          this.isInitialized = true;
          logger.info('🔊 Audio alert service fully initialized');
        }
        return true;
      } catch (error) {
        logger.error('Failed to resume AudioContext:', error);
        return false;
      }
    }
    
    return this.isInitialized;
  }

  /**
   * Create arrival tone using Web Audio API
   * Creates a pleasant but attention-grabbing chime
   */
  createArrivalTone() {
    return () => {
      if (!this.audioContext) return;

      const now = this.audioContext.currentTime;
      
      // Create oscillators for a chord-like arrival sound
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 (C major chord)
      
      frequencies.forEach((freq, index) => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, now);
        oscillator.type = 'sine';
        
        // Stagger the notes slightly for arpeggio effect
        const startTime = now + (index * 0.1);
        const duration = 0.5;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });

      // Add a final higher note for emphasis
      setTimeout(() => {
        if (!this.audioContext) return;
        const finalOsc = this.audioContext.createOscillator();
        const finalGain = this.audioContext.createGain();
        
        finalOsc.connect(finalGain);
        finalGain.connect(this.audioContext.destination);
        
        finalOsc.frequency.setValueAtTime(1046.5, this.audioContext.currentTime); // C6
        finalOsc.type = 'sine';
        
        finalGain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        finalGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
        
        finalOsc.start();
        finalOsc.stop(this.audioContext.currentTime + 0.8);
      }, 400);
    };
  }

  /**
   * Create alert tone for general notifications
   */
  createAlertTone() {
    return () => {
      if (!this.audioContext) return;

      const now = this.audioContext.currentTime;
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Two-tone alert
      oscillator.frequency.setValueAtTime(880, now);      // A5
      oscillator.frequency.setValueAtTime(1100, now + 0.15); // ~C#6
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    };
  }

  /**
   * Vibrate the device
   * @param {string} pattern - 'arrival', 'alert', or 'urgent'
   */
  vibrate(pattern = 'alert') {
    if (!('vibrate' in navigator)) {
      logger.debug('Vibration API not supported');
      return false;
    }

    const vibrationPattern = this.vibrationPatterns[pattern] || this.vibrationPatterns.alert;
    
    try {
      navigator.vibrate(vibrationPattern);
      logger.debug(`📳 Vibration triggered: ${pattern}`);
      return true;
    } catch (error) {
      logger.error('Vibration failed:', error);
      return false;
    }
  }

  /**
   * Stop any ongoing vibration
   */
  stopVibration() {
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }

  /**
   * Set the active language for voice navigation
   * @param {string} langCode - Language code (e.g. 'tw', 'ee', 'dag', 'en')
   */
  setLanguage(langCode) {
    this.currentLanguage = langCode;
    logger.info(`🌍 Audio service language set to: ${langCode}`);
  }

  /**
   * Speak text using Text-to-Speech
   * @param {string} text - Text to speak
   * @param {Object} options - TTS options
   * @returns {Promise<boolean>} - Success status
   */
  speak(text, options = {}) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        logger.warn('Speech synthesis not supported');
        resolve(false);
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      this.isSpeaking = true;

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply settings
      utterance.rate = options.rate || this.ttsSettings.rate;
      utterance.pitch = options.pitch || this.ttsSettings.pitch;
      utterance.volume = options.volume || this.ttsSettings.volume;
      
      // Set language from current preference
      const lang = options.lang || this.currentLanguage || 'en';
      const bcp47 = getBcp47(lang);
      utterance.lang = bcp47;
      
      // Try to find a matching voice for the language
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = bcp47.split('-')[0]; // e.g. 'ak' from 'ak-GH'
      const preferredVoice = voices.find(v =>
        v.lang.startsWith(langPrefix) && (v.name.includes('Google') || v.name.includes('Enhanced'))
      ) || voices.find(v => v.lang.startsWith(langPrefix))
        || voices.find(v =>
          v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Enhanced'))
        ) || voices.find(v => v.lang.startsWith('en'));
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        resolve(true);
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        logger.error('Speech error:', event.error);
        resolve(false);
      };

      window.speechSynthesis.speak(utterance);
      logger.info(`🔊 Speaking [${lang}]:`, text);
    });
  }

  /**
   * Speak a translated navigation phrase
   * @param {string} phraseKey - Key from navigationPhrases (e.g. 'turn_left', 'you_have_arrived')
   * @param {Object} vars - Variable substitutions (e.g. { destination: 'Madina Market' })
   * @param {Object} options - TTS options
   * @returns {Promise<boolean>}
   */
  speakPhrase(phraseKey, vars = {}, options = {}) {
    const lang = options.lang || this.currentLanguage || 'en';
    const text = getPhrase(phraseKey, lang, vars);
    return this.speak(text, { ...options, lang });
  }

  /**
   * Stop any ongoing speech
   */
  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  /**
   * Play arrival alert with sound, vibration, and voice
   * @param {string} locationName - Name of the arrival location
   * @param {Object} options - Alert options
   */
  async announceArrival(locationName = 'your destination', options = {}) {
    const {
      playSound = true,
      vibrate = true,
      speak = true,
      repeat = false,
      repeatInterval = 10000 // 10 seconds
    } = options;

    logger.info('🎉 Announcing arrival at:', locationName);

    // Try to resume audio context on user interaction
    if (!this.isInitialized || this.audioContext?.state === 'suspended') {
      const resumed = await this.resumeOnUserInteraction();
      if (!resumed && playSound) {
        logger.warn('🔊 Audio not available - skipping sound');
        playSound = false;
      }
    }

    // Play arrival sound
    if (playSound && this.arrivalSound) {
      try {
        this.arrivalSound();
      } catch (error) {
        logger.warn('🔊 Failed to play arrival sound:', error);
      }
    }

    // Vibrate device
    if (vibrate) {
      this.vibrate('arrival');
    }

    // Voice announcement (after brief delay for sound)
    if (speak) {
      setTimeout(async () => {
        await this.speakPhrase('you_have_arrived', { destination: locationName }, {
          rate: 0.8,  // Even slower for arrival
          pitch: 1.0,
          volume: 1.0
        });

        // Repeat if no acknowledgment
        if (repeat && !this.arrivalAcknowledged) {
          this.repeatArrivalTimer = setTimeout(() => {
            if (!this.arrivalAcknowledged) {
              this.announceArrival(locationName, { ...options, repeat: true });
            }
          }, repeatInterval);
        }
      }, 800); // Wait for chime to finish
    }
  }

  /**
   * Acknowledge arrival to stop repeat announcements
   */
  acknowledgeArrival() {
    this.arrivalAcknowledged = true;
    if (this.repeatArrivalTimer) {
      clearTimeout(this.repeatArrivalTimer);
      this.repeatArrivalTimer = null;
    }
    this.stopSpeaking();
    this.stopVibration();
    logger.debug('✅ Arrival acknowledged');
  }

  /**
   * Reset arrival state for new navigation
   */
  resetArrivalState() {
    this.arrivalAcknowledged = false;
    if (this.repeatArrivalTimer) {
      clearTimeout(this.repeatArrivalTimer);
      this.repeatArrivalTimer = null;
    }
  }

  /**
   * Play a simple alert sound
   */
  playAlertSound() {
    if (!this.isInitialized) {
      this.initialize().then(() => {
        if (this.alertSound) this.alertSound();
      });
      return;
    }

    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().then(() => {
        if (this.alertSound) this.alertSound();
      });
      return;
    }

    if (this.alertSound) {
      this.alertSound();
    }
  }

  /**
   * Announce navigation instruction (for turn-by-turn)
   * @param {string|Object} instruction - Navigation instruction text or step object
   * @param {string} distance - Distance to maneuver
   */
  announceNavigation(instruction, distance) {
    if (!instruction) return;

    const lang = this.currentLanguage || 'en';

    // If instruction is a step object from Google Directions API, use localized translation
    if (typeof instruction === 'object' && instruction.maneuver !== undefined) {
      // If a separate distance was provided (e.g. proximity warning), override the step's distance
      const stepWithDistance = distance ? { ...instruction, distance } : instruction;
      const translated = translateNavInstruction(stepWithDistance, lang);
      this.speak(translated, { ...this.ttsSettings, lang });
      return;
    }

    // Clean HTML tags from raw instruction text
    const cleanText = (typeof instruction === 'string' ? instruction : '').replace(/<[^>]*>/g, '');
    
    // Build announcement
    let message = '';
    if (distance && distance !== '0 m' && distance !== '0 meters') {
      message = getPhrase('in_distance', lang, { distance, instruction: cleanText });
    } else {
      message = cleanText;
    }

    this.speak(message, { ...this.ttsSettings, lang });
  }

  /**
   * Play new request alert - attention-grabbing sound for incoming requests
   * Uses ascending tones to indicate opportunity/urgency
   */
  async playNewRequestAlert() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }

    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    
    // Create ascending arpeggio for "new opportunity" feel
    const frequencies = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    
    frequencies.forEach((freq, index) => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.setValueAtTime(freq, now);
      oscillator.type = 'triangle'; // Softer than sine but still clear
      
      const startTime = now + (index * 0.12);
      const duration = 0.25;
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    });

    // Add a final "ding" for emphasis
    setTimeout(() => {
      if (!this.audioContext) return;
      
      const finalOsc = this.audioContext.createOscillator();
      const finalGain = this.audioContext.createGain();
      
      finalOsc.connect(finalGain);
      finalGain.connect(this.audioContext.destination);
      
      finalOsc.frequency.setValueAtTime(1046.5, this.audioContext.currentTime); // C6
      finalOsc.type = 'sine';
      
      finalGain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
      finalGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.6);
      
      finalOsc.start();
      finalOsc.stop(this.audioContext.currentTime + 0.6);
    }, 500);

    logger.debug('🔔 New request alert sound played');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopSpeaking();
    this.stopVibration();
    
    if (this.repeatArrivalTimer) {
      clearTimeout(this.repeatArrivalTimer);
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
    logger.debug('🔇 Audio alert service destroyed');
  }
}

// Export singleton instance
export const audioAlertService = new AudioAlertService();
