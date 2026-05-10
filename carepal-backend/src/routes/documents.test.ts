import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { documentsRouter } from './documents.js';
import { uploadDocument, type Document } from '../models/document.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-documents-route.sqlite');
// storage.ts resolves under process.cwd()/uploads — track so after() can clean.
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

let db: Knex;
let app: Express;

let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

const adminCaller: User = {
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null, cities: [],
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
  app.use(documentsRouter);
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  // Storage writes real files; nuke the candidate dirs we created.
  for (const cid of ['C-001', 'C-002']) {
    const dir = path.join(UPLOAD_ROOT, cid);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  setCaller(adminCaller);

  await db('documents').del();
  await db('candidate_assignments').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('users').del();

  await db('users').insert([
    { id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', domain: 'x.com', city: null },
    { id: 2, email: 'a@x.com', name: 'Akhlaque', role: 'ta', domain: 'x.com', city: null },
  ]);
  await db('requisitions').insert({
    id: 'REQ-100', city: 'Bangalore', hospital: 'T', area: null, bd_type: 'Focus',
    bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'S',
    date: '2026-04-26', status: 'Active', notes: null,
    created_at: new Date(), updated_at: new Date(),
  });
  await db('candidates').insert([
    {
      id: 'C-001', req_id: 'REQ-100', name: 'A', phone: '9876543210', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Sourced', bu: 'CPM',
    },
    {
      id: 'C-002', req_id: 'REQ-100', name: 'B', phone: '9876543211', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Sourced', bu: 'CPM',
    },
  ]);
  // PR-L: candidates need >=1 assignment.
  await db('candidate_assignments').insert([
    { candidate_id: 'C-001', user_id: 2 },
    { candidate_id: 'C-002', user_id: 2 },
  ]);
});

interface MultipartField {
  name: string;
  value: string | { buffer: Buffer; filename: string; contentType: string };
}

async function request(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  opts?: { json?: unknown; multipart?: MultipartField[] },
): Promise<{ status: number; body: unknown; headers: Headers; rawBody: Buffer }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      if (typeof addr !== 'object' || !addr) {
        server.close();
        reject(new Error('no server address'));
        return;
      }
      try {
        let body: string | FormData | undefined;
        const headers: Record<string, string> = {};
        if (opts?.json !== undefined) {
          body = JSON.stringify(opts.json);
          headers['Content-Type'] = 'application/json';
        } else if (opts?.multipart) {
          const fd = new FormData();
          for (const f of opts.multipart) {
            if (typeof f.value === 'string') {
              fd.append(f.name, f.value);
            } else {
              fd.append(
                f.name,
                new Blob([f.value.buffer], { type: f.value.contentType }),
                f.value.filename,
              );
            }
          }
          body = fd;
        }
        const res = await fetch(`http://127.0.0.1:${addr.port}${url}`, { method, headers, body });
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get('content-type') || '';
        const parsed = ct.includes('application/json') && buf.length
          ? JSON.parse(buf.toString('utf8'))
          : (buf.length && ct.startsWith('text/') ? buf.toString('utf8') : null);
        resolve({ status: res.status, body: parsed, headers: res.headers, rawBody: buf });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

describe('GET /api/candidates/:id/documents', () => {
  it('returns empty list for a candidate with no docs', async () => {
    const r = await request('GET', '/api/candidates/C-001/documents');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, []);
  });

  it('returns populated list after upload', async () => {
    await uploadDocument({
      candidateId: 'C-001', docType: 'Resume', filename: 'r.pdf',
      mimeType: 'application/pdf', buffer: Buffer.from('hello'), uploadedByUserId: 1,
    });
    const r = await request('GET', '/api/candidates/C-001/documents');
    assert.equal(r.status, 200);
    assert.equal((r.body as Document[]).length, 1);
    assert.equal((r.body as Document[])[0].docType, 'Resume');
  });
});

describe('POST /api/candidates/:id/documents', () => {
  const fileField = (content = 'pdf-bytes', name = 'resume.pdf', type = 'application/pdf') => ({
    name: 'file', value: { buffer: Buffer.from(content), filename: name, contentType: type },
  });

  it('201 happy path — creates document row', async () => {
    const r = await request('POST', '/api/candidates/C-001/documents', {
      multipart: [fileField(), { name: 'docType', value: 'Resume' }],
    });
    assert.equal(r.status, 201);
    const doc = r.body as Document;
    assert.equal(doc.candidateId, 'C-001');
    assert.equal(doc.docType, 'Resume');
    assert.equal(doc.filename, 'resume.pdf');

    const rows = await db('documents').where({ candidate_id: 'C-001' });
    assert.equal(rows.length, 1);
  });

  it('400 when no file is attached', async () => {
    const r = await request('POST', '/api/candidates/C-001/documents', {
      multipart: [{ name: 'docType', value: 'Resume' }],
    });
    assert.equal(r.status, 400);
  });

  it('400 when docType is not in DOC_TYPES enum', async () => {
    const r = await request('POST', '/api/candidates/C-001/documents', {
      multipart: [fileField(), { name: 'docType', value: 'Invoice' }],
    });
    assert.equal(r.status, 400);
  });

  it('401 when no caller is authenticated', async () => {
    setCaller(null);
    const r = await request('POST', '/api/candidates/C-001/documents', {
      multipart: [fileField(), { name: 'docType', value: 'Resume' }],
    });
    assert.equal(r.status, 401);
  });

  it('404 when candidate does not exist', async () => {
    const r = await request('POST', '/api/candidates/C-999/documents', {
      multipart: [fileField(), { name: 'docType', value: 'Resume' }],
    });
    assert.equal(r.status, 404);
  });

  it('upsert: re-uploading same docType for same candidate replaces previous', async () => {
    const r1 = await request('POST', '/api/candidates/C-001/documents', {
      multipart: [fileField('v1', 'r1.pdf'), { name: 'docType', value: 'Resume' }],
    });
    assert.equal(r1.status, 201);
    const r2 = await request('POST', '/api/candidates/C-001/documents', {
      multipart: [fileField('v2-longer', 'r2.pdf'), { name: 'docType', value: 'Resume' }],
    });
    assert.equal(r2.status, 201);
    assert.equal((r2.body as Document).id, (r1.body as Document).id, 'same row id (upsert)');

    const rows = await db('documents').where({ candidate_id: 'C-001', doc_type: 'Resume' });
    assert.equal(rows.length, 1, 'still only one row for this docType');
    assert.equal(rows[0].filename, 'r2.pdf');
    assert.equal(rows[0].size_bytes, Buffer.from('v2-longer').length);
  });
});

describe('GET /api/documents/:id/download', () => {
  it('happy: returns bytes with correct Content-Type and Content-Disposition', async () => {
    const doc = await uploadDocument({
      candidateId: 'C-001', docType: 'Resume', filename: 'cv.pdf',
      mimeType: 'application/pdf', buffer: Buffer.from('binary-blob-here'), uploadedByUserId: 1,
    });
    const r = await request('GET', `/api/documents/${doc.id}/download`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    const cd = r.headers.get('content-disposition') || '';
    assert.ok(cd.includes('attachment'), 'attachment disposition');
    assert.ok(cd.includes('cv.pdf'), 'filename in disposition');
    assert.equal(r.rawBody.toString('utf8'), 'binary-blob-here');
  });

  it('404 when document id does not exist', async () => {
    const r = await request('GET', '/api/documents/9999/download');
    assert.equal(r.status, 404);
  });
});

describe('DELETE /api/documents/:id', () => {
  it('204 happy path — row is gone from DB', async () => {
    const doc = await uploadDocument({
      candidateId: 'C-001', docType: 'Resume', filename: 'r.pdf',
      mimeType: 'application/pdf', buffer: Buffer.from('x'), uploadedByUserId: 1,
    });
    const r = await request('DELETE', `/api/documents/${doc.id}`);
    assert.equal(r.status, 204);
    const row = await db('documents').where({ id: doc.id }).first();
    assert.equal(row, undefined);
  });

  it('404 when document does not exist', async () => {
    const r = await request('DELETE', '/api/documents/9999');
    assert.equal(r.status, 404);
  });
});
