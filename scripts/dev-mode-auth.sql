-- Dev Mode Authentication Configuration
-- This script sets up authentication and RLS policies for development mode

-- First, disable RLS on tables used in development
ALTER TABLE pickup_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE collector_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE collector_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE request_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE authority_assignments DISABLE ROW LEVEL SECURITY;

-- Create a dev_mode role with full access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dev_mode') THEN
    CREATE ROLE dev_mode;
  END IF;
END
$$;

-- Grant full access to dev_mode role
GRANT ALL ON ALL TABLES IN SCHEMA public TO dev_mode;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO dev_mode;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO dev_mode;

-- Create a policy to allow dev_mode role full access
CREATE POLICY dev_mode_policy ON pickup_requests
  FOR ALL
  TO dev_mode
  USING (true)
  WITH CHECK (true);

CREATE POLICY dev_mode_policy ON collector_sessions
  FOR ALL
  TO dev_mode
  USING (true)
  WITH CHECK (true);

CREATE POLICY dev_mode_policy ON collector_profiles
  FOR ALL
  TO dev_mode
  USING (true)
  WITH CHECK (true);

CREATE POLICY dev_mode_policy ON request_notifications
  FOR ALL
  TO dev_mode
  USING (true)
  WITH CHECK (true);

CREATE POLICY dev_mode_policy ON authority_assignments
  FOR ALL
  TO dev_mode
  USING (true)
  WITH CHECK (true);

-- Instructions for developers:
-- 1. Run this script in the Supabase SQL editor
-- 2. Add VITE_SUPABASE_SERVICE_KEY to your .env file
-- 3. Set DEV_MODE=true in supabase.js
