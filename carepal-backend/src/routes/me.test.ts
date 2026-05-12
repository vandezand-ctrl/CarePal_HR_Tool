import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { meRouter } from './me.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-me-route.sqlite');

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
  app.use(meRouter);
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(() => {
  setCaller(adminCaller);
});

async function request(
  method: 'GET' | 'POST',
  url: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      if (typeof addr !== 'object' || !addr) {
        server.close();
        reject(new Error('no server address'));
        return;
      }
      try {
        const res = await fetch(`http://127.0.0.1:${addr.port}${url}`, { method });
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

describe('GET /api/me', () => {
  it('returns the authenticated user object', async () => {
    const r = await request('GET', '/api/me');
    assert.equal(r.status, 200);
    const body = r.body as User;
    assert.equal(body.id, adminCaller.id);
    assert.equal(body.email, adminCaller.email);
    assert.equal(body.role, adminCaller.role);
  });

  it('401 when no caller is authenticated', async () => {
    setCaller(null);
    const r = await request('GET', '/api/me');
    assert.equal(r.status, 401);
    assert.deepEqual(r.body, { error: 'Not authenticated' });
  });
});

describe('POST /api/me/inbox-seen', () => {
  beforeEach(async () => {
    setCaller(adminCaller);
    await db('users').del();
    await db('users').insert({
      id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', domain: 'x.com',
      city: null, created_at: new Date(), updated_at: new Date(),
    });
  });

  it('sets last_inbox_seen_at and returns 204', async () => {
    const r = await request('POST', '/api/me/inbox-seen');
    assert.equal(r.status, 204);
    const row = await db('users').where({ id: 1 }).first();
    assert.ok(row.last_inbox_seen_at, 'last_inbox_seen_at should be set');
  });

  it('401 when not authenticated', async () => {
    setCaller(null);
    const r = await request('POST', '/api/me/inbox-seen');
    assert.equal(r.status, 401);
  });
});

describe('POST /api/me/aop-seen', () => {
  beforeEach(async () => {
    setCaller(adminCaller);
    await db('users').del();
    await db('users').insert({
      id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', domain: 'x.com',
      city: null, created_at: new Date(), updated_at: new Date(),
    });
  });

  it('sets last_aop_seen_at and returns 204', async () => {
    const r = await request('POST', '/api/me/aop-seen');
    assert.equal(r.status, 204);
    const row = await db('users').where({ id: 1 }).first();
    assert.ok(row.last_aop_seen_at, 'last_aop_seen_at should be set');
  });

  it('401 when not authenticated', async () => {
    setCaller(null);
    const r = await request('POST', '/api/me/aop-seen');
    assert.equal(r.status, 401);
  });

  it('403 when TA tries to mark aop-seen (B-8 RBAC)', async () => {
    const taCaller: User = {
      id: 3, email: 'ta@x.com', name: 'TestTA', role: 'ta', city: null, domain: 'x.com', last_login_at: null, cities: [],
    };
    setCaller(taCaller);
    const r = await request('POST', '/api/me/aop-seen');
    assert.equal(r.status, 403);
  });

  it('403 when approver tries to mark aop-seen (B-8 RBAC)', async () => {
    const approverCaller: User = {
      id: 4, email: 'approver@x.com', name: 'TestApp', role: 'approver', city: null, domain: 'x.com', last_login_at: null, cities: [],
    };
    setCaller(approverCaller);
    const r = await request('POST', '/api/me/aop-seen');
    assert.equal(r.status, 403);
  });
});
