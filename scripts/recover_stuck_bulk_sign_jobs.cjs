#!/usr/bin/env node
/**
 * Recovery for the 2026-05-07 bulk-sign stuck-state incident.
 *
 * Production has multiple jobs left at status='In Progress' with both
 * signatures already written (the previous bulk-sign modal wrote the sigs
 * but then the AWAITING_FINALIZATION transition rejected on the trigger,
 * leaving the half-state). This script:
 *
 *   1. Finds every In-Progress job with BOTH signatures present.
 *   2. Calls check_job_completion_readiness() to see which would pass the
 *      trigger right now.
 *   3. For passing ones: flips status to Awaiting Finalization. The trigger
 *      runs in postgres context (auth.uid()=NULL → no admin-bypass) so
 *      gates re-validate naturally.
 *   4. For blocked ones: prints the per-job blocker so ops can tell techs
 *      what to fix on the JobDetail page.
 *
 * Idempotent — running twice just no-ops on already-transitioned jobs.
 */
const { Client } = require('pg');

(async () => {
  const c = new Client({
    connectionString: `postgresql://postgres.dljiubrbatmrskrzaazt:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  await c.query('BEGIN');
  try {
    // 1. Snapshot
    const snap = await c.query(`
      SELECT j.job_id, j.job_number, j.job_type, j.assigned_technician_name, j.customer_id
        FROM jobs j
       WHERE j.status = 'In Progress'
         AND j.deleted_at IS NULL
         AND j.technician_signature IS NOT NULL
         AND j.customer_signature   IS NOT NULL
       ORDER BY j.created_at ASC
    `);
    console.log(`Found ${snap.rowCount} In-Progress jobs with both signatures.`);
    if (snap.rowCount === 0) {
      await c.query('COMMIT');
      return;
    }

    const ids = snap.rows.map((r) => r.job_id);

    // 2. Readiness via the new RPC (no JWT set → trigger admin-bypass not engaged)
    const ready = await c.query(
      `SELECT * FROM check_job_completion_readiness($1::uuid[])`,
      [ids]
    );
    const readinessByJob = new Map(ready.rows.map((r) => [r.job_id, r]));

    const wouldPass = [];
    const wouldBlock = [];
    for (const j of snap.rows) {
      const r = readinessByJob.get(j.job_id);
      if (r && r.can_complete) wouldPass.push(j);
      else wouldBlock.push({ ...j, blocker: r?.blocker ?? 'unknown' });
    }
    console.log(`Would pass:  ${wouldPass.length}`);
    console.log(`Still blocked: ${wouldBlock.length}`);

    // 3. Flip the passing ones. One-by-one so the trigger evaluates each
    //    independently and any unexpected rejection only affects that row.
    let flipped = 0;
    for (const j of wouldPass) {
      try {
        await c.query(
          `UPDATE jobs SET status = 'Awaiting Finalization' WHERE job_id = $1 AND status = 'In Progress'`,
          [j.job_id]
        );
        flipped++;
      } catch (e) {
        console.log(`  [SKIP] ${j.job_number}: ${e.message}`);
      }
    }
    console.log(`\nFlipped ${flipped} jobs to Awaiting Finalization.`);

    // 4. Report blocked ones — these need tech action on JobDetail
    if (wouldBlock.length > 0) {
      console.log('\nStill-blocked jobs (tech needs to fix on JobDetail page):');
      console.table(
        wouldBlock.map((j) => ({
          job_number: j.job_number,
          tech: j.assigned_technician_name,
          job_type: j.job_type,
          blocker: j.blocker.replace(/^Cannot complete job:\s*/, ''),
        }))
      );
    }

    // 5. Verify post-state
    const verify = await c.query(
      `SELECT status, COUNT(*) AS n FROM jobs WHERE job_id = ANY($1::uuid[]) GROUP BY status ORDER BY status`,
      [ids]
    );
    console.log('\nPost-recovery status breakdown:');
    console.table(verify.rows);

    if (process.argv.includes('--apply')) {
      await c.query('COMMIT');
      console.log('\n[COMMITTED]');
    } else {
      await c.query('ROLLBACK');
      console.log('\n[DRY-RUN] Re-run with --apply to commit.');
    }
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('FAIL:', e.message);
    process.exit(1);
  }
  await c.end();
})().catch((e) => {
  console.error('OUTER:', e.message);
  process.exit(1);
});
