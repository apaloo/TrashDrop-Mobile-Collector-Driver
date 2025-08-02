import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function applyMigrations() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Read and parse migration SQL
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'db-migrations.sql'), 'utf8');

    // Split into individual statements (naive approach, assumes no semicolons in strings)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) throw error;
        console.log('✅ Statement executed successfully');
      } catch (err) {
        console.error('❌ Error executing statement:', err.message);
        console.error('Statement was:', statement);
        process.exit(1);
      }
    }

    console.log('\n✨ All migrations completed successfully!');
  } catch (err) {
    console.error('Failed to apply migrations:', err);
    process.exit(1);
  }
}

applyMigrations();
