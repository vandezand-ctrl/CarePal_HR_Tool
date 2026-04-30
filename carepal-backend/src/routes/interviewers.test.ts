import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { interviewersRouter } from './interviewers.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-interviewers-route.sqlite');

let db: Knex;
let app: Express;

let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

const adminCaller: User = {
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null,
};

interface Interviewer {
  name: string;
  city: string | null;
  round: number;
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
  app.use((req, _res, next) => {
    if (currentCaller) req.user = currentCaller;
    next();
  });
  app.use(interviewersRouter);
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
  method: 'GET',
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

describe('GET /api/interviewers', () => {
  it('returns the hardcoded list of interviewers', async () => {
    const r = await request('GET', '/api/interviewers');
    assert.equal(r.status, 200);
    const body = r.body as Interviewer[];
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
  });

  it('every entry has name, city, round of expected types', async () => {
    const r = await request('GET', '/api/interviewers');
    const body = r.body as Interviewer[];
    for (const entry of body) {
      assert.ok(typeof entry.name === 'string' && entry.name.length > 0);
      assert.ok(entry.city === null || typeof entry.city === 'string');
      assert.ok(entry.round === 1 || entry.round === 2);
    }
  });

  it('contains both round 1 and round 2 interviewers', async () => {
    const r = await request('GET', '/api/interviewers');
    const body = r.body as Interviewer[];
    assert.ok(body.some((e) => e.round === 1), 'has round 1');
    assert.ok(body.some((e) => e.round === 2), 'has round 2');
  });
});
