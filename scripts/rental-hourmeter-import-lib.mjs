const INCLUDED_ITEM_GROUPS = new Set(['R-FB', 'R-FD', 'R-FLPG']);
const EXCLUDED_ITEM_GROUPS = new Set(['R-HPT', 'R-EQUIP']);

const ITEM_GROUP_TO_TYPE = {
  'R-FB': 'Battery/Electrical',
  'R-FD': 'Diesel',
  'R-FLPG': 'LPG',
};

const HOURMETER_SHEET_TO_TYPE = {
  DIESEL: 'Diesel',
  LPG: 'LPG',
};

const HIGH_CONFIDENCE_MAKE_RULES = [
  { pattern: /^(5FD|6FBR|7FB|7FBE|7FBR|7FBRS|7FD|7FG|8FB|8FBE|8FBN|8FBR|8FD|8FDJ|8FDN|8FG|FDZN|FD50T9)/, make: 'Toyota' },
];

export function parseCsvText(text) {
  const normalizedText = String(text ?? '').replace(/^\ufeff/, '');
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const next = normalizedText[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(value);
      value = '';
      if (row.length > 1 || row[0] !== '') {
        rows.push(row);
      }
      row = [];
      continue;
    }

    value += char;
  }

  if (value !== '' || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

export function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAlias(value) {
  return normalizeWhitespace(value)
    .toUpperCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLooseAlias(value) {
  return normalizeAlias(value)
    .replace(/\s*\[[^\]]+\]\s*/g, ' ')
    .replace(/\(\s*M\s*\)/g, ' ')
    .replace(/\bSDN\b/g, ' ')
    .replace(/\bBHD\b/g, ' ')
    .replace(/\bBERHAD\b/g, ' ')
    .replace(/\bMALAYSIA\b/g, ' ')
    .replace(/\bCORP\b/g, ' ')
    .replace(/\bCORPORATION\b/g, ' ')
    .replace(/\bRESOUCES\b/g, ' RESOURCES ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSiteAlias(value) {
  return normalizeAlias(value)
    .replace(/\bSEK\b/g, 'SEC')
    .replace(/\bSEC\.\b/g, 'SEC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSerialNumber(value) {
  return normalizeAlias(value).replace(/\s+/g, '');
}

export function normalizeAieNumber(value) {
  return normalizeAlias(value).replace(/\s+/g, '');
}

export function parseInteger(value) {
  const normalized = normalizeWhitespace(value).replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDecimal(value) {
  const normalized = normalizeWhitespace(value).replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDateOnly(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function extractSerialAndAie(rawValue) {
  const raw = normalizeWhitespace(rawValue);
  if (!raw) {
    return {
      itemCodeRaw: '',
      serialNumber: '',
      normalizedSerialNumber: '',
      aieNumber: '',
      normalizedAieNumber: '',
    };
  }

  const match = raw.match(/^(.*?)\s*\((A[^)]+)\)\s*$/i);
  const serialNumber = match ? normalizeWhitespace(match[1]) : raw;
  const aieNumber = match ? normalizeWhitespace(match[2]) : '';

  return {
    itemCodeRaw: raw,
    serialNumber,
    normalizedSerialNumber: normalizeSerialNumber(serialNumber),
    aieNumber,
    normalizedAieNumber: normalizeAieNumber(aieNumber),
  };
}

export function inferForkliftTypeFromItemGroup(itemGroup) {
  return ITEM_GROUP_TO_TYPE[normalizeWhitespace(itemGroup)] || null;
}

export function inferForkliftTypeFromHourmeterSheet(sheetName) {
  return HOURMETER_SHEET_TO_TYPE[normalizeAlias(sheetName)] || null;
}

export function inferMakeFromSerialNumber(serialNumber) {
  const normalized = normalizeSerialNumber(serialNumber);
  const matchedRule = HIGH_CONFIDENCE_MAKE_RULES.find((rule) => rule.pattern.test(normalized));
  return matchedRule?.make || 'Others';
}

export function inferModelFromSerialNumber(serialNumber) {
  const normalized = normalizeWhitespace(serialNumber);
  if (!normalized) return '';
  const [prefix] = normalized.split('-');
  return prefix || normalized;
}

export function parseRentalCsvText(text) {
  const rows = parseCsvText(text);
  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((header) => normalizeWhitespace(header));

  return dataRows
    .map((row, index) => {
      const record = Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex] ?? '']));
      const itemGroup = normalizeWhitespace(record['Item Group']);
      const serialNumber = normalizeWhitespace(record['Item Code']);
      const aieNumber = normalizeWhitespace(record['F/L NO[AIE]']);

      return {
        rowNumber: index + 2,
        includeInV1: INCLUDED_ITEM_GROUPS.has(itemGroup),
        excludedReason: EXCLUDED_ITEM_GROUPS.has(itemGroup) ? 'excluded_item_group' : null,
        itemGroup,
        customerName: normalizeWhitespace(record.LOCATION1),
        customerDepartment: normalizeWhitespace(record["CUSTOMER'S DEPT"]),
        siteName: normalizeWhitespace(record.SITE),
        serialNumber,
        normalizedSerialNumber: normalizeSerialNumber(serialNumber),
        aieNumber,
        normalizedAieNumber: normalizeAieNumber(aieNumber),
        customerForkliftNumber: normalizeWhitespace(record['F/L NO.']),
        deliveryDate: parseDateOnly(record['DELIVERY DATE']),
        monthlyRentalRate: parseDecimal(record['MONTHLY RENTAL']),
        raw: record,
      };
    })
    .filter((record) => record.customerName || record.serialNumber || record.aieNumber);
}

function extractMonthPairs(headers, valueRow, dateRow, startIndex, endIndex) {
  const pairs = [];

  for (let index = startIndex; index < endIndex; index += 1) {
    const valueRaw = normalizeWhitespace(valueRow[index]);
    const dateRaw = parseDateOnly(dateRow[index]);
    if (!valueRaw && !dateRaw) continue;

    pairs.push({
      column: headers[index],
      valueRaw,
      value: parseInteger(valueRaw),
      date: dateRaw,
    });
  }

  return pairs;
}

export function selectLatestSnapshot(record) {
  const latestPair = [...record.latestPairs]
    .reverse()
    .find((pair) => pair.value !== null && pair.date);

  if (latestPair) {
    return {
      reading: latestPair.value,
      recordedAt: latestPair.date,
      sourceColumn: latestPair.column,
      sourceRow: 'latest',
    };
  }

  const currentPair = [...record.currentPairs]
    .reverse()
    .find((pair) => pair.value !== null && pair.date);

  if (currentPair) {
    return {
      reading: currentPair.value,
      recordedAt: currentPair.date,
      sourceColumn: currentPair.column,
      sourceRow: 'current',
    };
  }

  return null;
}

export function parseHourmeterSummaryCsvText(text) {
  const rows = parseCsvText(text);
  const [headers = [], ...dataRows] = rows;
  const customerIndex = headers.indexOf('CUSTOMER');
  const itemCodeIndex = headers.indexOf('Item code');
  const hourmeterIndex = headers.indexOf('hourmeter');
  const remainingDateIndex = headers.indexOf('REMAINING DATE');
  const startMonthIndex = hourmeterIndex + 1;
  const endMonthIndex = remainingDateIndex === -1 ? headers.length : remainingDateIndex;

  const records = [];
  const anomalies = [];

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    const customerName = normalizeWhitespace(row[customerIndex]);
    if (!customerName) continue;

    const currentDateRow = dataRows[index + 1];
    const latestValueRow = dataRows[index + 2];
    const latestDateRow = dataRows[index + 3];

    if (!currentDateRow || !latestValueRow || !latestDateRow) {
      anomalies.push({ rowNumber: index + 2, reason: 'truncated_hourmeter_block' });
      break;
    }

    const identity = extractSerialAndAie(row[itemCodeIndex]);
    const currentPairs = extractMonthPairs(headers, row, currentDateRow, startMonthIndex, endMonthIndex);
    const latestPairs = extractMonthPairs(headers, latestValueRow, latestDateRow, startMonthIndex, endMonthIndex);

    const record = {
      rowNumber: index + 2,
      sheetType: normalizeWhitespace(row[0]),
      customerName,
      siteName: normalizeWhitespace(row[headers.indexOf('Location')]),
      estServiceDate: parseDateOnly(row[headers.indexOf('Est service date')]),
      nextTargetHour: parseInteger(row[headers.indexOf('NEXT target hour')]),
      estDailyUsage: parseDecimal(row[headers.indexOf('est daily usage')]),
      fluctuation: parseDecimal(row[headers.indexOf('FLUCTUALTION')]),
      itemCodeRaw: identity.itemCodeRaw,
      serialNumber: identity.serialNumber,
      normalizedSerialNumber: identity.normalizedSerialNumber,
      aieNumber: identity.aieNumber,
      normalizedAieNumber: identity.normalizedAieNumber,
      currentPairs,
      latestPairs,
      rawBlock: [
        Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] ?? ''])),
        Object.fromEntries(headers.map((header, headerIndex) => [header, currentDateRow[headerIndex] ?? ''])),
        Object.fromEntries(headers.map((header, headerIndex) => [header, latestValueRow[headerIndex] ?? ''])),
        Object.fromEntries(headers.map((header, headerIndex) => [header, latestDateRow[headerIndex] ?? ''])),
      ],
    };

    records.push({
      ...record,
      latestSnapshot: selectLatestSnapshot(record),
    });

    index += 3;
  }

  return { records, anomalies };
}

function buildExactMap(records, keyFn) {
  const map = new Map();
  for (const record of records) {
    const key = keyFn(record);
    if (!key) continue;
    const existing = map.get(key) || [];
    existing.push(record);
    map.set(key, existing);
  }
  return map;
}

function resolveCustomerName(customerName, sourceSystem, existingState) {
  const normalizedAlias = normalizeAlias(customerName);
  if (!normalizedAlias) {
    return { customer: null, reason: 'blank_customer_name', suggestions: [] };
  }

  const aliasKey = `${sourceSystem}::${normalizedAlias}`;
  const aliasRecord = existingState.customerAliasesBySource.get(aliasKey);
  if (aliasRecord) {
    return { customer: existingState.customersById.get(aliasRecord.customer_id) || null, reason: null, suggestions: [] };
  }

  const exactMatches = existingState.customersByNormalizedName.get(normalizedAlias) || [];
  if (exactMatches.length === 1) {
    return { customer: exactMatches[0], reason: null, suggestions: [] };
  }

  const looseMatches = existingState.customersByLooseName.get(normalizeLooseAlias(customerName)) || [];
  return {
    customer: null,
    reason: exactMatches.length > 1 ? 'ambiguous_customer_name' : 'unresolved_customer_alias',
    suggestions: looseMatches.slice(0, 5).map((candidate) => ({
      customer_id: candidate.customer_id,
      name: candidate.name,
    })),
  };
}

function resolveSiteName(siteName, customerId, sourceSystem, existingState) {
  const normalizedAlias = normalizeSiteAlias(siteName);
  if (!normalizedAlias) {
    return { site: null, reason: null, suggestions: [] };
  }

  const aliasKey = `${sourceSystem}::${customerId}::${normalizedAlias}`;
  const aliasRecord = existingState.siteAliasesBySource.get(aliasKey);
  if (aliasRecord) {
    return { site: existingState.sitesById.get(aliasRecord.site_id) || null, reason: null, suggestions: [] };
  }

  const exactMatches = existingState.sitesByCustomerAndName.get(`${customerId}::${normalizedAlias}`) || [];
  if (exactMatches.length === 1) {
    return { site: exactMatches[0], reason: null, suggestions: [] };
  }

  return {
    site: null,
    reason: exactMatches.length > 1 ? 'ambiguous_site_name' : 'unresolved_site_alias',
    suggestions: (existingState.sitesByCustomerId.get(customerId) || []).slice(0, 5).map((candidate) => ({
      site_id: candidate.site_id,
      site_name: candidate.site_name,
      address: candidate.address || '',
    })),
  };
}

function getIdentityKey(serialNumber, aieNumber) {
  if (serialNumber) return `serial:${serialNumber}`;
  if (aieNumber) return `aie:${aieNumber}`;
  return '';
}

function buildExistingState({
  customers,
  customerSites,
  customerAliases,
  customerSiteAliases,
  forklifts,
  activeRentals,
}) {
  return {
    customersById: new Map(customers.map((customer) => [customer.customer_id, customer])),
    customersByNormalizedName: buildExactMap(customers, (customer) => normalizeAlias(customer.name)),
    customersByLooseName: buildExactMap(customers, (customer) => normalizeLooseAlias(customer.name)),
    customerAliasesBySource: new Map(
      customerAliases.map((alias) => [
        `${alias.source_system}::${normalizeAlias(alias.normalized_alias || alias.alias_name)}`,
        alias,
      ])
    ),
    sitesById: new Map(customerSites.map((site) => [site.site_id, site])),
    sitesByCustomerId: buildExactMap(customerSites, (site) => site.customer_id),
    sitesByCustomerAndName: buildExactMap(
      customerSites,
      (site) => `${site.customer_id}::${normalizeSiteAlias(site.site_name)}`
    ),
    siteAliasesBySource: new Map(
      customerSiteAliases.map((alias) => {
        const site = customerSites.find((customerSite) => customerSite.site_id === alias.site_id);
        return [
          `${alias.source_system}::${site?.customer_id || ''}::${normalizeSiteAlias(alias.normalized_alias || alias.alias_name)}`,
          alias,
        ];
      })
    ),
    forkliftsById: new Map(forklifts.map((forklift) => [forklift.forklift_id, forklift])),
    forkliftsBySerial: new Map(
      forklifts
        .filter((forklift) => normalizeSerialNumber(forklift.serial_number))
        .map((forklift) => [normalizeSerialNumber(forklift.serial_number), forklift])
    ),
    forkliftsByAie: new Map(
      forklifts
        .filter((forklift) => normalizeAieNumber(forklift.forklift_no))
        .map((forklift) => [normalizeAieNumber(forklift.forklift_no), forklift])
    ),
    activeRentalsByForkliftId: new Map(activeRentals.map((rental) => [rental.forklift_id, rental])),
  };
}

function mergeAssetSource(assetsByKey, sourceRecord, sourceType) {
  const identityKey = getIdentityKey(sourceRecord.normalizedSerialNumber, sourceRecord.normalizedAieNumber);
  if (!identityKey) {
    return null;
  }

  const existingAsset = assetsByKey.get(identityKey) || {
    assetKey: identityKey,
    identity: {
      serialNumber: sourceRecord.serialNumber,
      normalizedSerialNumber: sourceRecord.normalizedSerialNumber,
      aieNumber: sourceRecord.aieNumber,
      normalizedAieNumber: sourceRecord.normalizedAieNumber,
    },
    rentalSources: [],
    hourmeterSources: [],
  };

  existingAsset.identity.serialNumber ||= sourceRecord.serialNumber;
  existingAsset.identity.aieNumber ||= sourceRecord.aieNumber;
  existingAsset.identity.normalizedSerialNumber ||= sourceRecord.normalizedSerialNumber;
  existingAsset.identity.normalizedAieNumber ||= sourceRecord.normalizedAieNumber;

  if (sourceType === 'rental') {
    existingAsset.rentalSources.push(sourceRecord);
  } else {
    existingAsset.hourmeterSources.push(sourceRecord);
  }

  assetsByKey.set(identityKey, existingAsset);
  return existingAsset;
}

export function buildImportPreparationReport({
  rentalRecords,
  hourmeterRecords,
  existingState: rawExistingState,
  sourceSystems = { rental: 'rental_csv', hourmeter: 'hourmeter_csv' },
}) {
  const existingState = buildExistingState(rawExistingState);
  const includedRentalRecords = rentalRecords.filter((record) => record.includeInV1);
  const excludedRentalRecords = rentalRecords.filter((record) => !record.includeInV1);

  const assetsByKey = new Map();
  const missingIdentityAssets = [];

  for (const rentalRecord of includedRentalRecords) {
    const merged = mergeAssetSource(assetsByKey, rentalRecord, 'rental');
    if (!merged) {
      missingIdentityAssets.push({
        source: 'rental',
        rowNumber: rentalRecord.rowNumber,
        customerName: rentalRecord.customerName,
        serialNumber: rentalRecord.serialNumber,
        aieNumber: rentalRecord.aieNumber,
      });
    }
  }

  for (const hourmeterRecord of hourmeterRecords) {
    const merged = mergeAssetSource(assetsByKey, hourmeterRecord, 'hourmeter');
    if (!merged) {
      missingIdentityAssets.push({
        source: 'hourmeter',
        rowNumber: hourmeterRecord.rowNumber,
        customerName: hourmeterRecord.customerName,
        serialNumber: hourmeterRecord.serialNumber,
        aieNumber: hourmeterRecord.aieNumber,
      });
    }
  }

  const unresolvedCustomerAliases = [];
  const unresolvedSiteAliases = [];
  const classifiedAssets = [];

  for (const asset of assetsByKey.values()) {
    const reasons = [];
    const rentalSource = asset.rentalSources[0] || null;
    const hourmeterSource = asset.hourmeterSources[0] || null;

    if (asset.rentalSources.length > 1) {
      reasons.push('duplicate_rental_rows');
    }
    if (asset.hourmeterSources.length > 1) {
      reasons.push('duplicate_hourmeter_rows');
    }

    const existingBySerial = asset.identity.normalizedSerialNumber
      ? existingState.forkliftsBySerial.get(asset.identity.normalizedSerialNumber) || null
      : null;
    const existingByAie = asset.identity.normalizedAieNumber
      ? existingState.forkliftsByAie.get(asset.identity.normalizedAieNumber) || null
      : null;

    if (existingBySerial && existingByAie && existingBySerial.forklift_id !== existingByAie.forklift_id) {
      reasons.push('conflicting_existing_forklift_matches');
    }

    const existingForklift = existingBySerial || existingByAie || null;
    const existingRental = existingForklift
      ? existingState.activeRentalsByForkliftId.get(existingForklift.forklift_id) || null
      : null;

    let resolvedCustomer = null;
    let resolvedSite = null;
    let customerResolution = { reason: null, suggestions: [] };
    let siteResolution = { reason: null, suggestions: [] };

    if (rentalSource) {
      customerResolution = resolveCustomerName(rentalSource.customerName, sourceSystems.rental, existingState);
      resolvedCustomer = customerResolution.customer;

      if (!resolvedCustomer) {
        reasons.push(customerResolution.reason || 'unresolved_customer_alias');
        unresolvedCustomerAliases.push({
          assetKey: asset.assetKey,
          rowNumber: rentalSource.rowNumber,
          sourceName: rentalSource.customerName,
          suggestions: customerResolution.suggestions,
        });
      } else {
        siteResolution = resolveSiteName(rentalSource.siteName, resolvedCustomer.customer_id, sourceSystems.rental, existingState);
        resolvedSite = siteResolution.site;

        if (rentalSource.siteName && !resolvedSite && siteResolution.reason) {
          reasons.push(siteResolution.reason);
          unresolvedSiteAliases.push({
            assetKey: asset.assetKey,
            rowNumber: rentalSource.rowNumber,
            customerId: resolvedCustomer.customer_id,
            customerName: resolvedCustomer.name,
            sourceName: rentalSource.siteName,
            suggestions: siteResolution.suggestions,
          });
        }
      }
    }

    if (
      existingRental &&
      resolvedCustomer &&
      existingRental.customer_id &&
      existingRental.customer_id !== resolvedCustomer.customer_id
    ) {
      reasons.push('existing_active_rental_conflict');
    }

    if (
      hourmeterSource?.latestSnapshot &&
      existingForklift?.hourmeter != null &&
      hourmeterSource.latestSnapshot.reading < existingForklift.hourmeter
    ) {
      reasons.push('hourmeter_regression');
    }

    if (hourmeterSource && !hourmeterSource.latestSnapshot) {
      reasons.push('missing_latest_hourmeter_snapshot');
    }

    const action = reasons.length > 0
      ? 'manual-review'
      : existingForklift
        ? 'update'
        : 'create';

    classifiedAssets.push({
      assetKey: asset.assetKey,
      action,
      reasons,
      matchedForkliftId: existingForklift?.forklift_id || null,
      matchedBy: existingBySerial ? 'serial_number' : existingByAie ? 'forklift_no' : null,
      sourceSummary: {
        hasRentalSource: Boolean(rentalSource),
        hasHourmeterSource: Boolean(hourmeterSource),
      },
      sourceData: {
        rental: rentalSource
          ? {
              rowNumber: rentalSource.rowNumber,
              itemGroup: rentalSource.itemGroup,
              customerName: rentalSource.customerName,
              siteName: rentalSource.siteName,
              deliveryDate: rentalSource.deliveryDate,
              monthlyRentalRate: rentalSource.monthlyRentalRate,
              raw: rentalSource.raw,
            }
          : null,
        hourmeter: hourmeterSource
          ? {
              rowNumber: hourmeterSource.rowNumber,
              sheetType: hourmeterSource.sheetType,
              customerName: hourmeterSource.customerName,
              siteName: hourmeterSource.siteName,
              estServiceDate: hourmeterSource.estServiceDate,
              nextTargetHour: hourmeterSource.nextTargetHour,
              estDailyUsage: hourmeterSource.estDailyUsage,
              latestSnapshot: hourmeterSource.latestSnapshot,
              rawBlock: hourmeterSource.rawBlock,
            }
          : null,
      },
      proposedRecords: {
        forklift: {
          serial_number: asset.identity.serialNumber || null,
          forklift_no: asset.identity.aieNumber || null,
          customer_forklift_no: rentalSource?.customerForkliftNumber || null,
          type: rentalSource
            ? inferForkliftTypeFromItemGroup(rentalSource.itemGroup)
            : inferForkliftTypeFromHourmeterSheet(hourmeterSource?.sheetType || ''),
          make: inferMakeFromSerialNumber(asset.identity.serialNumber || ''),
          model: inferModelFromSerialNumber(asset.identity.serialNumber || ''),
          ownership: 'company',
          status: rentalSource ? 'Rented Out' : 'Available',
          delivery_date: rentalSource?.deliveryDate || null,
          source_item_group: rentalSource?.itemGroup || null,
          current_customer_id: rentalSource && resolvedCustomer ? resolvedCustomer.customer_id : null,
          current_site_id: rentalSource && resolvedSite ? resolvedSite.site_id : null,
          site: rentalSource?.siteName || null,
          hourmeter: hourmeterSource?.latestSnapshot?.reading ?? existingForklift?.hourmeter ?? 0,
          avg_daily_usage: hourmeterSource?.estDailyUsage ?? null,
          next_target_service_hour: hourmeterSource?.nextTargetHour ?? null,
          last_hourmeter_update: hourmeterSource?.latestSnapshot?.recordedAt ?? null,
        },
        rental: rentalSource
          ? {
              start_date: rentalSource.deliveryDate,
              customer_id: resolvedCustomer?.customer_id || null,
              site_id: resolvedSite?.site_id || null,
              site: rentalSource.siteName || null,
              monthly_rental_rate: rentalSource.monthlyRentalRate,
            }
          : null,
        hourmeterHistory: hourmeterSource?.latestSnapshot
          ? {
              reading: hourmeterSource.latestSnapshot.reading,
              recorded_at: hourmeterSource.latestSnapshot.recordedAt,
              source: 'import',
            }
          : null,
      },
    });
  }

  const classifiedCounts = classifiedAssets.reduce((counts, asset) => {
    counts[asset.action] = (counts[asset.action] || 0) + 1;
    return counts;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    sourceSystems,
    summary: {
      rentalRows: rentalRecords.length,
      rentalRowsIncluded: includedRentalRecords.length,
      rentalRowsExcluded: excludedRentalRecords.length,
      hourmeterRows: hourmeterRecords.length,
      assetsClassified: classifiedAssets.length,
      createCount: classifiedCounts.create || 0,
      updateCount: classifiedCounts.update || 0,
      manualReviewCount: classifiedCounts['manual-review'] || 0,
      unresolvedCustomerAliasCount: unresolvedCustomerAliases.length,
      unresolvedSiteAliasCount: unresolvedSiteAliases.length,
      missingIdentityCount: missingIdentityAssets.length,
    },
    excludedRentalRows: excludedRentalRecords.map((record) => ({
      rowNumber: record.rowNumber,
      itemGroup: record.itemGroup,
      serialNumber: record.serialNumber,
      aieNumber: record.aieNumber,
      customerName: record.customerName,
      reason: record.excludedReason || 'excluded_from_v1',
    })),
    reviewBuckets: {
      unresolvedCustomerAliases,
      unresolvedSiteAliases,
      missingIdentityAssets,
    },
    assets: classifiedAssets.sort((left, right) => left.assetKey.localeCompare(right.assetKey)),
  };
}

export {
  EXCLUDED_ITEM_GROUPS,
  INCLUDED_ITEM_GROUPS,
  ITEM_GROUP_TO_TYPE,
  HOURMETER_SHEET_TO_TYPE,
};
