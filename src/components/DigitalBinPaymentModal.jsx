import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, CheckCircle, XCircle, QrCode, Trash2, ScanLine, PencilLine } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { logger } from '../utils/logger';
import { checkPaymentStatus } from '../services/paymentService';
import { supabase } from '../services/supabase';

/**
 * Digital Bin Payment Modal
 * 
 * Collects payment information from client after bin pickup.
 * Opens automatically after QR scan marks bin as 'picked_up'.
 * 
 * Each digital bin is a unique pickup request — one bin per scan.
 * The bin's QR code is verified during navigation to mark it as picked up.
 * Manual entry has been removed to ensure transparency and prevent fraud.
 * 
 * Payment modes:
 * - MoMo: Requires client MoMo number and network
 * - e-cash: Requires client e-cash number and network
 * - cash: No additional fields required
 * 
 * Persists until payment succeeds or user cancels.
 * Allows resubmission on payment failure.
 */
const DigitalBinPaymentModal = ({
  isOpen,
  onClose,
  digitalBinId,
  collectorId,
  onSubmit,
  initialScannedBags = [] // Array of { code, timestamp } from the bin QR scan
}) => {
  // Scanned bin state (1 bin per request)
  const [scannedBags, setScannedBags] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const scannerContainerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const scannerActiveRef = useRef(false);

  // Form state
  const [totalBill, setTotalBill] = useState('');
  const [billManuallyEdited, setBillManuallyEdited] = useState(false);
  const [autoCalculatedBill, setAutoCalculatedBill] = useState(0);
  const [isFetchingFees, setIsFetchingFees] = useState(false);
  const [paymentMode, setPaymentMode] = useState('momo');
  const [clientMomo, setClientMomo] = useState('');
  const [clientRSwitch, setClientRSwitch] = useState('mtn');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Payment processing state
  const [paymentId, setPaymentId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'pending', 'processing', 'success', 'failed'
  const [processingMessage, setProcessingMessage] = useState('');
  const [authorizationSteps, setAuthorizationSteps] = useState([]);
  const pollingIntervalRef = useRef(null);

  // Extract bin ID from QR text (handles URLs and plain IDs)
  const extractBagId = useCallback((text) => {
    if (!text) return text;
    const urlMatch = text.match(/\/bin\/([a-f0-9-]+)$/i);
    if (urlMatch) return urlMatch[1];
    const urlMatch2 = text.match(/\/bag\/([a-f0-9-]+)$/i);
    if (urlMatch2) return urlMatch2[1];
    return text.trim();
  }, []);

  // Fetch fee for the bin from digital_bins table
  const fetchBagFee = useCallback(async (bagId) => {
    try {
      const { data, error } = await supabase
        .from('digital_bins')
        .select('id, fee, collector_total_payout')
        .eq('id', bagId)
        .maybeSingle();

      if (error) {
        logger.warn('Could not fetch fee for bin:', bagId, error.message);
        return 0;
      }
      if (data) {
        const fee = parseFloat(data.fee) || parseFloat(data.collector_total_payout) || 0;
        logger.info('💰 Bin fee fetched:', bagId, '→', fee);
        return fee;
      }
      return 0;
    } catch (err) {
      logger.warn('Error fetching bin fee:', err);
      return 0;
    }
  }, []);

  // Reset form when modal opens, seed with initial scanned bin
  useEffect(() => {
    if (isOpen) {
      const initialBags = (initialScannedBags || []).map(bag => ({
        code: typeof bag === 'string' ? bag : bag.code,
        id: extractBagId(typeof bag === 'string' ? bag : bag.code),
        fee: null, // will be fetched
        timestamp: typeof bag === 'string' ? Date.now() : (bag.timestamp || Date.now())
      }));
      // Deduplicate by extracted ID (safety check)
      const seen = new Set();
      const uniqueBags = initialBags.filter(bag => {
        if (seen.has(bag.id)) return false;
        seen.add(bag.id);
        return true;
      });
      setScannedBags(uniqueBags.length > 0 ? uniqueBags : []);
      setShowScanner(false);
      setScannerError('');
      setDuplicateWarning('');
      setTotalBill('');
      setBillManuallyEdited(false);
      setAutoCalculatedBill(0);
      setIsFetchingFees(false);
      setPaymentMode('momo');
      setClientMomo('');
      setClientRSwitch('mtn');
      setErrors({});
      setPaymentId(null);
      setPaymentStatus(null);
      setProcessingMessage('');
      setAuthorizationSteps([]);

      // Fetch fee for the bin
      if (uniqueBags.length > 0) {
        setIsFetchingFees(true);
        Promise.all(
          uniqueBags.map(async (bag) => {
            const fee = await fetchBagFee(bag.id);
            return { ...bag, fee };
          })
        ).then((bagsWithFees) => {
          setScannedBags(bagsWithFees);
          const sum = bagsWithFees.reduce((acc, b) => acc + (b.fee || 0), 0);
          setAutoCalculatedBill(sum);
          setTotalBill(sum > 0 ? sum.toFixed(2) : '');
          setIsFetchingFees(false);
        }).catch(() => {
          setIsFetchingFees(false);
        });
      }
    }
  }, [isOpen, initialScannedBags, extractBagId, fetchBagFee]);

  // Poll payment status when payment is processing
  useEffect(() => {
    if (!paymentId || !paymentStatus || paymentStatus === 'success' || paymentStatus === 'failed') {
      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Start polling for payment status updates
    logger.info('Starting payment status polling for:', paymentId);
    
    const pollStatus = async () => {
      try {
        console.log('🔄 [PaymentModal] Polling status for paymentId:', paymentId);
        const result = await checkPaymentStatus(paymentId);
        
        console.log('🔄 [PaymentModal] Poll result:', { success: result.success, status: result.status, gateway_error: result.payment?.gateway_error });
        
        if (result.success) {
          setPaymentStatus(result.status);
          
          if (result.status === 'success') {
            console.log('✅ [PaymentModal] Payment SUCCESS via polling!');
            setProcessingMessage('Payment successful! 🎉');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setTimeout(() => {
              onClose();
            }, 2000);
          } else if (result.status === 'failed') {
            console.error('❌ [PaymentModal] Payment FAILED via polling:', result.payment?.gateway_error);
            setProcessingMessage('Payment failed. Please try again.');
            setErrors({ submit: result.payment?.gateway_error || 'Payment failed. Please try again.' });
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          } else if (result.status === 'processing') {
            console.log('⏳ [PaymentModal] Still processing...');
            setProcessingMessage('Processing payment... Please wait.');
          } else {
            console.log('🔄 [PaymentModal] Status:', result.status, '(still polling...)');
          }
        } else {
          console.warn('⚠️ [PaymentModal] Poll returned success=false:', result.error);
        }
      } catch (error) {
        console.error('❌ [PaymentModal] Poll error:', error.message);
      }
    };

    // Poll immediately, then every 3 seconds
    pollStatus();
    pollingIntervalRef.current = setInterval(pollStatus, 3000);

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [paymentId, paymentStatus, onClose]);

  // Cleanup inline scanner
  const cleanupScanner = useCallback(async () => {
    try {
      if (html5QrCodeRef.current?.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      if (html5QrCodeRef.current) {
        try { await html5QrCodeRef.current.clear(); } catch (e) { /* ignore */ }
        html5QrCodeRef.current = null;
      }
      scannerActiveRef.current = false;
    } catch (err) {
      logger.warn('Scanner cleanup error:', err);
    }
  }, []);

  // Start inline QR scanner for additional bags
  const startInlineScanner = useCallback(async () => {
    setScannerError('');
    setDuplicateWarning('');
    setShowScanner(true);

    // Wait for DOM element to be ready
    await new Promise(resolve => setTimeout(resolve, 300));

    const containerId = 'payment-qr-reader';
    const container = document.getElementById(containerId);
    if (!container) {
      setScannerError('Scanner container not found. Please try again.');
      return;
    }

    try {
      await cleanupScanner();
      html5QrCodeRef.current = new Html5Qrcode(containerId, {
        verbose: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      });

      const config = {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1,
        disableFlip: false,
        videoConstraints: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280 },
          height: { min: 480, ideal: 720 }
        },
        formatsToSupport: [0],
        supportedScanTypes: [0]
      };

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        async (decodedText) => {
          const bagId = extractBagId(decodedText);
          logger.info('📦 Bin QR scanned:', bagId);

          // Deduplication check (read current state synchronously)
          let isDuplicate = false;
          setScannedBags(prev => {
            const alreadyScanned = prev.some(b => b.id === bagId);
            if (alreadyScanned) {
              isDuplicate = true;
              logger.warn('⚠️ Duplicate bin QR detected:', bagId);
              setDuplicateWarning(`Bin already scanned: ${bagId.substring(0, 8)}...`);
              setTimeout(() => setDuplicateWarning(''), 3000);
              return prev;
            }
            setDuplicateWarning('');
            // Haptic feedback on successful new scan
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            // Add bin with fee=null initially (fee fetched below)
            return [...prev, { code: decodedText, id: bagId, fee: null, timestamp: Date.now() }];
          });

          // Fetch fee for the newly scanned bin (async, updates after)
          if (!isDuplicate) {
            fetchBagFee(bagId).then(fee => {
              setScannedBags(prev =>
                prev.map(b => b.id === bagId ? { ...b, fee } : b)
              );
              // Recalculate auto-sum
              setScannedBags(prev => {
                const sum = prev.reduce((acc, b) => acc + (b.fee || 0), 0);
                setAutoCalculatedBill(sum);
                // Only update totalBill if collector hasn't manually edited it
                setBillManuallyEdited(wasEdited => {
                  if (!wasEdited) {
                    setTotalBill(sum > 0 ? sum.toFixed(2) : '');
                  }
                  return wasEdited;
                });
                return prev;
              });
            });
          }

          // Stop scanner after scan
          try {
            if (html5QrCodeRef.current?.isScanning) {
              await html5QrCodeRef.current.stop();
              scannerActiveRef.current = false;
            }
          } catch (err) {
            logger.warn('Error stopping scanner after bin scan:', err);
          }
          setShowScanner(false);
        },
        (errorMessage) => {
          // Silently ignore "no QR found" messages
        }
      );
      scannerActiveRef.current = true;
    } catch (err) {
      logger.error('Error starting bin scanner:', err);
      setScannerError(err.message || 'Failed to start camera');
    }
  }, [extractBagId, cleanupScanner]);

  // Stop scanner when hiding or on unmount
  useEffect(() => {
    if (!showScanner) {
      cleanupScanner();
    }
  }, [showScanner, cleanupScanner]);

  useEffect(() => {
    return () => { cleanupScanner(); };
  }, [cleanupScanner]);

  // Remove a scanned bin and recalculate total
  const removeBag = useCallback((bagId) => {
    setScannedBags(prev => {
      const updated = prev.filter(b => b.id !== bagId);
      const sum = updated.reduce((acc, b) => acc + (b.fee || 0), 0);
      setAutoCalculatedBill(sum);
      // Only auto-update totalBill if collector hasn't manually edited
      setBillManuallyEdited(wasEdited => {
        if (!wasEdited) {
          setTotalBill(sum > 0 ? sum.toFixed(2) : '');
        }
        return wasEdited;
      });
      return updated;
    });
  }, []);

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (scannedBags.length < 1) {
      newErrors.bags = 'Bin must be scanned';
    }

    if (!totalBill || parseFloat(totalBill) <= 0) {
      newErrors.totalBill = 'Total bill must be greater than 0';
    }

    if ((paymentMode === 'momo' || paymentMode === 'e_cash') && !clientMomo) {
      newErrors.clientMomo = 'Client MoMo number is required';
    }

    if ((paymentMode === 'momo' || paymentMode === 'e_cash') && clientMomo) {
      // Basic Ghana phone validation (10 digits starting with 0)
      const phoneRegex = /^0\d{9}$/;
      if (!phoneRegex.test(clientMomo)) {
        newErrors.clientMomo = 'Invalid phone number (e.g., 0244123456)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      console.warn('📝 [PaymentModal] Validation failed:', errors);
      return;
    }

    setIsSubmitting(true);
    setErrors({}); // Clear previous errors

    try {
      const paymentData = {
        digitalBinId,
        collectorId,
        binsCollected: scannedBags.length,
        scannedBinIds: scannedBags.map(b => b.id),
        totalBill: parseFloat(totalBill),
        paymentMode,
        clientMomo: (paymentMode === 'momo' || paymentMode === 'e_cash') ? clientMomo : null,
        clientRSwitch: (paymentMode === 'momo' || paymentMode === 'e_cash') ? clientRSwitch : null
      };

      console.log('📝 [PaymentModal] === SUBMITTING PAYMENT ===');
      console.log('📝 [PaymentModal] paymentData:', JSON.stringify(paymentData, null, 2));
      console.log('📝 [PaymentModal] onSubmit function:', typeof onSubmit, onSubmit?.name || '(anonymous)');

      const result = await onSubmit(paymentData);

      console.log('📝 [PaymentModal] onSubmit result:', JSON.stringify(result, null, 2));

      // Capture payment ID and status from result
      if (result && result.paymentId) {
        console.log('📝 [PaymentModal] Setting paymentId:', result.paymentId, 'status:', result.status);
        setPaymentId(result.paymentId);
        setPaymentStatus(result.status);
        
        // Store authorization steps if available
        if (result.authorizationSteps && result.authorizationSteps.length > 0) {
          console.log('📋 [PaymentModal] Got authorizationSteps:', result.authorizationSteps);
          setAuthorizationSteps(result.authorizationSteps);
        }

        if (result.status === 'success') {
          // Cash payment - immediate success
          console.log('✅ [PaymentModal] Immediate success (cash)');
          setProcessingMessage('Payment successful! 🎉');
          setTimeout(() => {
            onClose();
          }, 2000);
        } else if (result.status === 'pending' || result.status === 'processing') {
          // MoMo/e-cash - start polling
          console.log('⏳ [PaymentModal] Status pending/processing — will poll...');
          setProcessingMessage('Awaiting client approval...');
        } else {
          console.warn('⚠️ [PaymentModal] Unexpected result status:', result.status);
        }
      } else {
        console.warn('⚠️ [PaymentModal] No paymentId in result:', result);
        if (result && !result.success) {
          setErrors({ submit: result.error || 'Payment failed' });
        }
      }
    } catch (error) {
      console.error('❌ [PaymentModal] Submit error:', error.message, error);
      setErrors({ submit: error.message || 'Failed to process payment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle retry after failure
  const handleRetry = () => {
    setPaymentId(null);
    setPaymentStatus(null);
    setProcessingMessage('');
    setAuthorizationSteps([]);
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
         style={{ paddingTop: '4rem', paddingBottom: '5rem' }}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-3 max-h-full overflow-y-auto">
        {/* Header — large, clear title */}
        <div className="flex items-center justify-between p-4 border-b bg-green-600 rounded-t-2xl">
          <h2 className="text-lg font-bold text-white">Collect Payment</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting || paymentStatus === 'pending' || paymentStatus === 'processing'}
            className="text-white/70 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed p-1"
            title={paymentStatus === 'pending' || paymentStatus === 'processing' ? 'Please wait for payment to complete' : 'Close'}
          >
            <X size={26} />
          </button>
        </div>

        {/* Payment Processing Status */}
        {paymentStatus && (
          <div className="p-4 border-b">
            <div className="flex items-center justify-center space-x-3">
              {paymentStatus === 'success' && (
                <>
                  <CheckCircle className="text-green-600" size={32} />
                  <span className="text-green-700 font-bold text-lg">{processingMessage}</span>
                </>
              )}
              {(paymentStatus === 'pending' || paymentStatus === 'processing') && (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-3">
                    <Loader2 className="text-blue-600 animate-spin" size={32} />
                    <span className="text-blue-700 font-bold text-base">{processingMessage}</span>
                  </div>
                  {authorizationSteps.length > 0 && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-left">
                      <p className="text-sm font-bold text-yellow-800 mb-2">📱 Tell client to approve on their phone:</p>
                      <ol className="space-y-1">
                        {authorizationSteps.map((step, i) => (
                          <li key={i} className="text-sm text-yellow-900 flex items-start gap-2">
                            <span className="font-bold text-yellow-700 flex-shrink-0">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
              {paymentStatus === 'failed' && (
                <>
                  <XCircle className="text-red-600" size={32} />
                  <span className="text-red-700 font-bold text-base">{processingMessage}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* ─── Scanned Bin Section ─── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">�️</span>
                <span className="text-base font-bold text-gray-800">
                  Bin: <span className="text-2xl text-green-700">{scannedBags.length > 0 ? '1' : '0'}</span>
                </span>
              </div>
            </div>

            {/* Scanned bin — shows fee */}
            {scannedBags.length > 0 && (
              <div className="space-y-2 mb-3">
                {scannedBags.slice(0, 1).map((bin) => (
                  <div
                    key={bin.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                      <span className="text-green-800 font-bold text-base">Bin 1</span>
                      {bin.fee !== null && bin.fee > 0 ? (
                        <span className="text-green-700 font-bold text-base ml-1">
                          GHS {bin.fee.toFixed(2)}
                        </span>
                      ) : bin.fee === null ? (
                        <Loader2 size={14} className="text-gray-400 animate-spin ml-1" />
                      ) : (
                        <span className="text-gray-400 text-sm ml-1">GHS 0.00</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Duplicate warning */}
            {duplicateWarning && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-yellow-50 border-2 border-yellow-400 rounded-xl text-base text-yellow-800 font-semibold animate-pulse">
                <span className="text-xl flex-shrink-0">⚠️</span>
                {duplicateWarning}
              </div>
            )}

            {/* Inline QR scanner */}
            {showScanner && (
              <div className="mt-3 rounded-xl overflow-hidden border-2 border-blue-400 bg-black">
                <div
                  id="payment-qr-reader"
                  className="w-full"
                  style={{ minHeight: '260px' }}
                />
                <div className="flex items-center justify-between p-3 bg-blue-50">
                  <p className="text-sm font-semibold text-blue-700">📸 Point at bin QR code</p>
                  <button
                    type="button"
                    onClick={() => setShowScanner(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-800 text-sm font-bold rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}

            {/* Scanner error */}
            {scannerError && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-base font-semibold text-red-600">{scannerError}</p>
                <button
                  type="button"
                  onClick={startInlineScanner}
                  className="mt-2 px-4 py-2 bg-blue-100 text-blue-700 text-sm font-bold rounded-lg"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Validation error for bags */}
            {errors.bags && (
              <p className="mt-1 text-base font-semibold text-red-600">{errors.bags}</p>
            )}
          </div>

          {/* ─── Total Bill ─── */}
          <div>
            <label className="flex items-center gap-2 text-base font-bold text-gray-800 mb-2">
              <span className="text-xl">💰</span>
              Total Bill (GHS)
            </label>
            {/* Auto-calculated hint */}
            {isFetchingFees && (
              <div className="flex items-center gap-2 mb-2 text-sm text-blue-600">
                <Loader2 size={14} className="animate-spin" />
                <span>Loading bin fee...</span>
              </div>
            )}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">GHS</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={totalBill}
                onChange={(e) => {
                  setTotalBill(e.target.value);
                  setBillManuallyEdited(true);
                }}
                placeholder="0.00"
                className={`w-full pl-14 pr-10 py-3.5 border-2 rounded-xl text-2xl font-bold text-gray-900 ${
                  errors.totalBill ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-green-500'
                } focus:outline-none focus:ring-2 focus:ring-green-200`}
                disabled={isSubmitting || (paymentStatus && paymentStatus !== 'failed')}
                required
              />
              <PencilLine size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            {/* Show auto-sum reference when collector has edited manually */}
            {billManuallyEdited && autoCalculatedBill > 0 && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-gray-500">
                  Auto total: <span className="font-bold">GHS {autoCalculatedBill.toFixed(2)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTotalBill(autoCalculatedBill.toFixed(2));
                    setBillManuallyEdited(false);
                  }}
                  className="text-sm font-bold text-blue-600 underline"
                >
                  Use auto total
                </button>
              </div>
            )}
            {!billManuallyEdited && autoCalculatedBill > 0 && (
              <p className="mt-1 text-sm text-green-600 font-medium">
                ✅ Auto-calculated from bin fee — tap to edit
              </p>
            )}
            {errors.totalBill && (
              <p className="mt-1 text-base font-semibold text-red-600">{errors.totalBill}</p>
            )}
          </div>

          {/* ─── Payment Mode ─── */}
          <div>
            <label className="flex items-center gap-2 text-base font-bold text-gray-800 mb-3">
              <span className="text-xl">💳</span>
              How is client paying?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('momo')}
                disabled={isSubmitting || (paymentStatus && paymentStatus !== 'failed')}
                className={`px-3 py-3.5 rounded-xl border-2 text-base font-bold transition-all ${
                  paymentMode === 'momo'
                    ? 'border-green-500 bg-green-50 text-green-700 shadow-md ring-2 ring-green-200'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                📱 MoMo
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('e_cash')}
                disabled={isSubmitting || (paymentStatus && paymentStatus !== 'failed')}
                className={`px-3 py-3.5 rounded-xl border-2 text-base font-bold transition-all ${
                  paymentMode === 'e_cash'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                💵 e-Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('cash')}
                disabled={isSubmitting || (paymentStatus && paymentStatus !== 'failed')}
                className={`px-3 py-3.5 rounded-xl border-2 text-base font-bold transition-all ${
                  paymentMode === 'cash'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700 shadow-md ring-2 ring-yellow-200'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                🪙 Cash
              </button>
            </div>
          </div>

          {/* ─── Client MoMo Number (conditional) ─── */}
          {(paymentMode === 'momo' || paymentMode === 'e_cash') && (
            <>
              <div>
                <label className="flex items-center gap-2 text-base font-bold text-gray-800 mb-2">
                  <span className="text-xl">📞</span>
                  Client {paymentMode === 'momo' ? 'MoMo' : 'e-Cash'} Number
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={clientMomo}
                  onChange={(e) => setClientMomo(e.target.value)}
                  placeholder="0244123456"
                  className={`w-full px-4 py-3.5 border-2 rounded-xl text-lg font-semibold ${
                    errors.clientMomo ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-green-500'
                  } focus:outline-none focus:ring-2 focus:ring-green-200`}
                  disabled={isSubmitting || (paymentStatus && paymentStatus !== 'failed')}
                  required
                />
                {errors.clientMomo && (
                  <p className="mt-1 text-base font-semibold text-red-600">{errors.clientMomo}</p>
                )}
              </div>

              {/* Network Selection */}
              <div>
                <label className="flex items-center gap-2 text-base font-bold text-gray-800 mb-3">
                  <span className="text-xl">📡</span>
                  Network
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setClientRSwitch('mtn')}
                    disabled={isSubmitting || (paymentStatus && paymentStatus !== 'failed')}
                    className={`px-3 py-3.5 rounded-xl border-2 text-base font-bold transition-all ${
                      clientRSwitch === 'mtn'
                        ? 'border-yellow-400 bg-yellow-400 text-black shadow-md ring-2 ring-yellow-200'
                        : 'border-yellow-200 bg-yellow-50 text-black hover:border-yellow-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    MTN
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientRSwitch('vodafone')}
                    disabled={isSubmitting || (paymentStatus && paymentStatus !== 'failed')}
                    className={`px-3 py-3.5 rounded-xl border-2 text-base font-bold transition-all ${
                      clientRSwitch === 'vodafone'
                        ? 'border-red-400 bg-red-100 text-red-700 shadow-md ring-2 ring-red-200'
                        : 'border-red-100 bg-red-50 text-red-700 hover:border-red-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Vodafone
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientRSwitch('airteltigo')}
                    disabled={isSubmitting || (paymentStatus && paymentStatus !== 'failed')}
                    className={`px-3 py-3.5 rounded-xl border-2 text-base font-bold transition-all ${
                      clientRSwitch === 'airteltigo'
                        ? 'border-blue-400 bg-blue-100 text-blue-700 shadow-md ring-2 ring-blue-200'
                        : 'border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    AirtelTigo
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl">
              <p className="text-base font-bold text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* ─── Action Buttons — large tap targets ─── */}
          {paymentStatus === 'failed' ? (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3.5 border-2 border-gray-300 rounded-xl text-gray-700 text-base font-bold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 px-4 py-3.5 bg-orange-600 text-white rounded-xl text-base font-bold hover:bg-orange-700 transition-colors shadow-md"
              >
                🔄 Try Again
              </button>
            </div>
          ) : paymentStatus === 'success' || paymentStatus === 'pending' || paymentStatus === 'processing' ? (
            <div className="pt-4 text-center text-gray-600 text-base font-semibold">
              {paymentStatus === 'success' && 'Closing...'}
              {(paymentStatus === 'pending' || paymentStatus === 'processing') && 'Please wait...'}
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3.5 border-2 border-gray-300 rounded-xl text-gray-700 text-base font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || scannedBags.length < 1}
                className="flex-1 px-4 py-3.5 bg-green-600 text-white rounded-xl text-base font-bold hover:bg-green-700 transition-colors disabled:opacity-50 shadow-md"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={20} className="animate-spin" /> Wait...
                  </span>
                ) : (
                  `✅ Pay GHS ${totalBill || '0.00'}`
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default DigitalBinPaymentModal;
