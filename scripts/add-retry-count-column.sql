-- ========================================
-- Add retry_count column to bin_payments
-- Fix #6: Support for disbursement retry mechanism
-- ========================================

-- Add retry_count column if it doesn't exist
ALTER TABLE public.bin_payments 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Verify column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'bin_payments' AND column_name = 'retry_count';
