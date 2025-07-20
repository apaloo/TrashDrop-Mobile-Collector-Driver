import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
  const statuses = ['available', 'accepted', 'completed'];
  const zones = ['East Legon', 'Osu', 'Cantonments', 'Airport Residential', 'Labone', 'Teshie', 'Madina', 'Adenta'];
  
  const now = new Date();
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const coords = generateRandomPoint({ lat: centerLat, lng: centerLng }, radiusKm);
  
  return {
    id: `assign_${Date.now()}_${index}`,
    location: `Location ${index + 1} in ${zones[Math.floor(Math.random() * zones.length)]}`,
    coordinates: coords.point,
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
    
    console.log('Generated assignments:', assignments);
    
    // Insert assignments one by one using a stored procedure
    // This is necessary because we need to handle RLS
    const results = [];
    
    for (const assignment of assignments) {
      try {
        const { data, error } = await supabase.rpc('create_authority_assignment', {
          p_id: assignment.id,
          p_location: assignment.location,
          p_coordinates: assignment.coordinates,
          p_status: assignment.status,
          p_collector_id: assignment.collector_id,
          p_accepted_at: assignment.accepted_at,
          p_completed_at: assignment.completed_at
        });
        
        if (error) throw error;
        results.push(data);
      } catch (error) {
        console.error(`Error inserting assignment ${assignment.id}:`, error);
      }
    }
    
    console.log(`Successfully seeded ${results.length} authority assignments`);
    if (results.length > 0) {
      console.log('Sample assignment:', results[0]);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// First, let's create the database function if it doesn't exist
async function createDatabaseFunction() {
  const createFunctionSQL = `
    create or replace function create_authority_assignment(
      p_id text,
      p_location text,
      p_coordinates text,
      p_status text,
      p_collector_id uuid,
      p_accepted_at timestamptz,
      p_completed_at timestamptz
    )
    returns json
    language plpgsql
    security definer
    as $$
    begin
      insert into public.authority_assignments (
        id,
        location,
        coordinates,
        status,
        collector_id,
        accepted_at,
        completed_at,
        created_at,
        updated_at
      ) values (
        p_id,
        p_location,
        st_geomfromtext(p_coordinates, 4326),
        p_status,
        p_collector_id,
        p_accepted_at,
        p_completed_at,
        now(),
        now()
      )
      returning id, location, status, created_at;
      
      return json_build_object('success', true);
    exception when others then
      return json_build_object('error', sqlerrm);
    end;
    $$;`;

  try {
    const { data, error } = await supabase.rpc('pg_temp.execute_sql', {
      sql: createFunctionSQL
    });
    
    if (error) {
      console.error('Error creating database function:', error);
      return false;
    }
    
    console.log('Database function created successfully');
    return true;
  } catch (error) {
    console.error('Error creating database function:', error);
    return false;
  }
}

// Main execution
async function main() {
  console.log('Creating database function...');
  const functionCreated = await createDatabaseFunction();
  
  if (functionCreated) {
    console.log('Seeding authority assignments...');
    await seedAuthorityAssignments();
  } else {
    console.error('Failed to create database function. Cannot proceed with seeding.');
  }
}

// Run the main function
main().catch(console.error);
