import { useState, useEffect } from 'react';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../context/AuthContext';
import { createEarningsService } from '../services/earningsService';

// Cash Out Modal Component
const CashOutModal = ({ isOpen, onClose, totalEarnings, onWithdrawalSuccess }) => {
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
    
    if (parseFloat(amount) > totalEarnings) {
      setError(`Amount cannot exceed your total earnings of ₵${totalEarnings.toFixed(2)}`);
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
      // Simulate API call to payment gateway
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, this would be an API call to the payment gateway
      // const response = await fetch('/api/cashout', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ amount, paymentMethod, momoNumber, momoProvider })
      // });
      // const data = await response.json();
      // if (!response.ok) throw new Error(data.message);
      
      // Update the total earnings by subtracting the withdrawn amount
      const withdrawnAmount = parseFloat(amount);
      onWithdrawalSuccess(withdrawnAmount);
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
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
            <h2 className="text-xl font-bold">Cash Out</h2>
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
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="amount">
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
                <p className="text-sm text-gray-500 mt-1">Available: ₵{totalEarnings.toFixed(2)}</p>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
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
                    <label htmlFor="momo" className="ml-2 text-gray-700">
                      Mobile Money (MOMO)
                    </label>
                  </div>
                </div>
              </div>
              
              {paymentMethod === 'momo' && (
                <>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      MOMO Provider
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        className={`py-2 px-3 rounded-lg border ${momoProvider === 'mtn' ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}
                        onClick={() => setMomoProvider('mtn')}
                      >
                        MTN
                      </button>
                      <button
                        type="button"
                        className={`py-2 px-3 rounded-lg border ${momoProvider === 'vodafone' ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}
                        onClick={() => setMomoProvider('vodafone')}
                      >
                        Vodafone
                      </button>
                      <button
                        type="button"
                        className={`py-2 px-3 rounded-lg border ${momoProvider === 'airtel' ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}
                        onClick={() => setMomoProvider('airtel')}
                      >
                        AirtelTigo
                      </button>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="momoNumber">
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
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{transaction.note}</p>
      )}
    </div>
  );
};

const EarningsPage = () => {
  const { auth } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [period, setPeriod] = useState('week');
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    completedJobs: 0,
    avgPerJob: 0,
    rating: 0,
    completionRate: 0
  });
  const [earningsData, setEarningsData] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [showCashOutModal, setShowCashOutModal] = useState(false);

  // Fetch earnings and stats
  const fetchEarningsData = async () => {
    try {
      setIsLoading(true);
      const { data: userData } = await auth.getUser();
      if (!userData?.user?.id) {
        throw new Error('User not authenticated');
      }

      const earningsService = createEarningsService(userData.user.id);
      const { success, data, error } = await earningsService.getEarningsData();

      if (!success || error) {
        throw new Error(error || 'Failed to fetch earnings data');
      }

      setEarningsData(data.chartData);
      setStats(data.stats);
      setTransactions(data.transactions);
      setTotalEarnings(data.stats.totalEarnings);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      setIsLoading(false);
    }
  };

  const handleWithdrawalSuccess = async (amount) => {
    try {
      const { data: userData } = await auth.getUser();
      if (!userData?.user?.id) {
        throw new Error('User not authenticated');
      }

      const earningsService = createEarningsService(userData.user.id);
      const { success, error } = await earningsService.processWithdrawal(amount, {
        method: 'momo', // Default to mobile money for now
        timestamp: new Date().toISOString()
      });

      if (!success || error) {
        throw new Error(error || 'Failed to process withdrawal');
      }

      // Update total earnings
      setTotalEarnings(prev => prev - amount);
      
      // Refresh data to reflect the withdrawal
      await fetchEarningsData();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      // You might want to show an error toast here
    }
  };

  // Load data when component mounts
  useEffect(() => {
    fetchEarningsData();
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <TopNavBar user={{ first_name: 'Driver' }} />
        <div className="flex-grow mt-14 mb-16 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-gray-600">Loading earnings data...</p>
          </div>
        </div>
        <BottomNavBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopNavBar user={{ first_name: 'Driver' }} />
      
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
          onWithdrawalSuccess={handleWithdrawalSuccess}
        />
        
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
        
        {/* Tab Navigation */}
        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 ${activeTab === 'summary' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'transactions' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
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
            <div className="divide-y">
              {transactions.map((transaction, index) => (
                <TransactionItem key={index} transaction={transaction} />
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
      
      <BottomNavBar />
    </div>
  );
};

export default EarningsPage;
