import { useState } from 'react';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';

// Chart component (simplified for this example)
const EarningsChart = ({ data, period }) => {
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
  
  // Sample earnings data
  const earningsData = {
    week: [
      { label: 'Mon', amount: 42 },
      { label: 'Tue', amount: 65 },
      { label: 'Wed', amount: 30 },
      { label: 'Thu', amount: 75 },
      { label: 'Fri', amount: 55 },
      { label: 'Sat', amount: 90 },
      { label: 'Sun', amount: 40 },
    ],
    month: [
      { label: 'W1', amount: 240 },
      { label: 'W2', amount: 320 },
      { label: 'W3', amount: 280 },
      { label: 'W4', amount: 350 },
    ],
    year: [
      { label: 'Jan', amount: 1100 },
      { label: 'Feb', amount: 950 },
      { label: 'Mar', amount: 1300 },
      { label: 'Apr', amount: 1050 },
      { label: 'May', amount: 1200 },
      { label: 'Jun', amount: 1400 },
      { label: 'Jul', amount: 900 },
      { label: 'Aug', amount: 0 },
      { label: 'Sep', amount: 0 },
      { label: 'Oct', amount: 0 },
      { label: 'Nov', amount: 0 },
      { label: 'Dec', amount: 0 },
    ]
  };
  
  // Sample transactions
  const transactions = [
    {
      id: 'TR001',
      type: 'pickup_request',
      amount: 15,
      date: '2025-07-14T13:30:00Z',
      note: 'Plastic waste collection'
    },
    {
      id: 'TR002',
      type: 'authority_assignment',
      amount: 35,
      date: '2025-07-13T14:45:00Z',
      note: 'Street cleaning assignment'
    },
    {
      id: 'TR003',
      type: 'pickup_request',
      amount: 20,
      date: '2025-07-12T09:15:00Z',
      note: 'Glass waste collection'
    },
    {
      id: 'TR004',
      type: 'bonus',
      amount: 50,
      date: '2025-07-10T16:20:00Z',
      note: 'Weekly performance bonus'
    },
    {
      id: 'TR005',
      type: 'referral',
      amount: 25,
      date: '2025-07-08T11:10:00Z',
      note: 'New driver referral'
    }
  ];
  
  // Calculate stats
  const totalEarnings = transactions.reduce((sum, t) => sum + t.amount, 0);
  const weeklyEarnings = earningsData.week.reduce((sum, d) => sum + d.amount, 0);
  const monthlyEarnings = earningsData.month.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopNavBar user={{ first_name: 'Driver' }} />
      
      <div className="flex-grow mt-14 mb-16 px-4 py-3">
        <h1 className="text-2xl font-bold mb-4">Earnings</h1>
        
        {/* Summary Card */}
        <div className="card mb-4">
          <h2 className="text-xl font-bold mb-3">Your Balance</h2>
          <div className="text-3xl font-bold text-primary mb-4">₵{totalEarnings.toFixed(2)}</div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
              <p className="text-sm text-gray-500 mb-1">This Week</p>
              <p className="text-xl font-bold">₵{weeklyEarnings.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
              <p className="text-sm text-gray-500 mb-1">This Month</p>
              <p className="text-xl font-bold">₵{monthlyEarnings.toFixed(2)}</p>
            </div>
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
            {/* Period Selector */}
            <div className="flex justify-center mb-4">
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
            
            {/* Earnings Chart */}
            <EarningsChart data={earningsData[period]} period={period} />
            
            {/* Stats Summary */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Collections</p>
                <p className="text-xl font-bold">23</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500 mb-1">Avg. per Trip</p>
                <p className="text-xl font-bold">₵18.25</p>
              </div>
            </div>
            
            <div className="card">
              <h3 className="font-bold text-lg mb-2">Performance</h3>
              <div className="flex justify-between mb-2">
                <span className="text-sm">Rating</span>
                <span className="font-bold">4.8/5.0</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: '96%' }}></div>
              </div>
              
              <div className="flex justify-between mb-2">
                <span className="text-sm">Completion Rate</span>
                <span className="font-bold">98%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: '98%' }}></div>
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
      
      <BottomNavBar />
    </div>
  );
};

export default EarningsPage;
