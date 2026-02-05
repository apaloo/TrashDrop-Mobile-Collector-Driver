-- ========================================
-- Fix Historical Collector Payout Values
-- Migration Script for SOP v4.5.6 Payment Model
-- ========================================
-- 
-- PROBLEM: Historical digital_bins have incorrect collector_total_payout values
-- that were calculated without excluding the platform fee (GHC 1.00) from sharing.
-- 
-- CORRECT PAYMENT MODEL (SOP v4.5.6):
-- - Platform fee (GHC 1.00) is EXCLUDED from sharing - goes 100% to platform
-- - shareableAmount = fee - 1.00
-- - Collector gets 85-92% of shareableAmount based on deadhead distance
-- - 87% is default when deadhead info unavailable
-- 
-- Deadhead Distance | Collector Share
-- ------------------|----------------
-- 0-2 km            | 85%
-- 2-5 km            | 87%
-- 5-10 km           | 89%
-- 10+ km            | 92%
-- ========================================

-- Step 1: Create a function to calculate the correct deadhead share
CREATE OR REPLACE FUNCTION get_deadhead_share(deadhead_km DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  IF deadhead_km IS NULL OR deadhead_km <= 2 THEN
    RETURN 0.85;
  ELSIF deadhead_km <= 5 THEN
    RETURN 0.87;
  ELSIF deadhead_km <= 10 THEN
    RETURN 0.89;
  ELSE
    RETURN 0.92;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a function to recalculate collector payout for a digital bin
CREATE OR REPLACE FUNCTION calculate_correct_collector_payout(
  p_fee DECIMAL,
  p_is_urgent BOOLEAN,
  p_deadhead_km DECIMAL,
  p_collector_tips DECIMAL,
  p_collector_recyclables_payout DECIMAL,
  p_collector_loyalty_cashback DECIMAL
)
RETURNS TABLE (
  collector_core_payout DECIMAL,
  collector_urgent_payout DECIMAL,
  collector_total_payout DECIMAL,
  shareable_amount DECIMAL,
  base_portion DECIMAL,
  urgent_portion DECIMAL
) AS $$
DECLARE
  v_platform_fee DECIMAL := 1.00;
  v_shareable DECIMAL;
  v_base DECIMAL;
  v_urgent DECIMAL;
  v_deadhead_share DECIMAL;
  v_collector_core DECIMAL;
  v_collector_urgent DECIMAL;
  v_collector_tips DECIMAL;
  v_collector_recyclables DECIMAL;
  v_collector_loyalty DECIMAL;
  v_collector_total DECIMAL;
BEGIN
  -- Calculate shareable amount (exclude platform fee)
  v_shareable := GREATEST(COALESCE(p_fee, 0) - v_platform_fee, 0);
  
  -- Extract base and urgent portions from shareable amount
  IF COALESCE(p_is_urgent, FALSE) THEN
    -- Fee already includes 30% urgent surcharge
    -- shareableAmount = base * 1.30, so base = shareable / 1.30
    v_base := v_shareable / 1.30;
    v_urgent := v_shareable - v_base;
  ELSE
    v_base := v_shareable;
    v_urgent := 0;
  END IF;
  
  -- Get deadhead share (85-92%)
  v_deadhead_share := get_deadhead_share(p_deadhead_km);
  
  -- Calculate collector core payout (deadhead share of base)
  v_collector_core := v_base * v_deadhead_share;
  
  -- Calculate collector urgent payout (75% of urgent portion)
  v_collector_urgent := v_urgent * 0.75;
  
  -- External sources (can add on top of fee-based earnings)
  -- Note: collector_recyclables_payout is already the collector's 60% share
  v_collector_tips := COALESCE(p_collector_tips, 0);
  v_collector_recyclables := COALESCE(p_collector_recyclables_payout, 0);
  v_collector_loyalty := COALESCE(p_collector_loyalty_cashback, 0);
  
  -- Total collector payout
  v_collector_total := v_collector_core + v_collector_urgent + 
                       v_collector_tips + v_collector_recyclables + v_collector_loyalty;
  
  RETURN QUERY SELECT 
    ROUND(v_collector_core, 2),
    ROUND(v_collector_urgent, 2),
    ROUND(v_collector_total, 2),
    ROUND(v_shareable, 2),
    ROUND(v_base, 2),
    ROUND(v_urgent, 2);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Step 3: PREVIEW - See what will change (run this first!)
-- ========================================
-- This query shows the before/after values WITHOUT making changes
SELECT 
  db.id,
  db.fee,
  db.is_urgent,
  db.deadhead_km,
  -- Current (potentially wrong) values
  db.collector_core_payout AS current_core,
  db.collector_urgent_payout AS current_urgent,
  db.collector_total_payout AS current_total,
  -- Corrected values
  calc.collector_core_payout AS correct_core,
  calc.collector_urgent_payout AS correct_urgent,
  calc.collector_total_payout AS correct_total,
  -- Difference
  db.collector_total_payout - calc.collector_total_payout AS difference,
  -- Details
  calc.shareable_amount,
  calc.base_portion,
  calc.urgent_portion
FROM digital_bins db
CROSS JOIN LATERAL calculate_correct_collector_payout(
  db.fee,
  db.is_urgent,
  db.deadhead_km,
  db.collector_tips,
  db.collector_recyclables_payout,
  db.collector_loyalty_cashback
) calc
WHERE db.status IN ('picked_up', 'disposed')
ORDER BY ABS(db.collector_total_payout - calc.collector_total_payout) DESC;

-- ========================================
-- Step 4: APPLY FIX - Update all digital_bins with correct values
-- ========================================
-- ⚠️ IMPORTANT: Run the PREVIEW query above first to verify changes!
-- Uncomment the UPDATE statement below when ready to apply

/*
-- Create a backup first
CREATE TABLE IF NOT EXISTS digital_bins_payout_backup AS
SELECT id, fee, collector_core_payout, collector_urgent_payout, 
       collector_total_payout, updated_at
FROM digital_bins
WHERE status IN ('picked_up', 'disposed');

-- Apply the fix
UPDATE digital_bins db
SET 
  collector_core_payout = calc.collector_core_payout,
  collector_urgent_payout = calc.collector_urgent_payout,
  collector_total_payout = calc.collector_total_payout,
  updated_at = NOW()
FROM (
  SELECT 
    db2.id,
    (calculate_correct_collector_payout(
      db2.fee,
      db2.is_urgent,
      db2.deadhead_km,
      db2.collector_tips,
      db2.collector_recyclables_payout,
      db2.collector_loyalty_cashback
    )).*
  FROM digital_bins db2
  WHERE db2.status IN ('picked_up', 'disposed')
) calc
WHERE db.id = calc.id;

-- Verify the update
SELECT 
  'Total bins updated' AS metric,
  COUNT(*) AS value
FROM digital_bins
WHERE status IN ('picked_up', 'disposed');
*/

-- ========================================
-- Step 5: Verify the fix
-- ========================================
-- After applying the fix, run this to verify totals

SELECT 
  COUNT(*) AS total_bins,
  SUM(fee) AS total_fees,
  SUM(collector_total_payout) AS total_collector_payout,
  SUM(fee) - SUM(collector_total_payout) AS total_platform_share,
  ROUND(AVG(collector_total_payout / NULLIF(fee, 0)) * 100, 1) AS avg_collector_percent
FROM digital_bins
WHERE status = 'disposed'
  AND fee > 0;

-- ========================================
-- Step 6: Cleanup (optional - after verifying fix works)
-- ========================================
-- DROP FUNCTION IF EXISTS get_deadhead_share(DECIMAL);
-- DROP FUNCTION IF EXISTS calculate_correct_collector_payout(DECIMAL, BOOLEAN, DECIMAL, DECIMAL, DECIMAL, DECIMAL);
-- DROP TABLE IF EXISTS digital_bins_payout_backup;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
-- If something goes wrong, restore from backup:
/*
UPDATE digital_bins db
SET 
  collector_core_payout = backup.collector_core_payout,
  collector_urgent_payout = backup.collector_urgent_payout,
  collector_total_payout = backup.collector_total_payout
FROM digital_bins_payout_backup backup
WHERE db.id = backup.id;
*/
