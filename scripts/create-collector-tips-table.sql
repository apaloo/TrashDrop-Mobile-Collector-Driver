-- ========================================
-- Create collector_tips table
-- Required for earnings RPC function
-- ========================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.collector_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES auth.users(id),
  request_id UUID, -- Reference to pickup_request or digital_bin
  request_type VARCHAR(50) DEFAULT 'pickup_request', -- 'pickup_request' or 'digital_bin'
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_tips_collector 
  ON public.collector_tips(collector_id, created_at);
  
CREATE INDEX IF NOT EXISTS idx_tips_request 
  ON public.collector_tips(request_id);

-- 3. Enable RLS
ALTER TABLE public.collector_tips ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy (drop first if exists to avoid error)
DROP POLICY IF EXISTS view_own_tips ON public.collector_tips;
CREATE POLICY view_own_tips ON public.collector_tips
  FOR SELECT TO authenticated USING (collector_id = auth.uid());

-- 5. Grant permissions
GRANT SELECT ON public.collector_tips TO authenticated;

-- 6. Verify table was created
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'collector_tips'
) AS collector_tips_table_exists;
