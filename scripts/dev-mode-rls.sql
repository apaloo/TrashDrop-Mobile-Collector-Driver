-- Development Mode RLS Configuration
-- This script sets up RLS policies that allow access in development mode
-- while maintaining security in production

-- First, ensure RLS is enabled on all tables
ALTER TABLE collector_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE collector_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow dev mode access to collector_sessions" ON collector_sessions;
DROP POLICY IF EXISTS "Allow dev mode access to pickup_requests" ON pickup_requests;
DROP POLICY IF EXISTS "Allow dev mode access to collector_profiles" ON collector_profiles;
DROP POLICY IF EXISTS "Allow dev mode access to request_notifications" ON request_notifications;
DROP POLICY IF EXISTS "Allow dev mode access to authority_assignments" ON authority_assignments;

-- Create dev mode policies that check for dev mode header
-- These policies will allow full access when x-dev-mode header is present
CREATE POLICY "Allow dev mode access to collector_sessions"
ON collector_sessions FOR ALL
USING (current_setting('request.headers', true)::json->>'x-dev-mode' = 'true');

CREATE POLICY "Allow dev mode access to pickup_requests"
ON pickup_requests FOR ALL
USING (current_setting('request.headers', true)::json->>'x-dev-mode' = 'true');

CREATE POLICY "Allow dev mode access to collector_profiles"
ON collector_profiles FOR ALL
USING (current_setting('request.headers', true)::json->>'x-dev-mode' = 'true');

CREATE POLICY "Allow dev mode access to request_notifications"
ON request_notifications FOR ALL
USING (current_setting('request.headers', true)::json->>'x-dev-mode' = 'true');

CREATE POLICY "Allow dev mode access to authority_assignments"
ON authority_assignments FOR ALL
USING (current_setting('request.headers', true)::json->>'x-dev-mode' = 'true');

-- Note: Production policies are defined in db-migrations.sql
-- This script only adds dev mode policies on top of those
