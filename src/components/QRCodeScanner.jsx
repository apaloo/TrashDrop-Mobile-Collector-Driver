import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { logger } from '../utils/logger';

const QRCodeScanner = ({ onScanSuccess, onScanError, isWithinRange = true }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // State variables
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [scanStartTime, setScanStartTime] = useState(Date.now());

  // Cleanup function with safer DOM handling
  const cleanup = useCallback(async () => {
    logger.debug('🧹 Cleaning up QR scanner resources...');
    
    try {
      // First, stop any active scanning
      if (html5QrCodeRef.current?.isScanning) {
        logger.debug('🛑 Stopping active scanner');
        await html5QrCodeRef.current.stop();
      }

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

      // Clear the scanner instance
      if (html5QrCodeRef.current) {
        logger.debug('🗑️ Clearing scanner instance');
        try {
          await html5QrCodeRef.current.clear();
        } catch (clearErr) {
          logger.warn('⚠️ Error clearing scanner, continuing cleanup:', clearErr);
        }
        html5QrCodeRef.current = null;
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
      logger.error('❌ Error during scanner cleanup:', err);
      setCameraError('Error during cleanup: ' + err.message);
    }
  }, [setScanStartTime]);

  // Start the QR scanner
  const startScanner = useCallback(async () => {
    if (!scannerRef.current) {
      logger.warn('❌ Scanner container ref not ready');
      return;
    }

    try {
      // Clean up any existing scanner instance
      if (html5QrCodeRef.current?.isScanning) {
        logger.debug('🛑 Stopping existing scanner...');
        await cleanup();
      }

      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Initialize new scanner
      logger.debug('🎥 Initializing scanner...');
      html5QrCodeRef.current = new Html5Qrcode('qr-reader', {
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });

      // Configure camera with constraints
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
        videoConstraints: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        }
      };

      // Start scanning
      logger.debug('▶️ Starting QR scanner...');
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          logger.info('✅ QR code scanned:', decodedText);
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Only show errors when scanner is active (not during initialization)
          if (scannerActive) {
            logger.error('❌ QR Scanner Error:', errorMessage);
            onScanError(errorMessage);
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
      // Force remount on error
      setScanStartTime(Date.now());
    }
  }, [onScanSuccess, onScanError, cleanup]);

  // Initialize scanner when component mounts
  useEffect(() => {
    let mounted = true;
    let timeoutId;
    logger.debug('🎥 QR Scanner component mounted, isWithinRange:', isWithinRange);

    const initializeScanner = async () => {
      if (!mounted) {
        logger.debug('🛑 Component not mounted, skipping initialization');
        return;
      }

      // Reset scan start time to force remount of scanner container
      const newStartTime = Date.now();
      setScanStartTime(newStartTime);
      
      // Always cleanup first
      logger.debug('🧹 Running cleanup before initialization...');
      await cleanup();

      // Wait for scanner container to be ready
      if (!scannerRef.current) {
        logger.error('❌ Scanner container ref not ready');
        setCameraError('Scanner initialization failed: container not ready');
        return;
      }

      try {
        // Small delay to ensure DOM is ready after cleanup
        timeoutId = setTimeout(async () => {
          try {
            if (!mounted) return;
            await startScanner();
          } catch (err) {
            if (mounted) {
              logger.error('❌ Scanner initialization error:', err);
              setCameraError('Failed to initialize scanner');
            }
          }
        }, 1000);
      } catch (err) {
        if (mounted) {
          logger.error('❌ Scanner initialization error:', err);
          setCameraError('Failed to initialize scanner');
        }
      }
    };

    initializeScanner();

    // Clean up scanner when component unmounts
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      logger.debug('📤 QR Scanner component unmounting');
      cleanup();
    };
  }, [isWithinRange, cleanup, startScanner]);

  // Manual scan button handler
  const handleManualScan = () => {
    if (!isWithinRange) {
      onScanError && onScanError('You must be within 50 meters of the pickup location to scan.');
      return;
    }
    
    if (!scannerActive) {
      startScanner();
    } else if (process.env.NODE_ENV === 'development') {
      // For development testing only: simulate a successful scan
      const demoQrData = {
        source: 'trashdrop',
        bagId: `bag-${Date.now().toString().slice(-6)}`,
        type: 'plastic',
        timestamp: new Date().toISOString()
      };
      logger.debug('DEV MODE: Simulating QR code scan:', demoQrData);
      onScanSuccess && onScanSuccess(JSON.stringify(demoQrData));
    }
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

      {/* Scan Button */}
      <button
        onClick={handleManualScan}
        disabled={!isWithinRange}
        className={`w-full py-3 mt-4 rounded-lg flex items-center justify-center text-white transition-colors ${isWithinRange 
          ? 'bg-green-500 hover:bg-green-600' 
          : 'bg-gray-400 cursor-not-allowed'}`}
      >
        {cameraError ? 'Retry Camera Access' : isWithinRange ? (scannerActive ? 'Scanning...' : 'Scan Now') : 'Too Far From Pickup Location'}
      </button>
    </div>
  );
};

export default QRCodeScanner;
