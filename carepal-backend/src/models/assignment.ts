import { type Knex } from 'knex';
import { getDb } from '../db/index.js';
import type { User, UserRole } from './user.js';

/**
 * PR-L: candidate_assignments — many-to-many between candidates and users.
 * Replaces the single `candidates.ta` string column.
 *
 * Invariant: every candidate must have at least one assignment row at all
 * times. Enforced at the route layer (`setAssignments` throws on empty).
 */

interface AssignmentRow {
  id: number;
  candidate_id: string;
  user_id: number;
  assigned_at: string | Date;
  assigned_by: number | null;
}

interface UserJoinRow {
  user_id: number;
  email: string;
  name: string;
  role: string;
}

function userFromJoin(row: UserJoinRow): Pick<User, 'id' | 'email' | 'name' | 'role'> {
  return {
    id: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
  };
}

export type AssignedUser = Pick<User, 'id' | 'email' | 'name' | 'role'>;

export async function getAssignmentsForCandidate(
  candidateId: string,
  conn?: Knex | Knex.Transaction,
): Promise<AssignedUser[]> {
  const db = conn ?? getDb();
  const rows = await db<AssignmentRow>('candidate_assignments as ca')
    .join('users as u', 'u.id', 'ca.user_id')
    .where('ca.candidate_id', candidateId)
    .select<UserJoinRow[]>('ca.user_id as user_id', 'u.email', 'u.name', 'u.role')
    .orderBy('u.name', 'asc');
  return rows.map(userFromJoin);
}

/**
 * Bulk-load assignments for many candidates in one query, returning a map
 * keyed by candidate_id. Used by listCandidates so we don't N+1.
 */
export async function getAssignmentsForCandidates(
  candidateIds: string[],
): Promise<Map<string, AssignedUser[]>> {
  const map = new Map<string, AssignedUser[]>();
  if (candidateIds.length === 0) return map;
  const rows = await getDb()('candidate_assignments as ca')
    .join('users as u', 'u.id', 'ca.user_id')
    .whereIn('ca.candidate_id', candidateIds)
    .select<Array<UserJoinRow & { candidate_id: string }>>(
      'ca.candidate_id as candidate_id',
      'ca.user_id as user_id',
      'u.email',
      'u.name',
      'u.role',
    )
    .orderBy('u.name', 'asc');
  for (const r of rows) {
    const list = map.get(r.candidate_id) ?? [];
    list.push(userFromJoin(r));
    map.set(r.candidate_id, list);
  }
  return map;
}

/**
 * Replace all assignments for a candidate atomically. The new set is given
 * as user IDs; existing rows are deleted and the new set is inserted in a
 * single transaction.
 *
 * Throws if `userIds` is empty (the candidate must always have >=1 TA).
 * Caller is responsible for validating the user IDs exist + have role
 * `ta` or `admin`.
 */
export async function setAssignments(
  candidateId: string,
  userIds: number[],
  assignedBy: number,
): Promise<void> {
  if (userIds.length === 0) {
    throw new Error('At least one TA must be assigned to the candidate');
  }
  const dedup = Array.from(new Set(userIds));
  await getDb().transaction(async (trx) => {
    await trx('candidate_assignments').where({ candidate_id: candidateId }).del();
    await trx('candidate_assignments').insert(
      dedup.map((uid) => ({
        candidate_id: candidateId,
        user_id: uid,
        assigned_at: new Date(),
        assigned_by: assignedBy,
      })),
    );
  });
}

/**
 * Insert the initial assignments for a freshly-created candidate. Same
 * validation rules as setAssignments.
 */
export async function createAssignments(
  candidateId: string,
  userIds: number[],
  assignedBy: number | null,
  outerTrx?: Knex.Transaction,
): Promise<void> {
  if (userIds.length === 0) {
    throw new Error('At least one TA must be assigned to the candidate');
  }
  const dedup = Array.from(new Set(userIds));
  const conn = outerTrx ?? getDb();
  await conn('candidate_assignments').insert(
    dedup.map((uid) => ({
      candidate_id: candidateId,
      user_id: uid,
      assigned_at: new Date(),
      assigned_by: assignedBy,
    })),
  );
}
