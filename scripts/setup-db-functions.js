/**
 * Script to set up database functions
 * Run with: node scripts/setup-db-functions.js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or service key. Please check your environment variables.');
  process.exit(1);
}

// Create Supabase client with service key for admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupFunctions() {
  try {
    console.log('Setting up database functions...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '..', 'supabase', 'functions', 'create_collector_record.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('Error setting up functions:', error);
      // Try direct SQL execution if RPC fails
      console.log('Trying direct SQL execution...');
      const { error: directError } = await supabase.sql(sqlContent);
      
      if (directError) {
        console.error('Direct SQL execution failed:', directError);
        process.exit(1);
      }
    }
    
    console.log('Database functions set up successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setupFunctions();
