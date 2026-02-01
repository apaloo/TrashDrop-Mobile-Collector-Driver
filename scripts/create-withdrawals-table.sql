-- ========================================
-- Withdrawals Table Migration
-- Fix #2: Create missing withdrawals table for earningsService.processWithdrawal()
-- ========================================
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- 1. Create withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES auth.users(id),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'mobile_money' CHECK (payment_method IN ('mobile_money', 'bank_transfer')),
  payment_details JSONB DEFAULT '{}',
  -- Mobile money fields
  phone_number VARCHAR(20),
  network VARCHAR(20) CHECK (network IN ('MTN', 'VODAFONE', 'AIRTELTIGO', NULL)),
  -- Gateway response
  gateway_transaction_id TEXT,
  gateway_response JSONB,
  gateway_error TEXT,
  -- Timestamps
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawals_collector_id 
  ON public.withdrawals(collector_id);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status 
  ON public.withdrawals(status);

CREATE INDEX IF NOT EXISTS idx_withdrawals_collector_status 
  ON public.withdrawals(collector_id, status);

CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at 
  ON public.withdrawals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_gateway_transaction 
  ON public.withdrawals(gateway_transaction_id) 
  WHERE gateway_transaction_id IS NOT NULL;

-- 3. Enable Row Level Security
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
-- Collectors can view their own withdrawals
CREATE POLICY view_own_withdrawals ON public.withdrawals
  FOR SELECT
  TO authenticated
  USING (collector_id = auth.uid());

-- Collectors can insert their own withdrawal requests
CREATE POLICY insert_own_withdrawals ON public.withdrawals
  FOR INSERT
  TO authenticated
  WITH CHECK (collector_id = auth.uid());

-- Collectors can update their own pending/failed withdrawals (for retry)
CREATE POLICY update_own_withdrawals ON public.withdrawals
  FOR UPDATE
  TO authenticated
  USING (collector_id = auth.uid() AND status IN ('pending', 'failed'))
  WITH CHECK (collector_id = auth.uid());

-- 5. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.withdrawals TO authenticated;

-- 6. Create function to get withdrawal summary for a collector
CREATE OR REPLACE FUNCTION get_collector_withdrawal_summary(p_collector_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total_withdrawn', COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0),
    'pending_withdrawals', COALESCE(SUM(CASE WHEN status IN ('pending', 'processing') THEN amount ELSE 0 END), 0),
    'total_requests', COUNT(*),
    'completed_count', COUNT(*) FILTER (WHERE status = 'completed'),
    'pending_count', COUNT(*) FILTER (WHERE status IN ('pending', 'processing')),
    'failed_count', COUNT(*) FILTER (WHERE status = 'failed')
  )
  FROM public.withdrawals
  WHERE collector_id = p_collector_id;
$$;

GRANT EXECUTE ON FUNCTION get_collector_withdrawal_summary(UUID) TO authenticated;

-- 7. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_withdrawals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS withdrawals_updated_at_trigger ON public.withdrawals;
CREATE TRIGGER withdrawals_updated_at_trigger
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_withdrawals_updated_at();

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Test 1: Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'withdrawals'
) AS withdrawals_table_exists;

-- Test 2: Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'withdrawals';

-- Test 3: Check RLS policies
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'withdrawals';

-- ========================================
-- SAMPLE DATA (Optional - for testing)
-- ========================================
/*
INSERT INTO public.withdrawals (
  collector_id, amount, status, payment_method, phone_number, network
) VALUES (
  'your-collector-user-id'::uuid,
  50.00,
  'pending',
  'mobile_money',
  '0241234567',
  'MTN'
);
*/
