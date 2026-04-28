-- ============================================================================
-- Migration: Add 'disposed' status to illegal_dumping_mobile
-- ============================================================================
-- Purpose: Allow assignment disposal tracking to persist in the database.
--          Previously, disposal state was only stored in React local state
--          and was lost on page navigation.
--
-- Changes:
--   1. Add 'disposed' to the status CHECK constraint
--   2. Add disposed_at timestamp column
--   3. Add disposal_site_id column (FK to disposal_centers)
--   4. Add disposal_site_name column (denormalized for quick access)
--   5. Update collector_assignments_view to include disposed assignments
-- ============================================================================

-- Step 1: Drop and recreate the status CHECK constraint to include 'disposed'
ALTER TABLE illegal_dumping_mobile
  DROP CONSTRAINT IF EXISTS illegal_dumping_mobile_status_check;

ALTER TABLE illegal_dumping_mobile
  ADD CONSTRAINT illegal_dumping_mobile_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text, 'in_progress'::text, 'completed'::text, 'disposed'::text, 'cancelled'::text]));

-- Step 2: Add disposal tracking columns
ALTER TABLE illegal_dumping_mobile
  ADD COLUMN IF NOT EXISTS disposed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS disposal_site_id TEXT,
  ADD COLUMN IF NOT EXISTS disposal_site_name TEXT;

-- Step 3: Add foreign key for disposal_site_id (disposal_centers.id is TEXT)
-- Using DO block to avoid error if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'illegal_dumping_mobile_disposal_site_id_fkey'
  ) THEN
    ALTER TABLE illegal_dumping_mobile
      ADD CONSTRAINT illegal_dumping_mobile_disposal_site_id_fkey
      FOREIGN KEY (disposal_site_id) REFERENCES disposal_centers(id);
  END IF;
END $$;

-- Step 4: Update the collector_assignments_view to include disposed assignments
DROP VIEW IF EXISTS collector_assignments_view;

CREATE OR REPLACE VIEW collector_assignments_view AS
SELECT 
  idm.id,
  cp.user_id AS collector_id,
  idm.assigned_to AS collector_profile_id,
  idm.waste_type AS type,
  idm.location,
  idm.latitude,
  idm.longitude,
  idm.severity AS priority,
  idm.size,
  idm.photos,
  idm.reported_by,
  
  -- Status mapping for UI tabs (now includes disposed)
  CASE idm.status
    WHEN 'verified' THEN 'available'
    WHEN 'in_progress' THEN 'accepted'
    WHEN 'completed' THEN 'completed'
    WHEN 'disposed' THEN 'disposed'
    ELSE idm.status
  END AS status,
  
  idm.status AS original_status,
  idm.created_at,
  idm.updated_at,
  
  -- Disposal tracking columns
  idm.disposed_at,
  idm.disposal_site_id,
  idm.disposal_site_name,
  
  'Community Report' AS authority,
  
  ROUND(
    CASE idm.size
      WHEN 'small' THEN 5.00
      WHEN 'medium' THEN 10.00
      WHEN 'large' THEN 20.00
      ELSE 10.00
    END * 
    CASE idm.severity 
      WHEN 'high' THEN 1.5 
      ELSE 1.0 
    END,
    2
  ) AS payment,
  
  CASE idm.size
    WHEN 'small' THEN '15 mins'
    WHEN 'medium' THEN '30 mins'
    WHEN 'large' THEN '1 hour'
    ELSE '30 mins'
  END AS estimated_time,
  
  'Calculate' AS distance

FROM illegal_dumping_mobile idm
INNER JOIN collector_profiles cp ON idm.assigned_to = cp.id
WHERE idm.assigned_to IS NOT NULL
  AND idm.status IN ('verified', 'in_progress', 'completed', 'disposed');

-- Step 5: Add index for disposed status queries
CREATE INDEX IF NOT EXISTS idx_illegal_dumping_mobile_disposed
  ON illegal_dumping_mobile (assigned_to)
  WHERE status = 'disposed';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT * FROM collector_assignments_view WHERE status = 'disposed' LIMIT 5;
