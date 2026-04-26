import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { usersRouter } from './users.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-users-route.sqlite');

let db: Knex;
let app: Express;

// Caller identity for the fake auth middleware — tests mutate this to switch
// between an admin caller, a TA caller, etc.
let currentCaller: User | null = null;

function setCaller(c: User | null): void {
  currentCaller = c;
}

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
  // Fake auth middleware — populates req.user from the test-controlled global.
  app.use((req, _res, next) => {
    if (currentCaller) req.user = currentCaller;
    next();
  });
  app.use(usersRouter);
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  await db('users').del();
  await db('users').insert([
    {
      id: 1,
      email: 'sahil@carepalmoney.com',
      name: 'Sahil',
      role: 'admin',
      domain: 'carepalmoney.com',
      city: null,
    },
    {
      id: 2,
      email: 'akhlaque@carepalmoney.com',
      name: 'Akhlaque',
      role: 'ta',
      domain: 'carepalmoney.com',
      city: null,
    },
    {
      id: 3,
      email: 'soundappan@carepalmoney.com',
      name: 'Soundappan',
      role: 'approver',
      domain: 'carepalmoney.com',
      city: null,
    },
  ]);
  currentCaller = null;
});

// Tiny supertest-equivalent — keeps deps light. Spins up the app on an
// ephemeral port for one request, returns { status, body }.
async function request(
  method: 'GET' | 'PATCH',
  path: string,
  body?: unknown,
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
        const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
          method,
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
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

describe('GET /api/users', () => {
  it('returns all users (open to any authenticated caller)', async () => {
    setCaller({
      id: 2,
      email: 'akhlaque@carepalmoney.com',
      name: 'Akhlaque',
      role: 'ta',
      city: null,
      domain: 'carepalmoney.com',
      last_login_at: null,
    });
    const res = await request('GET', '/api/users');
    assert.equal(res.status, 200);
    assert.equal((res.body as User[]).length, 3);
  });
});

describe('PATCH /api/users/:id/role', () => {
  const adminCaller: User = {
    id: 1,
    email: 'sahil@carepalmoney.com',
    name: 'Sahil',
    role: 'admin',
    city: null,
    domain: 'carepalmoney.com',
    last_login_at: null,
  };
  const taCaller: User = {
    id: 2,
    email: 'akhlaque@carepalmoney.com',
    name: 'Akhlaque',
    role: 'ta',
    city: null,
    domain: 'carepalmoney.com',
    last_login_at: null,
  };

  it('401 when no caller (not authenticated)', async () => {
    setCaller(null);
    const res = await request('PATCH', '/api/users/2/role', { role: 'approver' });
    assert.equal(res.status, 401);
  });

  it('403 when caller is TA (not admin)', async () => {
    setCaller(taCaller);
    const res = await request('PATCH', '/api/users/3/role', { role: 'admin' });
    assert.equal(res.status, 403);
  });

  it('400 when role value is bogus', async () => {
    setCaller(adminCaller);
    const res = await request('PATCH', '/api/users/2/role', { role: 'superuser' });
    assert.equal(res.status, 400);
  });

  it('400 when id is non-numeric', async () => {
    setCaller(adminCaller);
    const res = await request('PATCH', '/api/users/abc/role', { role: 'approver' });
    assert.equal(res.status, 400);
  });

  it('404 when user does not exist', async () => {
    setCaller(adminCaller);
    const res = await request('PATCH', '/api/users/999/role', { role: 'approver' });
    assert.equal(res.status, 404);
  });

  it('200 + persists role change when admin promotes a TA to approver', async () => {
    setCaller(adminCaller);
    const res = await request('PATCH', '/api/users/2/role', { role: 'approver' });
    assert.equal(res.status, 200);
    assert.equal((res.body as User).role, 'approver');

    const persisted = await db('users').where({ id: 2 }).first();
    assert.equal(persisted.role, 'approver');
  });

  it('200 when admin promotes another user to admin', async () => {
    setCaller(adminCaller);
    const res = await request('PATCH', '/api/users/3/role', { role: 'admin' });
    assert.equal(res.status, 200);
    assert.equal((res.body as User).role, 'admin');
  });

  it('200 when admin demotes themselves (allowed — caller may regret it)', async () => {
    // No self-demotion guard intentionally: an admin team can recover by having
    // another admin re-promote. This is documented behavior, not an oversight.
    setCaller(adminCaller);
    const res = await request('PATCH', '/api/users/1/role', { role: 'ta' });
    assert.equal(res.status, 200);
    assert.equal((res.body as User).role, 'ta');
  });
});
