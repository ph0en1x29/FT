#!/usr/bin/env node
/**
 * archive-old-photos.mjs
 *
 * Compresses photos on completed jobs older than 30 days to reclaim Supabase
 * Storage space.  Photos are recompressed to 1024px max / 40% JPEG quality
 * (~90% size reduction) and re-uploaded in place.
 *
 * Prerequisites:
 *   npm install sharp          # one-time install (not a project dep)
 *
 * Usage:
 *   node scripts/archive-old-photos.mjs                # run for real
 *   node scripts/archive-old-photos.mjs --dry-run      # preview only
 *   node scripts/archive-old-photos.mjs --limit 50     # process at most 50
 *
 * Environment (reads .env.local automatically):
 *   VITE_SUPABASE_URL          — Supabase project URL
 *   VITE_SUPABASE_ANON_KEY     — anon key (reads public bucket)
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (required for overwrites)
 *   DATABASE_URL               — pooler connection string for DB queries
 *                                 (falls back to hardcoded pooler if missing)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// 1. Load .env.local
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
try {
  const envText = readFileSync(envPath, 'utf-8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* .env.local optional */ }

// ---------------------------------------------------------------------------
// 2. Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const BATCH_LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) || 100 : 100;
const ARCHIVE_DAYS = 30;
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 40; // percent

// ---------------------------------------------------------------------------
// 3. Connect to DB via pooler
// ---------------------------------------------------------------------------
const pg = (await import(resolve(__dirname, '..', 'node_modules/pg/lib/index.js'))).default;
const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres.dljiubrbatmrskrzaazt:tBHo9DvozGFigHVM@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

// ---------------------------------------------------------------------------
// 4. Load sharp (must be installed: npm install sharp)
// ---------------------------------------------------------------------------
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error(
    'ERROR: sharp is not installed.\n' +
    'Run: npm install sharp\n' +
    'Then re-run this script.'
  );
  await db.end();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 5. Supabase Storage client for re-upload
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('ERROR: VITE_SUPABASE_URL not set');
  await db.end();
  process.exit(1);
}
if (!SERVICE_ROLE_KEY && !DRY_RUN) {
  console.error(
    'ERROR: SUPABASE_SERVICE_ROLE_KEY not set (required for uploads).\n' +
    'Set it in .env.local or as an env var.  Use --dry-run to preview without uploading.'
  );
  await db.end();
  process.exit(1);
}

// Minimal fetch-based storage client (avoids importing the full Supabase SDK)
const storageUpload = async (bucket, path, buffer, contentType) => {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'PUT', // overwrite
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${text}`);
  }
};

// ---------------------------------------------------------------------------
// 6. Find archive candidates
// ---------------------------------------------------------------------------
console.log(`\n📦 Archive Old Photos — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
console.log(`   Threshold: completed > ${ARCHIVE_DAYS} days ago`);
console.log(`   Target: ${MAX_DIMENSION}px max, ${JPEG_QUALITY}% JPEG quality`);
console.log(`   Batch limit: ${BATCH_LIMIT}\n`);

const { rows: candidates } = await db.query(`
  SELECT jm.media_id, jm.url, jm.type, j.job_number
  FROM public.job_media jm
  JOIN public.jobs j ON j.job_id = jm.job_id
  WHERE jm.is_archived = false
    AND jm.type = 'photo'
    AND j.status IN ('Completed', 'Awaiting Finalization')
    AND j.completed_at < NOW() - INTERVAL '${ARCHIVE_DAYS} days'
  ORDER BY j.completed_at ASC
  LIMIT $1;
`, [BATCH_LIMIT]);

console.log(`Found ${candidates.length} candidate photo(s).\n`);

if (candidates.length === 0) {
  console.log('Nothing to archive. Done.');
  await db.end();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 7. Process each photo
// ---------------------------------------------------------------------------
let archived = 0;
let skipped = 0;
let errors = 0;

for (const row of candidates) {
  const { media_id, url, job_number } = row;
  const tag = `[${job_number} / ${media_id.slice(0, 8)}]`;

  try {
    // 7a. Download original
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`  ${tag} SKIP — download failed (${res.status})`);
      skipped++;
      continue;
    }
    const originalBuf = Buffer.from(await res.arrayBuffer());
    const originalSize = originalBuf.length;

    // 7b. Compress with sharp
    const compressed = await sharp(originalBuf)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    const newSize = compressed.length;
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

    console.log(
      `  ${tag} ${(originalSize / 1024).toFixed(0)} KB → ${(newSize / 1024).toFixed(0)} KB (${savings}% saved)`
    );

    if (DRY_RUN) {
      archived++;
      continue;
    }

    // 7c. Re-upload (overwrite) via storage API
    // Extract the storage path from the public URL:
    //   https://<ref>.supabase.co/storage/v1/object/public/job-photos/<path>
    const pathMatch = url.match(/\/job-photos\/(.+)$/);
    if (!pathMatch) {
      console.log(`  ${tag} SKIP — cannot parse storage path from URL`);
      skipped++;
      continue;
    }
    const storagePath = decodeURIComponent(pathMatch[1]);

    await storageUpload('job-photos', storagePath, compressed, 'image/jpeg');

    // 7d. Mark as archived in DB
    await db.query(
      `UPDATE public.job_media SET is_archived = true WHERE media_id = $1;`,
      [media_id]
    );

    archived++;
  } catch (err) {
    console.error(`  ${tag} ERROR: ${err.message}`);
    errors++;
  }
}

// ---------------------------------------------------------------------------
// 8. Summary
// ---------------------------------------------------------------------------
console.log(`\n✅ Done.  Archived: ${archived}  Skipped: ${skipped}  Errors: ${errors}`);
if (DRY_RUN) console.log('   (dry run — no files were changed)');

await db.end();
