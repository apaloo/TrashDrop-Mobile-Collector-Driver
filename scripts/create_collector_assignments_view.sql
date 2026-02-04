-- ============================================================================
-- DATABASE VIEW: collector_assignments_view
-- ============================================================================
-- Purpose: Maps illegal_dumping_mobile table to the assignment format expected
--          by the Collector Mobile App's Assignments page
-- 
-- Workflow:
--   1. Reporter submits illegal dumping report via Reporter App
--      → status='pending', assigned_to=NULL
--   2. Admin assigns collector via Admin Panel
--      → assigned_to=collector_uuid, status='verified'
--   3. Collector sees assignment in "Available" tab
--      → Fetches from this view where collector_id=user.id AND status='available'
--   4. Collector accepts → UPDATE illegal_dumping_mobile SET status='in_progress'
--   5. Collector completes → UPDATE illegal_dumping_mobile SET status='completed'
--
-- Status Mapping:
--   illegal_dumping_mobile.status  →  View status (for UI)
--   'pending'                      →  NOT SHOWN (awaiting admin verification)
--   'verified'                     →  'available' (ready for collector to accept)
--   'in_progress'                  →  'accepted' (collector is working on it)
--   'completed'                    →  'completed' (collector finished)
--
-- Usage:
--   - READ operations: SELECT FROM collector_assignments_view
--   - WRITE operations: UPDATE illegal_dumping_mobile directly
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS collector_assignments_view;

-- Create the view
-- IMPORTANT: This view joins with collector_profiles to map:
--   - illegal_dumping_mobile.assigned_to = collector_profiles.id (profile ID)
--   - Exposes collector_profiles.user_id as collector_id for app queries
-- The app uses auth user_id, but assignments store profile id
CREATE OR REPLACE VIEW collector_assignments_view AS
SELECT 
  -- Primary identifier
  idm.id,
  
  -- Collector assignment - expose USER_ID for app queries
  -- The app queries by auth user.id, not by profile id
  cp.user_id AS collector_id,
  
  -- Also expose the profile ID for update operations
  idm.assigned_to AS collector_profile_id,
  
  -- Assignment type from waste_type
  idm.waste_type AS type,
  
  -- Location info
  idm.location,
  idm.latitude,
  idm.longitude,
  
  -- Priority mapped from severity
  idm.severity AS priority,
  
  -- Additional report details
  idm.size,
  idm.photos,
  idm.reported_by,
  
  -- Status mapping for UI tabs
  CASE idm.status
    WHEN 'verified' THEN 'available'
    WHEN 'in_progress' THEN 'accepted'
    WHEN 'completed' THEN 'completed'
    ELSE idm.status
  END AS status,
  
  -- Keep original status for reference/debugging
  idm.status AS original_status,
  
  -- Timestamps
  idm.created_at,
  idm.updated_at,
  
  -- Default authority label for community reports
  'Community Report' AS authority,
  
  -- Calculate payment based on size and severity
  -- Base: small=5, medium=10, large=20
  -- Multiplier: high severity = 1.5x
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
  
  -- Estimate time based on size
  CASE idm.size
    WHEN 'small' THEN '15 mins'
    WHEN 'medium' THEN '30 mins'
    WHEN 'large' THEN '1 hour'
    ELSE '30 mins'
  END AS estimated_time,
  
  -- Distance placeholder (will be calculated client-side from user GPS)
  'Calculate' AS distance

FROM illegal_dumping_mobile idm
-- JOIN with collector_profiles to get user_id from profile id
INNER JOIN collector_profiles cp ON idm.assigned_to = cp.id

-- Only show reports that have been assigned by admin
-- and are in actionable states (not pending verification)
WHERE idm.assigned_to IS NOT NULL
  AND idm.status IN ('verified', 'in_progress', 'completed');

-- ============================================================================
-- GRANT PERMISSIONS (adjust role names as needed for your Supabase setup)
-- ============================================================================
-- Supabase uses 'authenticated' role for logged-in users
-- Uncomment and adjust if needed:

-- GRANT SELECT ON collector_assignments_view TO authenticated;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this after creating the view to verify it works:
-- SELECT * FROM collector_assignments_view LIMIT 5;
