-- Add Payment Breakdown Columns to digital_bins Table
-- This allows collectors to see the detailed payout breakdown for digital bin collections
-- Run this in Supabase SQL Editor

-- First, ensure the fee column exists (for backward compatibility)
ALTER TABLE digital_bins
  ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 0;

-- Add payout breakdown columns to digital_bins table
ALTER TABLE digital_bins
  ADD COLUMN IF NOT EXISTS collector_core_payout DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_urgent_payout DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_distance_payout DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_surge_payout DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_tips DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_recyclables_payout DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_loyalty_cashback DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collector_total_payout DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL(4,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS deadhead_km DECIMAL(10,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN digital_bins.collector_core_payout IS 'Base payout for the collector based on distance and bin capacity';
COMMENT ON COLUMN digital_bins.collector_urgent_payout IS 'Bonus for urgent collections';
COMMENT ON COLUMN digital_bins.collector_distance_payout IS 'Bonus based on travel distance';
COMMENT ON COLUMN digital_bins.collector_surge_payout IS 'Surge pricing bonus during high demand';
COMMENT ON COLUMN digital_bins.collector_tips IS 'Tips from the user (if applicable)';
COMMENT ON COLUMN digital_bins.collector_recyclables_payout IS 'Bonus for recyclable materials';
COMMENT ON COLUMN digital_bins.collector_loyalty_cashback IS 'Loyalty program cashback';
COMMENT ON COLUMN digital_bins.collector_total_payout IS 'Total payout to collector (sum of all components)';
COMMENT ON COLUMN digital_bins.surge_multiplier IS 'Surge pricing multiplier (1.0 = no surge)';
COMMENT ON COLUMN digital_bins.deadhead_km IS 'Distance in kilometers from collector to bin';

-- Update existing records to populate total_payout from fee column
UPDATE digital_bins 
SET collector_total_payout = COALESCE(fee, 0),
    collector_core_payout = COALESCE(fee, 0) * 0.87,
    collector_distance_payout = COALESCE(fee, 0) * 0.13
WHERE collector_total_payout = 0 AND fee > 0;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'digital_bins'
  AND (column_name LIKE '%collector_%' OR column_name IN ('surge_multiplier', 'deadhead_km', 'fee'))
ORDER BY ordinal_position;

-- Display sample data to verify
SELECT 
    id,
    waste_type,
    fee,
    collector_core_payout,
    collector_distance_payout,
    collector_total_payout,
    status
FROM digital_bins
LIMIT 5;
