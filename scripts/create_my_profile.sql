-- ============================================
-- CREATE YOUR COLLECTOR PROFILE
-- Run this in Supabase SQL Editor
-- ============================================

-- Insert your profile record
INSERT INTO collector_profiles (
  user_id,
  first_name,
  last_name,
  phone,
  region,
  id_type,
  vehicle_type,
  license_plate,
  vehicle_color,
  company_id,
  company_name,
  role
) VALUES (
  '05866646-1df1-454b-b977-849d09eabad4',  -- Your user ID
  'Kwabena',          -- ⚠️ UPDATE: Your first name
  'Clottey Yaw',      -- ⚠️ UPDATE: Your last name
  '+233593918202',    -- ⚠️ UPDATE: Your phone number
  'Greater Accra',    -- ⚠️ UPDATE: Your region
  'Ghana Card',       -- ID type
  'Motorcycle',       -- ⚠️ UPDATE: Your vehicle type
  'GR-123-20',        -- ⚠️ UPDATE: Your license plate
  'Black',            -- ⚠️ UPDATE: Your vehicle color
  'infobrix',         -- ⚠️ UPDATE: Your company ID
  'infobrix (Infob0021)', -- ⚠️ UPDATE: Your company name
  'Collector'         -- ⚠️ UPDATE: Your role
);

-- Verify it was created
SELECT * FROM collector_profiles 
WHERE user_id = '05866646-1df1-454b-b977-849d09eabad4';
