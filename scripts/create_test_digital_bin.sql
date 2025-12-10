-- Create a test digital bin for payment testing
-- Run this in your Supabase SQL Editor

-- Step 1: Create a bin location with coordinates
INSERT INTO bin_locations (
  user_id,
  location_name,
  address,
  coordinates,
  is_default,
  created_at
) VALUES (
  (SELECT user_id FROM collector_profiles LIMIT 1),
  'Test Location - Accra City Center',
  'Independence Avenue, Accra, Ghana',
  ST_SetSRID(ST_MakePoint(-0.1870, 5.6037), 4326), -- Accra, Ghana
  true,
  NOW()
)
ON CONFLICT DO NOTHING
RETURNING id;

-- Step 2: Create the digital bin with reference to the location
-- Note: You need to replace 'LOCATION_ID_FROM_ABOVE' with the actual ID returned above
-- Or run these in sequence, letting Supabase return the ID
WITH new_location AS (
  INSERT INTO bin_locations (
    user_id,
    location_name,
    address,
    coordinates,
    is_default,
    created_at
  ) VALUES (
    (SELECT user_id FROM collector_profiles LIMIT 1),
    'Test Bin Location - Accra',
    'Test Street, Accra, Ghana',
    ST_SetSRID(ST_MakePoint(-0.1870, 5.6037), 4326),
    false,
    NOW()
  )
  RETURNING id, user_id
)
INSERT INTO digital_bins (
  user_id,
  location_id,
  qr_code_url,
  frequency,
  waste_type,
  bag_count,
  details,
  is_active,
  expires_at,
  status,
  bin_size_liters,
  fee,
  created_at
)
SELECT
  new_location.user_id,
  new_location.id,
  'https://example.com/qr/test-bin-' || gen_random_uuid()::text,
  'weekly',
  'recyclable',
  1,
  'Test digital bin for payment testing',
  true,
  NOW() + INTERVAL '7 days',
  'available',
  120,
  5.00,
  NOW()
FROM new_location;

-- Verify the bin and location were created
SELECT 
  db.id as bin_id,
  db.user_id,
  db.waste_type,
  db.status,
  db.fee,
  bl.location_name,
  ST_AsText(bl.coordinates) as coordinates_text
FROM digital_bins db
JOIN bin_locations bl ON db.location_id = bl.id
WHERE db.status = 'available'
ORDER BY db.created_at DESC
LIMIT 5;
