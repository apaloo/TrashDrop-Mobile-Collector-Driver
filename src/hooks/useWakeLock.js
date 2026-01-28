import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useWakeLock - Keeps the screen on during navigation
 * 
 * Uses the Screen Wake Lock API (modern browsers) with video fallback for iOS/older browsers.
 * Auto-releases when component unmounts or when manually disabled.
 */
const useWakeLock = (autoEnable = false) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const wakeLockRef = useRef(null);
  const videoRef = useRef(null);
  const hasLoggedRef = useRef(false);

  // Check if Wake Lock API is supported
  useEffect(() => {
    const supported = 'wakeLock' in navigator;
    setIsSupported(supported);
    
    if (!hasLoggedRef.current) {
      if (supported) {
        console.log('🔆 Wake Lock API supported');
      } else {
        console.log('🔆 Wake Lock API not supported - using video fallback');
      }
      hasLoggedRef.current = true;
    }
  }, []);

  // Create hidden video element for fallback (iOS/older browsers)
  const createVideoFallback = useCallback(() => {
    if (videoRef.current) return videoRef.current;

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.style.position = 'absolute';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    
    // Tiny base64 encoded video that loops silently
    video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA3RtZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjY0MyA1YzY1NzA0IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAA3//728P4FNjuZQQAAAu5tb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAZAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACGHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAgAAAAIAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAGQAAAAAAAEAAAAAAZBtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAEAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAE7bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA+3N0YmwAAACXc3RzZAAAAAAAAAABAAAAh2F2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAACAAIASAAAAEgAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABj//wAAADFhdmNDAWQAFf/hABhnZAAVrNlBsJaEAAADAAQAAAMACg8WLZYBAAZo6+PLIsAAAAAYc3R0cwAAAAAAAAABAAAAAQAABAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAA';
    
    document.body.appendChild(video);
    videoRef.current = video;
    
    return video;
  }, []);

  // Enable wake lock
  const enable = useCallback(async () => {
    if (isEnabled) return true;

    try {
      // Try native Wake Lock API first
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          
          wakeLockRef.current.addEventListener('release', () => {
            console.log('🔆 Wake Lock released');
            setIsEnabled(false);
          });
          
          setIsEnabled(true);
          console.log('🔆 Wake Lock enabled - screen will stay on');
          return true;
        } catch (err) {
          console.warn('🔆 Wake Lock API failed, using fallback:', err.message);
        }
      }

      // Fallback: Use video loop for iOS/older browsers
      const video = createVideoFallback();
      await video.play();
      setIsEnabled(true);
      console.log('🔆 Wake Lock enabled (video fallback) - screen will stay on');
      return true;
      
    } catch (err) {
      console.error('🔆 Failed to enable wake lock:', err);
      return false;
    }
  }, [isEnabled, createVideoFallback]);

  // Disable wake lock
  const disable = useCallback(async () => {
    if (!isEnabled) return;

    try {
      // Release native Wake Lock
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }

      // Stop video fallback
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
        videoRef.current = null;
      }

      setIsEnabled(false);
      console.log('🔆 Wake Lock disabled - screen can sleep');
    } catch (err) {
      console.error('🔆 Failed to disable wake lock:', err);
    }
  }, [isEnabled]);

  // Toggle wake lock
  const toggle = useCallback(async () => {
    if (isEnabled) {
      await disable();
    } else {
      await enable();
    }
  }, [isEnabled, enable, disable]);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isEnabled && !wakeLockRef.current) {
        // Re-acquire wake lock when tab becomes visible
        if ('wakeLock' in navigator) {
          try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            console.log('🔆 Wake Lock re-acquired after visibility change');
          } catch (err) {
            console.warn('🔆 Failed to re-acquire wake lock:', err.message);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isEnabled]);

  // Auto-enable on mount if requested
  useEffect(() => {
    if (autoEnable) {
      enable();
    }
  }, [autoEnable, enable]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, []);

  return {
    isEnabled,
    isSupported,
    enable,
    disable,
    toggle
  };
};

export default useWakeLock;
