import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { logger } from '../utils/logger';

/**
 * Digital Bin Payment Modal
 * 
 * Collects payment information from client after bin pickup.
 * Opens automatically after QR scan marks bin as 'picked_up'.
 * 
 * Payment modes:
 * - MoMo: Requires client MoMo number and network
 * - e-cash: Requires client e-cash number and network
 * - cash: No additional fields required
 */
const DigitalBinPaymentModal = ({
  isOpen,
  onClose,
  digitalBinId,
  collectorId,
  onSubmit
}) => {
  // Form state
  const [bagsCollected, setBagsCollected] = useState(1);
  const [totalBill, setTotalBill] = useState('');
  const [paymentMode, setPaymentMode] = useState('momo');
  const [clientMomo, setClientMomo] = useState('');
  const [clientRSwitch, setClientRSwitch] = useState('mtn');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setBagsCollected(1);
      setTotalBill('');
      setPaymentMode('momo');
      setClientMomo('');
      setClientRSwitch('mtn');
      setErrors({});
    }
  }, [isOpen]);

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (bagsCollected < 1 || bagsCollected > 10) {
      newErrors.bagsCollected = 'Bags must be between 1 and 10';
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
      return;
    }

    setIsSubmitting(true);

    try {
      const paymentData = {
        digitalBinId,
        collectorId,
        bagsCollected: parseInt(bagsCollected),
        totalBill: parseFloat(totalBill),
        paymentMode,
        clientMomo: (paymentMode === 'momo' || paymentMode === 'e_cash') ? clientMomo : null,
        clientRSwitch: (paymentMode === 'momo' || paymentMode === 'e_cash') ? clientRSwitch : null
      };

      logger.info('Submitting payment data:', paymentData);

      await onSubmit(paymentData);

      // Close modal after successful submission
      onClose();
    } catch (error) {
      logger.error('Error submitting payment:', error);
      setErrors({ submit: error.message || 'Failed to process payment' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">Client Payment</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Number of Bags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Bags Collected *
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={bagsCollected}
              onChange={(e) => setBagsCollected(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md ${
                errors.bagsCollected ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSubmitting}
              required
            />
            {errors.bagsCollected && (
              <p className="mt-1 text-sm text-red-600">{errors.bagsCollected}</p>
            )}
          </div>

          {/* Total Bill */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Bill to Client (GHS) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={totalBill}
              onChange={(e) => setTotalBill(e.target.value)}
              placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-md ${
                errors.totalBill ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSubmitting}
              required
            />
            {errors.totalBill && (
              <p className="mt-1 text-sm text-red-600">{errors.totalBill}</p>
            )}
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Mode *
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="paymentMode"
                  value="momo"
                  checked={paymentMode === 'momo'}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="mr-2"
                  disabled={isSubmitting}
                />
                <span className="text-gray-700">Mobile Money (MoMo)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="paymentMode"
                  value="e_cash"
                  checked={paymentMode === 'e_cash'}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="mr-2"
                  disabled={isSubmitting}
                />
                <span className="text-gray-700">e-Cash</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="paymentMode"
                  value="cash"
                  checked={paymentMode === 'cash'}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="mr-2"
                  disabled={isSubmitting}
                />
                <span className="text-gray-700">Cash</span>
              </label>
            </div>
          </div>

          {/* Client MoMo Number (conditional) */}
          {(paymentMode === 'momo' || paymentMode === 'e_cash') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client {paymentMode === 'momo' ? 'MoMo' : 'e-Cash'} Number *
                </label>
                <input
                  type="tel"
                  value={clientMomo}
                  onChange={(e) => setClientMomo(e.target.value)}
                  placeholder="0244123456"
                  className={`w-full px-3 py-2 border rounded-md ${
                    errors.clientMomo ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                  required
                />
                {errors.clientMomo && (
                  <p className="mt-1 text-sm text-red-600">{errors.clientMomo}</p>
                )}
              </div>

              {/* Network Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Network *
                </label>
                <select
                  value={clientRSwitch}
                  onChange={(e) => setClientRSwitch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={isSubmitting}
                  required
                >
                  <option value="mtn">MTN</option>
                  <option value="vodafone">Vodafone</option>
                  <option value="airteltigo">AirtelTigo</option>
                </select>
              </div>
            </>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Complete Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DigitalBinPaymentModal;
