-- Fix RLS Policies for Pickup Requests
-- This allows collectors to accept and update pickup requests

-- First, let's see what policies currently exist
-- Run this in Supabase SQL Editor to check current policies:
-- SELECT * FROM pg_policies WHERE tablename = 'pickup_requests';

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to select pickup_requests" ON pickup_requests;
DROP POLICY IF EXISTS "Allow authenticated users to update pickup_requests" ON pickup_requests;
DROP POLICY IF EXISTS "Allow authenticated users to insert pickup_requests" ON pickup_requests;
DROP POLICY IF EXISTS "Collectors can only update available requests" ON pickup_requests;
DROP POLICY IF EXISTS "Collectors can update their own requests" ON pickup_requests;

-- Enable RLS on pickup_requests table
ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow everyone to SELECT (read) pickup requests
-- This allows the app to display available requests
CREATE POLICY "Allow all authenticated users to read pickup_requests"
ON pickup_requests
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow collectors to UPDATE available requests (to accept them)
-- This allows collectors to change status from 'available' to 'accepted'
CREATE POLICY "Allow collectors to accept available requests"
ON pickup_requests
FOR UPDATE
TO authenticated
USING (
  status = 'available' AND 
  (collector_id IS NULL OR collector_id = auth.uid())
)
WITH CHECK (
  status IN ('accepted', 'in_progress', 'completed') AND
  collector_id = auth.uid()
);

-- Policy 3: Allow collectors to UPDATE their own accepted requests
-- This allows collectors to update requests they've already accepted
CREATE POLICY "Allow collectors to update their own requests"
ON pickup_requests
FOR UPDATE
TO authenticated
USING (collector_id = auth.uid())
WITH CHECK (collector_id = auth.uid());

-- Policy 4: Allow authenticated users to INSERT new requests (for admins/customers)
CREATE POLICY "Allow authenticated users to create requests"
ON pickup_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 5: Allow service role full access (for system operations)
CREATE POLICY "Allow service role full access"
ON pickup_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Alternative simpler approach if the above is too restrictive:
-- Uncomment these lines and comment out the policies above

/*
-- Simple approach: Allow all authenticated users full access
DROP POLICY IF EXISTS "Allow all authenticated users full access" ON pickup_requests;

CREATE POLICY "Allow all authenticated users full access"
ON pickup_requests
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
*/

-- Also fix collector_sessions table if it exists
-- Enable RLS and create policies for collector_sessions
ALTER TABLE IF EXISTS collector_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow collectors to manage their own sessions" ON collector_sessions;

CREATE POLICY "Allow collectors to manage their own sessions"
ON collector_sessions
FOR ALL
TO authenticated
USING (collector_id = auth.uid())
WITH CHECK (collector_id = auth.uid());

-- Allow service role full access to collector_sessions
CREATE POLICY "Allow service role full access to sessions"
ON collector_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create digital_bins table if it doesn't exist
CREATE TABLE IF NOT EXISTS digital_bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waste_type TEXT DEFAULT 'general',
  coordinates POINT,
  location TEXT,
  fee DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'available',
  priority TEXT DEFAULT 'medium',
  bin_capacity TEXT,
  last_emptied TIMESTAMPTZ,
  collector_id UUID REFERENCES auth.users(id),
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on digital_bins table
ALTER TABLE digital_bins ENABLE ROW LEVEL SECURITY;

-- Create policies for digital_bins table
DROP POLICY IF EXISTS "Allow all authenticated users to read digital_bins" ON digital_bins;
DROP POLICY IF EXISTS "Allow collectors to collect digital_bins" ON digital_bins;
DROP POLICY IF EXISTS "Allow service role full access to digital_bins" ON digital_bins;

-- Policy 1: Allow everyone to SELECT (read) digital bins
CREATE POLICY "Allow all authenticated users to read digital_bins"
ON digital_bins
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow collectors to UPDATE digital bins (to collect them)
CREATE POLICY "Allow collectors to collect digital_bins"
ON digital_bins
FOR UPDATE
TO authenticated
USING (
  status = 'available' AND 
  (collector_id IS NULL OR collector_id = auth.uid())
)
WITH CHECK (
  status = 'collected' AND
  collector_id = auth.uid()
);

-- Policy 3: Allow service role full access to digital_bins
CREATE POLICY "Allow service role full access to digital_bins"
ON digital_bins
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON pickup_requests TO authenticated;
GRANT ALL ON collector_sessions TO authenticated;
GRANT ALL ON digital_bins TO authenticated;

-- For development: If you want to temporarily disable RLS completely:
-- ALTER TABLE pickup_requests DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE collector_sessions DISABLE ROW LEVEL SECURITY;

-- To re-enable later:
-- ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE collector_sessions ENABLE ROW LEVEL SECURITY;

-- Check the results
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('pickup_requests', 'collector_sessions')
ORDER BY tablename, policyname;
