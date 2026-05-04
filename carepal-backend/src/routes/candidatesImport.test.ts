import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import * as XLSX from 'xlsx';
import { setDbForTesting, closeDb } from '../db/index.js';
import { candidatesImportRouter } from './candidatesImport.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-candidates-import-route.sqlite');

let db: Knex;
let app: Express;

let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

const adminCaller: User = {
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null,
};

before(async () => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });

  db = knex({
    client: 'better-sqlite3',
    connection: { filename: TEST_DB_PATH },
    useNullAsDefault: true,
  });
  await db.migrate.latest({ directory: path.resolve('./migrations'), extension: 'js' });
  setDbForTesting(db);

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (currentCaller) req.user = currentCaller;
    next();
  });
  app.use(candidatesImportRouter);
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  setCaller(adminCaller);

  await db('candidates').del();
  await db('requisitions').del();
  await db('users').del();

  // PR-L: candidate_assignments table needs the FK target users present.
  await db('candidate_assignments').del();
  await db('users').insert([
    { id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', domain: 'x.com', city: null },
    // Named TA so the "match by name" path of the import resolves correctly.
    { id: 2, email: 'n@x.com', name: 'Namita', role: 'ta', domain: 'x.com', city: null },
  ]);
  await db('requisitions').insert({
    id: 'REQ-100', city: 'Bangalore', hospital: 'T', area: null, bd_type: 'Focus',
    bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'S',
    date: '2026-04-26', status: 'Active', notes: null,
    created_at: new Date(), updated_at: new Date(),
  });
});

function sheetBuffer(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

interface ImportResult {
  dryRun: boolean;
  totalRows: number;
  validCount?: number;
  createdCount?: number;
  invalidCount: number;
  valid?: { rowIndex: number; input: Record<string, unknown> }[];
  invalid: { rowIndex: number; raw: Record<string, unknown>; errors: string[] }[];
  created?: { id: string; assignedTas: { id: number; name: string }[] }[];
}

async function postImport(
  buffer: Buffer | null,
  query = '',
  filename = 'candidates.xlsx',
): Promise<{ status: number; body: ImportResult | { error: string } }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      if (typeof addr !== 'object' || !addr) {
        server.close();
        reject(new Error('no server address'));
        return;
      }
      try {
        const fd = new FormData();
        if (buffer) {
          fd.append(
            'file',
            new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            filename,
          );
        }
        const res = await fetch(
          `http://127.0.0.1:${addr.port}/api/candidates/import${query}`,
          { method: 'POST', body: fd },
        );
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        resolve({ status: res.status, body: parsed });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

const validRow = (over: Record<string, unknown> = {}) => ({
  Name: 'Priya K', Phone: '9876543210', Email: 'priya@example.com',
  City: 'Bangalore', 'Current Role': 'BDA', Company: 'Acme',
  'Current CTC': 30000, 'Expected CTC': 40000, Notice: '30 Days',
  'Req ID': 'REQ-100', BU: 'CPM', TA: 'Namita', ...over,
});

describe('POST /api/candidates/import?dryRun=true', () => {
  it('returns dryRun preview with totals + buckets', async () => {
    const buf = sheetBuffer([validRow(), validRow({ Name: 'Other', Phone: '9000000001' })]);
    const r = await postImport(buf, '?dryRun=true');
    assert.equal(r.status, 200);
    const body = r.body as ImportResult;
    assert.equal(body.dryRun, true);
    assert.equal(body.totalRows, 2);
    assert.equal(body.validCount, 2);
    assert.equal(body.invalidCount, 0);
    assert.equal(body.valid?.length, 2);

    // Dry run does not insert.
    const inserted = await db('candidates').count<{ c: number }[]>({ c: '*' });
    assert.equal(Number(inserted[0].c), 0);
  });
});

describe('POST /api/candidates/import?dryRun=false', () => {
  it('inserts valid rows and createdCount matches DB', async () => {
    const buf = sheetBuffer([validRow(), validRow({ Name: 'Two', Phone: '9000000002' })]);
    const r = await postImport(buf, '?dryRun=false');
    assert.equal(r.status, 200);
    const body = r.body as ImportResult;
    assert.equal(body.dryRun, false);
    assert.equal(body.createdCount, 2);

    const rows = await db('candidates').select('*');
    assert.equal(rows.length, 2);
  });
});

describe('POST /api/candidates/import — error/edge cases', () => {
  it('400 when no file is attached', async () => {
    const r = await postImport(null);
    assert.equal(r.status, 400);
  });

  it('FK violation: row references unknown reqId → invalid bucket with reason', async () => {
    const buf = sheetBuffer([validRow({ 'Req ID': 'REQ-999' })]);
    const r = await postImport(buf, '?dryRun=true');
    assert.equal(r.status, 200);
    const body = r.body as ImportResult;
    assert.equal(body.validCount, 0);
    assert.equal(body.invalidCount, 1);
    assert.ok(
      body.invalid[0].errors.some((e) => e.includes('Requisition REQ-999 does not exist')),
      `expected FK reason, got: ${JSON.stringify(body.invalid[0].errors)}`,
    );
  });

  it('per-row schema failure (missing required column) goes to invalid bucket', async () => {
    // Drop Phone — required by importRowSchema.
    const bad = validRow();
    delete (bad as Record<string, unknown>).Phone;
    const buf = sheetBuffer([validRow(), bad]);
    const r = await postImport(buf, '?dryRun=true');
    assert.equal(r.status, 200);
    const body = r.body as ImportResult;
    assert.equal(body.validCount, 1);
    assert.equal(body.invalidCount, 1);
    assert.ok(body.invalid[0].errors.length > 0);
  });

  it('defaultTa: missing TA column falls back to the importing user (admin Sahil)', async () => {
    // PR-L: with no TA column, the import resolves to caller's user_id and
    // creates a candidate_assignments row pointing at them.
    const row = validRow();
    delete (row as Record<string, unknown>).TA;
    const buf = sheetBuffer([row]);
    const r = await postImport(buf, '?dryRun=false');
    assert.equal(r.status, 200);
    const body = r.body as ImportResult;
    assert.equal(body.createdCount, 1);

    const persisted = await db('candidates').first();
    const assignments = await db('candidate_assignments')
      .where({ candidate_id: persisted.id })
      .select('user_id');
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].user_id, adminCaller.id, 'assignment created for caller');
  });

  it('TA column with a known name resolves to that user (case-insensitive)', async () => {
    // PR-L: 'Namita' (TA in seed users above) should resolve to user_id 2.
    const buf = sheetBuffer([validRow({ TA: 'namita' })]); // lowercase intentional
    const r = await postImport(buf, '?dryRun=false');
    assert.equal(r.status, 200);

    const persisted = await db('candidates').first();
    const assignments = await db('candidate_assignments')
      .where({ candidate_id: persisted.id })
      .select('user_id');
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0].user_id, 2, 'assigned to Namita (id=2)');
  });
});
