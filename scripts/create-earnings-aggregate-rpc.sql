-- ========================================
-- Earnings Aggregate RPC Function
-- Fix #5: Optimize N+1 database queries in earningsService.js
-- ========================================
-- This RPC function aggregates all earnings data in a single database call
-- instead of 5+ separate queries, significantly improving performance.
--
-- CRITICAL: Payment Model (SOP v4.5.6)
-- - Platform fee (GHC 1.00) is EXCLUDED from sharing
-- - shareableAmount = fee - 1.00
-- - Collector gets 85-92% of shareableAmount based on deadhead distance
-- - 87% is used as DEFAULT when deadhead info is unavailable (average of 85-92%)
-- ========================================

-- Platform fee constant (GHC 1.00)
-- DO NOT CHANGE without updating earningsService.js and disposalService.js
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_fee_type') THEN
    CREATE TYPE platform_fee_type AS (fee DECIMAL);
  END IF;
END $$;

-- 1. Create the main aggregate function
CREATE OR REPLACE FUNCTION get_collector_earnings_aggregate(
  p_collector_id UUID,
  p_start_date TIMESTAMP DEFAULT NULL,
  p_end_date TIMESTAMP DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_start_date TIMESTAMP := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
  v_end_date TIMESTAMP := COALESCE(p_end_date, NOW());
BEGIN
  SELECT json_build_object(
    -- Pickup request earnings (disposed)
    -- CRITICAL: Exclude platform fee (GHC 1.00) before applying 87% share
    -- shareableAmount = fee - 1.00, collector gets 87% of that
    'pickup_earnings', (
      SELECT json_build_object(
        'total', COALESCE(SUM(GREATEST(fee - 1.00, 0) * 0.87), 0),
        'core', COALESCE(SUM(GREATEST(fee - 1.00, 0) * 0.70), 0),
        'urgent', 0,
        'distance', 0,
        'surge', 0,
        'tips', 0,
        'recyclables', 0,
        'loyalty', 0,
        'count', COUNT(*),
        'items', COALESCE(json_agg(json_build_object(
          'id', id,
          'status', status,
          'waste_type', waste_type,
          'fee', fee,
          'collector_total_payout', GREATEST(fee - 1.00, 0) * 0.87,
          'created_at', created_at,
          'disposed_at', updated_at
        ) ORDER BY created_at DESC), '[]'::json)
      )
      FROM pickup_requests
      WHERE collector_id = p_collector_id
        AND status = 'disposed'
        AND created_at BETWEEN v_start_date AND v_end_date
    ),
    
    -- Pending pickup earnings (picked_up but not disposed)
    -- CRITICAL: Exclude platform fee (GHC 1.00) before applying 87% share
    'pending_earnings', (
      SELECT json_build_object(
        'total', COALESCE(SUM(GREATEST(fee - 1.00, 0) * 0.87), 0),
        'count', COUNT(*),
        'items', COALESCE(json_agg(json_build_object(
          'id', id,
          'status', status,
          'waste_type', waste_type,
          'fee', fee,
          'collector_total_payout', GREATEST(fee - 1.00, 0) * 0.87,
          'created_at', created_at
        ) ORDER BY created_at DESC), '[]'::json)
      )
      FROM pickup_requests
      WHERE collector_id = p_collector_id
        AND status = 'picked_up'
    ),
    
    -- Digital bin earnings (disposed)
    'digital_bin_earnings', (
      SELECT json_build_object(
        'total', COALESCE(SUM(collector_total_payout), 0),
        'core', COALESCE(SUM(collector_core_payout), 0),
        'urgent', COALESCE(SUM(collector_urgent_payout), 0),
        'distance', COALESCE(SUM(collector_distance_payout), 0),
        'surge', COALESCE(SUM(collector_surge_payout), 0),
        'tips', COALESCE(SUM(collector_tips), 0),
        'recyclables', COALESCE(SUM(collector_recyclables_payout), 0),
        'loyalty', COALESCE(SUM(collector_loyalty_cashback), 0),
        'count', COUNT(*),
        'items', COALESCE(json_agg(json_build_object(
          'id', id,
          'status', status,
          'waste_type', waste_type,
          'collector_total_payout', collector_total_payout,
          'created_at', created_at,
          'disposed_at', disposed_at
        ) ORDER BY created_at DESC), '[]'::json)
      )
      FROM digital_bins
      WHERE collector_id = p_collector_id
        AND status = 'disposed'
        AND created_at BETWEEN v_start_date AND v_end_date
    ),
    
    -- Pending digital bin earnings
    'pending_digital_bins', (
      SELECT json_build_object(
        'total', COALESCE(SUM(COALESCE(collector_total_payout, 5.0)), 0),
        'count', COUNT(*)
      )
      FROM digital_bins
      WHERE collector_id = p_collector_id
        AND status = 'picked_up'
    ),
    
    -- Platform share (App Bucket) - platform fee (1.00) + 13% of shareable amount
    -- CRITICAL: Platform gets GHC 1.00 fixed fee + 13% of (fee - 1.00)
    'platform_share', (
      SELECT COALESCE(SUM(1.00 + GREATEST(fee - 1.00, 0) * 0.13), 0)
      FROM pickup_requests
      WHERE collector_id = p_collector_id
        AND status = 'disposed'
        AND created_at BETWEEN v_start_date AND v_end_date
    ),
    
    -- Payment settlements (cash vs digital)
    'settlements', (
      SELECT json_build_object(
        'cash_collected', COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN total_bill ELSE 0 END), 0),
        'digital_collected', COALESCE(SUM(CASE WHEN payment_mode != 'cash' THEN total_bill ELSE 0 END), 0),
        'total_collected', COALESCE(SUM(total_bill), 0)
      )
      FROM bin_payments
      WHERE collector_id = (
        SELECT id FROM collector_profiles WHERE user_id = p_collector_id LIMIT 1
      )
        AND type = 'collection'
        AND status = 'success'
        AND created_at BETWEEN v_start_date AND v_end_date
    ),
    
    -- Job counts
    'job_counts', (
      SELECT json_build_object(
        'total_picked_up', (
          SELECT COUNT(*) FROM pickup_requests 
          WHERE collector_id = p_collector_id AND status IN ('picked_up', 'disposed')
        ),
        'total_disposed', (
          SELECT COUNT(*) FROM pickup_requests 
          WHERE collector_id = p_collector_id AND status = 'disposed'
        ),
        'bins_picked_up', (
          SELECT COUNT(*) FROM digital_bins 
          WHERE collector_id = p_collector_id AND status IN ('picked_up', 'disposed')
        ),
        'bins_disposed', (
          SELECT COUNT(*) FROM digital_bins 
          WHERE collector_id = p_collector_id AND status = 'disposed'
        )
      )
    ),
    
    -- Completion rate
    'completion_rate', (
      SELECT CASE 
        WHEN COUNT(*) = 0 THEN 100.0
        ELSE ROUND((COUNT(*) FILTER (WHERE status = 'disposed')::DECIMAL / COUNT(*)) * 100, 1)
      END
      FROM pickup_requests
      WHERE collector_id = p_collector_id
        AND status IN ('accepted', 'picked_up', 'disposed')
    ),
    
    -- Weekly earnings (last 7 days)
    -- CRITICAL: Exclude platform fee before applying share
    'weekly_earnings', (
      SELECT COALESCE(SUM(GREATEST(fee - 1.00, 0) * 0.87), 0)
      FROM pickup_requests
      WHERE collector_id = p_collector_id
        AND status = 'disposed'
        AND created_at >= NOW() - INTERVAL '7 days'
    ),
    
    -- Monthly earnings (last 30 days)
    -- CRITICAL: Exclude platform fee before applying share
    'monthly_earnings', (
      SELECT COALESCE(SUM(GREATEST(fee - 1.00, 0) * 0.87), 0)
      FROM pickup_requests
      WHERE collector_id = p_collector_id
        AND status = 'disposed'
        AND created_at >= NOW() - INTERVAL '30 days'
    ),
    
    -- Loyalty tier info
    'loyalty_tier', (
      SELECT json_build_object(
        'tier', COALESCE(tier, 'Silver'),
        'cashback_rate', COALESCE(cashback_rate, 0.01),
        'monthly_cap', COALESCE(monthly_cap, 100),
        'cashback_earned', COALESCE(cashback_earned, 0)
      )
      FROM collector_loyalty_tiers
      WHERE collector_id = p_collector_id
        AND month = DATE_TRUNC('month', NOW())::DATE
      LIMIT 1
    ),
    
    -- Recent tips
    'tips_received', (
      SELECT json_build_object(
        'total', COALESCE(SUM(amount), 0),
        'count', COUNT(*),
        'recent', COALESCE(json_agg(json_build_object(
          'id', id,
          'amount', amount,
          'created_at', created_at
        ) ORDER BY created_at DESC) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), '[]'::json)
      )
      FROM collector_tips
      WHERE collector_id = p_collector_id
        AND status = 'confirmed'
    ),
    
    -- Chart data (daily earnings for last 30 days)
    'chart_data', (
      SELECT COALESCE(json_agg(day_data ORDER BY day), '[]'::json)
      FROM (
        SELECT 
          DATE(created_at) as day,
          json_build_object(
            'date', DATE(created_at),
            'amount', COALESCE(SUM(GREATEST(fee - 1.00, 0) * 0.87), 0),
            'count', COUNT(*)
          ) as day_data
        FROM pickup_requests
        WHERE collector_id = p_collector_id
          AND status = 'disposed'
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
      ) daily
    ),
    
    -- Metadata
    'generated_at', NOW(),
    'period', json_build_object(
      'start', v_start_date,
      'end', v_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_collector_earnings_aggregate(UUID, TIMESTAMP, TIMESTAMP) TO authenticated;

-- 2. Create a simpler summary function for quick lookups
CREATE OR REPLACE FUNCTION get_collector_earnings_summary(p_collector_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- CRITICAL: All calculations exclude platform fee (GHC 1.00) before applying share
  SELECT json_build_object(
    'total_earnings', (
      SELECT COALESCE(SUM(payout), 0)
      FROM (
        SELECT GREATEST(fee - 1.00, 0) * 0.87 as payout FROM pickup_requests 
        WHERE collector_id = p_collector_id AND status = 'disposed'
        UNION ALL
        SELECT collector_total_payout as payout FROM digital_bins 
        WHERE collector_id = p_collector_id AND status = 'disposed'
      ) combined
    ),
    'pending_earnings', (
      SELECT COALESCE(SUM(GREATEST(fee - 1.00, 0) * 0.87), 0)
      FROM pickup_requests
      WHERE collector_id = p_collector_id AND status = 'picked_up'
    ),
    'weekly_earnings', (
      SELECT COALESCE(SUM(GREATEST(fee - 1.00, 0) * 0.87), 0)
      FROM pickup_requests
      WHERE collector_id = p_collector_id 
        AND status = 'disposed'
        AND created_at >= NOW() - INTERVAL '7 days'
    ),
    'monthly_earnings', (
      SELECT COALESCE(SUM(GREATEST(fee - 1.00, 0) * 0.87), 0)
      FROM pickup_requests
      WHERE collector_id = p_collector_id 
        AND status = 'disposed'
        AND created_at >= NOW() - INTERVAL '30 days'
    ),
    'total_jobs', (
      SELECT COUNT(*) FROM pickup_requests 
      WHERE collector_id = p_collector_id AND status = 'disposed'
    ),
    'completion_rate', (
      SELECT CASE 
        WHEN COUNT(*) = 0 THEN 100.0
        ELSE ROUND((COUNT(*) FILTER (WHERE status = 'disposed')::DECIMAL / COUNT(*)) * 100, 1)
      END
      FROM pickup_requests
      WHERE collector_id = p_collector_id AND status IN ('accepted', 'picked_up', 'disposed')
    )
  );
$$;

GRANT EXECUTE ON FUNCTION get_collector_earnings_summary(UUID) TO authenticated;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Test the aggregate function (replace with actual collector ID)
-- SELECT get_collector_earnings_aggregate('your-collector-user-id'::uuid);

-- Test the summary function
-- SELECT get_collector_earnings_summary('your-collector-user-id'::uuid);

-- Check function exists
SELECT EXISTS (
  SELECT FROM pg_proc 
  WHERE proname = 'get_collector_earnings_aggregate'
) AS aggregate_function_exists;

SELECT EXISTS (
  SELECT FROM pg_proc 
  WHERE proname = 'get_collector_earnings_summary'
) AS summary_function_exists;
