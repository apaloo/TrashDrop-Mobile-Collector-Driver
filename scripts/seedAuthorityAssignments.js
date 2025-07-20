import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Center coordinates (Accra, Ghana)
const centerLat = 5.6725034273482295;
const centerLng = -0.2808245894815911;
const radiusKm = 15; // 15km radius

// Function to generate random coordinates within a radius (in kilometers)
function generateRandomPoint(center, radius) {
  const y0 = center.lat;
  const x0 = center.lng;
  
  // Convert radius from kilometers to degrees (approximate)
  const r = radius / 111.32;
  
  // Generate random angle and distance
  const u = Math.random();
  const v = Math.random();
  const w = r * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  
  // Calculate new coordinates
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  
  // Adjust the x-coordinate for the shrinking of the east-west distances
  const newX = x / Math.cos(y0 * Math.PI / 180);
  
  const foundLatitude = y + y0;
  const foundLongitude = newX + x0;
  
  return {
    lat: foundLatitude,
    lng: foundLongitude,
    point: `POINT(${foundLongitude} ${foundLatitude})`
  };
}

// Generate random assignment data
function generateRandomAssignment(index) {
  const wasteTypes = ['general', 'recyclable', 'hazardous', 'organic', 'e-waste'];
  const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  const priorities = ['low', 'medium', 'high'];
  const zones = ['East Legon', 'Osu', 'Cantonments', 'Airport Residential', 'Labone', 'Teshie', 'Madina', 'Adenta'];
  
  const now = new Date();
  const createdAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Random date in last 30 days
  const dueDate = new Date(createdAt.getTime() + (7 + Math.floor(Math.random() * 14)) * 24 * 60 * 60 * 1000); // 7-21 days after creation
  
  // Generate random coordinates within 15km radius
  const coords = generateRandomPoint({ lat: centerLat, lng: centerLng }, radiusKm);
  
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    id: `assign_${Date.now()}_${index}`,
    location: `Location ${index + 1} in ${zones[Math.floor(Math.random() * zones.length)]}`,
    coordinates: coords.point,
    fee: [500, 1000, 1500, 2000, 2500][Math.floor(Math.random() * 5)],
    status: status,
    collector_id: null, // Will be assigned when accepted
    accepted_at: status === 'accepted' || status === 'completed' ? now.toISOString() : null,
    completed_at: status === 'completed' ? now.toISOString() : null,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

// Seed authority assignments
async function seedAuthorityAssignments() {
  try {
    // Generate 15 random assignments
    const assignments = Array.from({ length: 15 }, (_, i) => generateRandomAssignment(i));
    
    // Insert assignments into the database
    const { data, error } = await supabase
      .from('authority_assignments')
      .insert(assignments)
      .select();
    
    if (error) {
      console.error('Error seeding authority assignments:', error);
    } else {
      console.log(`Successfully seeded ${data.length} authority assignments`);
      console.log('Sample assignment:', data[0]);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the seed function
seedAuthorityAssignments();
