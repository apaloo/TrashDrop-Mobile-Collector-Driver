// Script to seed test data into the pickup_requests table
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Configure dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Center coordinates (Accra, Ghana)
const centerLat = 5.672524779099469;
const centerLng = -0.2808150610819718;
const radiusKm = 10; // 10km radius

// Waste types
const wasteTypes = ['plastic', 'paper', 'glass', 'metal', 'organic', 'e-waste', 'hazardous'];

// Address prefixes for generating realistic locations
const addressPrefixes = [
  'House', 'Apartment', 'Office', 'Shop', 'Market', 'Mall', 
  'School', 'Hospital', 'Restaurant', 'Hotel', 'Residence', 'Complex'
];

// Street names for generating realistic addresses
const streetNames = [
  'Main St', 'Oak Ave', 'Maple Rd', 'Cedar Ln', 'Pine St', 'Elm St', 'Birch Blvd',
  'Cedar Ave', 'Spruce Dr', 'Willow Way', 'Park Ave', 'Broadway', 'High St',
  'Market St', 'Church Rd', 'School St', 'University Ave', 'Hospital Rd'
];

// Generate random coordinates within a radius (in kilometers)
function generateRandomPoint(center, radius) {
  // Convert radius from kilometers to degrees (approximate)
  const radiusInDegrees = radius / 111.32;
  
  // Generate random angle and distance
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radiusInDegrees;
  
  // Calculate new coordinates
  const lat = center.lat + (Math.cos(angle) * distance);
  const lng = center.lng + (Math.sin(angle) * distance);
  
  return { lat, lng };
}

// Generate a random date within the last 7 days
function randomDate() {
  const now = new Date();
  const pastDate = new Date();
  pastDate.setDate(now.getDate() - 7);
  return new Date(pastDate.getTime() + Math.random() * (now.getTime() - pastDate.getTime()));
}

// Generate test data
async function generateTestData() {
  const testData = [];
  
  for (let i = 0; i < 20; i++) {
    // Only create 'available' requests to avoid foreign key constraints
    const status = 'available';
    const coords = generateRandomPoint({ lat: centerLat, lng: centerLng }, radiusKm);
    const wasteType = wasteTypes[Math.floor(Math.random() * wasteTypes.length)];
    const addressPrefix = addressPrefixes[Math.floor(Math.random() * addressPrefixes.length)];
    const street = streetNames[Math.floor(Math.random() * streetNames.length)];
    const address = `${addressPrefix} ${Math.floor(1 + Math.random() * 500)} ${street}`;
    const fee = Math.floor(10 + Math.random() * 40); // Random fee between 10 and 50
    const bagCount = Math.floor(1 + Math.random() * 10); // 1-10 bags
    
    // Format coordinates as a PostGIS geometry string (POINT(lng lat))
    const pointString = `POINT(${coords.lng} ${coords.lat})`;
    
    const request = {
      'id..': uuidv4(), // Using the correct column name with dots from your schema
      location: address,
      coordinates: pointString, // This will be converted to a geometry type in Supabase
      fee: fee,
      status: status,
      waste_type: wasteType,
      bag_count: bagCount,
      special_instructions: Math.random() > 0.7 ? 'Handle with care' : null,
      created_at: randomDate().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // For available requests, we don't need to set collector_id, accepted_at, or picked_up_at
    
    testData.push(request);
  }
  
  return testData;
}

// Insert test data into Supabase
async function seedDatabase() {
  try {
    console.log('Generating test data...');
    const testData = await generateTestData();
    
    console.log('Inserting test data into Supabase...');
    const { data, error } = await supabase
      .from('pickup_requests')
      .insert(testData);
    
    if (error) {
      console.error('Error inserting test data:', error);
    } else {
      console.log('Successfully inserted test data!');
      console.log(`${testData.length} records added to pickup_requests table.`);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Run the seed function
seedDatabase()
  .then(() => {
    console.log('Seeding complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
