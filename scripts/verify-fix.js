import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function verifyFix() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Verifying collector_sessions table structure...');
    
    // Get the current user to use for testing
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting current user:', userError);
      process.exit(1);
    }
    
    if (!userData.user) {
      console.error('No authenticated user found. Please sign in first.');
      process.exit(1);
    }
    
    console.log(`Using user ID: ${userData.user.id} for verification`);
    
    // Try to upsert a record with all the required fields
    const testRecord = {
      collector_id: userData.user.id,
      status: 'offline',
      status_reason: 'verification test',
      last_status_change: new Date().toISOString(),
      is_active: false,
      last_activity: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('collector_sessions')
      .upsert(testRecord)
      .select();
    
    if (error) {
      console.error('❌ Error upserting test record:', error);
      console.log('The fix has NOT been applied successfully.');
      
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('\nMissing columns detected. Please follow these steps:');
        console.log('1. Open the fix-instructions.html file in your browser');
        console.log('2. Follow the instructions to run the SQL script in the Supabase dashboard');
        console.log('3. Run this verification script again after applying the fix');
      }
    } else {
      console.log('✅ Test record upserted successfully!');
      console.log('The fix has been applied successfully.');
      console.log('\nRecord data:', data);
      
      // Try to select the record to verify all columns
      const { data: selectData, error: selectError } = await supabase
        .from('collector_sessions')
        .select('*')
        .eq('collector_id', userData.user.id)
        .single();
      
      if (selectError) {
        console.error('Error selecting record:', selectError);
      } else {
        console.log('\nVerified record data:');
        console.log('- id:', selectData.id);
        console.log('- collector_id:', selectData.collector_id);
        console.log('- status:', selectData.status);
        console.log('- status_reason:', selectData.status_reason);
        console.log('- last_status_change:', selectData.last_status_change);
        console.log('- is_active:', selectData.is_active);
        console.log('- last_activity:', selectData.last_activity);
        console.log('- updated_at:', selectData.updated_at);
        
        console.log('\n✅ All columns verified successfully!');
        console.log('You can now restart your application to use the updated schema.');
      }
    }
  } catch (err) {
    console.error('Failed to verify fix:', err);
    process.exit(1);
  }
}

verifyFix();
