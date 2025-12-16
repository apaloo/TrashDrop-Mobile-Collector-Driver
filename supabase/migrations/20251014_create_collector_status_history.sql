-- Create collector_status_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.collector_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collector_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'online',
    session_start TIMESTAMPTZ,
    session_end TIMESTAMPTZ,
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Add foreign key constraint if collector_profiles table exists
    CONSTRAINT fk_collector_id FOREIGN KEY (collector_id)
        REFERENCES public.collector_profiles(id) ON DELETE CASCADE
);

-- Add comment for documentation
COMMENT ON TABLE public.collector_status_history IS 'Stores collector online session history';

-- Add RLS policies if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'collector_status_history' 
        AND policyname = 'Collectors can view their own status history'
    ) THEN
        CREATE POLICY "Collectors can view their own status history" ON public.collector_status_history
        FOR SELECT
        USING (auth.uid()::text = collector_id::text);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'collector_status_history' 
        AND policyname = 'Collectors can insert their own status history'
    ) THEN
        CREATE POLICY "Collectors can insert their own status history" ON public.collector_status_history
        FOR INSERT
        WITH CHECK (auth.uid()::text = collector_id::text);
    END IF;
END
$$;

-- Enable RLS on the table
ALTER TABLE public.collector_status_history ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_collector_status_history_collector_id ON public.collector_status_history(collector_id);
CREATE INDEX IF NOT EXISTS idx_collector_status_history_created_at ON public.collector_status_history(created_at);
