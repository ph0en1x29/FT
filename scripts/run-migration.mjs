/**
 * Run migration using direct pg connection
 * Uses Supabase connection string with transaction mode
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check for DB password in environment
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

if (!DB_PASSWORD) {
  console.error('ERROR: SUPABASE_DB_PASSWORD environment variable not set');
  console.error('');
  console.error('Set it and run again:');
  console.error('  export SUPABASE_DB_PASSWORD="your-password"');
  console.error('  node scripts/run-migration.mjs');
  console.error('');
  console.error('Find password in Supabase Dashboard > Settings > Database > Connection string');
  process.exit(1);
}

const connectionString = `postgresql://postgres.dljiubrbatmrskrzaazt:${DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:6543/postgres`;

const client = new pg.Client({ connectionString });

async function runMigration() {
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260205_hourmeter_service_tracking.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('🚀 Applying migration: 20260205_hourmeter_service_tracking.sql');
  console.log('');
  
  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    await client.query('BEGIN');
    console.log('✓ Started transaction');
    
    await client.query(sql);
    console.log('✓ Executed migration SQL');
    
    await client.query('COMMIT');
    console.log('✓ Committed transaction');
    
    console.log('');
    console.log('========================================');
    console.log('✅ Migration applied successfully!');
    console.log('========================================');
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    if (error.position) {
      console.error('Error position:', error.position);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
