import { supabase, DEV_MODE } from './supabase';

// Mock data for dev mode
const mockTransactions = [
  {
    id: 'mock-trans-1',
    type: 'pickup',
    amount: 50,
    status: 'completed',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    location: 'Test Location 1',
    customer: 'Customer #1'
  },
  {
    id: 'mock-trans-2',
    type: 'pickup',
    amount: 75,
    status: 'completed',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    location: 'Test Location 2',
    customer: 'Customer #2'
  }
];

class EarningsService {
  constructor(collectorId) {
    this.collectorId = collectorId;
  }

  async getEarningsData() {
    try {
      if (DEV_MODE) {
        console.log('[DEV MODE] Using mock earnings data');
        return {
          success: true,
          data: {
            transactions: mockTransactions,
            chartData: {
              week: [
                { label: 'Mon', amount: 20 },
                { label: 'Tue', amount: 0 },
                { label: 'Wed', amount: 30 },
                { label: 'Thu', amount: 25 },
                { label: 'Fri', amount: 50 },
                { label: 'Sat', amount: 0 },
                { label: 'Sun', amount: 0 }
              ],
              month: [
                { label: 'W1', amount: 75 },
                { label: 'W2', amount: 50 },
                { label: 'W3', amount: 0 },
                { label: 'W4', amount: 0 }
              ],
              year: [
                { label: 'Jan', amount: 125 },
                { label: 'Feb', amount: 0 },
                { label: 'Mar', amount: 0 },
                { label: 'Apr', amount: 0 },
                { label: 'May', amount: 0 },
                { label: 'Jun', amount: 0 },
                { label: 'Jul', amount: 0 },
                { label: 'Aug', amount: 0 },
                { label: 'Sep', amount: 0 },
                { label: 'Oct', amount: 0 },
                { label: 'Nov', amount: 0 },
                { label: 'Dec', amount: 0 }
              ]
            },
            stats: {
              totalEarnings: 125,
              completedJobs: 2,
              avgPerJob: 62.5,
              rating: 4.8,
              completionRate: 95,
              weeklyEarnings: 125,
              monthlyEarnings: 125
            }
          }
        };
      }

      // Get completed pickups
      const { data: completedPickups, error: pickupsError } = await supabase
        .from('pickup_requests')
        .select('*')
        .eq('collector_id', this.collectorId)
        .eq('status', 'picked_up');

      if (pickupsError) throw pickupsError;

      // Calculate earnings stats
      const totalEarnings = completedPickups?.reduce((sum, pickup) => sum + (pickup.fee || 0), 0) || 0;
      const completedJobs = completedPickups?.length || 0;
      const avgPerJob = completedJobs > 0 ? totalEarnings / completedJobs : 0;

      // Calculate weekly and monthly earnings
      const now = new Date();
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const weeklyEarnings = completedPickups
        ?.filter(p => new Date(p.picked_up_at) > weekAgo)
        ?.reduce((sum, p) => sum + (p.fee || 0), 0) || 0;

      const monthlyEarnings = completedPickups
        ?.filter(p => new Date(p.picked_up_at) > monthAgo)
        ?.reduce((sum, p) => sum + (p.fee || 0), 0) || 0;

      // Format transactions
      const transactions = completedPickups?.map(pickup => ({
        id: pickup.id,
        type: 'pickup',
        amount: pickup.fee || 0,
        status: 'completed',
        timestamp: pickup.picked_up_at,
        location: pickup.location,
        customer: `Customer #${pickup.id}`
      })) || [];

      // Generate chart data from actual pickup data
      const generateChartData = (pickups) => {
        const today = new Date();
        
        // Week data (last 7 days)
        const weekData = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today - i * 24 * 60 * 60 * 1000);
          const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
          const dayEarnings = pickups
            ?.filter(p => new Date(p.picked_up_at).toDateString() === date.toDateString())
            ?.reduce((sum, p) => sum + (p.fee || 0), 0) || 0;
          return { label: dayName, amount: dayEarnings };
        }).reverse();

        // Month data (last 4 weeks)
        const monthData = Array.from({ length: 4 }, (_, i) => {
          const weekStart = new Date(today - (i + 1) * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = new Date(today - i * 7 * 24 * 60 * 60 * 1000);
          const weekEarnings = pickups
            ?.filter(p => {
              const pickupDate = new Date(p.picked_up_at);
              return pickupDate >= weekStart && pickupDate < weekEnd;
            })
            ?.reduce((sum, p) => sum + (p.fee || 0), 0) || 0;
          return { label: `W${4-i}`, amount: weekEarnings };
        }).reverse();

        // Year data (last 12 months)
        const yearData = Array.from({ length: 12 }, (_, i) => {
          const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
          const monthName = monthStart.toLocaleDateString('en-US', { month: 'short' });
          const monthEarnings = pickups
            ?.filter(p => {
              const pickupDate = new Date(p.picked_up_at);
              return pickupDate >= monthStart && pickupDate <= monthEnd;
            })
            ?.reduce((sum, p) => sum + (p.fee || 0), 0) || 0;
          return { label: monthName, amount: monthEarnings };
        }).reverse();

        return { week: weekData, month: monthData, year: yearData };
      };

      const chartData = generateChartData(completedPickups);

      return {
        success: true,
        data: {
          transactions,
          chartData,
          stats: {
            totalEarnings,
            completedJobs,
            avgPerJob,
            rating: 4.8, // Placeholder until rating system is implemented
            completionRate: 95, // Placeholder until completion rate tracking is implemented
            weeklyEarnings,
            monthlyEarnings
          }
        }
      };

    } catch (error) {
      console.error('Error fetching earnings data:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  async processWithdrawal(amount, paymentDetails) {
    try {
      if (DEV_MODE) {
        console.log('[DEV MODE] Simulating withdrawal:', {
          amount,
          paymentDetails
        });
        return {
          success: true,
          message: '[DEV MODE] Withdrawal processed successfully'
        };
      }

      // In production, this would integrate with a payment gateway
      // For now, just record the withdrawal in our database
      const { error } = await supabase
        .from('withdrawals')
        .insert({
          collector_id: this.collectorId,
          amount,
          payment_method: paymentDetails.method,
          payment_details: paymentDetails,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      return {
        success: true,
        message: 'Withdrawal request submitted successfully'
      };

    } catch (error) {
      console.error('Error processing withdrawal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const createEarningsService = (collectorId) => {
  return new EarningsService(collectorId);
};

export default EarningsService;
