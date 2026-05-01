#!/usr/bin/env node
/**
 * Bundle-size budget check.
 *
 * Runs after `vite build`. Reads dist/ for the brotli-compressed chunks and
 * fails the build if any chunk exceeds its budget. Adding this before the
 * size regresses keeps perf wins from quietly being eaten by future imports.
 *
 * Per-chunk budgets are intentionally close to today's compressed sizes so
 * a 20-30% regression trips the gate. Bumping is a deliberate decision.
 *
 * To add a new chunk, append { match: /pattern/, budgetBr: <bytes> }.
 * Anything not matched is checked against DEFAULT_BUDGET_BR.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = 'dist';
const KB = 1024;

// Brotli (.br) size budgets — what the browser actually downloads when the
// host serves Content-Encoding: br. Numbers are observed-size + ~25% headroom.
const DEFAULT_BUDGET_BR = 60 * KB;
const BUDGETS = [
  { match: /vendor-react-dom-/, budgetBr: 65 * KB },
  { match: /vendor-supabase-/, budgetBr: 65 * KB },
  { match: /vendor-router-/, budgetBr: 20 * KB },
  { match: /vendor-query-/, budgetBr: 15 * KB },
  { match: /vendor-toast-/, budgetBr: 15 * KB },
  { match: /vendor-icons-/, budgetBr: 15 * KB },
  { match: /vendor-zip-/, budgetBr: 35 * KB },
  { match: /marker-shadow-/, budgetBr: 60 * KB }, // Leaflet runtime
  { match: /index-.*\.js\.br$/, budgetBr: 50 * KB }, // page chunks
];

const TOTAL_BUDGET_BR = 800 * KB;

const findFiles = (dir, pattern) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findFiles(full, pattern));
    else if (pattern.test(entry.name)) out.push(full);
  }
  return out;
};

const formatKb = (bytes) => `${(bytes / KB).toFixed(2)}kb`;

const matchBudget = (filename) => {
  for (const b of BUDGETS) {
    if (b.match.test(filename)) return b.budgetBr;
  }
  return DEFAULT_BUDGET_BR;
};

let failed = false;
let totalBr = 0;
const violations = [];
const sizes = [];

const brFiles = findFiles(DIST_DIR, /\.js\.br$/);
if (brFiles.length === 0) {
  console.error('No .br files found under dist/ — run `vite build` first.');
  process.exit(1);
}

for (const file of brFiles) {
  const size = statSync(file).size;
  totalBr += size;
  const budget = matchBudget(file);
  const overBy = size - budget;
  sizes.push({ file, size, budget, overBy });
  if (overBy > 0) {
    failed = true;
    violations.push({ file, size, budget, overBy });
  }
}

sizes.sort((a, b) => b.size - a.size);
console.log('\nBundle-size check (brotli-compressed)\n');
console.log(`${'Chunk'.padEnd(72)}${'Size'.padStart(12)}${'Budget'.padStart(12)}${'Δ'.padStart(12)}`);
for (const s of sizes) {
  const file = s.file.replace(`${DIST_DIR}/`, '');
  const status = s.overBy > 0 ? `+${formatKb(s.overBy)}` : `-${formatKb(-s.overBy)}`;
  console.log(`${file.padEnd(72)}${formatKb(s.size).padStart(12)}${formatKb(s.budget).padStart(12)}${status.padStart(12)}`);
}

console.log(`\nTotal br across ${brFiles.length} chunks: ${formatKb(totalBr)}  (budget ${formatKb(TOTAL_BUDGET_BR)})`);
if (totalBr > TOTAL_BUDGET_BR) {
  failed = true;
  violations.push({ file: 'TOTAL', size: totalBr, budget: TOTAL_BUDGET_BR, overBy: totalBr - TOTAL_BUDGET_BR });
}

if (failed) {
  console.error('\nBundle-size budget exceeded:');
  for (const v of violations) {
    console.error(`  ${v.file}: ${formatKb(v.size)} (budget ${formatKb(v.budget)}, +${formatKb(v.overBy)})`);
  }
  console.error('\nFix: lazy-load heavier deps, split a chunk, or — if intentional — bump the budget in scripts/check-bundle-size.mjs.');
  process.exit(1);
}

console.log('\n✓ All chunks within budget.');
