import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { logger } from '../utils/logger';

const QRCodeScanner = ({ onScanSuccess, onScanError, isWithinRange = true }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Stable refs for props — avoids re-triggering useEffect on every parent render
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);
  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { onScanErrorRef.current = onScanError; }, [onScanError]);

  // Mutex: prevents concurrent stop() calls on the same Html5Qrcode instance
  const stoppingRef = useRef(false);

  // State variables
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [scanStartTime, setScanStartTime] = useState(Date.now());
  const [isScanning, setIsScanning] = useState(false);

  // Debug log geofence state changes
  useEffect(() => {
    logger.debug('🎯 QR Scanner geofence state changed - isWithinRange:', isWithinRange);
  }, [isWithinRange]);

  // ── Safe stop: serialises stop() calls so only one is in-flight at a time ──
  const safeStop = useCallback(async (instance) => {
    if (!instance) return;
    if (stoppingRef.current) {
      // Another stop is already in-flight — wait for it to finish
      logger.debug('⏳ Waiting for in-flight scanner stop...');
      let waited = 0;
      while (stoppingRef.current && waited < 2000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }
      return; // The other stop already did the work
    }
    if (!instance.isScanning) return;
    stoppingRef.current = true;
    try {
      logger.debug('🛑 Stopping active scanner');
      await instance.stop();
    } catch (err) {
      if (err?.message?.includes('transition')) {
        logger.warn('⚠️ Scanner stop skipped (already transitioning)');
        await new Promise(r => setTimeout(r, 300));
      } else {
        logger.error('❌ Error stopping scanner:', err);
      }
    } finally {
      stoppingRef.current = false;
    }
  }, []);

  // ── Cleanup: tear down scanner + release camera ──
  const cleanup = useCallback(async () => {
    logger.debug('🧹 Cleaning up QR scanner resources...');

    // Capture & null-out the instance atomically so a concurrent cleanup
    // (e.g. unmount + new mount running at the same time) sees null and skips.
    const instance = html5QrCodeRef.current;
    html5QrCodeRef.current = null;

    try {
      await safeStop(instance);

      // Release camera stream if it exists
      if (scannerRef.current) {
        const videoElements = scannerRef.current.getElementsByTagName('video');
        for (const video of Array.from(videoElements)) {
          if (video.srcObject) {
            const stream = video.srcObject;
            if (stream instanceof MediaStream) {
              stream.getTracks().forEach(track => {
                track.stop();
                logger.debug('📷 Stopped camera track:', track.label);
              });
            }
            video.srcObject = null;
          }
        }
      }

      // Clear the captured scanner instance
      if (instance) {
        logger.debug('🗑️ Clearing scanner instance');
        try {
          await instance.clear();
        } catch (clearErr) {
          logger.warn('⚠️ Error clearing scanner, continuing cleanup:', clearErr);
        }
      }

      // Remove any existing scanner elements
      const existingScanner = document.getElementById('qr-reader');
      if (existingScanner) {
        existingScanner.innerHTML = '';
      }

      // Reset state
      setScannerActive(false);
      setCameraInitialized(false);
      setCameraError('');
      logger.debug('✅ Cleanup completed successfully');
    } catch (err) {
      // Non-fatal — scanner lifecycle errors during cleanup should not block the UI
      logger.warn('⚠️ Error during scanner cleanup:', err?.message || err);
    }
  }, [safeStop]);

  // ── Start scanner ──
  const startScanner = useCallback(async () => {
    if (!scannerRef.current) {
      logger.warn('❌ Scanner container ref not ready');
      return;
    }

    try {
      // Clean up any existing scanner instance
      await cleanup();

      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!scannerRef.current) {
        logger.warn('⚠️ Scanner ref lost after cleanup');
        return;
      }

      // Initialize new scanner
      logger.debug('🎥 Initializing scanner...');
      html5QrCodeRef.current = new Html5Qrcode('qr-reader', {
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });

      // Configure camera with optimized constraints for QR scanning
      const config = {
        fps: 20, // Increased for better detection
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
        disableFlip: false, // Allow flipping for better detection
        videoConstraints: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        },
        // Improved QR detection
        formatsToSupport: [0], // QR_CODE only
        supportedScanTypes: [0] // QR_CODE only
      };

      // Start scanning
      logger.debug('▶️ Starting QR scanner...');
      setIsScanning(true);
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        async (decodedText) => {
          logger.info('✅ QR code successfully scanned:', decodedText);
          setIsScanning(false);
          
          // Stop scanner immediately to prevent duplicate scans
          await safeStop(html5QrCodeRef.current);
          setScannerActive(false);
          logger.debug('🛑 Scanner stopped after successful scan');
          
          // Call success handler via ref (always latest)
          onScanSuccessRef.current?.(decodedText);
        },
        (errorMessage) => {
          // Silently ignore scanning errors (they're just "no QR found" messages)
          // These are expected - camera is scanning but no QR code is in view
          // Only report to error handler for actual failures, not parse attempts
          if (errorMessage && 
              !errorMessage.includes('No barcode') && 
              !errorMessage.includes('No MultiFormat') &&
              !errorMessage.includes('QR code parse error')) {
            onScanErrorRef.current?.(errorMessage);
          }
        }
      );

      setScannerActive(true);
      setCameraInitialized(true);
      logger.debug('✅ Scanner started successfully');
    } catch (err) {
      logger.error('❌ Error starting scanner:', err);
      setCameraError(err.message);
      setScannerActive(false);
    }
  }, [cleanup, safeStop]);

  // ── Main lifecycle: only re-runs when isWithinRange changes ──
  useEffect(() => {
    let mounted = true;
    let timeoutId;
    logger.debug('🎥 QR Scanner component mounted, isWithinRange:', isWithinRange);

    const initializeScanner = async () => {
      if (!mounted) {
        logger.debug('🛑 Component not mounted, skipping initialization');
        return;
      }

      // Always cleanup first
      logger.debug('🧹 Running cleanup before initialization...');
      await cleanup();

      // Re-check mounted after async cleanup — component may have unmounted while awaiting
      if (!mounted) {
        logger.debug('🛑 Component unmounted during cleanup, aborting initialization');
        return;
      }

      // Wait for scanner container to be ready
      if (!scannerRef.current) {
        logger.warn('⚠️ Scanner container ref not ready after cleanup, waiting...');
        await new Promise(r => setTimeout(r, 300));
        if (!mounted || !scannerRef.current) {
          logger.error('❌ Scanner container ref still not ready');
          return;
        }
      }

      // Small delay to ensure DOM is ready after cleanup
      timeoutId = setTimeout(async () => {
        if (!mounted) return;
        try {
          await startScanner();
        } catch (err) {
          if (mounted) {
            logger.error('❌ Scanner initialization error:', err);
            setCameraError('Failed to initialize scanner');
          }
        }
      }, 500);
    };

    initializeScanner();

    // Clean up scanner when component unmounts
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      logger.debug('📤 QR Scanner component unmounting');
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWithinRange]);

  // Manual retry button handler
  const handleRetryScanner = () => {
    logger.debug('🔄 Retrying scanner initialization...');
    setCameraError('');
    setScanStartTime(Date.now());
  };

  return (
    <div className="qr-scanner-container relative">
      {/* Scanner container with key for forced remount */}
      {!cameraError && (
        <div
          key={`scanner-${scanStartTime}`}
          ref={scannerRef}
          id="qr-reader"
          className="w-full max-w-[600px] mx-auto relative bg-black rounded-lg overflow-hidden"
          style={{ minHeight: '300px' }}
        />
      )}

      {/* Loading State */}
      {!scannerActive && !cameraInitialized && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-center text-white">
            <svg className="animate-spin h-10 w-10 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p>Initializing camera...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100 rounded-lg">
          <div className="text-center text-red-600 p-4">
            <svg className="h-10 w-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p>{cameraError}</p>
            <p className="mt-2 text-sm">Please ensure camera permissions are granted and try again.</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <p className="text-center text-sm text-gray-500 mt-4">
        Position QR code within the frame to scan
      </p>

      {/* Status Button */}
      {!isWithinRange && (
        <div className="w-full py-3 mt-4 rounded-lg flex items-center justify-center bg-gray-400 text-white">
          Too Far From Pickup Location
        </div>
      )}
      
      {isWithinRange && cameraError && (
        <button
          onClick={handleRetryScanner}
          className="w-full py-3 mt-4 rounded-lg flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          Retry Camera Access
        </button>
      )}
      
      {isWithinRange && !cameraError && scannerActive && (
        <div className="w-full py-3 mt-4 rounded-lg flex items-center justify-center bg-green-500 text-white">
          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Scanning...
        </div>
      )}
    </div>
  );
};

export default QRCodeScanner;
