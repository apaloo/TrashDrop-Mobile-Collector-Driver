-- Add missing columns to collector_sessions table
ALTER TABLE IF EXISTS public.collector_sessions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline',
ADD COLUMN IF NOT EXISTS status_reason TEXT,
ADD COLUMN IF NOT EXISTS last_status_change TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add comment for documentation
COMMENT ON TABLE public.collector_sessions IS 'Stores collector online/offline status and session data';

-- Add RLS policies if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'collector_sessions' 
        AND policyname = 'Collectors can view their own sessions'
    ) THEN
        CREATE POLICY "Collectors can view their own sessions" ON public.collector_sessions
        FOR SELECT
        USING (auth.uid()::text = collector_id::text);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'collector_sessions' 
        AND policyname = 'Collectors can update their own sessions'
    ) THEN
        CREATE POLICY "Collectors can update their own sessions" ON public.collector_sessions
        FOR UPDATE
        USING (auth.uid()::text = collector_id::text);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'collector_sessions' 
        AND policyname = 'Collectors can insert their own sessions'
    ) THEN
        CREATE POLICY "Collectors can insert their own sessions" ON public.collector_sessions
        FOR INSERT
        WITH CHECK (auth.uid()::text = collector_id::text);
    END IF;
END
$$;
