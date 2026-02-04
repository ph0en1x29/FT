import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function fixAuditLogRLS() {
  console.log('Fixing job_audit_log RLS policy...');
  
  // Use rpc to execute SQL (need to create a helper function first, or use direct query)
  // Since we can't execute raw SQL directly, let's try using the admin API
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      DROP POLICY IF EXISTS "job_audit_log_insert_authenticated" ON public.job_audit_log;
      CREATE POLICY "job_audit_log_insert_all" ON public.job_audit_log FOR INSERT WITH CHECK (true);
    `
  });
  
  if (error) {
    console.error('Error:', error.message);
    console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
    console.log(`
DROP POLICY IF EXISTS "job_audit_log_insert_authenticated" ON public.job_audit_log;
CREATE POLICY "job_audit_log_insert_all" ON public.job_audit_log FOR INSERT WITH CHECK (true);
    `);
    process.exit(1);
  }
  
  console.log('Success!', data);
}

fixAuditLogRLS();
