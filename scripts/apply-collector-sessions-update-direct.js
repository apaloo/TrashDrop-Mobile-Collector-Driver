import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function applyMigration() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Execute the ALTER TABLE statement directly
    console.log('Adding missing columns to collector_sessions table...');
    
    const { error: alterError } = await supabase.from('collector_sessions').select('id').limit(1);
    
    if (alterError) {
      console.error('Error checking collector_sessions table:', alterError);
      
      // If the table doesn't exist, create it
      if (alterError.code === 'PGRST104') {
        console.log('Table does not exist, creating collector_sessions table...');
        
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS public.collector_sessions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            collector_id uuid NOT NULL REFERENCES auth.users(id),
            status TEXT DEFAULT 'offline',
            status_reason TEXT,
            last_status_change TIMESTAMPTZ DEFAULT NOW(),
            is_active BOOLEAN DEFAULT FALSE,
            last_activity TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `;
        
        // We need to use the REST API directly since we can't execute SQL directly
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            command: 'CREATE_TABLE',
            table: 'collector_sessions',
            schema: {
              id: { type: 'uuid', primaryKey: true, defaultValue: 'gen_random_uuid()' },
              collector_id: { type: 'uuid', notNull: true, references: 'auth.users(id)' },
              status: { type: 'text', defaultValue: "'offline'" },
              status_reason: { type: 'text' },
              last_status_change: { type: 'timestamptz', defaultValue: 'NOW()' },
              is_active: { type: 'boolean', defaultValue: 'false' },
              last_activity: { type: 'timestamptz', defaultValue: 'NOW()' },
              updated_at: { type: 'timestamptz', defaultValue: 'NOW()' }
            }
          })
        });
        
        if (!response.ok) {
          console.error('Error creating table:', await response.text());
        } else {
          console.log('✅ Table created successfully');
        }
      }
    } else {
      console.log('Table exists, adding columns...');
      
      // Add columns one by one using the REST API
      const columns = [
        { name: 'status', type: 'text', default: "'offline'" },
        { name: 'status_reason', type: 'text' },
        { name: 'last_status_change', type: 'timestamptz', default: 'NOW()' },
        { name: 'is_active', type: 'boolean', default: 'false' },
        { name: 'last_activity', type: 'timestamptz', default: 'NOW()' },
        { name: 'updated_at', type: 'timestamptz', default: 'NOW()' }
      ];
      
      for (const column of columns) {
        try {
          // Check if column exists
          const { error: columnError } = await supabase
            .from('collector_sessions')
            .select(column.name)
            .limit(1);
          
          if (columnError) {
            console.log(`Adding column ${column.name}...`);
            
            // Column doesn't exist, add it
            const response = await fetch(`${supabaseUrl}/rest/v1/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({
                command: 'ALTER_TABLE',
                table: 'collector_sessions',
                action: 'ADD_COLUMN',
                column: {
                  name: column.name,
                  type: column.type,
                  default: column.default
                }
              })
            });
            
            if (!response.ok) {
              console.error(`Error adding column ${column.name}:`, await response.text());
            } else {
              console.log(`✅ Column ${column.name} added successfully`);
            }
          } else {
            console.log(`Column ${column.name} already exists`);
          }
        } catch (err) {
          console.error(`Error processing column ${column.name}:`, err);
        }
      }
    }
    
    console.log('\n✨ Collector sessions table update completed!');
    console.log('Please restart your application to use the updated schema.');
    
  } catch (err) {
    console.error('Failed to apply migration:', err);
    process.exit(1);
  }
}

applyMigration();
