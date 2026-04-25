import { getDb } from '../db/index.js';

export type UserRole = 'admin' | 'approver' | 'ta';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  city: string | null;
  domain: string;
  last_login_at: string | null;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  city: string | null;
  domain: string;
  last_login_at: string | Date | null;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    city: row.city,
    domain: row.domain,
    last_login_at:
      row.last_login_at instanceof Date
        ? row.last_login_at.toISOString()
        : row.last_login_at,
  };
}

export async function listUsers(): Promise<User[]> {
  const rows = await getDb()<UserRow>('users').select('*').orderBy('name');
  return rows.map(rowToUser);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const row = await getDb()<UserRow>('users').where({ email }).first();
  return row ? rowToUser(row) : null;
}

export async function getUserById(id: number): Promise<User | null> {
  const row = await getDb()<UserRow>('users').where({ id }).first();
  return row ? rowToUser(row) : null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  domain: string;
  city?: string | null;
}

/**
 * Insert a new user. Used by the Google auth middleware on first sign-in.
 * Sets last_login_at to NOW() since this is happening *as* they sign in.
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const db = getDb();
  const now = db.fn.now();
  const [insertedId] = await db('users').insert({
    email: input.email.toLowerCase(),
    name: input.name,
    role: input.role,
    domain: input.domain,
    city: input.city ?? null,
    created_at: now,
    updated_at: now,
    last_login_at: now,
  });
  // SQLite returns the inserted rowId; MySQL returns the AUTO_INCREMENT id.
  // Both are usable as a primary key lookup.
  const user = await getUserById(insertedId as number);
  if (!user) {
    throw new Error(`Failed to read back user just inserted (id=${insertedId})`);
  }
  return user;
}

/**
 * Admin-only: change a user's role. Returns the updated user.
 * Returns null if no user exists with that id.
 */
export async function updateUserRole(
  id: number,
  role: UserRole,
): Promise<User | null> {
  const db = getDb();
  const updated = await db('users')
    .where({ id })
    .update({ role, updated_at: db.fn.now() });
  if (updated === 0) return null;
  return getUserById(id);
}

/**
 * Bump last_login_at to now. Called from auth middleware on every successful
 * authentication. Best-effort — caller doesn't need to await.
 */
export async function touchLastLogin(id: number): Promise<void> {
  const db = getDb();
  await db('users').where({ id }).update({ last_login_at: db.fn.now() });
}
