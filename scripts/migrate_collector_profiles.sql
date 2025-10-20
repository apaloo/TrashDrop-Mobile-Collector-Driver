-- ============================================
-- MIGRATION: Update collector_profiles table
-- Remove email, Add ID verification and vehicle photo fields
-- ============================================

-- Step 1: Add new columns (with defaults so existing rows don't break)
ALTER TABLE collector_profiles 
ADD COLUMN IF NOT EXISTS id_type VARCHAR(50) DEFAULT 'Ghana Card',
ADD COLUMN IF NOT EXISTS id_front_photo_url TEXT,
ADD COLUMN IF NOT EXISTS id_back_photo_url TEXT,
ADD COLUMN IF NOT EXISTS vehicle_photo_url TEXT;

-- Step 2: Drop the email column (if it exists)
ALTER TABLE collector_profiles 
DROP COLUMN IF EXISTS email;

-- Step 3: Update the id_type to NOT NULL (now that it has defaults)
ALTER TABLE collector_profiles 
ALTER COLUMN id_type SET NOT NULL;

-- Step 4: Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'collector_profiles'
ORDER BY ordinal_position;
