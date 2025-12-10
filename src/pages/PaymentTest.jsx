import React, { useState, useEffect } from 'react';
import { initiateCollection, checkCollectionStatus } from '../services/paymentService';
import { testConnection } from '../services/trendiPayService';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

export default function PaymentTest() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loadingBin, setLoadingBin] = useState(true);
  
  // Collection form state
  const [collectionForm, setCollectionForm] = useState({
    amount: '5.00',
    clientMomo: '0245724489',
    clientRSwitch: 'MTN',
    digitalBinId: '',
    collectorId: ''
  });
  
  // Fetch real digital bin and collector ID from database
  useEffect(() => {
    const fetchTestData = async () => {
      try {
        setLoadingBin(true);
        
        // Get a real digital bin from database (status: available)
        const { data: bins, error: binError } = await supabase
          .from('digital_bins')
          .select('id, client_id, status')
          .eq('status', 'available')
          .limit(1);
        
        if (binError) {
          console.error('Error fetching digital bin:', binError);
          setError('Could not fetch test digital bin. Make sure digital_bins table has available bins.');
          return;
        }
        
        if (!bins || bins.length === 0) {
          setError('No available digital bins in database. Create a test bin first.');
          return;
        }
        
        // Use logged in user's ID if available, otherwise use client_id from bin
        const collectorId = user?.id || bins[0].client_id;
        
        setCollectionForm(prev => ({
          ...prev,
          digitalBinId: bins[0].id,
          collectorId: collectorId
        }));
        
        console.log('✅ Loaded test data:', { 
          digitalBinId: bins[0].id, 
          collectorId,
          binStatus: bins[0].status 
        });
        
      } catch (err) {
        console.error('Error in fetchTestData:', err);
        setError(err.message);
      } finally {
        setLoadingBin(false);
      }
    };
    
    fetchTestData();
  }, [user]);
  
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
      console.log('🧪 Checking TrendiPay configuration...');
      
      // Check if credentials are configured
      const apiUrl = import.meta.env.VITE_TRENDIPAY_API_URL;
      const apiKey = import.meta.env.VITE_TRENDIPAY_API_KEY;
      const terminalId = import.meta.env.VITE_TRENDIPAY_TERMINAL_ID;
      const merchantId = import.meta.env.VITE_TRENDIPAY_MERCHANT_ID;
      const enabled = import.meta.env.VITE_ENABLE_TRENDIPAY;
      
      const hasCredentials = apiUrl && apiKey && terminalId && merchantId;
      
      const configResult = {
        success: hasCredentials,
        message: hasCredentials 
          ? '✅ TrendiPay credentials configured' 
          : '⚠️ Missing TrendiPay credentials',
        data: {
          enabled: enabled === 'true',
          apiUrl,
          hasApiKey: !!apiKey,
          apiKeyLength: apiKey?.length || 0,
          hasTerminalId: !!terminalId,
          hasMerchantId: !!merchantId,
          note: 'API connection will be tested when initiating a payment'
        }
      };
      
      console.log('📊 Configuration check:', configResult);
      setResult(configResult);
      
      if (!hasCredentials) {
        setError('TrendiPay credentials not fully configured in .env file');
      }
    } catch (err) {
      console.error('❌ Configuration check failed:', err);
      setError(err.message || 'Configuration check failed');
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
      
      const response = await fetch(`${apiUrl}/health`, {
        headers: {
          'ngrok-skip-browser-warning': 'true' // Skip ngrok interstitial page
        }
      });
      
      const contentType = response.headers.get('content-type');
      
      // Check if we got JSON (expected) or HTML (ngrok interstitial)
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Received HTML instead of JSON - ngrok may be showing interstitial page. Try accessing ' + apiUrl + '/health in a browser first.');
      }
      
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
        error: err.message || 'Webhook server not reachable. Make sure backend_webhooks/server.js and ngrok are running.'
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
              🔧 Check Configuration
            </button>
            <button
              onClick={handleCheckWebhookServer}
              disabled={loading}
              className="bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium text-sm"
            >
              🌐 Check Webhook Server
            </button>
          </div>

          {/* Loading State */}
          {loadingBin && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">⏳ Loading test data from database...</p>
            </div>
          )}

          {/* No Bins Available */}
          {!loadingBin && !collectionForm.digitalBinId && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 mb-2">❌ No available digital bins found</p>
              <p className="text-xs text-red-600">Create a test digital bin in the database with status='available' first.</p>
            </div>
          )}

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
                  Digital Bin ID (from database)
                </label>
                <input
                  type="text"
                  value={collectionForm.digitalBinId || 'Loading...'}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collector ID (from auth or bin)
                </label>
                <input
                  type="text"
                  value={collectionForm.collectorId || 'Loading...'}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loading || loadingBin || !collectionForm.digitalBinId}
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
