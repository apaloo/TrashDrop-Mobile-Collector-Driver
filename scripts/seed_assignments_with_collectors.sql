-- Updated Seed Script for authority_assignments with Pre-Assigned Collectors
-- This script demonstrates the admin pre-assignment workflow
-- Each assignment is assigned to a specific collector from creation

-- Disable RLS for seeding
ALTER TABLE public.authority_assignments DISABLE ROW LEVEL SECURITY;

-- First, let's get some collector IDs from the collector_profiles table
-- In production, admins would select collectors from a UI dropdown

-- Example: Assign assignments to specific collectors
-- Replace these UUIDs with actual collector IDs from your auth.users or collector_profiles table

-- For testing purposes, you can get collector IDs by running:
-- SELECT id, first_name, last_name FROM collector_profiles LIMIT 5;

-- Let's assume we have two collectors for this example:
-- Collector A: '6fba1031-839f-4985-a180-9ae0a04b7812' (replace with actual ID)
-- Collector B: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' (replace with actual ID)

DO $$
DECLARE
    collector_a_id UUID := '6fba1031-839f-4985-a180-9ae0a04b7812';  -- Replace with real collector ID
    collector_b_id UUID := '6fba1031-839f-4985-a180-9ae0a04b7812';  -- Replace with real collector ID (can be same for testing)
BEGIN
    -- Delete existing test assignments to avoid duplicates
    DELETE FROM public.authority_assignments WHERE id LIKE 'assign_%';

    -- Insert assignments assigned to Collector A (Available - not yet accepted)
    INSERT INTO public.authority_assignments (
        id, location, coordinates, type, priority, payment, 
        estimated_time, distance, authority, status, collector_id,
        accepted_at, completed_at, created_at, updated_at
    ) VALUES 
        ('assign_1', 'East Legon Area 1', ST_GeomFromText('POINT(-0.29 5.70)', 4326), 
         'residential', 'medium', '100.00', '30 mins', '2.5 km', 'Accra Metro', 
         'available', collector_a_id, NULL, NULL, NOW(), NOW()),
        
        ('assign_2', 'Osu Commercial District', ST_GeomFromText('POINT(-0.22 5.70)', 4326), 
         'commercial', 'high', '250.00', '45 mins', '3.2 km', 'Accra Metro', 
         'available', collector_a_id, NULL, NULL, NOW(), NOW()),
        
        ('assign_3', 'Labone Residential Area', ST_GeomFromText('POINT(-0.24 5.74)', 4326), 
         'residential', 'medium', '150.00', '35 mins', '2.8 km', 'Accra Metro', 
         'available', collector_a_id, NULL, NULL, NOW(), NOW()),
        
        ('assign_4', 'Madina Market Area', ST_GeomFromText('POINT(-0.34 5.58)', 4326), 
         'commercial', 'high', '200.00', '40 mins', '3.5 km', 'La Nkwantanang Madina', 
         'available', collector_a_id, NULL, NULL, NOW(), NOW());

    -- Insert assignments assigned to Collector B (Available - not yet accepted)
    INSERT INTO public.authority_assignments (
        id, location, coordinates, type, priority, payment, 
        estimated_time, distance, authority, status, collector_id,
        accepted_at, completed_at, created_at, updated_at
    ) VALUES 
        ('assign_5', 'Adenta Housing Estate', ST_GeomFromText('POINT(-0.18 5.60)', 4326), 
         'residential', 'low', '80.00', '20 mins', '1.5 km', 'Adenta Municipal', 
         'available', collector_b_id, NULL, NULL, NOW(), NOW()),
        
        ('assign_6', 'Teshie School Zone', ST_GeomFromText('POINT(-0.29 5.62)', 4326), 
         'institutional', 'medium', '120.00', '28 mins', '2.3 km', 'Ledzokuku Municipal', 
         'available', collector_b_id, NULL, NULL, NOW(), NOW()),
        
        ('assign_7', 'Spintex Road Commercial', ST_GeomFromText('POINT(-0.29 5.55)', 4326), 
         'commercial', 'high', '220.00', '40 mins', '3.0 km', 'Ledzokuku Municipal', 
         'available', collector_b_id, NULL, NULL, NOW(), NOW());

    -- Insert accepted assignments for Collector A (already accepted, in progress)
    INSERT INTO public.authority_assignments (
        id, location, coordinates, type, priority, payment, 
        estimated_time, distance, authority, status, collector_id,
        accepted_at, completed_at, created_at, updated_at
    ) VALUES 
        ('assign_8', 'Airport Residential Area', ST_GeomFromText('POINT(-0.18 5.73)', 4326), 
         'residential', 'medium', '110.00', '32 mins', '2.6 km', 'Accra Metro', 
         'accepted', collector_a_id, NOW() - interval '2 hours', NULL, NOW() - interval '3 hours', NOW());

    -- Insert completed assignments for Collector A (historical)
    INSERT INTO public.authority_assignments (
        id, location, coordinates, type, priority, payment, 
        estimated_time, distance, authority, status, collector_id,
        accepted_at, completed_at, created_at, updated_at
    ) VALUES 
        ('assign_9', 'Cantonments Office Complex', ST_GeomFromText('POINT(-0.21 5.58)', 4326), 
         'commercial', 'high', '280.00', '46 mins', '3.8 km', 'Accra Metro', 
         'completed', collector_a_id, NOW() - interval '1 day', NOW() - interval '23 hours', NOW() - interval '2 days', NOW()),
        
        ('assign_10', 'Ridge Hospital Area', ST_GeomFromText('POINT(-0.36 5.63)', 4326), 
         'institutional', 'high', '300.00', '50 mins', '4.0 km', 'Accra Metro', 
         'completed', collector_a_id, NOW() - interval '3 days', NOW() - interval '2 days', NOW() - interval '4 days', NOW());

    -- Insert completed assignment for Collector B
    INSERT INTO public.authority_assignments (
        id, location, coordinates, type, priority, payment, 
        estimated_time, distance, authority, status, collector_id,
        accepted_at, completed_at, created_at, updated_at
    ) VALUES 
        ('assign_11', 'Tema Community 1', ST_GeomFromText('POINT(-0.01 5.67)', 4326), 
         'residential', 'medium', '95.00', '24 mins', '1.9 km', 'Tema Metro', 
         'completed', collector_b_id, NOW() - interval '12 hours', NOW() - interval '10 hours', NOW() - interval '1 day', NOW());

    RAISE NOTICE '✅ Seeded assignments with pre-assigned collectors:';
    RAISE NOTICE '  - Collector A (Available): 4 assignments';
    RAISE NOTICE '  - Collector A (Accepted): 1 assignment';
    RAISE NOTICE '  - Collector A (Completed): 2 assignments';
    RAISE NOTICE '  - Collector B (Available): 3 assignments';
    RAISE NOTICE '  - Collector B (Completed): 1 assignment';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ IMPORTANT: Replace collector IDs in this script with actual collector IDs from your database!';
    RAISE NOTICE '   Run: SELECT id, first_name, last_name, email FROM collector_profiles;';
END $$;

-- Re-enable RLS
ALTER TABLE public.authority_assignments ENABLE ROW LEVEL SECURITY;

-- Verify the seeded data
SELECT 
    status,
    collector_id,
    COUNT(*) as count
FROM public.authority_assignments
WHERE id LIKE 'assign_%'
GROUP BY status, collector_id
ORDER BY status, collector_id;
