-- Seed 15 illegal dumping sites within 10km of coordinates (5.672505, -0.280669)
-- This script should be run in Supabase SQL Editor with admin privileges

-- Insert 15 illegal dumping sites
INSERT INTO authority_assignments (id, location, coordinates, type, priority, payment, estimated_time, distance, authority, status, collector_id, accepted_at, completed_at, created_at, updated_at) VALUES

-- Site 1: East Legon Industrial Area
('DUMP-01001', 'East Legon - Industrial Area', ST_GeomFromText('POINT(-0.271234 5.678901)', 4326), 'Industrial Waste Removal', 'high', '$250.00', '4-6 hours', '2.1 km', 'Environmental Protection Agency', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 2: Osu Construction Site  
('DUMP-02002', 'Osu - Construction Site Area', ST_GeomFromText('POINT(-0.289543 5.671234)', 4326), 'Construction Site Cleanup', 'medium', '$175.00', '2-4 hours', '1.8 km', 'Public Works Department', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 3: Cantonments Residential Area
('DUMP-03003', 'Cantonments - Residential Area', ST_GeomFromText('POINT(-0.275678 5.663456)', 4326), 'Residential Cleanup', 'low', '$75.00', '1-3 hours', '3.2 km', 'Municipal Assembly', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 4: Airport Residential Forest
('DUMP-04004', 'Airport Residential - Forest Area', ST_GeomFromText('POINT(-0.284321 5.685432)', 4326), 'Forest Clearing', 'high', '$200.00', '4-6 hours', '2.8 km', 'Environmental Protection Agency', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 5: Labone River Bank
('DUMP-05005', 'Labone - River Bank Area', ST_GeomFromText('POINT(-0.295678 5.669876)', 4326), 'River Bank Cleanup', 'high', '$200.00', '4-6 hours', '4.1 km', 'District Health Office', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 6: Teshie Vacant Lot  
('DUMP-06006', 'Teshie - Vacant Lot Area', ST_GeomFromText('POINT(-0.273456 5.655432)', 4326), 'Vacant Lot Cleanup', 'medium', '$125.00', '2-4 hours', '5.3 km', 'Community Development Board', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 7: Madina Commercial Area
('DUMP-07007', 'Madina - Commercial Area', ST_GeomFromText('POINT(-0.266789 5.682345)', 4326), 'Commercial Area Cleanup', 'medium', '$125.00', '2-4 hours', '3.7 km', 'Waste Management Authority', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 8: Adenta Bridge Area
('DUMP-08008', 'Adenta - Bridge Underpass Area', ST_GeomFromText('POINT(-0.278901 5.691234)', 4326), 'Bridge Underpass Cleanup', 'low', '$75.00', '1-3 hours', '6.2 km', 'Public Works Department', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 9: East Legon School Area
('DUMP-09009', 'East Legon - School Area', ST_GeomFromText('POINT(-0.282456 5.674567)', 4326), 'School Area Cleanup', 'high', '$200.00', '4-6 hours', '1.5 km', 'District Health Office', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 10: Osu Market Area  
('DUMP-10010', 'Osu - Market Area', ST_GeomFromText('POINT(-0.291234 5.665432)', 4326), 'Market Area Cleanup', 'medium', '$125.00', '2-4 hours', '2.9 km', 'Municipal Assembly', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 11: Cantonments Community Area
('DUMP-11011', 'Cantonments - Community Area', ST_GeomFromText('POINT(-0.276543 5.679876)', 4326), 'Community Cleanup', 'low', '$75.00', '1-3 hours', '1.9 km', 'Community Development Board', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 12: Airport Public Park
('DUMP-12012', 'Airport Residential - Public Park Area', ST_GeomFromText('POINT(-0.287654 5.668901)', 4326), 'Public Park Cleanup', 'medium', '$125.00', '2-4 hours', '3.4 km', 'Environmental Protection Agency', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 13: Labone Street Area
('DUMP-13013', 'Labone - Street Area', ST_GeomFromText('POINT(-0.293456 5.676543)', 4326), 'Street Cleaning', 'low', '$75.00', '1-3 hours', '4.8 km', 'Public Works Department', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 14: Teshie Roadside  
('DUMP-14014', 'Teshie - Roadside Area', ST_GeomFromText('POINT(-0.274321 5.658765)', 4326), 'Roadside Cleanup', 'medium', '$125.00', '2-4 hours', '7.1 km', 'Waste Management Authority', 'available', NULL, NULL, NULL, NOW(), NOW()),

-- Site 15: Madina Abandoned Property
('DUMP-15015', 'Madina - Abandoned Property Area', ST_GeomFromText('POINT(-0.268901 5.684321)', 4326), 'Abandoned Property Cleanup', 'high', '$250.00', '4-6 hours', '4.5 km', 'District Health Office', 'available', NULL, NULL, NULL, NOW(), NOW());

-- Verify the inserts
SELECT 
    id,
    location,
    ST_AsText(coordinates) as coordinates_text,
    type,
    priority,
    payment,
    authority,
    status,
    created_at
FROM authority_assignments 
WHERE id LIKE 'DUMP-%' 
ORDER BY id;
