-- =====================================================
-- ADD COMPREHENSIVE GHANA WASTE MANAGEMENT FACILITIES
-- Migration script to add major landfills, recycling 
-- plants, and disposal centers across all regions
-- =====================================================

-- Add new columns if they don't exist (for enhanced data)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposal_centers' AND column_name = 'region') THEN
        ALTER TABLE disposal_centers ADD COLUMN region VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposal_centers' AND column_name = 'district') THEN
        ALTER TABLE disposal_centers ADD COLUMN district VARCHAR(150);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposal_centers' AND column_name = 'operating_hours') THEN
        ALTER TABLE disposal_centers ADD COLUMN operating_hours VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposal_centers' AND column_name = 'phone') THEN
        ALTER TABLE disposal_centers ADD COLUMN phone VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposal_centers' AND column_name = 'rating') THEN
        ALTER TABLE disposal_centers ADD COLUMN rating DECIMAL(2,1) DEFAULT 4.0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposal_centers' AND column_name = 'capacity_notes') THEN
        ALTER TABLE disposal_centers ADD COLUMN capacity_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disposal_centers' AND column_name = 'status') THEN
        ALTER TABLE disposal_centers ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    END IF;
END $$;

-- =====================================================
-- MAJOR LANDFILL SITES (Nationwide)
-- =====================================================

INSERT INTO disposal_centers (id, name, coordinates, address, waste_type, latitude, longitude, center_type, region, district, operating_hours, rating, capacity_notes, status, created_at, updated_at)
VALUES
  -- Kpone Engineered Landfill (Decommissioned but historically significant)
  (gen_random_uuid(), 'Kpone Engineered Landfill', ST_SetSRID(ST_Point(0.0287, 5.7031), 4326), '5km northeast of Tema Township, Kpone', 'Municipal Solid Waste', ST_SetSRID(ST_Point(0.0287, 5.7031), 4326), ST_SetSRID(ST_Point(0.0287, 5.7031), 4326), 'landfill', 'Greater Accra', 'Kpone Katamanso Municipal', '6:00 AM - 6:00 PM', 3.5, 'Decommissioned in 2013. Was receiving 1000 tpd of MSW.', 'decommissioned', NOW(), NOW()),

  -- Oblogo Landfill (Main Accra landfill)
  (gen_random_uuid(), 'Oblogo Sanitary Landfill', ST_SetSRID(ST_Point(-0.345, 5.556), 4326), 'Oblogo, near Densu River, Weija-Gbawe', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-0.345, 5.556), 4326), ST_SetSRID(ST_Point(-0.345, 5.556), 4326), 'landfill', 'Greater Accra', 'Weija-Gbawe Municipal', '6:00 AM - 6:00 PM', 4.0, 'Main recipient of waste from Accra Metropolitan area.', 'active', NOW(), NOW()),

  -- Dompoase Landfill (Kumasi main landfill)
  (gen_random_uuid(), 'Dompoase Landfill & Fecal Sludge Treatment', ST_SetSRID(ST_Point(-1.5914, 6.6259), 4326), 'Dompoase, near Kaase suburb, Kumasi', 'Municipal Solid Waste, Fecal Sludge', ST_SetSRID(ST_Point(-1.5914, 6.6259), 4326), ST_SetSRID(ST_Point(-1.5914, 6.6259), 4326), 'landfill', 'Ashanti', 'Kumasi Metropolitan', '6:00 AM - 6:00 PM', 4.2, 'Major landfill serving Kumasi Metropolis. Includes fecal sludge treatment.', 'active', NOW(), NOW()),

  -- Oti Landfill (Kumasi)
  (gen_random_uuid(), 'Oti Engineered Landfill', ST_SetSRID(ST_Point(-1.57, 6.65), 4326), 'Oti area, Kumasi', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-1.57, 6.65), 4326), ST_SetSRID(ST_Point(-1.57, 6.65), 4326), 'landfill', 'Ashanti', 'Kumasi Metropolitan', '6:00 AM - 6:00 PM', 4.0, 'Serves Kumasi Metropolis since 2004.', 'active', NOW(), NOW()),

  -- Sofokrom Landfill (Sekondi-Takoradi)
  (gen_random_uuid(), 'Sofokrom Landfill', ST_SetSRID(ST_Point(-1.78, 4.95), 4326), 'Sofokrom-Essipon, Sekondi-Takoradi', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-1.78, 4.95), 4326), ST_SetSRID(ST_Point(-1.78, 4.95), 4326), 'landfill', 'Western', 'Sekondi-Takoradi Metropolitan', '6:00 AM - 6:00 PM', 3.8, 'Main disposal site for STMA.', 'active', NOW(), NOW()),

  -- Abokobi Controlled Dump
  (gen_random_uuid(), 'Abokobi Controlled Dump', ST_SetSRID(ST_Point(-0.18, 5.72), 4326), 'Abokobi, Ga East Municipality', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-0.18, 5.72), 4326), ST_SetSRID(ST_Point(-0.18, 5.72), 4326), 'landfill', 'Greater Accra', 'Ga East Municipal', '6:00 AM - 6:00 PM', 3.5, 'Controlled dumping site.', 'active', NOW(), NOW()),

  -- Pantang Landfill
  (gen_random_uuid(), 'Pantang Landfill', ST_SetSRID(ST_Point(-0.165, 5.71), 4326), 'Pantang-Abokobi area, Accra', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-0.165, 5.71), 4326), ST_SetSRID(ST_Point(-0.165, 5.71), 4326), 'landfill', 'Greater Accra', 'La-Nkwantanang Madina Municipal', '6:00 AM - 6:00 PM', 3.7, 'Serves parts of Accra Metropolitan area.', 'active', NOW(), NOW()),

  -- Nsumia Landfill (Eastern Region)
  (gen_random_uuid(), 'Nsumia Landfill', ST_SetSRID(ST_Point(-0.32, 5.8), 4326), 'Nsumia, off Accra-Nsawam Highway', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-0.32, 5.8), 4326), ST_SetSRID(ST_Point(-0.32, 5.8), 4326), 'landfill', 'Eastern', 'Nsawam-Adoagyiri', '6:00 AM - 6:00 PM', 3.8, 'Plans to convert to waste-to-energy facility.', 'active', NOW(), NOW()),

  -- Tamale Landfill (Northern Region)
  (gen_random_uuid(), 'Tamale Municipal Landfill', ST_SetSRID(ST_Point(-0.84, 9.4), 4326), 'Tamale Metropolitan area', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-0.84, 9.4), 4326), ST_SetSRID(ST_Point(-0.84, 9.4), 4326), 'landfill', 'Northern', 'Tamale Metropolitan', '6:00 AM - 6:00 PM', 3.5, 'Serves rapidly growing Tamale city.', 'active', NOW(), NOW()),

  -- Bolgatanga Landfill (Upper East)
  (gen_random_uuid(), 'Bolgatanga Landfill', ST_SetSRID(ST_Point(-0.85, 10.79), 4326), 'Bolgatanga Municipality', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-0.85, 10.79), 4326), ST_SetSRID(ST_Point(-0.85, 10.79), 4326), 'landfill', 'Upper East', 'Bolgatanga Municipal', '6:00 AM - 6:00 PM', 3.5, 'Municipal landfill for Bolgatanga.', 'active', NOW(), NOW()),

  -- Nkanfoa Open Dump (Central Region)
  (gen_random_uuid(), 'Nkanfoa Disposal Site', ST_SetSRID(ST_Point(-1.24, 5.11), 4326), 'Nkanfoa, Cape Coast', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-1.24, 5.11), 4326), ST_SetSRID(ST_Point(-1.24, 5.11), 4326), 'landfill', 'Central', 'Cape Coast Metropolitan', '6:00 AM - 6:00 PM', 3.0, 'Open dump site for Cape Coast.', 'active', NOW(), NOW()),

  -- Mallam Landfill
  (gen_random_uuid(), 'Mallam Landfill', ST_SetSRID(ST_Point(-0.29, 5.57), 4326), 'Mallam, peri-urban Accra', 'Municipal Solid Waste', ST_SetSRID(ST_Point(-0.29, 5.57), 4326), ST_SetSRID(ST_Point(-0.29, 5.57), 4326), 'landfill', 'Greater Accra', 'Weija-Gbawe Municipal', '6:00 AM - 6:00 PM', 3.5, 'Peri-urban landfill serving western Accra.', 'active', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- INTEGRATED RECYCLING AND COMPOST PLANTS (IRECOP)
-- =====================================================

INSERT INTO disposal_centers (id, name, coordinates, address, waste_type, latitude, longitude, center_type, region, district, operating_hours, phone, rating, capacity_notes, status, created_at, updated_at)
VALUES
  -- ACARP (Accra Compost and Recycling Plant)
  (gen_random_uuid(), 'ACARP - Accra Compost & Recycling Plant', ST_SetSRID(ST_Point(-0.35, 5.68), 4326), 'Adjen Kotoku, near Medie, Ga West', 'Municipal Solid Waste, Organic Waste, Compost', ST_SetSRID(ST_Point(-0.35, 5.68), 4326), ST_SetSRID(ST_Point(-0.35, 5.68), 4326), 'recycling_plant', 'Greater Accra', 'Ga West Municipal', '8:00 AM - 5:00 PM', '+233302213500', 4.5, 'First state-of-art waste sorting and composting facility in West Africa. Over 300 staff.', 'active', NOW(), NOW()),

  -- KCARP (Kumasi Compost and Recycling Plant)
  (gen_random_uuid(), 'KCARP - Kumasi Compost & Recycling Plant', ST_SetSRID(ST_Point(-1.55, 6.55), 4326), 'Essereso-Adagya, Bosomtwe District', 'Municipal Solid Waste, Organic Waste, Compost', ST_SetSRID(ST_Point(-1.55, 6.55), 4326), ST_SetSRID(ST_Point(-1.55, 6.55), 4326), 'recycling_plant', 'Ashanti', 'Bosomtwe District', '8:00 AM - 5:00 PM', NULL, 4.3, 'Large-scale facility for Kumasi Metropolis and nearby districts.', 'active', NOW(), NOW()),

  -- IRECOP Sunyani
  (gen_random_uuid(), 'IRECOP Sunyani - Nwawasua', ST_SetSRID(ST_Point(-2.33, 7.35), 4326), 'Nwawasua (Wawasua), near Sunyani, Bono Region', 'Municipal Solid Waste, Organic Waste, Compost', ST_SetSRID(ST_Point(-2.33, 7.35), 4326), ST_SetSRID(ST_Point(-2.33, 7.35), 4326), 'recycling_plant', 'Bono', 'Sunyani Municipal', '8:00 AM - 5:00 PM', NULL, 4.0, 'Inaugurated by Ministry of SWR. Specializes in composting and recycling.', 'active', NOW(), NOW()),

  -- IRECOP Nalerigu (North East Region)
  (gen_random_uuid(), 'IRECOP Nalerigu', ST_SetSRID(ST_Point(-0.35, 10.4), 4326), 'Nalerigu, North East Region', 'Municipal Solid Waste, Organic Waste, Compost', ST_SetSRID(ST_Point(-0.35, 10.4), 4326), ST_SetSRID(ST_Point(-0.35, 10.4), 4326), 'recycling_plant', 'North East', 'Mamprugu Moagduri District', '8:00 AM - 5:00 PM', NULL, 4.0, '400-ton capacity recycling plant. Produces compost and recyclable products.', 'active', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- E-WASTE RECYCLING FACILITIES
-- =====================================================

INSERT INTO disposal_centers (id, name, coordinates, address, waste_type, latitude, longitude, center_type, region, district, operating_hours, phone, rating, capacity_notes, status, created_at, updated_at)
VALUES
  -- Electro Recycling Ghana
  (gen_random_uuid(), 'Electro Recycling Ghana (ERG)', ST_SetSRID(ST_Point(-0.17, 5.68), 4326), 'Madina, Accra', 'Electronic Waste, Metal Scrap, Batteries', ST_SetSRID(ST_Point(-0.17, 5.68), 4326), ST_SetSRID(ST_Point(-0.17, 5.68), 4326), 'e_waste', 'Greater Accra', 'La-Nkwantanang Madina Municipal', '8:00 AM - 5:00 PM', NULL, 4.5, 'First licensed e-waste disposal plant in Ghana (EPA 2020). Manual dismantling for clean secondary materials.', 'active', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- WASTE-TO-ENERGY & TREATMENT PLANTS
-- =====================================================

INSERT INTO disposal_centers (id, name, coordinates, address, waste_type, latitude, longitude, center_type, region, district, operating_hours, phone, rating, capacity_notes, status, created_at, updated_at)
VALUES
  -- Safi Sana Ashaiman
  (gen_random_uuid(), 'Safi Sana - Ashaiman Poo Power Factory', ST_SetSRID(ST_Point(0.02, 5.7), 4326), 'Ashaiman, outskirts of Accra', 'Organic Waste, Fecal Sludge, Biogas', ST_SetSRID(ST_Point(0.02, 5.7), 4326), ST_SetSRID(ST_Point(0.02, 5.7), 4326), 'treatment_plant', 'Greater Accra', 'Ashaiman Municipal', '8:00 AM - 5:00 PM', '+233302972380', 4.6, 'Dutch-Ghanaian social venture. Converts waste to bio-fertilizer and energy. Serves 280,000 inhabitants.', 'active', NOW(), NOW()),

  -- Sofokrom Fecal Sludge Treatment
  (gen_random_uuid(), 'Sofokrom Fecal Sludge Treatment Plant', ST_SetSRID(ST_Point(-1.775, 4.955), 4326), 'Sofokrom-Essipon, Sekondi-Takoradi', 'Fecal Sludge, Wastewater', ST_SetSRID(ST_Point(-1.775, 4.955), 4326), ST_SetSRID(ST_Point(-1.775, 4.955), 4326), 'treatment_plant', 'Western', 'Sekondi-Takoradi Metropolitan', '6:00 AM - 6:00 PM', NULL, 4.0, '200 million euros wastewater treatment plant.', 'active', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- MAJOR WASTE MANAGEMENT COMPANIES (Regional Offices)
-- =====================================================

INSERT INTO disposal_centers (id, name, coordinates, address, waste_type, latitude, longitude, center_type, region, district, operating_hours, phone, rating, capacity_notes, status, created_at, updated_at)
VALUES
  -- Zoomlion Northern Region
  (gen_random_uuid(), 'Zoomlion - Northern Region Office', ST_SetSRID(ST_Point(-0.01, 9.43), 4326), 'Opp. Soochi Water, Gushegu Road, Yendi', 'All Waste Types', ST_SetSRID(ST_Point(-0.01, 9.43), 4326), ST_SetSRID(ST_Point(-0.01, 9.43), 4326), 'center', 'Northern', 'Tamale Metropolitan', '8:00 AM - 5:00 PM', '+233246651044', 4.2, 'Northern Region operations hub.', 'active', NOW(), NOW()),

  -- Zoomlion Central Region
  (gen_random_uuid(), 'Zoomlion - Central Region Office', ST_SetSRID(ST_Point(-1.25, 5.11), 4326), 'Behind Ameen Sangaii, Guinness, Cape Coast', 'All Waste Types', ST_SetSRID(ST_Point(-1.25, 5.11), 4326), ST_SetSRID(ST_Point(-1.25, 5.11), 4326), 'center', 'Central', 'Cape Coast Metropolitan', '8:00 AM - 5:00 PM', '+233208630876', 4.2, 'Central Region operations hub.', 'active', NOW(), NOW()),

  -- Jekora Ventures Compost Plant
  (gen_random_uuid(), 'Jekora Ventures Fortifer Compost Plant', ST_SetSRID(ST_Point(-0.218, 5.568), 4326), 'Accra', 'Organic Waste, Food Waste, Compost', ST_SetSRID(ST_Point(-0.218, 5.568), 4326), ST_SetSRID(ST_Point(-0.218, 5.568), 4326), 'compost_plant', 'Greater Accra', 'Accra Metropolitan', '8:00 AM - 5:00 PM', '+233277632648', 4.3, 'Converts food waste, fecal sludge, wood waste, rice husk to compost and briquettes.', 'active', NOW(), NOW()),

  -- City Waste Recycling (Enhanced entry)
  (gen_random_uuid(), 'City Waste Recycling Limited', ST_SetSRID(ST_Point(-0.21, 5.57), 4326), 'Accra', 'Plastic, Electronic Waste, Batteries, Sawdust', ST_SetSRID(ST_Point(-0.21, 5.57), 4326), ST_SetSRID(ST_Point(-0.21, 5.57), 4326), 'center', 'Greater Accra', 'Accra Metropolitan', '9:00 AM - 5:00 PM; Sat 6:00 AM - 12:00 PM', '+233244315069', 4.1, 'Waste source segregation, collection, recycling, e-waste, batteries, sawdust briquetting.', 'active', NOW(), NOW()),

  -- Nelplast Ghana
  (gen_random_uuid(), 'Nelplast Ghana Limited', ST_SetSRID(ST_Point(-0.22, 5.59), 4326), 'Accra', 'Plastic Bags, Water Sachets, Plastic Film', ST_SetSRID(ST_Point(-0.22, 5.59), 4326), ST_SetSRID(ST_Point(-0.22, 5.59), 4326), 'center', 'Greater Accra', 'Accra Metropolitan', '8:00 AM - 5:00 PM', '+233303970873', 4.4, 'Converts plastic waste into pavement slabs and tiles. Produces 200 blocks/day using 800kg plastic.', 'active', NOW(), NOW()),

  -- Borla Plus
  (gen_random_uuid(), 'Borla Plus', ST_SetSRID(ST_Point(-0.24, 5.56), 4326), 'Zara Link, Accra', 'Plastic Waste', ST_SetSRID(ST_Point(-0.24, 5.56), 4326), ST_SetSRID(ST_Point(-0.24, 5.56), 4326), 'center', 'Greater Accra', 'Accra Metropolitan', '24 Hours', '+233262684468', 4.0, 'Recovery and sub-cycling of plastic waste.', 'active', NOW(), NOW()),

  -- Trashy Bags Africa
  (gen_random_uuid(), 'Trashy Bags Africa', ST_SetSRID(ST_Point(-0.21, 5.58), 4326), 'Accra', 'Plastic Water Sachets', ST_SetSRID(ST_Point(-0.21, 5.58), 4326), ST_SetSRID(ST_Point(-0.21, 5.58), 4326), 'center', 'Greater Accra', 'Accra Metropolitan', '9:00 AM - 5:00 PM', NULL, 4.3, 'Upcycles drinking water sachets into eco-friendly bags. Collected ~33 million sachets since 2007.', 'active', NOW(), NOW()),

  -- rePATRN Limited
  (gen_random_uuid(), 'rePATRN Limited', ST_SetSRID(ST_Point(-0.21, 5.575), 4326), 'Accra', 'Plastic Waste', ST_SetSRID(ST_Point(-0.21, 5.575), 4326), ST_SetSRID(ST_Point(-0.21, 5.575), 4326), 'center', 'Greater Accra', 'Accra Metropolitan', '8:00 AM - 5:00 PM', '+23320797341', 4.0, 'Plastic recovery company.', 'active', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- CREATE INDEXES FOR NEW COLUMNS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_disposal_centers_region ON disposal_centers (region);
CREATE INDEX IF NOT EXISTS idx_disposal_centers_status ON disposal_centers (status);

-- =====================================================
-- UPDATE EXISTING RECORDS WITH REGION INFO
-- =====================================================

UPDATE disposal_centers 
SET region = 'Greater Accra' 
WHERE region IS NULL 
AND (
  address ILIKE '%accra%' 
  OR address ILIKE '%tema%' 
  OR address ILIKE '%madina%'
  OR address ILIKE '%coliba%'
);

-- =====================================================
-- VERIFY INSERTIONS
-- =====================================================

SELECT 
  COUNT(*) as total_centers,
  COUNT(DISTINCT region) as regions_covered,
  COUNT(DISTINCT center_type) as center_types,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_centers
FROM disposal_centers;

-- Show distribution by region
SELECT 
  COALESCE(region, 'Not specified') as region,
  COUNT(*) as count
FROM disposal_centers 
GROUP BY region 
ORDER BY count DESC;

-- Show distribution by center type
SELECT 
  center_type,
  COUNT(*) as count
FROM disposal_centers 
GROUP BY center_type 
ORDER BY count DESC;
