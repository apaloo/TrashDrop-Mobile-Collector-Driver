-- TrashDrop Development Mode Migrations
-- Run these migrations in your Supabase SQL editor to temporarily relax RLS policies for development

-- Drop existing RLS policies for collector_sessions
DROP POLICY IF EXISTS "Collectors can view their own sessions" ON public.collector_sessions;
DROP POLICY IF EXISTS "Collectors can update their own sessions" ON public.collector_sessions;
DROP POLICY IF EXISTS "Collectors can insert their own sessions" ON public.collector_sessions;

-- Create development mode RLS policies for collector_sessions
CREATE POLICY "Dev mode - Allow all operations on collector_sessions"
  ON public.collector_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Note: This policy allows all authenticated users to perform any operation on collector_sessions
-- This should ONLY be used in development mode and never in production
