import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function fixCollectorSessions() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Checking collector_sessions table...');
    
    // First, try to insert a dummy record with all the required fields
    // This will either succeed or fail with a specific error that tells us what's wrong
    const testRecord = {
      collector_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      status: 'offline',
      status_reason: 'test',
      last_status_change: new Date().toISOString(),
      is_active: false,
      last_activity: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('collector_sessions')
      .insert(testRecord);
    
    if (error) {
      console.log('Error inserting test record:', error);
      
      if (error.code === '42P01') {
        // Table doesn't exist
        console.log('Table does not exist. Please run the full migration script.');
      } else if (error.code === '23502') {
        // Not null violation - likely the table exists but is missing columns
        console.log('Table exists but is missing required columns.');
        
        // Try to update an existing record with the new fields
        const { data: existingData, error: selectError } = await supabase
          .from('collector_sessions')
          .select('id, collector_id')
          .limit(1);
        
        if (selectError) {
          console.error('Error selecting from collector_sessions:', selectError);
        } else if (existingData && existingData.length > 0) {
          const existingRecord = existingData[0];
          console.log('Found existing record:', existingRecord);
          
          // Try to update with new fields
          const updateData = {
            status: 'offline',
            status_reason: null,
            last_status_change: new Date().toISOString(),
            is_active: false,
            last_activity: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { error: updateError } = await supabase
            .from('collector_sessions')
            .update(updateData)
            .eq('id', existingRecord.id);
          
          if (updateError) {
            console.error('Error updating record with new fields:', updateError);
            console.log('This likely means the columns do not exist.');
            console.log('Please use the Supabase dashboard to add the missing columns:');
            console.log('- status (text, default: "offline")');
            console.log('- status_reason (text, nullable)');
            console.log('- last_status_change (timestamptz, default: NOW())');
            console.log('- is_active (boolean, default: false)');
            console.log('- last_activity (timestamptz, default: NOW())');
            console.log('- updated_at (timestamptz, default: NOW())');
          } else {
            console.log('✅ Successfully updated record with new fields!');
            console.log('The table structure appears to be correct now.');
          }
        } else {
          console.log('No existing records found to update.');
        }
      } else {
        console.error('Unknown error:', error);
      }
    } else {
      console.log('✅ Test record inserted successfully!');
      console.log('The table structure appears to be correct.');
      
      // Clean up the test record
      const { error: deleteError } = await supabase
        .from('collector_sessions')
        .delete()
        .eq('collector_id', '00000000-0000-0000-0000-000000000000');
      
      if (deleteError) {
        console.error('Error deleting test record:', deleteError);
      } else {
        console.log('Test record cleaned up successfully.');
      }
    }
    
    console.log('\nDiagnostic complete. Please check the Supabase dashboard to manually add any missing columns if needed.');
    console.log('After making changes, restart your application to use the updated schema.');
    
  } catch (err) {
    console.error('Failed to run diagnostic:', err);
    process.exit(1);
  }
}

fixCollectorSessions();
