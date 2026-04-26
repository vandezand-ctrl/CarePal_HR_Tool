/* eslint-disable @typescript-eslint/no-explicit-any -- this test file fakes
   Express request/response objects and Google's TokenPayload, both of which
   have many optional fields we don't care about; `any` casts keep the test
   helpers terse without sacrificing the assertions. */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { mockAuth, googleAuthFactory, isEmailAllowed } from './auth.js';
import { getUserByEmail } from '../models/user.js';

// ---------------------------------------------------------------------------
// Test DB lifecycle — isolated SQLite file, migrated, with seeded users.
// ---------------------------------------------------------------------------

const TEST_DB_PATH = path.resolve('./data/test-auth.sqlite');

let db: Knex;

before(async () => {
  // Fresh file per test run.
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });

  db = knex({
    client: 'better-sqlite3',
    connection: { filename: TEST_DB_PATH },
    useNullAsDefault: true,
  });
  await db.migrate.latest({ directory: path.resolve('./migrations'), extension: 'js' });
  setDbForTesting(db);
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
      email: 'sahil@carepalmoney.com',
      name: 'Sahil',
      role: 'admin',
      domain: 'carepalmoney.com',
      city: null,
    },
    {
      email: 'akhlaque@carepalmoney.com',
      name: 'Akhlaque',
      role: 'ta',
      domain: 'carepalmoney.com',
      city: null,
    },
  ]);
});

// ---------------------------------------------------------------------------
// Express stub helpers — keeps tests focused on middleware logic, not Express.
// ---------------------------------------------------------------------------

interface FakeRes {
  statusCode: number;
  body: unknown;
  status(code: number): FakeRes;
  json(body: unknown): FakeRes;
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
}

function makeReq(headers: Record<string, string> = {}) {
  // Lower-case header lookup is what Express does.
  const lc: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lc[k.toLowerCase()] = v;
  return {
    header(name: string) {
      return lc[name.toLowerCase()];
    },
    user: undefined,
  } as any;
}

// ---------------------------------------------------------------------------
// isEmailAllowed — pure logic
// ---------------------------------------------------------------------------

describe('isEmailAllowed', () => {
  it('rejects unverified emails', () => {
    assert.equal(
      isEmailAllowed({ email: 'a@carepalmoney.com', email_verified: false, hd: 'carepalmoney.com' }),
      false,
    );
  });

  it('rejects when email missing', () => {
    assert.equal(isEmailAllowed({ email_verified: true, hd: 'carepalmoney.com' }), false);
  });

  it('accepts the personal admin gmail (no hd)', () => {
    assert.equal(
      isEmailAllowed({ email: 'jessevandezand@gmail.com', email_verified: true }),
      true,
    );
  });

  it('accepts carepalmoney.com hosted domain', () => {
    assert.equal(
      isEmailAllowed({ email: 'someone@carepalmoney.com', email_verified: true, hd: 'carepalmoney.com' }),
      true,
    );
  });

  it('accepts impactguru.com hosted domain', () => {
    assert.equal(
      isEmailAllowed({ email: 'x@impactguru.com', email_verified: true, hd: 'impactguru.com' }),
      true,
    );
  });

  it('rejects random gmail (not the personal admin)', () => {
    assert.equal(
      isEmailAllowed({ email: 'someone@gmail.com', email_verified: true }),
      false,
    );
  });

  it('rejects a carepalmoney.com email without hd claim (not a real Workspace login)', () => {
    // hd is set by Google only for Workspace accounts. An email-suffix match
    // alone isn't enough — somebody could sign in with a personal gmail
    // pretending to be `someone@carepalmoney.com`.
    assert.equal(
      isEmailAllowed({ email: 'someone@carepalmoney.com', email_verified: true }),
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// mockAuth (dev/CI mode)
// ---------------------------------------------------------------------------

describe('mockAuth middleware', () => {
  it('401 when x-user-email header missing', async () => {
    const req = makeReq({});
    const res = makeRes();
    let nextCalled = false;
    await mockAuth(req, res as any, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
  });

  it('401 when email not in DB', async () => {
    const req = makeReq({ 'x-user-email': 'nobody@carepalmoney.com' });
    const res = makeRes();
    let nextCalled = false;
    await mockAuth(req, res as any, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
  });

  it('attaches req.user when email matches', async () => {
    const req = makeReq({ 'x-user-email': 'sahil@carepalmoney.com' });
    const res = makeRes();
    let nextCalled = false;
    await mockAuth(req, res as any, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.user?.email, 'sahil@carepalmoney.com');
    assert.equal(req.user?.role, 'admin');
  });
});

// ---------------------------------------------------------------------------
// googleAuthFactory — uses a stub verifier so we never hit Google.
// ---------------------------------------------------------------------------

describe('googleAuth middleware', () => {
  it('401 when Authorization header missing', async () => {
    const auth = googleAuthFactory(async () => null);
    const req = makeReq({});
    const res = makeRes();
    await auth(req, res as any, () => {});
    assert.equal(res.statusCode, 401);
  });

  it('401 when Authorization header not Bearer', async () => {
    const auth = googleAuthFactory(async () => null);
    const req = makeReq({ Authorization: 'Basic abc' });
    const res = makeRes();
    await auth(req, res as any, () => {});
    assert.equal(res.statusCode, 401);
  });

  it('401 when verifier throws (invalid token)', async () => {
    const auth = googleAuthFactory(async () => {
      throw new Error('Wrong number of segments in token');
    });
    const req = makeReq({ Authorization: 'Bearer rubbish' });
    const res = makeRes();
    await auth(req, res as any, () => {});
    assert.equal(res.statusCode, 401);
  });

  it('403 when verified payload is from a disallowed domain', async () => {
    const auth = googleAuthFactory(async () => ({
      email: 'attacker@evil.com',
      email_verified: true,
        }) as any);
    const req = makeReq({ Authorization: 'Bearer goodtoken' });
    const res = makeRes();
    await auth(req, res as any, () => {});
    assert.equal(res.statusCode, 403);
  });

  it('attaches req.user for the personal admin gmail', async () => {
    // Pre-create the personal admin row to mirror prod bootstrap.
    await db('users').insert({
      email: 'jessevandezand@gmail.com',
      name: 'Jesse',
      role: 'admin',
      domain: 'gmail.com',
      city: null,
    });
    const auth = googleAuthFactory(async () => ({
      email: 'jessevandezand@gmail.com',
      email_verified: true,
      name: 'Jesse',
        }) as any);
    const req = makeReq({ Authorization: 'Bearer goodtoken' });
    const res = makeRes();
    let nextCalled = false;
    await auth(req, res as any, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.user?.role, 'admin');
  });

  it('auto-creates a new TA user for first-time carepalmoney.com sign-in', async () => {
    const auth = googleAuthFactory(async () => ({
      email: 'newhire@carepalmoney.com',
      email_verified: true,
      name: 'New Hire',
      hd: 'carepalmoney.com',
        }) as any);

    assert.equal(await getUserByEmail('newhire@carepalmoney.com'), null);

    const req = makeReq({ Authorization: 'Bearer goodtoken' });
    const res = makeRes();
    let nextCalled = false;
    await auth(req, res as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, 'should call next() on success');
    assert.equal(req.user?.role, 'ta', 'new users default to TA');
    assert.equal(req.user?.domain, 'carepalmoney.com');

    const persisted = await getUserByEmail('newhire@carepalmoney.com');
    assert.ok(persisted, 'user should be persisted');
    assert.equal(persisted?.role, 'ta');
    assert.ok(persisted?.last_login_at, 'last_login_at should be set on creation');
  });

  it('updates last_login_at on existing user sign-in', async () => {
    const auth = googleAuthFactory(async () => ({
      email: 'sahil@carepalmoney.com',
      email_verified: true,
      name: 'Sahil',
      hd: 'carepalmoney.com',
        }) as any);

    // Seeded user starts with NULL last_login_at.
    const before = await getUserByEmail('sahil@carepalmoney.com');
    assert.equal(before?.last_login_at, null);

    const req = makeReq({ Authorization: 'Bearer goodtoken' });
    const res = makeRes();
    await auth(req, res as any, () => {});

    // touchLastLogin is fire-and-forget — give it a tick to flush.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const after = await getUserByEmail('sahil@carepalmoney.com');
    assert.ok(after?.last_login_at, 'last_login_at should be set after sign-in');
    assert.equal(after?.role, 'admin', 'existing role preserved');
  });
});
