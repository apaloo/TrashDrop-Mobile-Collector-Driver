import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Center coordinates provided by user
const centerLat = 5.672505;
const centerLng = -0.280669;
const radiusKm = 10; // 10km radius as requested

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

// Generate realistic illegal dumping site locations
function generateIllegalDumpingSite(index) {
  const dumpingSiteTypes = [
    'Roadside Cleanup',
    'Construction Site Cleanup', 
    'Forest Clearing',
    'River Bank Cleanup',
    'Vacant Lot Cleanup',
    'Industrial Waste Removal',
    'Commercial Area Cleanup',
    'Residential Cleanup',
    'Bridge Underpass Cleanup',
    'Abandoned Property Cleanup',
    'School Area Cleanup',
    'Market Area Cleanup',
    'Community Cleanup',
    'Public Park Cleanup',
    'Street Cleaning'
  ];
  
  const authorities = [
    'Public Works Department',
    'Environmental Protection Agency',
    'Waste Management Authority',
    'Municipal Assembly',
    'Community Development Board',
    'District Health Office'
  ];
  
  const priorities = ['low', 'medium', 'high'];
  const zones = ['East Legon', 'Osu', 'Cantonments', 'Airport Residential', 'Labone', 'Teshie', 'Madina', 'Adenta'];
  
  const now = new Date();
  
  // Generate random coordinates within 10km radius
  const coords = generateRandomPoint({ lat: centerLat, lng: centerLng }, radiusKm);
  
  const priority = priorities[Math.floor(Math.random() * priorities.length)];
  const cleanupType = dumpingSiteTypes[Math.floor(Math.random() * dumpingSiteTypes.length)];
  const zone = zones[Math.floor(Math.random() * zones.length)];
  const authority = authorities[Math.floor(Math.random() * authorities.length)];
  
  // Calculate payment based on priority and type
  let basePayment = 75;
  if (priority === 'medium') basePayment = 125;
  if (priority === 'high') basePayment = 200;
  if (cleanupType.includes('Construction') || cleanupType.includes('Industrial')) basePayment += 50;
  
  // Estimate time based on priority
  const estimatedHours = priority === 'high' ? '4-6 hours' : priority === 'medium' ? '2-4 hours' : '1-3 hours';
  
  // Calculate approximate distance (0.5 to 8.5 km within 10km radius)
  const approximateDistance = (Math.random() * 8 + 0.5).toFixed(1);
  
  return {
    id: `DUMP-${String(index + 1).padStart(2, '0')}${Math.floor(Math.random() * 900) + 100}`,
    location: `${zone} - ${cleanupType.replace(' Cleanup', ' Area')}`,
    coordinates: coords.point,
    type: cleanupType,
    priority: priority,
    payment: `$${basePayment}.00`,
    estimated_time: estimatedHours,
    distance: `${approximateDistance} km`,
    authority: authority,
    status: 'available',
    collector_id: null,
    accepted_at: null,
    completed_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

// Clear existing data and seed new illegal dumping sites
async function seedIllegalDumpingSites() {
  try {
    console.log('🗑️  Starting illegal dumping sites seeding process...');
    
    // First, let's check the current structure of the authority_assignments table
    const { data: existingData, error: fetchError } = await supabase
      .from('authority_assignments')
      .select('*')
      .limit(1);
      
    if (fetchError) {
      console.error('Error fetching table structure:', fetchError);
      return;
    }
    
    console.log('Current table structure sample:', existingData[0]);
    
    // Clear existing data (optional - comment out if you want to keep existing data)
    // const { error: deleteError } = await supabase
    //   .from('authority_assignments')
    //   .delete()
    //   .neq('id', 'never_matches'); // This deletes all records
    
    // if (deleteError) {
    //   console.error('Error clearing existing data:', deleteError);
    // } else {
    //   console.log('✅ Cleared existing authority assignments');
    // }
    
    // Generate 15 illegal dumping sites
    const dumpingSites = Array.from({ length: 15 }, (_, i) => generateIllegalDumpingSite(i));
    
    console.log('📍 Generated 15 illegal dumping sites within 10km radius');
    console.log('Center coordinates:', { lat: centerLat, lng: centerLng });
    console.log('Sample dumping site:', dumpingSites[0]);
    
    // Insert dumping sites into the database
    const { data, error } = await supabase
      .from('authority_assignments')
      .insert(dumpingSites)
      .select();
    
    if (error) {
      console.error('❌ Error seeding illegal dumping sites:', error);
      console.error('Error details:', error.details);
      console.error('Error message:', error.message);
    } else {
      console.log(`✅ Successfully seeded ${data.length} illegal dumping sites!`);
      console.log('📊 Summary:');
      
      // Show breakdown by severity
      const severityBreakdown = data.reduce((acc, site) => {
        acc[site.severity] = (acc[site.severity] || 0) + 1;
        return acc;
      }, {});
      
      console.log('   Severity breakdown:', severityBreakdown);
      console.log('   Average fee:', data.reduce((sum, site) => sum + site.fee, 0) / data.length);
      console.log('   Sample locations:');
      data.slice(0, 3).forEach((site, i) => {
        console.log(`   ${i + 1}. ${site.location} (${site.severity} priority)`);
      });
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the seed function
seedIllegalDumpingSites();
