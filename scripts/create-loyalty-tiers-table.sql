-- ========================================
-- Create collector_loyalty_tiers table
-- Required for earnings loyalty tier feature
-- ========================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.collector_loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES auth.users(id),
  month DATE NOT NULL, -- First day of month, e.g., '2025-01-01'
  tier VARCHAR(20) NOT NULL DEFAULT 'Silver', -- Silver, Gold, Platinum
  cashback_rate DECIMAL(4,3) NOT NULL DEFAULT 0.01, -- 1%, 2%, 3%
  monthly_cap DECIMAL(10,2) NOT NULL DEFAULT 100, -- Max cashback per month
  cashback_earned DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_jobs_this_month INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(collector_id, month)
);

-- 2. Create index
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_collector 
  ON public.collector_loyalty_tiers(collector_id, month);

-- 3. Enable RLS
ALTER TABLE public.collector_loyalty_tiers ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy (drop first if exists to avoid error)
DROP POLICY IF EXISTS view_own_loyalty_tier ON public.collector_loyalty_tiers;
CREATE POLICY view_own_loyalty_tier ON public.collector_loyalty_tiers
  FOR SELECT TO authenticated USING (collector_id = auth.uid());

-- 5. Grant permissions
GRANT SELECT ON public.collector_loyalty_tiers TO authenticated;

-- 6. Verify table was created
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'collector_loyalty_tiers'
) AS loyalty_tiers_table_exists;
