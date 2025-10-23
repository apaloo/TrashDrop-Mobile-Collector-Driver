-- Migration: Ensure authority_assignments has collector_id column and proper indexes
-- Purpose: Enable collector-specific assignment filtering
-- Date: 2025-10-22

-- 1. Add collector_id column if it doesn't exist
DO $$ 
BEGIN
    -- Check if collector_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'authority_assignments' 
        AND column_name = 'collector_id'
    ) THEN
        -- Add the column with foreign key reference to auth.users
        ALTER TABLE public.authority_assignments 
        ADD COLUMN collector_id UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'Added collector_id column to authority_assignments table';
    ELSE
        RAISE NOTICE 'collector_id column already exists in authority_assignments table';
    END IF;
END $$;

-- 2. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_authority_assignments_collector_id 
ON public.authority_assignments(collector_id);

CREATE INDEX IF NOT EXISTS idx_authority_assignments_status 
ON public.authority_assignments(status);

CREATE INDEX IF NOT EXISTS idx_authority_assignments_collector_status 
ON public.authority_assignments(collector_id, status);

-- Composite index for efficient filtering by collector and status
CREATE INDEX IF NOT EXISTS idx_authority_assignments_status_collector_null
ON public.authority_assignments(status, collector_id) 
WHERE collector_id IS NULL;

-- 3. Add helpful comments
COMMENT ON COLUMN public.authority_assignments.collector_id IS 
'References the collector (auth.users) who has accepted/completed this assignment. NULL means available for any collector.';

-- 4. Set up Row Level Security (RLS) policies if not already configured
-- Enable RLS on the table
ALTER TABLE public.authority_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Collectors can view available and their own assignments" ON public.authority_assignments;
DROP POLICY IF EXISTS "Collectors can accept available assignments" ON public.authority_assignments;
DROP POLICY IF EXISTS "Collectors can update their own assignments" ON public.authority_assignments;
DROP POLICY IF EXISTS "Allow service role full access" ON public.authority_assignments;

-- Policy 1: Collectors can ONLY view assignments assigned to them by admin
-- No shared pool - admins must pre-assign assignments to specific collectors
CREATE POLICY "Collectors can view only their own assignments"
ON public.authority_assignments
FOR SELECT
TO authenticated
USING (
  collector_id = auth.uid()
);

-- Policy 2: Accept (INSERT) new assignments - typically done by admins/system
CREATE POLICY "Allow authenticated users to create assignments"
ON public.authority_assignments
FOR INSERT
TO authenticated
WITH CHECK (true);  -- Adjust based on your business logic

-- Policy 3: Update assignments - collectors can only update assignments assigned to them
CREATE POLICY "Collectors can update their own assignments"
ON public.authority_assignments
FOR UPDATE
TO authenticated
USING (
  -- Can only update if it's already assigned to this collector
  collector_id = auth.uid()
)
WITH CHECK (
  -- After update, must still be assigned to this collector (prevent reassignment)
  collector_id = auth.uid()
);

-- Policy 4: Allow service role full access (for admin operations)
CREATE POLICY "Allow service role full access"
ON public.authority_assignments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Verify the setup
DO $$
DECLARE
    col_count INTEGER;
    idx_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Check column exists
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'authority_assignments' 
    AND column_name = 'collector_id';
    
    -- Check indexes exist
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes 
    WHERE schemaname = 'public'
    AND tablename = 'authority_assignments'
    AND indexname LIKE 'idx_authority_assignments_collector%';
    
    -- Check policies exist
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'authority_assignments';
    
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '  - collector_id column exists: %', (col_count > 0);
    RAISE NOTICE '  - Collector indexes created: %', idx_count;
    RAISE NOTICE '  - RLS policies configured: %', policy_count;
END $$;

-- 6. Example: Update existing assignments if needed (optional - uncomment if required)
-- Set all existing accepted/completed assignments to a default collector
-- CAUTION: Only run this if you need to assign existing assignments to a specific collector
/*
DO $$
DECLARE
    default_collector_id UUID;
BEGIN
    -- Get a default collector ID (adjust this query to match your needs)
    -- SELECT id INTO default_collector_id 
    -- FROM auth.users 
    -- WHERE email = 'default@example.com' 
    -- LIMIT 1;
    
    -- IF default_collector_id IS NOT NULL THEN
    --     UPDATE public.authority_assignments
    --     SET collector_id = default_collector_id
    --     WHERE status IN ('accepted', 'completed')
    --     AND collector_id IS NULL;
        
    --     RAISE NOTICE 'Updated % existing assignments to collector %', 
    --         (SELECT COUNT(*) FROM public.authority_assignments WHERE collector_id = default_collector_id),
    --         default_collector_id;
    -- END IF;
END $$;
*/

-- 7. Note: Admin Pre-Assignment Workflow
-- In this system, admins must set collector_id when creating assignments
-- Available status means "assigned to collector but not yet accepted by them"
-- Do NOT set collector_id to NULL - it should always reference a specific collector

-- If you need to clean up old assignments without collector_id, run this manually:
-- UPDATE public.authority_assignments
-- SET collector_id = 'some-default-collector-id'
-- WHERE collector_id IS NULL;

RAISE NOTICE '✅ Migration complete. Admins must assign collector_id when creating new assignments.';
