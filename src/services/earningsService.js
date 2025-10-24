import { supabase, DEV_MODE } from './supabase';
import { logger } from '../utils/logger';

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
        logger.debug('[DEV MODE] Using mock earnings data');
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
      logger.error('Error fetching earnings data:', error);
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
        logger.debug('[DEV MODE] Simulating withdrawal:', {
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
      logger.error('Error processing withdrawal:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get detailed earnings breakdown by bucket type (SOP v4.5.6)
   * Falls back to legacy fee calculation if new fields unavailable
   * 
   * @returns {Promise<Object>} Earnings breakdown by bucket type
   */
  async getDetailedEarningsBreakdown() {
    try {
      if (DEV_MODE) {
        logger.debug('[DEV MODE] Using mock detailed earnings breakdown');
        return {
          success: true,
          data: {
            buckets: {
              core: 850,
              urgent: 120,
              distance: 45,
              surge: 80,
              tips: 35,
              recyclables: 60,
              loyalty: 15
            },
            total: 1205,
            jobCount: 15,
            breakdown: [
              { type: 'core', amount: 850, percentage: 70.5 },
              { type: 'urgent', amount: 120, percentage: 10.0 },
              { type: 'distance', amount: 45, percentage: 3.7 },
              { type: 'surge', amount: 80, percentage: 6.6 },
              { type: 'tips', amount: 35, percentage: 2.9 },
              { type: 'recyclables', amount: 60, percentage: 5.0 },
              { type: 'loyalty', amount: 15, percentage: 1.2 }
            ]
          }
        };
      }

      // Get completed pickups with all fields
      const { data: completedPickups, error: pickupsError } = await supabase
        .from('pickup_requests')
        .select('*')
        .eq('collector_id', this.collectorId)
        .eq('status', 'picked_up');

      if (pickupsError) throw pickupsError;

      // Aggregate by bucket type
      const buckets = {
        core: 0,
        urgent: 0,
        distance: 0,
        surge: 0,
        tips: 0,
        recyclables: 0,
        loyalty: 0
      };

      completedPickups?.forEach(pickup => {
        // Use new fields if available, fallback to proportional split of fee
        if (pickup.collector_core_payout !== null && pickup.collector_core_payout !== undefined) {
          buckets.core += pickup.collector_core_payout || 0;
          buckets.urgent += pickup.collector_urgent_payout || 0;
          buckets.distance += pickup.collector_distance_payout || 0;
          buckets.surge += pickup.collector_surge_payout || 0;
          buckets.tips += pickup.collector_tips || 0;
          buckets.recyclables += pickup.collector_recyclables_payout || 0;
          buckets.loyalty += pickup.collector_loyalty_cashback || 0;
        } else {
          // Legacy: all earnings go to core bucket
          buckets.core += pickup.fee || 0;
        }
      });

      const total = Object.values(buckets).reduce((sum, val) => sum + val, 0);

      // Calculate percentages
      const breakdown = Object.keys(buckets).map(type => ({
        type,
        amount: buckets[type],
        percentage: total > 0 ? (buckets[type] / total) * 100 : 0
      }));

      return {
        success: true,
        data: {
          buckets,
          total,
          jobCount: completedPickups?.length || 0,
          breakdown
        }
      };

    } catch (error) {
      logger.error('Error fetching detailed earnings breakdown:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Get payout transactions with type breakdown
   * 
   * @param {string} [timeframe='30d'] - Timeframe for transactions (7d, 30d, 90d)
   * @returns {Promise<Object>} Transactions grouped by type
   */
  async getPayoutTransactions(timeframe = '30d') {
    try {
      if (DEV_MODE) {
        logger.debug('[DEV MODE] Using mock payout transactions');
        return {
          success: true,
          data: {
            transactions: [
              {
                id: 'mock-1',
                type: 'core',
                amount: 85,
                description: 'Base payout - Request #123',
                settled_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
              },
              {
                id: 'mock-2',
                type: 'urgent',
                amount: 25,
                description: 'Urgent bonus - Request #123',
                settled_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
              }
            ],
            byType: {
              core: 850,
              urgent: 120,
              distance: 45,
              surge: 80,
              tip: 35,
              recyclables: 60,
              loyalty: 15
            }
          }
        };
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      const days = parseInt(timeframe) || 30;
      startDate.setDate(endDate.getDate() - days);

      const { data: transactions, error } = await supabase
        .from('payout_transactions')
        .select('*')
        .eq('collector_id', this.collectorId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by transaction type
      const byType = {};
      transactions?.forEach(tx => {
        if (!byType[tx.transaction_type]) {
          byType[tx.transaction_type] = 0;
        }
        byType[tx.transaction_type] += tx.amount || 0;
      });

      return {
        success: true,
        data: {
          transactions: transactions || [],
          byType
        }
      };

    } catch (error) {
      logger.error('Error fetching payout transactions:', error);
      return {
        success: false,
        error: error.message,
        data: { transactions: [], byType: {} }
      };
    }
  }

  /**
   * Get current loyalty tier information
   * 
   * @returns {Promise<Object>} Loyalty tier details
   */
  async getLoyaltyTier() {
    try {
      if (DEV_MODE) {
        logger.debug('[DEV MODE] Using mock loyalty tier');
        return {
          success: true,
          data: {
            tier: 'Gold',
            cashback_rate: 0.02,
            monthly_cap: 200,
            cashback_earned: 45,
            remaining: 155,
            csat_score: 4.8,
            completion_rate: 95,
            recyclables_percentage: 15
          }
        };
      }

      // Get current month (first day)
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthStr = currentMonth.toISOString().split('T')[0];

      const { data: tier, error } = await supabase
        .from('collector_loyalty_tiers')
        .select('*')
        .eq('collector_id', this.collectorId)
        .eq('month', currentMonthStr)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Default to Silver if no tier found
      const tierData = tier || {
        tier: 'Silver',
        cashback_rate: 0.01,
        monthly_cap: 100,
        cashback_earned: 0,
        csat_score: 0,
        completion_rate: 0,
        recyclables_percentage: 0
      };

      return {
        success: true,
        data: {
          ...tierData,
          remaining: (tierData.monthly_cap || 0) - (tierData.cashback_earned || 0)
        }
      };

    } catch (error) {
      logger.error('Error fetching loyalty tier:', error);
      return {
        success: false,
        error: error.message,
        data: {
          tier: 'Silver',
          cashback_rate: 0.01,
          monthly_cap: 100,
          cashback_earned: 0,
          remaining: 100
        }
      };
    }
  }

  /**
   * Get tips received (all-time and by timeframe)
   * 
   * @param {string} [timeframe='30d'] - Timeframe for tips
   * @returns {Promise<Object>} Tips summary
   */
  async getTipsReceived(timeframe = '30d') {
    try {
      if (DEV_MODE) {
        logger.debug('[DEV MODE] Using mock tips data');
        return {
          success: true,
          data: {
            total: 35,
            count: 5,
            average: 7,
            byType: {
              pre_checkout: 15,
              post_completion: 20
            }
          }
        };
      }

      const endDate = new Date();
      const startDate = new Date();
      const days = parseInt(timeframe) || 30;
      startDate.setDate(endDate.getDate() - days);

      const { data: tips, error } = await supabase
        .from('collector_tips')
        .select('*')
        .eq('collector_id', this.collectorId)
        .eq('status', 'confirmed')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const total = tips?.reduce((sum, tip) => sum + (tip.amount || 0), 0) || 0;
      const count = tips?.length || 0;
      const average = count > 0 ? total / count : 0;

      const byType = {
        pre_checkout: 0,
        post_completion: 0
      };

      tips?.forEach(tip => {
        if (tip.tip_type === 'pre_checkout') {
          byType.pre_checkout += tip.amount || 0;
        } else {
          byType.post_completion += tip.amount || 0;
        }
      });

      return {
        success: true,
        data: {
          total,
          count,
          average,
          byType,
          tips: tips || []
        }
      };

    } catch (error) {
      logger.error('Error fetching tips:', error);
      return {
        success: false,
        error: error.message,
        data: { total: 0, count: 0, average: 0, byType: {}, tips: [] }
      };
    }
  }
}

export const createEarningsService = (collectorId) => {
  return new EarningsService(collectorId);
};

export default EarningsService;
