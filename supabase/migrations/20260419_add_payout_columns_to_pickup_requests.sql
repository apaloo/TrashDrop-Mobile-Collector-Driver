-- Migration: Add payout breakdown columns to pickup_requests
-- Aligns pickup_requests with digital_bins so the TrashDrop Pricing Algorithm v4.5.6
-- sharing model is applied at disposal time for ALL request types.

ALTER TABLE pickup_requests
  ADD COLUMN IF NOT EXISTS collector_core_payout        NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collector_urgent_payout      NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collector_distance_payout    NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collector_surge_payout       NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collector_tips               NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collector_recyclables_payout NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collector_loyalty_cashback   NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collector_total_payout       NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_share               NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payout_breakdown             JSONB         DEFAULT NULL;

-- Index for earnings queries on disposed pickup requests
CREATE INDEX IF NOT EXISTS idx_pickup_requests_disposed_payout
  ON pickup_requests (collector_id, collector_total_payout)
  WHERE status = 'disposed';
