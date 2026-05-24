-- =============================================================================
-- Promotional Pricing Migration
-- Adds is_promotional flag + bin_size_liters to digital_bins,
-- platform_subsidy + is_promotional to bin_payments,
-- and creates promotional_fee_schedule + promotional_usage tables.
-- Run in Supabase SQL Editor (admin/service-role).
-- =============================================================================

-- ─── 1. digital_bins: add promotional flag & bin size ──────────────────────────
ALTER TABLE digital_bins
  ADD COLUMN IF NOT EXISTS is_promotional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bin_size_liters integer NOT NULL DEFAULT 120;

COMMENT ON COLUMN digital_bins.is_promotional
  IS 'True when this bin was created under the new-user promotional fixed-fee model.';
COMMENT ON COLUMN digital_bins.bin_size_liters
  IS 'Bin capacity in litres (120, 240, or 360). Used to look up promotional fee schedule.';

-- ─── 2. bin_payments: add subsidy tracking ─────────────────────────────────────
ALTER TABLE bin_payments
  ADD COLUMN IF NOT EXISTS platform_subsidy numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_promotional boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN bin_payments.platform_subsidy
  IS 'Amount the platform subsidises from the marketing fund for promotional bins (collector_payout - client_fee).';
COMMENT ON COLUMN bin_payments.is_promotional
  IS 'Mirrors digital_bins.is_promotional for fast querying on payment records.';

-- ─── 3. promotional_fee_schedule table ─────────────────────────────────────────
-- Canonical fee schedule keyed by bin size. The collector app also carries a
-- hard-coded fallback (PROMOTIONAL_FEE_SCHEDULE in paymentCalculations.js).
CREATE TABLE IF NOT EXISTS promotional_fee_schedule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_size_liters integer NOT NULL UNIQUE,
  client_fee    numeric(10,2) NOT NULL,
  collector_payout numeric(10,2) NOT NULL,
  platform_subsidy numeric(10,2) GENERATED ALWAYS AS (collector_payout - client_fee) STORED,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE promotional_fee_schedule
  IS 'Fixed fee schedule for new-user promotional digital bins.';

-- Seed default schedule
INSERT INTO promotional_fee_schedule (bin_size_liters, client_fee, collector_payout)
VALUES
  (120, 18.00, 30.00),
  (240, 22.00, 40.00),
  (360, 48.00, 95.00)
ON CONFLICT (bin_size_liters) DO UPDATE SET
  client_fee       = EXCLUDED.client_fee,
  collector_payout = EXCLUDED.collector_payout,
  updated_at       = now();

-- ─── 4. promotional_usage table ────────────────────────────────────────────────
-- Tracks how many promotional requests each user has consumed.
-- The client app increments used_count when creating a promotional bin.
CREATE TABLE IF NOT EXISTS promotional_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  max_requests  integer NOT NULL DEFAULT 5,
  used_count    integer NOT NULL DEFAULT 0,
  is_eligible   boolean GENERATED ALWAYS AS (used_count < max_requests) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_promotional_usage_user UNIQUE (user_id)
);

COMMENT ON TABLE promotional_usage
  IS 'Per-user tracker for promotional request allowance (default 5).';

-- ─── 5. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_digital_bins_is_promotional
  ON digital_bins (is_promotional) WHERE is_promotional = true;

CREATE INDEX IF NOT EXISTS idx_bin_payments_is_promotional
  ON bin_payments (is_promotional) WHERE is_promotional = true;

CREATE INDEX IF NOT EXISTS idx_promotional_usage_user_id
  ON promotional_usage (user_id);

-- ─── 6. RLS policies (match existing pattern) ─────────────────────────────────
ALTER TABLE promotional_fee_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_usage ENABLE ROW LEVEL SECURITY;

-- Fee schedule is read-only for all authenticated users
CREATE POLICY "promotional_fee_schedule_read"
  ON promotional_fee_schedule FOR SELECT
  TO authenticated
  USING (true);

-- Usage: users can read and update their own row
CREATE POLICY "promotional_usage_select_own"
  ON promotional_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "promotional_usage_insert_own"
  ON promotional_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "promotional_usage_update_own"
  ON promotional_usage FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Done ──────────────────────────────────────────────────────────────────────
-- After running:
-- 1. Verify: SELECT * FROM promotional_fee_schedule;
-- 2. Verify: \d digital_bins   (should show is_promotional, bin_size_liters)
-- 3. Verify: \d bin_payments   (should show platform_subsidy, is_promotional)
-- 4. Verify: \d promotional_usage (should show user_id, used_count, is_eligible)
