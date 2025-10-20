-- TrashDrop Mobile Collector Driver
-- Create collector_profiles table with RLS policies
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS collector_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  region VARCHAR(100) NOT NULL,
  
  -- ID Verification
  id_type VARCHAR(50) NOT NULL DEFAULT 'Ghana Card',
  id_front_photo_url TEXT,
  id_back_photo_url TEXT,
  
  -- Vehicle Information
  vehicle_type VARCHAR(50) NOT NULL,
  license_plate VARCHAR(50) NOT NULL,
  vehicle_color VARCHAR(50) NOT NULL,
  vehicle_photo_url TEXT,
  
  -- Company Information
  company_id VARCHAR(100) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_collector_profiles_user_id 
ON collector_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_collector_profiles_phone 
ON collector_profiles(phone);

CREATE INDEX IF NOT EXISTS idx_collector_profiles_company 
ON collector_profiles(company_id);

-- ============================================
-- 3. CREATE UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_collector_profiles_updated_at ON collector_profiles;

CREATE TRIGGER update_collector_profiles_updated_at 
    BEFORE UPDATE ON collector_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE collector_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CREATE RLS POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON collector_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON collector_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON collector_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON collector_profiles;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
ON collector_profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own profile during signup
CREATE POLICY "Users can create own profile"
ON collector_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON collector_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own profile (optional - usually not needed)
CREATE POLICY "Users can delete own profile"
ON collector_profiles
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON collector_profiles TO authenticated;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Run this to verify the table was created successfully
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'collector_profiles'
ORDER BY ordinal_position;
