-- ========================================
-- Fix: Digital Bins Status Transition Trigger
-- ========================================
-- Run this SQL in your Supabase SQL Editor
--
-- Problem: The existing trigger on digital_bins rejects valid status
-- transitions (en_route, arrived, collecting) because it was created
-- before these statuses were added.
--
-- This script:
-- 1. Drops any existing BEFORE UPDATE status validation trigger on digital_bins
-- 2. Creates a new comprehensive trigger allowing the full lifecycle:
--    pending/available → accepted → en_route → arrived → collecting → completed/disposed
-- 3. Also fixes pickup_requests trigger if present
-- ========================================

-- Step 1: Drop ALL existing BEFORE UPDATE triggers on digital_bins
-- (We don't know the trigger name, so drop any that validate status)
DO $$
DECLARE
  trig RECORD;
BEGIN
  FOR trig IN
    SELECT tgname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'digital_bins'
      AND t.tgtype & 2 = 2   -- BEFORE trigger
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON digital_bins', trig.tgname);
    RAISE NOTICE 'Dropped trigger: % on digital_bins', trig.tgname;
  END LOOP;
END $$;

-- Step 2: Drop ALL existing BEFORE UPDATE triggers on pickup_requests
DO $$
DECLARE
  trig RECORD;
BEGIN
  FOR trig IN
    SELECT tgname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'pickup_requests'
      AND t.tgtype & 2 = 2   -- BEFORE trigger
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON pickup_requests', trig.tgname);
    RAISE NOTICE 'Dropped trigger: % on pickup_requests', trig.tgname;
  END LOOP;
END $$;

-- Step 3: Create the corrected status transition validation function for digital_bins
CREATE OR REPLACE FUNCTION validate_digital_bin_status_transition()
RETURNS trigger AS $$
BEGIN
  -- Allow same-status updates (no-op transitions)
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  CASE NEW.status
    WHEN 'accepted' THEN
      IF OLD.status NOT IN ('pending', 'available') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'en_route' THEN
      IF OLD.status NOT IN ('accepted') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'arrived' THEN
      IF OLD.status NOT IN ('en_route', 'accepted') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'collecting' THEN
      IF OLD.status NOT IN ('arrived', 'en_route', 'accepted') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'completed' THEN
      IF OLD.status NOT IN ('collecting', 'arrived') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'disposed' THEN
      IF OLD.status NOT IN ('collecting', 'completed', 'arrived') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'cancelled' THEN
      -- Can cancel from any non-terminal state
      IF OLD.status IN ('completed', 'disposed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'canceled' THEN
      -- Alternate spelling
      IF OLD.status IN ('completed', 'disposed', 'cancelled', 'canceled') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'pending' THEN
      -- Reset to pending (admin action)
      NULL;
    WHEN 'available' THEN
      -- Reset to available (admin action)
      NULL;
    ELSE
      -- Allow any other status (future-proofing)
      NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create the corrected trigger on digital_bins
CREATE TRIGGER validate_digital_bin_status
  BEFORE UPDATE OF status ON digital_bins
  FOR EACH ROW
  EXECUTE FUNCTION validate_digital_bin_status_transition();

-- Step 5: Create the corrected status transition validation function for pickup_requests
CREATE OR REPLACE FUNCTION validate_pickup_request_status_transition()
RETURNS trigger AS $$
BEGIN
  -- Allow same-status updates (no-op transitions)
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  CASE NEW.status
    WHEN 'accepted' THEN
      IF OLD.status NOT IN ('pending', 'available') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'en_route' THEN
      IF OLD.status NOT IN ('accepted') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'arrived' THEN
      IF OLD.status NOT IN ('en_route', 'accepted') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'collecting' THEN
      IF OLD.status NOT IN ('arrived', 'en_route', 'accepted') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'completed' THEN
      IF OLD.status NOT IN ('collecting', 'arrived') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'disposed' THEN
      IF OLD.status NOT IN ('collecting', 'completed', 'arrived') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'cancelled' THEN
      IF OLD.status IN ('completed', 'disposed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'canceled' THEN
      IF OLD.status IN ('completed', 'disposed', 'cancelled', 'canceled') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'expired' THEN
      IF OLD.status NOT IN ('accepted', 'en_route', 'available', 'pending') THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    WHEN 'pending' THEN
      NULL;
    WHEN 'available' THEN
      NULL;
    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create the corrected trigger on pickup_requests
CREATE TRIGGER validate_pickup_request_status
  BEFORE UPDATE OF status ON pickup_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_pickup_request_status_transition();

-- Step 7: Update CHECK constraints to include all valid statuses
DO $$
BEGIN
  ALTER TABLE digital_bins DROP CONSTRAINT IF EXISTS digital_bins_status_check;
  ALTER TABLE digital_bins ADD CONSTRAINT digital_bins_status_check
    CHECK (status IN ('pending', 'available', 'accepted', 'en_route', 'arrived', 'collecting', 'completed', 'disposed', 'cancelled', 'canceled', 'expired'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'digital_bins constraint update skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE pickup_requests DROP CONSTRAINT IF EXISTS pickup_requests_status_check;
  ALTER TABLE pickup_requests ADD CONSTRAINT pickup_requests_status_check
    CHECK (status IN ('pending', 'available', 'accepted', 'en_route', 'arrived', 'collecting', 'completed', 'disposed', 'cancelled', 'canceled', 'expired'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pickup_requests constraint update skipped: %', SQLERRM;
END $$;

-- ========================================
-- Verification: List triggers on both tables
-- ========================================
SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name,
  p.proname AS function_name,
  CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('digital_bins', 'pickup_requests')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
