import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRCodeScanner = ({ onScanSuccess, onScanError, isWithinRange = true }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Track camera initialization status
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    // Initialize scanner when component mounts
    if (!html5QrCodeRef.current && scannerRef.current) {
      html5QrCodeRef.current = new Html5Qrcode(scannerRef.current.id);
      
      // Automatically start scanner if within range
      if (isWithinRange) {
        startScanner();
      }
    }

    // Clean up scanner when component unmounts
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop()
          .catch(err => console.error('Error stopping scanner:', err));
      }
    };
  }, [isWithinRange]);

  const [scannerActive, setScannerActive] = useState(false);

  const startScanner = () => {
    if (!html5QrCodeRef.current || !isWithinRange) return;

    setScannerActive(true);
    setCameraError('');
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      videoConstraints: {
        facingMode: "environment",
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 }
      }
    };

    html5QrCodeRef.current.start(
      { facingMode: "environment" }, // Use back camera
      config,
      (decodedText) => {
        // Validate QR code format - check if it's a TrashDrop QR code
        try {
          const qrData = JSON.parse(decodedText);
          if (qrData && qrData.source === 'trashdrop' && qrData.bagId) {
            // Valid TrashDrop QR code
            console.log('Valid TrashDrop QR Code detected:', qrData);
            onScanSuccess(decodedText);
            
            // Stop scanning after successful detection
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
              html5QrCodeRef.current.stop()
                .catch(err => console.error('Error stopping scanner after success:', err));
              setScannerActive(false);
            }
          } else {
            // Not a TrashDrop QR code
            console.error('Invalid QR code format: Not a TrashDrop QR code');
            onScanError && onScanError('Invalid QR code. Please scan a TrashDrop QR code.');
          }
        } catch (e) {
          // Not a valid JSON
          console.error('Invalid QR code format:', e);
          onScanError && onScanError('Invalid QR code format. Please scan a TrashDrop QR code.');
        }
      },
      
      (errorMessage) => {
        // Errors are common during scanning, only log critical ones
        if (errorMessage.includes('Camera access denied') || 
            errorMessage.includes('No camera')) {
          console.error('QR Code scan error:', errorMessage);
          onScanError && onScanError(errorMessage);
        }
      }
    ).then(() => {
      console.log('Camera started successfully');
      setCameraInitialized(true);
    }).catch(err => {
      console.error('Error starting scanner:', err);
      setCameraError('Failed to start camera: ' + err.message);
      setScannerActive(false);
      onScanError && onScanError('Failed to start camera: ' + err.message);
    });
  };

  // Manual scan button handler
  const handleManualScan = () => {
    if (!isWithinRange) {
      onScanError && onScanError('You must be within 50 meters of the pickup location to scan.');
      return;
    }
    
    if (!scannerActive) {
      startScanner();
    } else {
      // For demo purposes, simulate a successful scan when button is clicked
      // In a real app, this would just activate the scanner if it's not already active
      const demoQrData = {
        source: 'trashdrop',
        bagId: `bag-${Date.now()}`,
        type: 'organic',
        timestamp: new Date().toISOString()
      };
      onScanSuccess(JSON.stringify(demoQrData));
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
