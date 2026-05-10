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
  await db('user_cities').del();
  await db('users').del();
  await db('headcount').del();
  await db('requisitions').del();

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

  // Seed headcount + requisitions so listAllCities can find cities.
  await db('headcount').insert([
    { city: 'Bangalore', bu: 'CPM', aop: 10 },
    { city: 'Mumbai', bu: 'CPM', aop: 5 },
    { city: 'Delhi', bu: 'IGIV', aop: 8 },
  ]);
  await db('requisitions').insert([
    {
      id: 'REQ-001',
      city: 'Bangalore',
      hospital: 'Test Hospital',
      bd_type: 'Focus',
      bu: 'CPM',
      hire_type: 'New',
      raised_by: 'Sahil',
      date: '2026-01-01',
      status: 'Active',
    },
  ]);

  currentCaller = null;
});

// Tiny supertest-equivalent — keeps deps light. Spins up the app on an
// ephemeral port for one request, returns { status, body }.
async function request(
  method: 'GET' | 'PATCH' | 'PUT',
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

const adminCaller: User = {
  id: 1,
  email: 'sahil@carepalmoney.com',
  name: 'Sahil',
  role: 'admin',
  city: null,
  domain: 'carepalmoney.com',
  last_login_at: null,
  cities: [],
};
const taCaller: User = {
  id: 2,
  email: 'akhlaque@carepalmoney.com',
  name: 'Akhlaque',
  role: 'ta',
  city: null,
  domain: 'carepalmoney.com',
  last_login_at: null,
  cities: [],
};

describe('GET /api/users', () => {
  it('returns all users with cities field', async () => {
    setCaller(taCaller);
    // Seed one city assignment for Akhlaque.
    await db('user_cities').insert({ user_id: 2, city: 'Bangalore' });
    const res = await request('GET', '/api/users');
    assert.equal(res.status, 200);
    const users = res.body as User[];
    assert.equal(users.length, 3);
    const akhlaque = users.find((u) => u.id === 2);
    assert.ok(akhlaque);
    assert.deepEqual(akhlaque.cities, ['Bangalore']);
    const sahil = users.find((u) => u.id === 1);
    assert.ok(sahil);
    assert.deepEqual(sahil.cities, []);
  });
});

describe('PATCH /api/users/:id/role', () => {
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
    setCaller(adminCaller);
    const res = await request('PATCH', '/api/users/1/role', { role: 'ta' });
    assert.equal(res.status, 200);
    assert.equal((res.body as User).role, 'ta');
  });
});

describe('GET /api/cities', () => {
  it('returns distinct sorted cities from headcount + requisitions', async () => {
    setCaller(taCaller);
    const res = await request('GET', '/api/cities');
    assert.equal(res.status, 200);
    const cities = res.body as string[];
    assert.deepEqual(cities, ['Bangalore', 'Delhi', 'Mumbai']);
  });
});

describe('PUT /api/users/:id/cities', () => {
  it('403 when caller is TA (not admin)', async () => {
    setCaller(taCaller);
    const res = await request('PUT', '/api/users/3/cities', { cities: ['Bangalore'] });
    assert.equal(res.status, 403);
  });

  it('404 when user does not exist', async () => {
    setCaller(adminCaller);
    const res = await request('PUT', '/api/users/999/cities', { cities: ['Bangalore'] });
    assert.equal(res.status, 404);
  });

  it('200 + persists city assignment', async () => {
    setCaller(adminCaller);
    const res = await request('PUT', '/api/users/2/cities', { cities: ['Bangalore', 'Mumbai'] });
    assert.equal(res.status, 200);
    const body = res.body as User;
    assert.deepEqual(body.cities, ['Bangalore', 'Mumbai']);

    const rows = await db('user_cities').where({ user_id: 2 }).orderBy('city');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].city, 'Bangalore');
    assert.equal(rows[1].city, 'Mumbai');
  });

  it('200 with empty array clears all cities', async () => {
    await db('user_cities').insert([
      { user_id: 2, city: 'Bangalore', assigned_by: 1 },
      { user_id: 2, city: 'Mumbai', assigned_by: 1 },
    ]);
    setCaller(adminCaller);
    const res = await request('PUT', '/api/users/2/cities', { cities: [] });
    assert.equal(res.status, 200);
    assert.deepEqual((res.body as User).cities, []);

    const rows = await db('user_cities').where({ user_id: 2 });
    assert.equal(rows.length, 0);
  });

  it('replaces existing cities on re-assignment', async () => {
    await db('user_cities').insert({ user_id: 2, city: 'Bangalore', assigned_by: 1 });
    setCaller(adminCaller);
    const res = await request('PUT', '/api/users/2/cities', { cities: ['Delhi'] });
    assert.equal(res.status, 200);
    assert.deepEqual((res.body as User).cities, ['Delhi']);

    const rows = await db('user_cities').where({ user_id: 2 });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].city, 'Delhi');
  });
});
