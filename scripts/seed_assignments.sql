-- Disable RLS for authority_assignments
ALTER TABLE public.authority_assignments DISABLE ROW LEVEL SECURITY;

-- Insert assignments with all required fields
-- Note: 
-- 'type' can be one of: 'residential', 'commercial', 'institutional'
-- 'priority' can be 'low', 'medium', 'high'
-- 'status' is one of: 'available', 'accepted', 'completed'
-- 'payment' is a required text field
-- 'estimated_time' and 'distance' are optional text fields
-- 'authority' is an optional text field

INSERT INTO public.authority_assignments (
  id,
  location,
  coordinates,
  type,
  priority,
  payment,
  estimated_time,
  distance,
  authority,
  status,
  collector_id,
  accepted_at,
  completed_at,
  created_at,
  updated_at
) VALUES 
  -- Available assignments
  ('assign_1', 'Location 1 in Madina', ST_GeomFromText('POINT(-0.29 5.70)', 4326), 'residential', 'medium', '100.00', '30 mins', '2.5 km', 'Accra Metro', 'available', NULL, NULL, NULL, NOW(), NOW()),
  ('assign_2', 'Location 2 in Labone', ST_GeomFromText('POINT(-0.22 5.70)', 4326), 'commercial', 'high', '250.00', '45 mins', '3.2 km', 'Accra Metro', 'available', NULL, NULL, NULL, NOW(), NOW()),
  ('assign_3', 'Location 3 in Osu', ST_GeomFromText('POINT(-0.24 5.74)', 4326), 'commercial', 'high', '200.00', '35 mins', '2.8 km', 'Accra Metro', 'available', NULL, NULL, NULL, NOW(), NOW()),
  ('assign_4', 'Location 4 in East Legon', ST_GeomFromText('POINT(-0.34 5.58)', 4326), 'residential', 'medium', '120.00', '25 mins', '2.0 km', 'Accra Metro', 'available', NULL, NULL, NULL, NOW(), NOW()),
  ('assign_5', 'Location 5 in Adenta', ST_GeomFromText('POINT(-0.18 5.60)', 4326), 'residential', 'low', '80.00', '20 mins', '1.5 km', 'Adenta Municipal', 'available', NULL, NULL, NULL, NOW(), NOW()),
  ('assign_6', 'Location 6 in Teshie', ST_GeomFromText('POINT(-0.29 5.62)', 4326), 'residential', 'medium', '90.00', '28 mins', '2.3 km', 'Ledzokuku Municipal', 'available', NULL, NULL, NULL, NOW(), NOW()),
  ('assign_7', 'Location 7 in Madina', ST_GeomFromText('POINT(-0.29 5.55)', 4326), 'commercial', 'high', '220.00', '40 mins', '3.0 km', 'La Nkwantanang Madina', 'available', NULL, NULL, NULL, NOW(), NOW()),
  ('assign_8', 'Location 8 in Adenta', ST_GeomFromText('POINT(-0.18 5.73)', 4326), 'residential', 'low', '85.00', '22 mins', '1.8 km', 'Adenta Municipal', 'available', NULL, NULL, NULL, NOW(), NOW()),
  ('assign_9', 'Location 9 in East Legon', ST_GeomFromText('POINT(-0.21 5.58)', 4326), 'institutional', 'high', '300.00', '50 mins', '4.0 km', 'Accra Metro', 'available', NULL, NULL, NULL, NOW(), NOW()),
  ('assign_10', 'Location 10 in Labone', ST_GeomFromText('POINT(-0.36 5.63)', 4326), 'commercial', 'high', '240.00', '42 mins', '3.5 km', 'Accra Metro', 'available', NULL, NULL, NULL, NOW(), NOW()),
  
  -- Accepted assignments
  ('assign_11', 'Location 11 in Osu', ST_GeomFromText('POINT(-0.26 5.61)', 4326), 'commercial', 'high', '260.00', '38 mins', '3.1 km', 'Accra Metro', 'accepted', NULL, NOW(), NULL, NOW(), NOW()),
  ('assign_12', 'Location 12 in Madina', ST_GeomFromText('POINT(-0.32 5.74)', 4326), 'residential', 'medium', '110.00', '32 mins', '2.6 km', 'La Nkwantanang Madina', 'accepted', NULL, NOW(), NULL, NOW(), NOW()),
  
  -- Completed assignments
  ('assign_13', 'Location 13 in Adenta', ST_GeomFromText('POINT(-0.21 5.59)', 4326), 'residential', 'low', '95.00', '24 mins', '1.9 km', 'Adenta Municipal', 'completed', NULL, NOW() - interval '2 hours', NOW(), NOW() - interval '3 hours', NOW()),
  ('assign_14', 'Location 14 in Labone', ST_GeomFromText('POINT(-0.38 5.63)', 4326), 'commercial', 'high', '280.00', '46 mins', '3.8 km', 'Accra Metro', 'completed', NULL, NOW() - interval '5 hours', NOW() - interval '1 hour', NOW() - interval '6 hours', NOW()),
  ('assign_15', 'Location 15 in Osu', ST_GeomFromText('POINT(-0.38 5.66)', 4326), 'institutional', 'high', '320.00', '55 mins', '4.5 km', 'Accra Metro', 'completed', NULL, NOW() - interval '1 day', NOW() - interval '23 hours', NOW() - interval '24 hours', NOW());

-- Re-enable RLS for authority_assignments
ALTER TABLE public.authority_assignments ENABLE ROW LEVEL SECURITY;
