import { getDb } from '../db/index.js';

export type UserRole = 'admin' | 'approver' | 'ta';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  city: string | null;
  domain: string;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  city: string | null;
  domain: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    city: row.city,
    domain: row.domain,
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
