#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  buildImportPreparationReport,
  parseHourmeterSummaryCsvText,
  parseRentalCsvText,
} from './rental-hourmeter-import-lib.mjs';

dotenv.config({ path: '.env.local' });

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) continue;
    const key = argument.slice(2);
    const value = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : 'true';
    options[key] = value;
    if (value !== 'true') {
      index += 1;
    }
  }
  return options;
}

async function readCsv(filePath) {
  return fs.readFile(filePath, 'utf8');
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials are required. Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY.');
  }

  return createClient(url, key);
}

async function authenticate(client, options) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const email = options.email || process.env.IMPORT_PREP_EMAIL;
  const password = options.password || process.env.IMPORT_PREP_PASSWORD;

  if (!email || !password) {
    throw new Error('Anon auth requires --email and --password (or IMPORT_PREP_EMAIL / IMPORT_PREP_PASSWORD).');
  }

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Supabase auth failed: ${error.message}`);
  }
}

async function fetchAll(client, queryFactory) {
  const pageSize = 1000;
  const records = [];

  for (let from = 0; ; from += pageSize) {
    const query = queryFactory().range(from, from + pageSize - 1);
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    records.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return records;
}

async function fetchOptional(client, queryFactory, fallback = []) {
  try {
    return await fetchAll(client, queryFactory);
  } catch (_error) {
    return fallback;
  }
}

async function loadExistingState(client) {
  const customers = await fetchAll(client, () =>
    client.from('customers').select('customer_id, name').order('name')
  );

  const customerSites = await fetchOptional(client, () =>
    client
      .from('customer_sites')
      .select('site_id, customer_id, site_name, address, is_active')
      .order('site_name')
  );

  const customerAliases = await fetchOptional(client, () =>
    client
      .from('customer_aliases')
      .select('alias_id, customer_id, source_system, alias_name, normalized_alias, is_active')
      .eq('is_active', true)
      .order('alias_name')
  );

  const customerSiteAliases = await fetchOptional(client, () =>
    client
      .from('customer_site_aliases')
      .select('alias_id, site_id, source_system, alias_name, normalized_alias, is_active')
      .eq('is_active', true)
      .order('alias_name')
  );

  let forklifts;
  try {
    forklifts = await fetchAll(client, () =>
      client
        .from('forklifts')
        .select('forklift_id, serial_number, forklift_no, hourmeter, current_customer_id, current_site_id')
        .order('serial_number')
    );
  } catch (_error) {
    forklifts = await fetchAll(client, () =>
      client
        .from('forklifts')
        .select('forklift_id, serial_number, forklift_no, hourmeter, current_customer_id')
        .order('serial_number')
    );
  }

  let activeRentals;
  try {
    activeRentals = await fetchAll(client, () =>
      client
        .from('forklift_rentals')
        .select('rental_id, forklift_id, customer_id, site_id, site, status')
        .eq('status', 'active')
        .order('start_date')
    );
  } catch (_error) {
    activeRentals = await fetchAll(client, () =>
      client
        .from('forklift_rentals')
        .select('rental_id, forklift_id, customer_id, site, status')
        .eq('status', 'active')
        .order('start_date')
    );
  }

  return {
    customers,
    customerSites,
    customerAliases,
    customerSiteAliases,
    forklifts,
    activeRentals,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rentalCsvPath = options['rental-csv'];
  const hourmeterCsvPath = options['hourmeter-csv'];

  if (!rentalCsvPath || !hourmeterCsvPath) {
    throw new Error('Usage: node scripts/rental-hourmeter-import-prep.mjs --rental-csv <path> --hourmeter-csv <path> [--output <path>] [--email <email> --password <password>]');
  }

  const outputPath = options.output || path.resolve('tmp', 'rental-hourmeter-import-prep-report.json');
  const client = getSupabaseClient();
  await authenticate(client, options);

  const [rentalText, hourmeterText, existingState] = await Promise.all([
    readCsv(rentalCsvPath),
    readCsv(hourmeterCsvPath),
    loadExistingState(client),
  ]);

  const rentalRecords = parseRentalCsvText(rentalText);
  const { records: hourmeterRecords, anomalies } = parseHourmeterSummaryCsvText(hourmeterText);
  const report = buildImportPreparationReport({
    rentalRecords,
    hourmeterRecords,
    existingState,
    sourceSystems: {
      rental: options['rental-source-system'] || 'rental_csv',
      hourmeter: options['hourmeter-source-system'] || 'hourmeter_csv',
    },
  });

  report.hourmeterAnomalies = anomalies;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    outputPath,
    summary: report.summary,
    reviewBuckets: {
      unresolvedCustomerAliases: report.reviewBuckets.unresolvedCustomerAliases.length,
      unresolvedSiteAliases: report.reviewBuckets.unresolvedSiteAliases.length,
      missingIdentityAssets: report.reviewBuckets.missingIdentityAssets.length,
      hourmeterAnomalies: anomalies.length,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
