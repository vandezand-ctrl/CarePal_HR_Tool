#!/usr/bin/env node
/**
 * One-off importer for "GTM - Hiring Tracker.xlsx" (CarePal's live ops sheet)
 * → headcount + requisitions tables.
 *
 * Reads two sheets:
 *   - Funnel  → city/BU AOP targets for the headcount table.
 *               Sheet has two sections separated by a literal "CF" label row;
 *               the first section is CPM, the second is IGIV (Crowdfunding).
 *   - CPM     → hospital-level rows for the CPM business unit. We only import
 *               rows tagged "New" or "Replacement"; "Existing" rows describe
 *               already-staffed hospitals (current state, not hiring need).
 *
 * Skipped intentionally:
 *   - "FOS Details for PJ Approval" (selected candidates) — too sparse for the
 *     candidates schema (no phone/email/CTC/notice/recruiter). Importing
 *     placeholders would actively make the demo worse.
 *   - All time-series / weekly-projection sheets — the tool doesn't store
 *     historical snapshots; current state is derived live.
 *
 * Three modes:
 *   --mode=print  (default) — print parsed rows to stdout; no DB writes
 *   --mode=local             — apply to local SQLite via knex
 *   --mode=sql --sql-out=…   — emit a MySQL bootstrap file (UPSERT shape) for
 *                              pasting into Cloud SQL Studio against prod
 *
 * Usage examples:
 *   node scripts/import_hiring_tracker.mjs --xlsx "/c/Users/.../GTM - Hiring Tracker.xlsx"
 *   node scripts/import_hiring_tracker.mjs --xlsx "…" --mode=local
 *   node scripts/import_hiring_tracker.mjs --xlsx "…" --mode=sql --sql-out=../personal/hiring-tracker.sql
 *
 * The xlsx file itself is NEVER committed (it contains real CarePal hiring
 * numbers). The default --sql-out path lives under /personal/ which is
 * gitignored at the repo root.
 */

import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

// --- CLI ----------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    xlsx: { type: 'string' },
    mode: { type: 'string', default: 'print' },
    'sql-out': { type: 'string' },
    'req-id-start': { type: 'string', default: '100' },
  },
});

if (!args.xlsx) {
  console.error('Missing --xlsx <path-to-hiring-tracker.xlsx>');
  process.exit(2);
}
if (!['print', 'local', 'sql'].includes(args.mode)) {
  console.error(`Invalid --mode=${args.mode}. Expected print|local|sql.`);
  process.exit(2);
}
if (args.mode === 'sql' && !args['sql-out']) {
  console.error('Missing --sql-out <path> (required when --mode=sql).');
  process.exit(2);
}

const REQ_ID_START = parseInt(args['req-id-start'], 10);
if (!Number.isInteger(REQ_ID_START) || REQ_ID_START < 1) {
  console.error('--req-id-start must be a positive integer.');
  process.exit(2);
}

// --- Parse Funnel sheet -> headcount -----------------------------------------

/**
 * The Funnel sheet has two stacked sections. Each starts with a header row
 * `["City", "AOP", "Current HC", ...]`, then an "Overall HC" total row, then
 * city rows, then a separator. The two sections are separated by a literal
 * "CF" label cell.
 *
 * Returns [{ city, bu, aop }] in source order.
 */
function parseHeadcount(wb) {
  const ws = wb.Sheets['Funnel'];
  if (!ws) throw new Error('Funnel sheet not found in workbook');
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const out = [];
  let bu = 'CPM'; // first section is CPM (Lending)
  let inSection = false;

  for (const row of data) {
    const first = String(row[0] || '').trim();
    if (!first) {
      inSection = false;
      continue;
    }

    // Section break: literal "CF" cell switches us to IGIV before the next header.
    if (first === 'CF') {
      bu = 'IGIV';
      inSection = false;
      continue;
    }

    // Header row resets the section flag.
    if (first === 'City') {
      inSection = true;
      continue;
    }

    if (!inSection) continue;
    if (first === 'Overall HC') continue; // total row, derived

    const aop = Number(row[1]);
    if (!Number.isFinite(aop) || aop <= 0) continue; // skip rows with no AOP

    // Normalise a couple of city spellings to match what's already in the seed.
    let city = first;
    if (city === 'Mysore') city = 'Mysore'; // keep
    if (city === 'Kolkatta') city = 'Kolkata';

    out.push({ city, bu, aop });
  }
  return out;
}

// Per-city raised_by fallbacks for cities where the source has a "City Lead"
// header without a name in parens. These match the documented City Leads in
// docs/PROJECT_OVERVIEW.md so the demo audience recognises the names.
const CITY_LEAD_FALLBACKS = {
  Hyderabad: 'Khazim Syed',
  Delhi: 'Mahesh Anand',
};

// --- Parse CPM sheet -> requisitions -----------------------------------------

/**
 * CPM sheet structure: blocks of rows per city, each block led by a "City Lead
 * (Name)" pseudo-header that gives us the real raised_by name, then hospital
 * rows, then a "City Total" row. Some city headers have no name; we fall back
 * to a generic placeholder there.
 *
 * One inconsistency in the source: row 68 says "Mumbai" / "City Lead (Sushant)"
 * but the rows that follow are Pune hospitals. We treat that header as Pune's
 * city-lead row.
 *
 * We import only rows where New/Existing/Replacement is "New" or "Replacement"
 * — "Existing" describes already-staffed hospitals, not hiring needs. Default
 * status is "Active" when Approved=Yes; "Pending Approval" otherwise.
 */
function parseRequisitions(wb, idStart) {
  const ws = wb.Sheets['CPM'];
  if (!ws) throw new Error('CPM sheet not found in workbook');
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const out = [];
  let currentCity = null;
  let currentLead = null;
  let nextId = idStart;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const c0 = String(row[0] || '').trim();
    const c1 = String(row[1] || '').trim();
    const c5 = String(row[5] || '').trim(); // New / Existing / Replacement
    const c6 = String(row[6] || '').trim(); // Approved/Not (Yes / No / blank)

    if (!c0) continue;

    // City Total row — skip and reset the city context.
    if (/Total$/i.test(c0)) {
      currentCity = null;
      currentLead = null;
      continue;
    }

    // Header row — skip.
    if (c0 === 'City') continue;

    // City Lead pseudo-header (e.g. "Chennai" + "City Lead ( Aman Kumar)")
    if (c1.toLowerCase().startsWith('city lead')) {
      // Special case: the Pune block is preceded by a misclassified "Mumbai"
      // city-lead row (Sushant). The next non-header data row is Pune.
      const peek = data[i + 1];
      const peekCity = peek ? String(peek[0] || '').trim() : '';
      if (c0 === 'Mumbai' && peekCity === 'Pune') {
        currentCity = 'Pune';
      } else if (c0 === 'Ahemdabad') {
        currentCity = 'Ahmedabad'; // normalise typo in source
      } else {
        currentCity = c0;
      }
      const m = c1.match(/City Lead\s*\(\s*(.+?)\s*\)/i);
      currentLead = m ? m[1].replace(/\s+/g, ' ').trim() : null;
      continue;
    }

    // Hospital row — must have a city in scope, a hospital name, and a hire type
    if (!currentCity) continue;
    if (!c1) continue;

    const hireTypeRaw = c5;
    if (hireTypeRaw === 'Existing') continue; // current state, not hiring need
    if (hireTypeRaw !== 'New' && hireTypeRaw !== 'Replacement') continue;

    const status = c6 === 'Yes' ? 'Active' : 'Pending Approval';
    const id = `REQ-${String(nextId).padStart(3, '0')}`;
    nextId++;

    out.push({
      id,
      city: currentCity,
      hospital: c1,
      area: null,
      bd_type: 'Focus', // each row is a single hospital → Focus
      bu: 'CPM',
      hire_type: hireTypeRaw,
      replacement_for: hireTypeRaw === 'Replacement' ? 'TBD (per hiring tracker import)' : null,
      raised_by: currentLead || CITY_LEAD_FALLBACKS[currentCity] || 'Sahil Lakshmanan',
      date: '2026-04-28', // import date — source doesn't carry per-row dates
      status,
      notes: null,
    });
  }

  return out;
}

// --- Output ------------------------------------------------------------------

function printSummary(headcount, reqs) {
  console.log('=== Headcount (' + headcount.length + ' rows) ===');
  for (const h of headcount) {
    console.log(`  ${h.city.padEnd(12)} ${h.bu.padEnd(5)}  AOP=${h.aop}`);
  }
  console.log();
  console.log('=== Requisitions (' + reqs.length + ' rows) ===');
  // Group for readability
  const byCity = new Map();
  for (const r of reqs) {
    if (!byCity.has(r.city)) byCity.set(r.city, []);
    byCity.get(r.city).push(r);
  }
  for (const [city, rs] of byCity) {
    console.log(`  ${city} (${rs.length}):`);
    for (const r of rs) {
      console.log(`    ${r.id}  ${r.hire_type.padEnd(11)} ${r.status.padEnd(16)}  ${r.hospital}  (raised_by: ${r.raised_by})`);
    }
  }
}

function escapeSqlString(s) {
  if (s === null || s === undefined) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

function emitMysqlBootstrap(headcount, reqs) {
  const lines = [];
  lines.push('-- Bootstrap from GTM - Hiring Tracker.xlsx');
  lines.push('-- Generated by carepal-backend/scripts/import_hiring_tracker.mjs');
  lines.push('-- Safe to re-run: headcount uses ON DUPLICATE KEY UPDATE on (city, bu),');
  lines.push('-- requisitions uses INSERT IGNORE keyed on the REQ-XXX primary key.');
  lines.push('-- Apply against prod via Cloud SQL Studio.');
  lines.push('');
  lines.push('-- ============================================================');
  lines.push('-- Headcount AOP targets (' + headcount.length + ' rows)');
  lines.push('-- ============================================================');
  for (const h of headcount) {
    lines.push(
      `INSERT INTO headcount (city, bu, aop) VALUES (${escapeSqlString(h.city)}, ${escapeSqlString(h.bu)}, ${h.aop}) ` +
      `ON DUPLICATE KEY UPDATE aop = VALUES(aop), updated_at = CURRENT_TIMESTAMP;`,
    );
  }
  lines.push('');
  lines.push('-- ============================================================');
  lines.push('-- Requisitions (' + reqs.length + ' rows)');
  lines.push('-- ============================================================');
  for (const r of reqs) {
    lines.push(
      `INSERT IGNORE INTO requisitions ` +
      `(id, city, hospital, area, bd_type, bu, hire_type, replacement_for, raised_by, date, status, notes) ` +
      `VALUES (` +
      [
        escapeSqlString(r.id),
        escapeSqlString(r.city),
        escapeSqlString(r.hospital),
        escapeSqlString(r.area),
        escapeSqlString(r.bd_type),
        escapeSqlString(r.bu),
        escapeSqlString(r.hire_type),
        escapeSqlString(r.replacement_for),
        escapeSqlString(r.raised_by),
        escapeSqlString(r.date),
        escapeSqlString(r.status),
        escapeSqlString(r.notes),
      ].join(', ') +
      ');',
    );
  }
  lines.push('');
  return lines.join('\n');
}

async function applyToLocalSqlite(headcount, reqs) {
  // Lazy-import knex so the script still works in --print/--sql mode without a DB.
  const knexPkg = (await import('knex')).default;
  const { default: cfg } = await import('../knexfile.js');
  const knex = knexPkg(cfg);

  try {
    // Headcount: upsert on (city, bu)
    for (const h of headcount) {
      await knex('headcount')
        .insert({ city: h.city, bu: h.bu, aop: h.aop })
        .onConflict(['city', 'bu'])
        .merge({ aop: h.aop, updated_at: new Date() });
    }

    // Requisitions: insert-or-ignore on the primary key
    for (const r of reqs) {
      const exists = await knex('requisitions').where({ id: r.id }).first();
      if (exists) continue;
      await knex('requisitions').insert(r);
    }

    const headRows = await knex('headcount').count({ n: '*' }).first();
    const reqRows = await knex('requisitions').count({ n: '*' }).first();
    console.log(`Local DB now has ${headRows.n} headcount rows and ${reqRows.n} requisitions.`);
  } finally {
    await knex.destroy();
  }
}

// --- Main --------------------------------------------------------------------

const xlsxPath = path.resolve(args.xlsx);
if (!fs.existsSync(xlsxPath)) {
  console.error(`xlsx file not found: ${xlsxPath}`);
  process.exit(2);
}

const wb = XLSX.readFile(xlsxPath);
const headcount = parseHeadcount(wb);
const reqs = parseRequisitions(wb, REQ_ID_START);

if (args.mode === 'print') {
  printSummary(headcount, reqs);
} else if (args.mode === 'sql') {
  const sql = emitMysqlBootstrap(headcount, reqs);
  const outPath = path.resolve(args['sql-out']);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, sql, 'utf8');
  console.log(`Wrote ${headcount.length} headcount + ${reqs.length} requisitions to ${outPath}`);
} else if (args.mode === 'local') {
  await applyToLocalSqlite(headcount, reqs);
  console.log(`Applied ${headcount.length} headcount + ${reqs.length} requisitions to local SQLite.`);
}
