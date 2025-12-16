-- First check if the table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'collector_sessions') THEN
    -- Create the table if it doesn't exist
    CREATE TABLE public.collector_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      collector_id uuid NOT NULL REFERENCES auth.users(id),
      filter_criteria jsonb,
      reserved_requests uuid[] DEFAULT ARRAY[]::uuid[],
      session_start timestamp with time zone DEFAULT now(),
      last_activity timestamp with time zone DEFAULT now(),
      is_active boolean DEFAULT true,
      expires_at timestamp with time zone DEFAULT (now() + interval '24 hours'),
      status TEXT DEFAULT 'offline',
      status_reason TEXT,
      last_status_change TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    RAISE NOTICE 'Created collector_sessions table with all required columns';
  ELSE
    -- Table exists, add missing columns
    BEGIN
      ALTER TABLE public.collector_sessions 
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline',
      ADD COLUMN IF NOT EXISTS status_reason TEXT,
      ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      
      RAISE NOTICE 'Added missing columns to collector_sessions table';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error adding columns: %', SQLERRM;
    END;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.collector_sessions IS 'Stores collector online/offline status and session data';

-- Enable RLS on the table
ALTER TABLE public.collector_sessions ENABLE ROW LEVEL SECURITY;

-- Add RLS policies if they don't exist
DO $$
BEGIN
    -- Drop existing policies to avoid conflicts
    DROP POLICY IF EXISTS "Collectors can view their own sessions" ON public.collector_sessions;
    DROP POLICY IF EXISTS "Collectors can update their own sessions" ON public.collector_sessions;
    DROP POLICY IF EXISTS "Collectors can insert their own sessions" ON public.collector_sessions;
    
    -- Create new policies with proper type casting
    CREATE POLICY "Collectors can view their own sessions" ON public.collector_sessions
    FOR SELECT
    USING (auth.uid()::text = collector_id::text);
    
    CREATE POLICY "Collectors can update their own sessions" ON public.collector_sessions
    FOR UPDATE
    USING (auth.uid()::text = collector_id::text);
    
    CREATE POLICY "Collectors can insert their own sessions" ON public.collector_sessions
    FOR INSERT
    WITH CHECK (auth.uid()::text = collector_id::text);
    
    RAISE NOTICE 'Created RLS policies for collector_sessions table';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating policies: %', SQLERRM;
END
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_collector_sessions_collector_id ON public.collector_sessions(collector_id);
CREATE INDEX IF NOT EXISTS idx_collector_sessions_is_active ON public.collector_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_collector_sessions_status ON public.collector_sessions(status);

-- Grant necessary permissions
GRANT ALL ON public.collector_sessions TO authenticated;
GRANT ALL ON public.collector_sessions TO service_role;

-- Verify the table structure
SELECT 
  column_name, 
  data_type, 
  column_default, 
  is_nullable
FROM 
  information_schema.columns
WHERE 
  table_schema = 'public' AND 
  table_name = 'collector_sessions'
ORDER BY 
  ordinal_position;

-- Verify RLS policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM 
  pg_policies
WHERE 
  tablename = 'collector_sessions';
