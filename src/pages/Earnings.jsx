import { useState, useEffect } from 'react';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../context/AuthContext';
import { createEarningsService } from '../services/earningsService';
import { authService } from '../services/supabase';
import { logger } from '../utils/logger';

// Cash Out Modal Component
const CashOutModal = ({ isOpen, onClose, totalEarnings, availableForWithdrawal, pendingDisposalAmount = 0, onWithdrawalSuccess }) => {
  // Available for withdrawal is only from disposed bins
  const withdrawableAmount = availableForWithdrawal ?? 0;
  const hasPendingEarnings = pendingDisposalAmount > 0;
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('momo');
  const [momoNumber, setMomoNumber] = useState('');
  const [momoProvider, setMomoProvider] = useState('mtn');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const handleAmountChange = (e) => {
    const value = e.target.value;
    // Only allow numbers and decimals
    if (/^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError('');
    }
  };
  
  const validateForm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    
    if (parseFloat(amount) > withdrawableAmount) {
      setError(`Amount cannot exceed your available balance of ₵${withdrawableAmount.toFixed(2)}`);
      return false;
    }
    
    if (!momoNumber || momoNumber.length < 10) {
      setError('Please enter a valid mobile money number');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const withdrawnAmount = parseFloat(amount);
      
      // Call the onWithdrawalSuccess callback which handles the disbursement
      const result = await onWithdrawalSuccess(withdrawnAmount, {
        momoNumber,
        momoProvider,
        accountName: 'Collector' // Could be fetched from profile
      });
      
      if (result && !result.success) {
        throw new Error(result.error || 'Failed to process withdrawal');
      }
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setAmount('');
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to process withdrawal. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Cash Out</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {success ? (
            <div className="text-center py-8">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Withdrawal Successful!</h3>
              <p className="text-gray-500 mb-6">
                ₵{parseFloat(amount).toFixed(2)} has been sent to your {momoProvider.toUpperCase()} account.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-900 text-base font-bold mb-2" htmlFor="amount">
                  Amount (₵)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">₵</span>
                  <input
                    id="amount"
                    type="text"
                    className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    required
                  />
                </div>
                {withdrawableAmount > 0 ? (
                  <p className="text-sm text-green-600 font-semibold mt-1">Available for withdrawal: ₵{withdrawableAmount.toFixed(2)}</p>
                ) : (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700 font-medium">
                      ⚠️ No funds available for withdrawal
                    </p>
                    {hasPendingEarnings && (
                      <p className="text-xs text-amber-600 mt-1">
                        You have ₵{pendingDisposalAmount.toFixed(2)} pending disposal. Dispose your collected waste at a facility to unlock these funds.
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-900 text-base font-bold mb-2">
                  Payment Method
                </label>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="flex items-center">
                    <input
                      id="momo"
                      type="radio"
                      name="paymentMethod"
                      value="momo"
                      checked={paymentMethod === 'momo'}
                      onChange={() => setPaymentMethod('momo')}
                      className="h-4 w-4 text-primary"
                    />
                    <label htmlFor="momo" className="ml-2 text-gray-900 font-medium">
                      Mobile Money (MOMO)
                    </label>
                  </div>
                </div>
              </div>
              
              {paymentMethod === 'momo' && (
                <>
                  <div className="mb-4">
                    <label className="block text-gray-900 text-base font-bold mb-2">
                      MOMO Provider
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        className={`py-3 px-3 rounded-lg border-2 font-bold transition-all ${momoProvider === 'mtn' ? 'bg-yellow-400 text-black border-yellow-500 ring-2 ring-yellow-300' : 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100'}`}
                        onClick={() => setMomoProvider('mtn')}
                      >
                        MTN
                      </button>
                      <button
                        type="button"
                        className={`py-3 px-3 rounded-lg border-2 font-bold transition-all ${momoProvider === 'vodafone' ? 'bg-red-500 text-white border-red-600 ring-2 ring-red-300' : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'}`}
                        onClick={() => setMomoProvider('vodafone')}
                      >
                        Vodafone
                      </button>
                      <button
                        type="button"
                        className={`py-3 px-3 rounded-lg border-2 font-bold transition-all ${momoProvider === 'airtel' ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-300' : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'}`}
                        onClick={() => setMomoProvider('airtel')}
                      >
                        AirtelTigo
                      </button>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <label className="block text-gray-900 text-base font-bold mb-2" htmlFor="momoNumber">
                      MOMO Number
                    </label>
                    <input
                      id="momoNumber"
                      type="tel"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., 0244123456"
                      value={momoNumber}
                      onChange={(e) => setMomoNumber(e.target.value.replace(/\D/g, ''))}
                      maxLength={10}
                      required
                    />
                  </div>
                </>
              )}
              
              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
                  {error}
                </div>
              )}
              
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="mr-2 px-4 py-2 text-gray-500 hover:text-gray-700"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : 'Withdraw'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Chart component (simplified for this example)
const EarningsLineChart = ({ data, period }) => {
  // In a real implementation, we would use a library like Chart.js or Recharts
  // This is a simplified visual representation
  
  // Guard against undefined or empty data
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="mt-4 mb-6 text-center text-gray-500">
        <p>No earnings data available</p>
      </div>
    );
  }
  
  const maxValue = Math.max(...data.map(d => d.amount));
  
  return (
    <div className="mt-4 mb-6">
      <div className="flex justify-between mb-2">
        <span className="text-sm text-gray-500">Earnings ({period})</span>
        <span className="text-sm text-gray-500">Max: ₵{maxValue}</span>
      </div>
      <div className="flex items-end h-32 space-x-1">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-primary rounded-t"
              style={{ height: `${(item.amount / maxValue) * 100}%` }}
            ></div>
            <span className="text-xs mt-1">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Transaction list item component
const TransactionItem = ({ transaction }) => {
  // Format transaction type name
  const formatTransactionType = (type) => {
    switch (type) {
      case 'pickup_request':
        return 'Pickup Request';
      case 'digital_bin':
        return 'Digital Bin';
      case 'authority_assignment':
        return 'Authority Assignment';
      case 'bonus':
        return 'Bonus';
      case 'referral':
        return 'Referral';
      default:
        return type;
    }
  };

  return (
    <div className="py-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex justify-between">
        <div>
          <p className="font-medium">{formatTransactionType(transaction.type)}</p>
          <p className="text-xs text-gray-500">{transaction.id}</p>
        </div>
        <div className="text-right">
          <p className={`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {transaction.amount > 0 ? '+' : ''}₵{transaction.amount}
          </p>
          <p className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString()}</p>
        </div>
      </div>
      {transaction.note && (
        <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-semibold ${
          transaction.note === 'Pending disposal' 
            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
            : transaction.note === 'Disposed'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-gray-100 text-gray-700 border border-gray-300'
        }`}>
          {transaction.note === 'Pending disposal' && '🚚 '}
          {transaction.note === 'Disposed' && '✅ '}
          {transaction.note}
        </span>
      )}
    </div>
  );
};

const EarningsPage = () => {
  const { user, hasInitiallyChecked } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [period, setPeriod] = useState('week');
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  
  // Offline and cache status
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [fromCache, setFromCache] = useState(false);
  const [cacheAge, setCacheAge] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  
  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Fix #8: Consolidated state management - single state object instead of 15+ separate states
  const [earningsState, setEarningsState] = useState({
    // Earnings totals
    totalEarnings: 0,
    weeklyEarnings: 0,
    monthlyEarnings: 0,
    pendingDisposalEarnings: 0,
    disposedEarnings: 0,
    platformEarnings: 0,
    grossRevenue: 0,
    // Stats
    completedJobs: 0,
    pendingDisposalJobs: 0,
    disposedJobs: 0,
    avgPerJob: 0,
    rating: 0,
    completionRate: 0,
    collectorSharePercent: 0,
    platformSharePercent: 0,
    paymentModeBreakdown: null,
    // Chart and transactions
    chartData: {},
    transactions: [],
    // Detailed breakdown
    detailedEarnings: null,
    loyaltyTier: null
  });
  
  // Fix #7: Pagination state for transactions
  const [transactionPage, setTransactionPage] = useState(1);
  const TRANSACTIONS_PER_PAGE = 10;
  
  // Computed values from consolidated state
  const { 
    totalEarnings, weeklyEarnings, monthlyEarnings, 
    pendingDisposalEarnings, disposedEarnings, 
    platformEarnings, grossRevenue, 
    chartData: earningsData, transactions,
    detailedEarnings, loyaltyTier,
    ...stats 
  } = earningsState;
  
  // Fix #7: Paginated transactions
  const totalPages = Math.ceil(transactions.length / TRANSACTIONS_PER_PAGE);
  const paginatedTransactions = transactions.slice(
    (transactionPage - 1) * TRANSACTIONS_PER_PAGE,
    transactionPage * TRANSACTIONS_PER_PAGE
  );

  // Fetch earnings and stats with offline caching support
  const fetchEarningsData = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const earningsService = createEarningsService(user.id);
      
      // Use cache-enabled fetch for better offline support
      const result = await earningsService.getEarningsWithCache({ forceRefresh });
      
      if (!result.success) {
        // Show offline message if applicable
        if (result.isOffline) {
          logger.warn('📴 Offline mode - no cached data available');
        }
        throw new Error(result.error || 'Failed to fetch earnings data');
      }
      
      const data = result.data;
      
      // Update cache status indicators
      setFromCache(result.fromCache || false);
      setCacheAge(result.cacheAge || null);
      setLastRefresh(new Date());
      
      logger.info(`📊 Earnings data loaded (fromCache: ${result.fromCache}, cacheAge: ${result.cacheAge ? Math.round(result.cacheAge / 1000) + 's' : 'N/A'})`);

      // Fix #8: Update consolidated state in single call
      // Handle both RPC optimized and legacy data formats
      const statsData = data.stats || data;
      setEarningsState(prev => ({
        ...prev,
        chartData: data.chartData || {},
        transactions: data.transactions || [],
        totalEarnings: statsData.totalEarnings || data.totalEarnings || 0,
        weeklyEarnings: statsData.weeklyEarnings || data.weeklyEarnings || 0,
        monthlyEarnings: statsData.monthlyEarnings || data.monthlyEarnings || 0,
        pendingDisposalEarnings: statsData.pendingDisposalEarnings || data.pendingDisposalEarnings || 0,
        disposedEarnings: statsData.disposedEarnings || data.disposedEarnings || 0,
        platformEarnings: statsData.platformEarnings || data.platformEarnings || 0,
        grossRevenue: statsData.grossRevenue || data.grossRevenue || 0,
        completedJobs: statsData.completedJobs || data.jobCounts?.disposed || 0,
        pendingDisposalJobs: statsData.pendingDisposalJobs || data.jobCounts?.pickedUp || 0,
        disposedJobs: statsData.disposedJobs || data.jobCounts?.disposed || 0,
        avgPerJob: statsData.avgPerJob || 0,
        rating: statsData.rating || 0,
        completionRate: statsData.completionRate || data.completionRate || 0,
        collectorSharePercent: statsData.collectorSharePercent || 0,
        platformSharePercent: statsData.platformSharePercent || 0,
        paymentModeBreakdown: statsData.paymentModeBreakdown || null,
        loyaltyTier: data.loyaltyTier || null
      }));
      
      // Only fetch detailed breakdown if online and not from cache
      if (!result.fromCache && navigator.onLine) {
        // Fetch detailed earnings breakdown (SOP v4.5.6)
        const { success: detailSuccess, data: detailData } = await earningsService.getDetailedEarningsBreakdown();
        // Fetch loyalty tier information
        const { success: tierSuccess, data: tierData } = await earningsService.getLoyaltyTier();
        
        // Update detailed data in single call
        setEarningsState(prev => ({
          ...prev,
          detailedEarnings: detailSuccess ? detailData : null,
          loyaltyTier: tierSuccess ? tierData : prev.loyaltyTier
        }));
      }
      
      // Fix #7: Reset pagination when data changes
      setTransactionPage(1);
      
      setIsLoading(false);
    } catch (error) {
      logger.error('Error fetching earnings data:', error);
      setIsLoading(false);
    }
  };
  
  // Force refresh handler for pull-to-refresh or manual refresh
  const handleForceRefresh = () => {
    if (navigator.onLine) {
      fetchEarningsData(true);
    } else {
      logger.warn('📴 Cannot refresh while offline');
    }
  };

  const handleWithdrawalSuccess = async (amount, paymentDetails) => {
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const earningsService = createEarningsService(user.id);
      
      // **NEW: Process digital bin disbursement with validation**
      const { success, error, message, binsIncluded } = await earningsService.processDigitalBinDisbursement(
        amount,
        paymentDetails
      );

      if (!success || error) {
        return {
          success: false,
          error: error || 'Failed to process withdrawal'
        };
      }

      logger.info('Disbursement successful:', { amount, binsIncluded, message });

      // Refresh data to reflect the withdrawal
      await fetchEarningsData();
      
      return { success: true, message, binsIncluded };
    } catch (error) {
      logger.error('Error processing withdrawal:', error);
      return {
        success: false,
        error: error.message || 'Failed to process withdrawal'
      };
    }
  };

  // Handle authentication redirect for invalid sessions
  useEffect(() => {
    // Only redirect if initial check is complete and user is not authenticated
    if (hasInitiallyChecked && !user?.id) {
      logger.warn('User not authenticated in Earnings page, clearing session and redirecting...');
      
      // Clear all auth-related data
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('sb-') || key.includes('dev_mode')) {
          localStorage.removeItem(key);
        }
      });
      
      // Redirect to login page
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    }
  }, [hasInitiallyChecked, user]);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { success, profile } = await authService.getUserProfile(user.id);
        if (success && profile) {
          setUserProfile({
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone
          });
        }
      } catch (err) {
        logger.error('Error loading user profile for nav:', err);
      }
    };
    
    fetchUserProfile();
  }, [user]);
  
  // Load data when component mounts
  useEffect(() => {
    // Only fetch data if user is available
    if (user?.id) {
      fetchEarningsData();
    } else {
      setIsLoading(false);
    }
  }, [period, user?.id]);

  // Show loading state while checking auth or fetching data
  if (!hasInitiallyChecked || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex-grow mt-14 mb-16 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600">
              {!hasInitiallyChecked ? 'Checking authentication...' : 'Loading earnings data...'}
            </p>
          </div>
        </div>
        <BottomNavBar />
      </div>
    );
  }

  // Show authentication required state (redirect handled by useEffect above)
  if (!user?.id) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex-grow mt-14 mb-16 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Authentication required to view earnings</p>
            <p className="text-sm text-gray-500 mt-2">Redirecting to login...</p>
          </div>
        </div>
        <BottomNavBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopNavBar user={userProfile} />
      
      <div className="flex-grow mt-14 mb-16 flex flex-col">
        {/* Fixed Header Section */}
        <div className="fixed top-14 left-0 right-0 bg-gray-50 dark:bg-gray-900 z-10 px-4 pt-3 pb-2">
        <h1 className="text-2xl font-bold mb-4">Earnings</h1>
        
        {/* Period Selector */}
        <div className="flex justify-start mb-4">
          <div className="inline-flex rounded-md shadow-sm">
            <button
              className={`px-4 py-2 text-sm rounded-l-md ${period === 'week' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setPeriod('week')}
            >
              Week
            </button>
            <button
              className={`px-4 py-2 text-sm ${period === 'month' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setPeriod('month')}
            >
              Month
            </button>
            <button
              className={`px-4 py-2 text-sm rounded-r-md ${period === 'year' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setPeriod('year')}
            >
              Year
            </button>
          </div>
        </div>
        
        {/* Cash Out Button */}
        <button 
          onClick={() => setShowCashOutModal(true)}
          className="w-full bg-primary text-white py-3 rounded-lg flex items-center justify-center mb-6 shadow-md hover:bg-green-600 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          Cash Out
        </button>
        </div>
        
        {/* Scrollable Content Section with padding to account for fixed header */}
        <div className="px-4 pt-[172px] pb-3">
        
        {/* Cash Out Modal */}
        <CashOutModal 
          isOpen={showCashOutModal} 
          onClose={() => setShowCashOutModal(false)} 
          totalEarnings={totalEarnings}
          availableForWithdrawal={disposedEarnings}
          pendingDisposalAmount={pendingDisposalEarnings}
          onWithdrawalSuccess={handleWithdrawalSuccess}
        />
        
        {/* Offline/Cache Status Indicator */}
        {(isOffline || fromCache) && (
          <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
            isOffline 
              ? 'bg-red-50 border border-red-200' 
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center">
              <span className="mr-2">{isOffline ? '📴' : '📦'}</span>
              <div>
                <p className={`text-sm font-medium ${isOffline ? 'text-red-700' : 'text-blue-700'}`}>
                  {isOffline ? 'Offline Mode' : 'Cached Data'}
                </p>
                <p className={`text-xs ${isOffline ? 'text-red-600' : 'text-blue-600'}`}>
                  {isOffline 
                    ? 'Showing cached data. Connect to refresh.' 
                    : `Updated ${cacheAge ? Math.round(cacheAge / 1000) + 's ago' : 'recently'}`
                  }
                </p>
              </div>
            </div>
            {!isOffline && (
              <button
                onClick={handleForceRefresh}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
              >
                Refresh
              </button>
            )}
          </div>
        )}
        
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm mb-1">Total Earnings</p>
            <p className="text-xl font-bold">₵{totalEarnings.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm mb-1">Completed Jobs</p>
            <p className="text-xl font-bold">{stats.completedJobs}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm mb-1">Avg. Per Job</p>
            <p className="text-xl font-bold">₵{stats.avgPerJob.toFixed(2)}</p>
          </div>
        </div>
        
        {/* Disposal Status Breakdown */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Earnings by Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center mb-1">
                <span className="text-amber-600 mr-2">🚚</span>
                <p className="text-amber-700 text-sm font-bold">Pending Disposal</p>
              </div>
              <p className="text-xl font-bold text-amber-600">₵{pendingDisposalEarnings.toFixed(2)}</p>
              <p className="text-xs text-amber-600">{stats.pendingDisposalJobs || 0} jobs awaiting disposal</p>
              <p className="text-xs text-amber-500 mt-1 italic">Dispose to unlock funds</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center mb-1">
                <span className="text-green-600 mr-2">💰</span>
                <p className="text-green-700 text-sm font-bold">Available for Withdrawal</p>
              </div>
              <p className="text-xl font-bold text-green-600">₵{disposedEarnings.toFixed(2)}</p>
              <p className="text-xs text-green-600">{stats.disposedJobs || 0} jobs disposed</p>
              {disposedEarnings > 0 && (
                <p className="text-xs text-green-500 mt-1 italic">Ready to cash out!</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Revenue Split - Collector vs Platform (SOP v4.5.6) */}
        {grossRevenue > 0 && (
          <div className="bg-white rounded-lg shadow mb-6 p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Revenue Split</h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Gross Revenue (User Paid)</span>
                <span className="font-semibold">₵{grossRevenue.toFixed(2)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div className="flex h-full">
                  <div 
                    className="bg-green-500 h-full flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${stats.collectorSharePercent || 87}%` }}
                  >
                    {stats.collectorSharePercent || 87}%
                  </div>
                  <div 
                    className="bg-blue-500 h-full flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: `${stats.platformSharePercent || 13}%` }}
                  >
                    {stats.platformSharePercent || 13}%
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center mb-1">
                  <span className="text-green-600 mr-2">👤</span>
                  <p className="text-green-700 text-sm font-medium">Your Earnings</p>
                </div>
                <p className="text-xl font-bold text-green-600">₵{totalEarnings.toFixed(2)}</p>
                <p className="text-xs text-green-600">{stats.collectorSharePercent || 87}% of revenue</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center mb-1">
                  <span className="text-blue-600 mr-2">🏢</span>
                  <p className="text-blue-700 text-sm font-medium">Platform Fee</p>
                </div>
                <p className="text-xl font-bold text-blue-600">₵{platformEarnings.toFixed(2)}</p>
                <p className="text-xs text-blue-600">{stats.platformSharePercent || 13}% of revenue</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Payment Mode Settlement (Cash vs Digital) */}
        {stats.paymentModeBreakdown && (stats.paymentModeBreakdown.cash.collected > 0 || stats.paymentModeBreakdown.digital.collected > 0) && (
          <div className="bg-white rounded-lg shadow mb-6 p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Payment Settlement</h3>
            <div className="space-y-3">
              {/* Cash Payments */}
              {stats.paymentModeBreakdown.cash.collected > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className="text-yellow-600 mr-2">💵</span>
                      <span className="text-yellow-800 font-medium">Cash Collected</span>
                    </div>
                    <span className="font-bold text-yellow-700">₵{stats.paymentModeBreakdown.cash.collected.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-yellow-700">Platform commission:</span>
                    <span className="font-semibold text-gray-600">₵{stats.paymentModeBreakdown.cash.platformDue.toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              {/* Digital Payments */}
              {stats.paymentModeBreakdown.digital.collected > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className="text-purple-600 mr-2">📱</span>
                      <span className="text-purple-800 font-medium">Digital Payments</span>
                    </div>
                    <span className="font-bold text-purple-700">₵{stats.paymentModeBreakdown.digital.collected.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-purple-700">Your share:</span>
                    <span className="font-semibold text-purple-600">₵{stats.paymentModeBreakdown.digital.collectorDue.toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              {/* Reconciliation Section */}
              {stats.paymentModeBreakdown.reconciliation && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">📊 Reconciliation</p>
                  
                  {/* Commission deducted from digital payout */}
                  {stats.paymentModeBreakdown.reconciliation.commissionDeducted > 0 && (
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Commission deducted from payout:</span>
                      <span className="font-semibold text-orange-600">-₵{stats.paymentModeBreakdown.reconciliation.commissionDeducted.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {/* Net payout to collector (after deduction) */}
                  {stats.paymentModeBreakdown.reconciliation.netPayoutToCollector > 0 && (
                    <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                      <span className="text-gray-700 font-medium">Net payout to you:</span>
                      <span className="font-bold text-green-600">₵{stats.paymentModeBreakdown.reconciliation.netPayoutToCollector.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Final Settlement Status */}
              {stats.paymentModeBreakdown.reconciliation?.requiresPayback ? (
                // Collector must pay back via MoMo
                <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-2">⚠️</span>
                      <div>
                        <span className="font-medium text-red-800">Payment Required</span>
                        <p className="text-xs text-red-600">Pay via MoMo to platform</p>
                      </div>
                    </div>
                    <span className="font-bold text-xl text-red-600">
                      ₵{stats.paymentModeBreakdown.reconciliation.collectorMustPayBack.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : stats.paymentModeBreakdown.reconciliation?.netPayoutToCollector > 0 ? (
                // Platform will pay collector
                <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-2">✅</span>
                      <div>
                        <span className="font-medium text-green-800">You Will Receive</span>
                        <p className="text-xs text-green-600">After commission deduction</p>
                      </div>
                    </div>
                    <span className="font-bold text-xl text-green-600">
                      ₵{stats.paymentModeBreakdown.reconciliation.netPayoutToCollector.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                // Fully settled
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-2">🤝</span>
                      <span className="font-medium text-gray-700">Fully Settled</span>
                    </div>
                    <span className="font-bold text-gray-600">₵0.00</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Earnings Breakdown (SOP v4.5.6) */}
        {detailedEarnings && detailedEarnings.buckets && (
          <div className="bg-white rounded-lg shadow mb-6 p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Earnings Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">💼 Base Core Pickups</span>
                <span className="font-semibold text-green-600">₵{detailedEarnings.buckets.core.toFixed(0)}</span>
              </div>
              
              {detailedEarnings.buckets.urgent > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">⚡ Urgent Bonuses</span>
                  <span className="font-semibold text-orange-600">₵{detailedEarnings.buckets.urgent.toFixed(0)}</span>
                </div>
              )}
              
              {detailedEarnings.buckets.distance > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">📍 Distance Bonuses</span>
                  <span className="font-semibold text-blue-600">₵{detailedEarnings.buckets.distance.toFixed(0)}</span>
                </div>
              )}
              
              {detailedEarnings.buckets.surge > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">🔥 Surge Bonuses</span>
                  <span className="font-semibold text-red-600">₵{detailedEarnings.buckets.surge.toFixed(0)}</span>
                </div>
              )}
              
              {detailedEarnings.buckets.tips > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">💵 Tips Received</span>
                  <span className="font-semibold text-purple-600">₵{detailedEarnings.buckets.tips.toFixed(0)}</span>
                </div>
              )}
              
              {detailedEarnings.buckets.recyclables > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">♻️ Recyclables Share</span>
                  <span className="font-semibold text-teal-600">₵{detailedEarnings.buckets.recyclables.toFixed(0)}</span>
                </div>
              )}
              
              {detailedEarnings.buckets.loyalty > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-700">⭐ Loyalty Cashback</span>
                  <span className="font-semibold text-indigo-600">₵{detailedEarnings.buckets.loyalty.toFixed(0)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-3 border-t-2 mt-2">
                <span className="text-lg font-bold">Total Earnings</span>
                <span className="text-xl font-bold text-green-600">₵{detailedEarnings.total.toFixed(0)}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Loyalty Tier Info */}
        {loyaltyTier && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow mb-6 p-4 text-white">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">⭐ {loyaltyTier.tier} Tier</h3>
              <span className="text-sm bg-white bg-opacity-20 px-3 py-1 rounded-full">
                {(loyaltyTier.cashback_rate * 100).toFixed(0)}% Cashback
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>Monthly Cashback</span>
              <span className="font-semibold">₵{loyaltyTier.cashback_earned?.toFixed(0) || 0} / ₵{loyaltyTier.monthly_cap}</span>
            </div>
            <div className="w-full bg-white bg-opacity-30 rounded-full h-2 mt-2">
              <div 
                className="bg-white h-2 rounded-full transition-all" 
                style={{ width: `${Math.min(((loyaltyTier.cashback_earned || 0) / loyaltyTier.monthly_cap) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="flex justify-center gap-2 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-base font-bold transition-all ${
              activeTab === 'summary' 
                ? 'bg-green-500 text-white shadow-md' 
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('summary')}
          >
            <span className="text-lg">📊</span>
            <span>Summary</span>
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-base font-bold transition-all ${
              activeTab === 'transactions' 
                ? 'bg-green-500 text-white shadow-md' 
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('transactions')}
          >
            <span className="text-lg">📋</span>
            <span>Transactions</span>
          </button>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'summary' && (
          <div>
            {/* Earnings Line Chart */}
            <EarningsLineChart data={earningsData[period]} period={period} />
            
            {/* Stats Summary */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">This {period.charAt(0).toUpperCase() + period.slice(1)}</p>
                <p className="text-xl font-bold">
                  ₵{period === 'week' ? weeklyEarnings.toFixed(2) : 
                      period === 'month' ? monthlyEarnings.toFixed(2) : 
                      stats.totalEarnings.toFixed(2)}
                </p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Avg. per Job</p>
                <p className="text-xl font-bold">₵{stats.avgPerJob.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="card">
              <h3 className="font-bold text-lg mb-2">Performance</h3>
              <div className="flex justify-between mb-2">
                <span className="text-sm">Rating</span>
                <span className="font-bold">{stats.rating.toFixed(1)}/5.0</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${(stats.rating / 5) * 100}%` }}></div>
              </div>
              
              <div className="flex justify-between mb-2">
                <span className="text-sm">Completion Rate</span>
                <span className="font-bold">{stats.completionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${stats.completionRate}%` }}></div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'transactions' && (
          <div className="card">
            <h3 className="font-bold text-lg mb-4">Recent Transactions</h3>
            {/* Fix #7: Paginated transactions */}
            <div className="divide-y">
              {paginatedTransactions.map((transaction, index) => (
                <TransactionItem key={transaction.id || index} transaction={transaction} />
              ))}
              {transactions.length === 0 && (
                <p className="text-gray-500 text-center py-4">No transactions yet</p>
              )}
            </div>
            
            {/* Fix #7: Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <button
                  onClick={() => setTransactionPage(p => Math.max(1, p - 1))}
                  disabled={transactionPage === 1}
                  className={`px-3 py-1 rounded ${transactionPage === 1 ? 'bg-gray-200 text-gray-400' : 'bg-primary text-white'}`}
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {transactionPage} of {totalPages} ({transactions.length} total)
                </span>
                <button
                  onClick={() => setTransactionPage(p => Math.min(totalPages, p + 1))}
                  disabled={transactionPage === totalPages}
                  className={`px-3 py-1 rounded ${transactionPage === totalPages ? 'bg-gray-200 text-gray-400' : 'bg-primary text-white'}`}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      
      <BottomNavBar />
    </div>
  );
};

export default EarningsPage;
