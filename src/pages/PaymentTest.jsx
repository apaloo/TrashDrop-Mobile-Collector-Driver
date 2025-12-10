import React, { useState } from 'react';
import { initiateCollection, checkCollectionStatus } from '../services/paymentService';
import { testConnection } from '../services/trendiPayService';

export default function PaymentTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Collection form state
  const [collectionForm, setCollectionForm] = useState({
    amount: '5.00',
    clientMomo: '0245724489',
    clientRSwitch: 'MTN',
    digitalBinId: 'test-bin-' + Date.now(),
    collectorId: 'test-collector-123'
  });
  
  // Status check form
  const [transactionId, setTransactionId] = useState('');

  const handleTestCollection = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🧪 Testing collection payment:', collectionForm);
      
      // Map form data to payment service expected format
      const paymentData = {
        digitalBinId: collectionForm.digitalBinId,
        collectorId: collectionForm.collectorId,
        bagsCollected: 1, // Default for testing
        totalBill: parseFloat(collectionForm.amount),
        paymentMode: 'momo', // Default to MoMo for testing
        clientMomo: collectionForm.clientMomo,
        clientRSwitch: collectionForm.clientRSwitch.toLowerCase()
      };
      
      console.log('📤 Sending payment data:', paymentData);
      
      const response = await initiateCollection(paymentData);
      
      console.log('📊 Collection result:', response);
      setResult(response);
      
      if (response.success && response.transactionId) {
        setTransactionId(response.transactionId);
      }
    } catch (err) {
      console.error('❌ Collection test failed:', err);
      setError(err.message || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    if (!transactionId) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Checking status for:', transactionId);
      
      const response = await checkCollectionStatus(transactionId, collectionForm.digitalBinId);
      
      console.log('📊 Status result:', response);
      setResult(response);
    } catch (err) {
      console.error('❌ Status check failed:', err);
      setError(err.message || 'Status check failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🧪 Testing TrendiPay connection...');
      
      const response = await testConnection();
      
      console.log('📊 Connection result:', response);
      setResult(response);
    } catch (err) {
      console.error('❌ Connection test failed:', err);
      setError(err.message || 'Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckWebhookServer = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      console.log('🧪 Checking webhook server:', apiUrl);
      
      const response = await fetch(`${apiUrl}/health`);
      const data = await response.json();
      
      console.log('📊 Webhook server status:', data);
      setResult({
        success: response.ok,
        message: 'Webhook server is running',
        data
      });
    } catch (err) {
      console.error('❌ Webhook server check failed:', err);
      setError(err.message || 'Webhook server not reachable');
      setResult({
        success: false,
        error: 'Webhook server not reachable. Make sure backend_webhooks/server.js and ngrok are running.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            💳 TrendiPay Payment Testing
          </h1>
          <p className="text-sm text-gray-600 mb-4">
            Test TrendiPay integration with live webhook server
          </p>
          
          {/* Environment Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">🔧 Configuration</h3>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">API URL:</span> {import.meta.env.VITE_TRENDIPAY_API_URL}</p>
              <p><span className="font-medium">Webhook URL:</span> {import.meta.env.VITE_API_URL}</p>
              <p><span className="font-medium">Terminal ID:</span> {import.meta.env.VITE_TRENDIPAY_TERMINAL_ID}</p>
              <p><span className="font-medium">TrendiPay Enabled:</span> {import.meta.env.VITE_ENABLE_TRENDIPAY}</p>
            </div>
          </div>

          {/* Quick Tests */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={handleTestConnection}
              disabled={loading}
              className="bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium text-sm"
            >
              🔌 Test API Connection
            </button>
            <button
              onClick={handleCheckWebhookServer}
              disabled={loading}
              className="bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium text-sm"
            >
              🌐 Check Webhook Server
            </button>
          </div>

          {/* Collection Payment Form */}
          <form onSubmit={handleTestCollection} className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              💰 Test Collection Payment
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Client → TrashDrop</span>
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (GHS)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={collectionForm.amount}
                  onChange={(e) => setCollectionForm({ ...collectionForm, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client MoMo Number
                </label>
                <input
                  type="text"
                  value={collectionForm.clientMomo}
                  onChange={(e) => setCollectionForm({ ...collectionForm, clientMomo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0245724489"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Network
                </label>
                <select
                  value={collectionForm.clientRSwitch}
                  onChange={(e) => setCollectionForm({ ...collectionForm, clientRSwitch: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="MTN">MTN</option>
                  <option value="VODAFONE">Vodafone</option>
                  <option value="AIRTELTIGO">AirtelTigo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Digital Bin ID (auto-generated)
                </label>
                <input
                  type="text"
                  value={collectionForm.digitalBinId}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
              >
                {loading ? '⏳ Processing...' : '🚀 Initiate Collection Payment'}
              </button>
            </div>
          </form>

          {/* Status Check Form */}
          {transactionId && (
            <form onSubmit={handleCheckStatus} className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                🔍 Check Payment Status
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction ID
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-yellow-600 text-white py-3 px-4 rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 font-medium"
                >
                  {loading ? '⏳ Checking...' : '🔍 Check Status'}
                </button>
              </div>
            </form>
          )}

          {/* Result Display */}
          {result && (
            <div className={`rounded-lg p-4 mb-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <h3 className="font-semibold text-lg mb-2 flex items-center">
                {result.success ? '✅ Success' : '❌ Failed'}
              </h3>
              <pre className="text-xs bg-white p-3 rounded overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-red-900 mb-2">❌ Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
            <h3 className="font-semibold text-gray-900 mb-2">📋 Testing Instructions</h3>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              <li>First, click "Check Webhook Server" to ensure backend is running</li>
              <li>Click "Test API Connection" to verify TrendiPay credentials</li>
              <li>Fill in the collection payment form and click "Initiate Collection Payment"</li>
              <li>Check your phone for MoMo approval prompt (MTN *170#)</li>
              <li>Use "Check Status" button to poll payment status</li>
              <li>Monitor console for detailed logs</li>
            </ol>
          </div>

          {/* Requirements */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
            <h3 className="font-semibold text-orange-900 mb-2">⚠️ Requirements</h3>
            <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
              <li>Webhook server must be running: <code className="bg-orange-100 px-1 py-0.5 rounded">cd backend_webhooks && node server.js</code></li>
              <li>ngrok must be active: <code className="bg-orange-100 px-1 py-0.5 rounded">ngrok http 3000</code></li>
              <li>VITE_API_URL must be set to ngrok URL in .env</li>
              <li>TrendiPay credentials must be valid in .env</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
