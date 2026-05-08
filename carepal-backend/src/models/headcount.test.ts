import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { updateHeadcountTarget, getUnseenAopChanges } from './headcount.js';
import { markAopSeen } from './user.js';

// PR-O coverage: actor tracking on AOP edits + the "changes since you last
// viewed" query that drives the Dashboard toast.

const TEST_DB_PATH = path.resolve('./data/test-headcount-model.sqlite');

let db: Knex;
const SAHIL_ID = 1;
const AKHLAQUE_ID = 2;

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
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  await db('candidate_assignments').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('headcount').del();
  await db('users').del();

  await db('users').insert([
    { id: SAHIL_ID, email: 's@x.com', name: 'Sahil', role: 'admin', domain: 'x.com', city: null },
    { id: AKHLAQUE_ID, email: 'a@x.com', name: 'Akhlaque', role: 'admin', domain: 'x.com', city: null },
  ]);
  await db('headcount').insert([
    { city: 'Bangalore', bu: 'CPM', aop: 5 },
    { city: 'Bangalore', bu: 'IGIV', aop: 3 },
    { city: 'Mumbai', bu: 'CPM', aop: 4 },
  ]);
});

describe('updateHeadcountTarget — actor tracking', () => {
  it('writes updated_by_user_id when actorId is provided', async () => {
    await updateHeadcountTarget('Bangalore', 'CPM', 7, SAHIL_ID);
    const row = await db('headcount').where({ city: 'Bangalore', bu: 'CPM' }).first();
    assert.equal(row.aop, 7);
    assert.equal(row.updated_by_user_id, SAHIL_ID);
  });

  it('leaves updated_by_user_id null when actor is omitted (back-compat)', async () => {
    await updateHeadcountTarget('Bangalore', 'CPM', 7);
    const row = await db('headcount').where({ city: 'Bangalore', bu: 'CPM' }).first();
    assert.equal(row.updated_by_user_id, null);
  });
});

describe('getUnseenAopChanges', () => {
  // Helper: artificially set last_aop_seen_at to a known timestamp so we can
  // make assertions about "before" vs "after".
  async function setLastSeen(userId: number, when: Date | null): Promise<void> {
    await db('users').where({ id: userId }).update({ last_aop_seen_at: when });
  }

  it('returns [] when viewer has never set last_aop_seen_at (new admin)', async () => {
    // Akhlaque made a change but Sahil's last_aop_seen_at is null — we don't
    // want to surprise him with the entire history on first sign-in.
    await updateHeadcountTarget('Bangalore', 'CPM', 7, AKHLAQUE_ID);
    const changes = await getUnseenAopChanges(SAHIL_ID);
    assert.deepEqual(changes, []);
  });

  it('excludes the viewer\'s own edits', async () => {
    await setLastSeen(SAHIL_ID, new Date(Date.now() - 60_000));
    await updateHeadcountTarget('Bangalore', 'CPM', 7, SAHIL_ID);
    const changes = await getUnseenAopChanges(SAHIL_ID);
    assert.equal(changes.length, 0);
  });

  it('includes other admins\' edits made after last_aop_seen_at', async () => {
    await setLastSeen(SAHIL_ID, new Date(Date.now() - 60_000));
    await updateHeadcountTarget('Bangalore', 'CPM', 7, AKHLAQUE_ID);
    const changes = await getUnseenAopChanges(SAHIL_ID);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].city, 'Bangalore');
    assert.equal(changes[0].bu, 'CPM');
    assert.equal(changes[0].aop, 7);
    assert.equal(changes[0].updatedBy.id, AKHLAQUE_ID);
    assert.equal(changes[0].updatedBy.name, 'Akhlaque');
  });

  it('excludes edits older than last_aop_seen_at', async () => {
    // Akhlaque edits first…
    await updateHeadcountTarget('Bangalore', 'CPM', 7, AKHLAQUE_ID);
    // …then Sahil opens the Dashboard (a moment later).
    await new Promise((r) => setTimeout(r, 20));
    await markAopSeen(SAHIL_ID);
    // No edits since — list should be empty.
    const changes = await getUnseenAopChanges(SAHIL_ID);
    assert.equal(changes.length, 0);
  });

  it('returns multiple changes ordered by most recent first', async () => {
    await setLastSeen(SAHIL_ID, new Date(Date.now() - 60_000));
    await updateHeadcountTarget('Bangalore', 'CPM', 7, AKHLAQUE_ID);
    await new Promise((r) => setTimeout(r, 20));
    await updateHeadcountTarget('Mumbai', 'CPM', 6, AKHLAQUE_ID);
    const changes = await getUnseenAopChanges(SAHIL_ID);
    assert.equal(changes.length, 2);
    assert.equal(changes[0].city, 'Mumbai'); // newest first
    assert.equal(changes[1].city, 'Bangalore');
  });

  it('skips rows with null updated_by_user_id (pre-PR-O / system edits)', async () => {
    await setLastSeen(SAHIL_ID, new Date(Date.now() - 60_000));
    // Simulate a pre-PR-O edit: aop changed without an actor.
    await updateHeadcountTarget('Bangalore', 'CPM', 7);
    const changes = await getUnseenAopChanges(SAHIL_ID);
    assert.equal(changes.length, 0);
  });
});

describe('markAopSeen', () => {
  it('sets last_aop_seen_at to roughly now', async () => {
    const before = Date.now();
    await markAopSeen(SAHIL_ID);
    const row = await db('users').where({ id: SAHIL_ID }).first();
    assert.ok(row.last_aop_seen_at);
    const seenMs = new Date(row.last_aop_seen_at).getTime();
    assert.ok(seenMs >= before - 1000 && seenMs <= Date.now() + 1000,
      `last_aop_seen_at should be ~now (got ${row.last_aop_seen_at})`);
  });
});
