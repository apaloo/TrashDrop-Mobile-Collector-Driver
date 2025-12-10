-- Create a test digital bin for payment testing
-- Run this in your Supabase SQL Editor

-- First, check if there are any users in auth.users
-- Replace 'YOUR_USER_ID' with an actual user ID from your database

-- Insert test digital bin with coordinates near Accra, Ghana
INSERT INTO digital_bins (
  user_id,
  waste_type,
  coordinates,
  status,
  location_name,
  created_at
) VALUES (
  -- Use first available user from auth.users or collector_profiles
  (SELECT user_id FROM collector_profiles LIMIT 1),
  'recyclable',
  ST_SetSRID(ST_MakePoint(-0.1870, 5.6037), 4326), -- Accra, Ghana
  'available',
  'Test Bin - Accra City Center',
  NOW()
)
ON CONFLICT DO NOTHING;

-- Verify the bin was created
SELECT 
  id,
  user_id,
  waste_type,
  status,
  location_name,
  ST_AsText(coordinates) as coordinates_text
FROM digital_bins
WHERE status = 'available'
LIMIT 5;
