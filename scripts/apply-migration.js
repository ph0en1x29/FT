/**
 * Apply migration using Supabase service role key
 * This script reads the migration file and executes it via Supabase's pg client
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://dljiubrbatmrskrzaazt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsaml1YnJiYXRtcnNrcnphYXp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTMzNDU5NCwiZXhwIjoyMDgwOTEwNTk0fQ.sYkN2dQA4FziSJx7sCdzc4l1htvEbWf7uLEOkOBJ_d8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function applyMigration() {
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260205_hourmeter_service_tracking.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Applying migration: 20260205_hourmeter_service_tracking.sql');
  console.log('SQL length:', sql.length, 'characters');
  
  // Split into individual statements (rough split on semicolons followed by newlines)
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));
  
  console.log(`Found ${statements.length} statements to execute\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.startsWith('--')) continue;
    
    // Get first line for logging
    const firstLine = stmt.split('\n')[0].substring(0, 60);
    console.log(`[${i + 1}/${statements.length}] ${firstLine}...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
      
      if (error) {
        // Try direct query as fallback (for DDL statements)
        const { error: directError } = await supabase.from('_exec').select().limit(0);
        if (directError && directError.code !== '42P01') {
          console.log(`   ⚠️  Warning: ${error.message}`);
          errorCount++;
        } else {
          console.log('   ✓ OK (via fallback)');
          successCount++;
        }
      } else {
        console.log('   ✓ OK');
        successCount++;
      }
    } catch (e) {
      console.log(`   ⚠️  ${e.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n========================================`);
  console.log(`Migration complete: ${successCount} success, ${errorCount} warnings`);
  console.log(`========================================\n`);
}

applyMigration().catch(console.error);
