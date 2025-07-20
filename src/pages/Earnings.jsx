import { useState, useEffect } from 'react';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
  const [period, setPeriod] = useState('week');
  const [activeTab, setActiveTab] = useState('summary');
  const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);
  const [currentEarnings, setCurrentEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Real data states
  const [earningsData, setEarningsData] = useState({ week: [], month: [], year: [] });
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    completedJobs: 0,
    avgPerJob: 0,
    rating: 0,
    completionRate: 0
  });

  // Fetch earnings and stats from Supabase
  const fetchEarningsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Fetching real earnings data from Supabase...');
      
      // Fetch completed assignments and requests
      const [assignmentsResult, requestsResult] = await Promise.all([
        supabase
          .from('authority_assignments')
          .select('*')
          .eq('status', 'completed')
          .order('updated_at', { ascending: false }),
        supabase
          .from('pickup_requests')
          .select('*')
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
      ]);
      
      if (assignmentsResult.error) {
        console.error('Error fetching assignments:', assignmentsResult.error);
        throw assignmentsResult.error;
      }
      
      if (requestsResult.error) {
        console.error('Error fetching requests:', requestsResult.error);
        throw requestsResult.error;
      }
      
      const completedAssignments = assignmentsResult.data || [];
      const completedRequests = requestsResult.data || [];
      
      console.log(`✅ Found ${completedAssignments.length} completed assignments and ${completedRequests.length} completed requests`);
      
      // Calculate earnings and stats
      const allCompletedJobs = [...completedAssignments, ...completedRequests];
      const totalEarnings = allCompletedJobs.reduce((sum, job) => {
        const payment = parseFloat((job.payment || job.fee || '0').toString().replace(/[\$₵,]/g, '')) || 0;
        return sum + payment;
      }, 0);
      
      const completedJobsCount = allCompletedJobs.length;
      const avgPerJob = completedJobsCount > 0 ? totalEarnings / completedJobsCount : 0;
      
      // Calculate stats
      const newStats = {
        totalEarnings,
        completedJobs: completedJobsCount,
        avgPerJob,
        rating: 4.8, // This could be calculated from user feedback in the future
        completionRate: 98 // This could be calculated from total vs completed jobs
      };
      
      setStats(newStats);
      setCurrentEarnings(totalEarnings);
      
      // Generate earnings chart data
      const chartData = generateEarningsChartData(allCompletedJobs);
      setEarningsData(chartData);
      
      // Generate transactions list
      const transactionsList = generateTransactionsList(completedAssignments, completedRequests);
      setTransactions(transactionsList);
      
      console.log('💰 Earnings calculated:', {
        totalEarnings: totalEarnings.toFixed(2),
        completedJobs: completedJobsCount,
        avgPerJob: avgPerJob.toFixed(2)
      });
      
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      setError('Failed to load earnings data. Please try again.');
      
      // Fallback to empty data
      setStats({ totalEarnings: 0, completedJobs: 0, avgPerJob: 0, rating: 0, completionRate: 0 });
      setCurrentEarnings(0);
      setEarningsData({ week: [], month: [], year: [] });
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate chart data based on completed jobs
  const generateEarningsChartData = (jobs) => {
    const now = new Date();
    
    // Week data (last 7 days)
    const weekData = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayName = weekDays[date.getDay()];
      
      const dayEarnings = jobs
        .filter(job => {
          const jobDate = new Date(job.completed_at || job.created_at);
          return jobDate.toDateString() === date.toDateString();
        })
        .reduce((sum, job) => {
          const payment = parseFloat((job.payment || job.fee || '0').toString().replace(/[\$₵,]/g, '')) || 0;
          return sum + payment;
        }, 0);
      
      weekData.push({ label: dayName, amount: dayEarnings });
    }
    
    // Month data (last 4 weeks)
    const monthData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - 6);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      
      const weekEarnings = jobs
        .filter(job => {
          const jobDate = new Date(job.completed_at || job.created_at);
          return jobDate >= weekStart && jobDate <= weekEnd;
        })
        .reduce((sum, job) => {
          const payment = parseFloat((job.payment || job.fee || '0').toString().replace(/[\$₵,]/g, '')) || 0;
          return sum + payment;
        }, 0);
      
      monthData.push({ label: `W${4-i}`, amount: weekEarnings });
    }
    
    // Year data (last 12 months)
    const yearData = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthName = months[monthDate.getMonth()];
      
      const monthEarnings = jobs
        .filter(job => {
          const jobDate = new Date(job.completed_at || job.created_at);
          return jobDate.getMonth() === monthDate.getMonth() && jobDate.getFullYear() === monthDate.getFullYear();
        })
        .reduce((sum, job) => {
          const payment = parseFloat((job.payment || job.fee || '0').toString().replace(/[\$₵,]/g, '')) || 0;
          return sum + payment;
        }, 0);
      
      yearData.push({ label: monthName, amount: monthEarnings });
    }
    
    return { week: weekData, month: monthData, year: yearData };
  };
  
  // Generate transactions list from completed jobs
  const generateTransactionsList = (assignments, requests) => {
    const allTransactions = [];
    
    // Add assignments as transactions
    assignments.forEach(assignment => {
      const payment = parseFloat((assignment.payment || '0').toString().replace(/[\$₵,]/g, '')) || 0;
      if (payment > 0) {
        allTransactions.push({
          id: `ASSIGN-${assignment.id}`,
          type: 'authority_assignment',
          amount: payment,
          date: assignment.completed_at || assignment.created_at,
          note: `${assignment.type || 'Assignment'} - ${assignment.location || 'Location not specified'}`
        });
      }
    });
    
    // Add requests as transactions
    requests.forEach(request => {
      const fee = parseFloat((request.fee || '0').toString().replace(/[\$₵,]/g, '')) || 0;
      if (fee > 0) {
        allTransactions.push({
          id: `REQ-${request.id}`,
          type: 'pickup_request',
          amount: fee,
          date: request.completed_at || request.created_at,
          note: `${request.waste_type || 'Waste'} collection - ${request.location || 'Location not specified'}`
        });
      }
    });
    
    // Sort by date (newest first) and limit to recent 20
    return allTransactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20);
  };
  
  // Load data when component mounts
  useEffect(() => {
    fetchEarningsData();
  }, []);
  
  // Use the current earnings state
  const totalEarnings = currentEarnings; // This will be updated after withdrawal
  const weeklyEarnings = earningsData.week.reduce((sum, d) => sum + d.amount, 0);
  const monthlyEarnings = earningsData.month.reduce((sum, d) => sum + d.amount, 0);
  
  // Show loading state
  if (loading) {
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
  
  // Show error state
  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <TopNavBar user={{ first_name: 'Driver' }} />
        <div className="flex-grow mt-14 mb-16 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="text-red-500 text-xl mb-2">⚠️</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button 
              onClick={fetchEarningsData}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
            >
              Try Again
            </button>
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
          onClick={() => setIsCashOutModalOpen(true)}
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
          isOpen={isCashOutModalOpen} 
          onClose={() => setIsCashOutModalOpen(false)} 
          totalEarnings={totalEarnings}
          onWithdrawalSuccess={(amount) => {
            // Update the current earnings by subtracting the withdrawn amount
            setCurrentEarnings(prevEarnings => {
              const newEarnings = prevEarnings - amount;
              return Math.max(0, parseFloat(newEarnings.toFixed(2))); // Ensure we don't go below 0 and format to 2 decimal places
            });
          }}
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
