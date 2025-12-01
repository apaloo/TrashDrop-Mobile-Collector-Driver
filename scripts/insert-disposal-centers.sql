-- Insert Disposal Centers Data
-- This script populates the disposal_centers table with waste collection and recycling centers

-- Insert disposal centers with geography coordinates (PostGIS POINT format)
INSERT INTO disposal_centers (id, name, coordinates, address, waste_type, latitude, longitude, center_type, created_at, updated_at)
VALUES
  -- Adeseglakpee E-waste Recycling Centre/EPA
  (gen_random_uuid(), 'Adeseglakpee E-waste Recycling Centre/EPA', ST_SetSRID(ST_Point(-0.22895, 5.549645), 4326), 'Adeseglakpee E-waste Recycling Centre/EPA', 'Burning, Electrical Appliances, Small Appliances, Waste', ST_SetSRID(ST_Point(-0.22895, 5.549645), 4326), ST_SetSRID(ST_Point(-0.22895, 5.549645), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- Coliba Collection Points
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.247351, 5.60061), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.247351, 5.60061), 4326), ST_SetSRID(ST_Point(-0.247351, 5.60061), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.229417, 5.594755), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.229417, 5.594755), 4326), ST_SetSRID(ST_Point(-0.229417, 5.594755), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.229167, 5.579717), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.229167, 5.579717), 4326), ST_SetSRID(ST_Point(-0.229167, 5.579717), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.228162, 5.559949), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.228162, 5.559949), 4326), ST_SetSRID(ST_Point(-0.228162, 5.559949), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.230182, 5.558369), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.230182, 5.558369), 4326), ST_SetSRID(ST_Point(-0.230182, 5.558369), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.220391, 5.558102), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.220391, 5.558102), 4326), ST_SetSRID(ST_Point(-0.220391, 5.558102), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.181763, 5.565733), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.181763, 5.565733), 4326), ST_SetSRID(ST_Point(-0.181763, 5.565733), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.180504, 5.591868), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.180504, 5.591868), 4326), ST_SetSRID(ST_Point(-0.180504, 5.591868), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.214355, 5.586459), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.214355, 5.586459), 4326), ST_SetSRID(ST_Point(-0.214355, 5.586459), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.202893, 5.592574), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.202893, 5.592574), 4326), ST_SetSRID(ST_Point(-0.202893, 5.592574), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.204328, 5.578789), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.204328, 5.578789), 4326), ST_SetSRID(ST_Point(-0.204328, 5.578789), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.175572, 5.64614), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.175572, 5.64614), 4326), ST_SetSRID(ST_Point(-0.175572, 5.64614), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.014585, 5.682964), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.014585, 5.682964), 4326), ST_SetSRID(ST_Point(-0.014585, 5.682964), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.238415, 5.589958), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.238415, 5.589958), 4326), ST_SetSRID(ST_Point(-0.238415, 5.589958), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.236452, 5.573153), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.236452, 5.573153), 4326), ST_SetSRID(ST_Point(-0.236452, 5.573153), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(0.02443, 5.683755), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(0.02443, 5.683755), 4326), ST_SetSRID(ST_Point(0.02443, 5.683755), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.074741, 5.654311), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.074741, 5.654311), 4326), ST_SetSRID(ST_Point(-0.074741, 5.654311), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Coliba Collection Point', ST_SetSRID(ST_Point(-0.063735, 5.641761), 4326), 'Coliba', 'Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.063735, 5.641761), 4326), ST_SetSRID(ST_Point(-0.063735, 5.641761), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- Accra Waste Recovery Park
  (gen_random_uuid(), 'Accra Waste Recovery Park', ST_SetSRID(ST_Point(-0.223608, 5.641361), 4326), 'Accra Waste Recovery Park', 'Aluminum Cans, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.223608, 5.641361), 4326), ST_SetSRID(ST_Point(-0.223608, 5.641361), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- SESA Recycling Centers
  (gen_random_uuid(), 'SESA Recycling', ST_SetSRID(ST_Point(-0.214036, 5.698552), 4326), 'SESA Recycling', 'Waste', ST_SetSRID(ST_Point(-0.214036, 5.698552), 4326), ST_SetSRID(ST_Point(-0.214036, 5.698552), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- Recycling Centers
  (gen_random_uuid(), 'Recycling Centre', ST_SetSRID(ST_Point(-0.314144, 5.598917), 4326), 'Recycling Centre', 'Not Specified', ST_SetSRID(ST_Point(-0.314144, 5.598917), 4326), ST_SetSRID(ST_Point(-0.314144, 5.598917), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- Recycling Containers
  (gen_random_uuid(), 'Recycling Container', ST_SetSRID(ST_Point(-0.206553, 5.698696), 4326), 'Recycling Container', 'Waste', ST_SetSRID(ST_Point(-0.206553, 5.698696), 4326), ST_SetSRID(ST_Point(-0.206553, 5.698696), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycling Container', ST_SetSRID(ST_Point(-0.200528, 5.696798), 4326), 'Recycling Container', 'Waste', ST_SetSRID(ST_Point(-0.200528, 5.696798), 4326), ST_SetSRID(ST_Point(-0.200528, 5.696798), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycling Container', ST_SetSRID(ST_Point(-0.200511, 5.587145), 4326), 'Recycling Container', 'Waste', ST_SetSRID(ST_Point(-0.200511, 5.587145), 4326), ST_SetSRID(ST_Point(-0.200511, 5.587145), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycling Container', ST_SetSRID(ST_Point(-0.207504, 5.596292), 4326), 'Recycling Container', 'Waste', ST_SetSRID(ST_Point(-0.207504, 5.596292), 4326), ST_SetSRID(ST_Point(-0.207504, 5.596292), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycling Container', ST_SetSRID(ST_Point(-0.207504, 5.599262), 4326), 'Recycling Container', 'Waste', ST_SetSRID(ST_Point(-0.207504, 5.599262), 4326), ST_SetSRID(ST_Point(-0.207504, 5.599262), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycling Container', ST_SetSRID(ST_Point(-0.199684, 5.578425), 4326), 'Recycling Container', 'Waste', ST_SetSRID(ST_Point(-0.199684, 5.578425), 4326), ST_SetSRID(ST_Point(-0.199684, 5.578425), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- Christ Revelation Church (Basai Municipal Church)
  (gen_random_uuid(), 'Christ Revelation Church (Basai Municipal Church)', ST_SetSRID(ST_Point(-0.214265, 5.653537), 4326), 'Christ Revelation Church', 'Waste', ST_SetSRID(ST_Point(-0.214265, 5.653537), 4326), ST_SetSRID(ST_Point(-0.214265, 5.653537), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- SESA Collection Point
  (gen_random_uuid(), 'SESA Collection Point', ST_SetSRID(ST_Point(-0.261534, 5.623389), 4326), 'SESA Collection Point', 'Aluminium, Cans, Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.261534, 5.623389), 4326), ST_SetSRID(ST_Point(-0.261534, 5.623389), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- SESA Recycling Points
  (gen_random_uuid(), 'SESA Recycling', ST_SetSRID(ST_Point(-0.26197, 5.692975), 4326), 'SESA Recycling', 'Cardboard, Cartons, Newspaper, Paper, Paper Packaging, Plastic, Plastic Bottles, Plastic Packaging', ST_SetSRID(ST_Point(-0.26197, 5.692975), 4326), ST_SetSRID(ST_Point(-0.26197, 5.692975), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'SESA Recycling', ST_SetSRID(ST_Point(-0.214138, 5.673742), 4326), 'SESA Recycling', 'Plastic', ST_SetSRID(ST_Point(-0.214138, 5.673742), 4326), ST_SetSRID(ST_Point(-0.214138, 5.673742), 4326), 'container', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- Specialized Recycling Facilities
  (gen_random_uuid(), 'Universal Plastic Product and Recycling Limited', ST_SetSRID(ST_Point(-0.27105, 5.695748), 4326), 'Universal Plastic Product and Recycling Limited', 'Plastic', ST_SetSRID(ST_Point(-0.27105, 5.695748), 4326), ST_SetSRID(ST_Point(-0.27105, 5.695748), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Crown Waste Management', ST_SetSRID(ST_Point(-0.242537, 5.610772), 4326), 'Crown Waste Management', 'Metal', ST_SetSRID(ST_Point(-0.242537, 5.610772), 4326), ST_SetSRID(ST_Point(-0.242537, 5.610772), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Liz Montes Avenue Facility', ST_SetSRID(ST_Point(-0.221552, 5.534625), 4326), 'Liz Montes Avenue Facility', 'Plastic', ST_SetSRID(ST_Point(-0.221552, 5.534625), 4326), ST_SetSRID(ST_Point(-0.221552, 5.534625), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycling Company (Former Compost Plant Lanmd)', ST_SetSRID(ST_Point(-0.225908, 5.540742), 4326), 'Recycling Company', 'Plastic', ST_SetSRID(ST_Point(-0.225908, 5.540742), 4326), ST_SetSRID(ST_Point(-0.225908, 5.540742), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Vink''s Dump Factory', ST_SetSRID(ST_Point(-0.160522, 5.629587), 4326), 'Vink''s Dump Factory', 'Plastic', ST_SetSRID(ST_Point(-0.160522, 5.629587), 4326), ST_SetSRID(ST_Point(-0.160522, 5.629587), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Zoomlion', ST_SetSRID(ST_Point(-0.181188, 5.611963), 4326), 'Zoomlion', 'Plastic', ST_SetSRID(ST_Point(-0.181188, 5.611963), 4326), ST_SetSRID(ST_Point(-0.181188, 5.611963), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Kwame Nkrumah Scrap Landfill', ST_SetSRID(ST_Point(-0.198789, 5.619619), 4326), 'Kwame Nkrumah Scrap Landfill', 'Burning, Electrical Appliances, Small Appliances, Plastic', ST_SetSRID(ST_Point(-0.198789, 5.619619), 4326), ST_SetSRID(ST_Point(-0.198789, 5.619619), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Eia Odumasse', ST_SetSRID(ST_Point(-0.308162, 5.569867), 4326), 'Eia Odumasse', 'Plastic', ST_SetSRID(ST_Point(-0.308162, 5.569867), 4326), ST_SetSRID(ST_Point(-0.308162, 5.569867), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycle Up Experimental Services', ST_SetSRID(ST_Point(-0.280505, 5.792184), 4326), 'Recycle Up Experimental Services', 'Plastic Bottles', ST_SetSRID(ST_Point(-0.280505, 5.792184), 4326), ST_SetSRID(ST_Point(-0.280505, 5.792184), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Jakeria Ventures ForNn/ Compost Plant', ST_SetSRID(ST_Point(-0.083741, 5.66259), 4326), 'Jakeria Ventures ForNn/ Compost Plant', 'Food Waste, Green Waste', ST_SetSRID(ST_Point(-0.083741, 5.66259), 4326), ST_SetSRID(ST_Point(-0.083741, 5.66259), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Taafohouse', ST_SetSRID(ST_Point(-0.235514, 5.58377), 4326), 'Taafohouse', 'Plastic', ST_SetSRID(ST_Point(-0.235514, 5.58377), 4326), ST_SetSRID(ST_Point(-0.235514, 5.58377), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  
  -- Environmental Services
  (gen_random_uuid(), 'Recycling Centre', ST_SetSRID(ST_Point(-1.635241, 5.095211), 4326), 'Environmental Services', 'Not Specified', ST_SetSRID(ST_Point(-1.635241, 5.095211), 4326), ST_SetSRID(ST_Point(-1.635241, 5.095211), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycling Centre', ST_SetSRID(ST_Point(-1.679382, 5.880985), 4326), 'Recycling Centre', 'Not Specified', ST_SetSRID(ST_Point(-1.679382, 5.880985), 4326), ST_SetSRID(ST_Point(-1.679382, 5.880985), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycling Service Point', ST_SetSRID(ST_Point(-0.203908, 5.63892), 4326), 'Recycling Service Point', 'Not Specified', ST_SetSRID(ST_Point(-0.203908, 5.63892), 4326), ST_SetSRID(ST_Point(-0.203908, 5.63892), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Scrap Recycling', ST_SetSRID(ST_Point(-0.581158, 5.684128), 4326), 'Scrap Recycling', 'Scrap Metal', ST_SetSRID(ST_Point(-0.581158, 5.684128), 4326), ST_SetSRID(ST_Point(-0.581158, 5.684128), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Plastic Recycling', ST_SetSRID(ST_Point(-0.581681, 5.694427), 4326), 'Plastic Recycling', 'Plastic', ST_SetSRID(ST_Point(-0.581681, 5.694427), 4326), ST_SetSRID(ST_Point(-0.581681, 5.694427), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'Recycling Center', ST_SetSRID(ST_Point(-0.181637, 5.571599), 4326), 'Recycling Center', 'Not Specified', ST_SetSRID(ST_Point(-0.181637, 5.571599), 4326), ST_SetSRID(ST_Point(-0.181637, 5.571599), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00'),
  (gen_random_uuid(), 'recycling (International)', ST_SetSRID(ST_Point(-0.677484, 5.609285), 4326), 'recycling (International)', 'Not Specified', ST_SetSRID(ST_Point(-0.677484, 5.609285), 4326), ST_SetSRID(ST_Point(-0.677484, 5.609285), 4326), 'center', '2025-04-04 14:15:15.30324+00', '2025-04-04 14:15:15.30324+00');

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_disposal_centers_coordinates ON disposal_centers USING GIST (coordinates);
CREATE INDEX IF NOT EXISTS idx_disposal_centers_center_type ON disposal_centers (center_type);
CREATE INDEX IF NOT EXISTS idx_disposal_centers_waste_type ON disposal_centers (waste_type);

-- Verify the insertions
SELECT 
  count(*) as total_centers,
  count(DISTINCT center_type) as distinct_types,
  count(DISTINCT waste_type) as distinct_waste_types
FROM disposal_centers;

COMMENT ON TABLE disposal_centers IS 'Storage for waste collection and recycling disposal centers in Ghana';
COMMENT ON COLUMN disposal_centers.coordinates IS 'PostGIS geography point for location (latitude, longitude)';
COMMENT ON COLUMN disposal_centers.center_type IS 'Type of disposal center: center, container, etc.';
COMMENT ON COLUMN disposal_centers.waste_type IS 'Types of waste accepted at this center (comma-separated)';
