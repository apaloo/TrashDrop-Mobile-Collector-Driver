import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRCodeScanner = ({ onScanSuccess, onScanError }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    // Initialize scanner when component mounts
    if (!html5QrCodeRef.current && scannerRef.current) {
      html5QrCodeRef.current = new Html5Qrcode(scannerRef.current.id);
      
      startScanner();
    }

    // Clean up scanner when component unmounts
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop()
          .catch(err => console.error('Error stopping scanner:', err));
      }
    };
  }, []);

  const startScanner = () => {
    if (!html5QrCodeRef.current) return;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    html5QrCodeRef.current.start(
      { facingMode: "environment" }, // Use back camera
      config,
      (decodedText) => {
        // On successful scan
        console.log('QR Code detected:', decodedText);
        onScanSuccess(decodedText);
        
        // Stop scanning after successful detection
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop()
            .catch(err => console.error('Error stopping scanner after success:', err));
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
    ).catch(err => {
      console.error('Error starting scanner:', err);
      onScanError && onScanError('Failed to start camera: ' + err.message);
    });
  };

  return (
    <div className="qr-scanner-container">
      <div 
        id="qr-reader" 
        ref={scannerRef} 
        className="w-full bg-gray-100 rounded-lg overflow-hidden"
        style={{ minHeight: '300px' }}
      ></div>
      <p className="text-center text-sm text-gray-500 mt-2">
        Position QR code within the frame to scan
      </p>
    </div>
  );
};

export default QRCodeScanner;
