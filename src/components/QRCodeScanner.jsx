import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRCodeScanner = ({ onScanSuccess, onScanError, isWithinRange = true }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // State variables
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);

  // Initialize scanner when component mounts
  useEffect(() => {
    console.log('QR Scanner component mounted, isWithinRange:', isWithinRange);

    const initializeScanner = async () => {
      if (!scannerRef.current) {
        console.error('Scanner ref not ready');
        return;
      }

      try {
        // Generate a unique ID for the scanner element
        const scannerId = `qr-reader-${Date.now()}`;
        scannerRef.current.id = scannerId;

        // Create a new instance with the container ID
        if (html5QrCodeRef.current) {
          await html5QrCodeRef.current.clear();
        }
        html5QrCodeRef.current = new Html5Qrcode(scannerId);
        console.log('Html5Qrcode instance created');

        // Auto-start if within range
        if (isWithinRange) {
          console.log('Within range, auto-starting scanner');
          // Request camera permission first
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop()); // Release camera immediately
            console.log('Camera permission granted');
            // Small timeout to ensure DOM is fully ready
            setTimeout(() => startScanner(), 500);
          } catch (err) {
            console.error('Camera permission error:', err);
            setCameraError('Camera access denied. Please grant camera permissions.');
          }
        }
      } catch (err) {
        console.error('Scanner initialization error:', err);
        setCameraError('Failed to initialize scanner');
      }
    };

    initializeScanner();

    // Clean up scanner when component unmounts
    return () => {
      console.log('QR Scanner component unmounting, cleaning up resources');
      const cleanup = async () => {
        if (html5QrCodeRef.current) {
          try {
            if (html5QrCodeRef.current.isScanning) {
              console.log('Stopping active scanner');
              await html5QrCodeRef.current.stop();
            }
            console.log('Clearing scanner instance');
            await html5QrCodeRef.current.clear();
            html5QrCodeRef.current = null;
          } catch (err) {
            console.error('Error during scanner cleanup:', err);
          }
        }
        // Reset all states
        setCameraInitialized(false);
        setScannerActive(false);
        setCameraError('');
      };
      cleanup();
    };
  }, [isWithinRange]);

  // Process successful scan
  const handleScanSuccess = (decodedText) => {
    console.log('QR scan detected:', decodedText);
    
    try {
      // Parse and validate the QR data
      const qrData = JSON.parse(decodedText);
      if (qrData && qrData.source === 'trashdrop' && qrData.bagId) {
        // Valid TrashDrop QR code found
        console.log('Valid TrashDrop QR code detected:', qrData);
        
        // Call success handler
        onScanSuccess && onScanSuccess(decodedText);
        
        // Stop scanning after successful detection
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          console.log('Stopping scanner after successful scan');
          html5QrCodeRef.current.stop()
            .catch(err => console.error('Error stopping scanner after success:', err));
          setScannerActive(false);
        }
      } else {
        // Not a valid TrashDrop QR code
        console.error('Invalid QR code format: Not a TrashDrop QR code');
        onScanError && onScanError('Invalid QR code. Please scan a TrashDrop QR code.');
      }
    } catch (err) {
      // Not a valid JSON
      console.error('Invalid QR code format (not JSON):', err);
      onScanError && onScanError('Invalid QR code format. Please scan a TrashDrop QR code.');
    }
  };

  // Start the QR scanner
  const startScanner = async () => {
    console.log('Starting QR scanner...');
    
    if (!html5QrCodeRef.current) {
      console.error('QR scanner not initialized');
      setCameraError('QR scanner not initialized');
      return;
    }
    
    if (!isWithinRange) {
      console.log('Not within range, cannot start scanner');
      onScanError && onScanError('You must be within range of the pickup location to scan.');
      return;
    }
    
    if (html5QrCodeRef.current.isScanning) {
      console.log('Scanner already running');
      return;
    }

    // Request camera permissions first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Release camera immediately
      console.log('Camera permission granted');
    } catch (err) {
      console.error('Camera permission denied:', err);
      setCameraError('Camera access denied. Please grant camera permissions.');
      return;
    }

    // Reset error state and set scanner active
    setCameraError('');
    setScannerActive(true);

    try {
      // Explicitly request camera permission first
      console.log('Requesting camera permissions...');
      try {
        await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        console.log('Camera permission granted');
      } catch (permissionErr) {
        console.error('Camera permission denied:', permissionErr);
        setCameraError(`Camera permission denied: ${permissionErr.message}`);
        setScannerActive(false);
        return;
      }
      
      // Configure scanner
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        videoConstraints: {
          facingMode: "environment", // Use back camera
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        }
      };

      console.log('Starting scanner with config:', config);
      
      // Start the scanner
      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText) => handleScanSuccess(decodedText),
        (errorMessage) => {
          // Only show errors when scanner is active (not during initialization)
          if (scannerActive) {
            console.error('QR Scanner Error:', errorMessage);
          }
        }
      );

      console.log('QR scanner started successfully');
      setCameraInitialized(true);
    } catch (err) {
      console.error('Failed to start scanner:', err);
      setCameraError(`Camera error: ${err.message || 'Could not access camera'}`);
      setScannerActive(false);
    }
  };

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
      console.log('DEV MODE: Simulating QR code scan:', demoQrData);
      onScanSuccess && onScanSuccess(JSON.stringify(demoQrData));
    }
  };

  return (
    <div className="qr-scanner-container">
      <div 
        id="qr-reader" 
        ref={scannerRef} 
        className="w-full bg-black rounded-lg overflow-hidden relative"
        style={{ minHeight: '300px' }}
      >
        {!scannerActive && !cameraInitialized && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <svg className="animate-spin h-10 w-10 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Initializing camera...</p>
            </div>
          </div>
        )}
        
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-100">
            <div className="text-center text-red-600 p-4">
              <svg className="h-10 w-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p>{cameraError}</p>
              <p className="mt-2 text-sm">Please ensure camera permissions are granted and try again.</p>
            </div>
          </div>
        )}
      </div>
      
      <p className="text-center text-sm text-gray-500 mt-2">
        Position QR code within the frame to scan
      </p>
      
      {/* Scan Now Button */}
      <button 
        onClick={handleManualScan}
        disabled={!isWithinRange}
        className={`w-full py-3 mt-4 rounded-lg flex items-center justify-center text-white ${isWithinRange 
          ? 'bg-green-500 hover:bg-green-600 transition-colors' 
          : 'bg-gray-400 cursor-not-allowed'}`}
      >
        {cameraError ? 'Retry Camera Access' : isWithinRange ? (scannerActive ? 'Scanning...' : 'Scan Now') : 'Too Far From Pickup Location'}
      </button>
    </div>
  );
};

export default QRCodeScanner;
