import { getDb } from '../db/index.js';

interface ApprovalRow {
  id: number;
  requisition_id: string;
  phase: number;
  user_id: number;
  approved_at: string | Date | null;
  assigned_at: string | Date;
  assigned_by: number | null;
}

interface ApprovalJoinRow extends ApprovalRow {
  user_name: string;
  user_email: string;
  user_role: string;
}

export interface ApprovalEntry {
  id: number;
  phase: 1 | 2;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  approvedAt: string | null;
  assignedAt: string;
}

export interface PhaseStatus {
  phase: 1 | 2;
  approvers: ApprovalEntry[];
  complete: boolean;
}

function toISOString(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function rowToEntry(row: ApprovalJoinRow): ApprovalEntry {
  return {
    id: row.id,
    phase: row.phase as 1 | 2,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    userRole: row.user_role,
    approvedAt: toISOString(row.approved_at),
    assignedAt: toISOString(row.assigned_at)!,
  };
}

function buildPhaseStatuses(entries: ApprovalEntry[]): PhaseStatus[] {
  const phase1 = entries.filter((e) => e.phase === 1);
  const phase2 = entries.filter((e) => e.phase === 2);
  return [
    { phase: 1, approvers: phase1, complete: phase1.length > 0 && phase1.every((a) => a.approvedAt !== null) },
    { phase: 2, approvers: phase2, complete: phase2.length > 0 && phase2.every((a) => a.approvedAt !== null) },
  ];
}

export async function getApprovalsForRequisition(reqId: string): Promise<PhaseStatus[]> {
  const rows = await getDb()<ApprovalJoinRow>('requisition_approvals as ra')
    .join('users as u', 'u.id', 'ra.user_id')
    .where('ra.requisition_id', reqId)
    .select(
      'ra.id',
      'ra.requisition_id',
      'ra.phase',
      'ra.user_id',
      'ra.approved_at',
      'ra.assigned_at',
      'ra.assigned_by',
      'u.name as user_name',
      'u.email as user_email',
      'u.role as user_role',
    )
    .orderBy([{ column: 'ra.phase', order: 'asc' }, { column: 'u.name', order: 'asc' }]);
  return buildPhaseStatuses(rows.map(rowToEntry));
}

export async function getApprovalsForRequisitions(
  reqIds: string[],
): Promise<Map<string, PhaseStatus[]>> {
  const map = new Map<string, PhaseStatus[]>();
  if (reqIds.length === 0) return map;
  const rows = await getDb()('requisition_approvals as ra')
    .join('users as u', 'u.id', 'ra.user_id')
    .whereIn('ra.requisition_id', reqIds)
    .select<Array<ApprovalJoinRow & { requisition_id: string }>>(
      'ra.id',
      'ra.requisition_id',
      'ra.phase',
      'ra.user_id',
      'ra.approved_at',
      'ra.assigned_at',
      'ra.assigned_by',
      'u.name as user_name',
      'u.email as user_email',
      'u.role as user_role',
    )
    .orderBy([{ column: 'ra.phase', order: 'asc' }, { column: 'u.name', order: 'asc' }]);

  // Group by requisition_id
  const byReq = new Map<string, ApprovalEntry[]>();
  for (const row of rows) {
    const list = byReq.get(row.requisition_id) ?? [];
    list.push(rowToEntry(row));
    byReq.set(row.requisition_id, list);
  }
  for (const reqId of reqIds) {
    map.set(reqId, buildPhaseStatuses(byReq.get(reqId) ?? []));
  }
  return map;
}

export async function createInitialApprovals(
  reqId: string,
  phase1UserIds: number[],
  phase2UserIds: number[],
  assignedBy: number,
): Promise<void> {
  const rows = [
    ...Array.from(new Set(phase1UserIds)).map((uid) => ({
      requisition_id: reqId,
      phase: 1,
      user_id: uid,
      approved_at: null,
      assigned_at: new Date(),
      assigned_by: assignedBy,
    })),
    ...Array.from(new Set(phase2UserIds)).map((uid) => ({
      requisition_id: reqId,
      phase: 2,
      user_id: uid,
      approved_at: null,
      assigned_at: new Date(),
      assigned_by: assignedBy,
    })),
  ];
  await getDb()('requisition_approvals').insert(rows);
}

export async function recordApproval(
  reqId: string,
  phase: 1 | 2,
  userId: number,
): Promise<{ phaseComplete: boolean }> {
  const row = await getDb()<ApprovalRow>('requisition_approvals')
    .where({ requisition_id: reqId, phase, user_id: userId })
    .first();

  if (!row) {
    throw new Error(`User ${userId} is not assigned as a phase ${phase} approver for ${reqId}`);
  }
  if (row.approved_at !== null) {
    throw new Error(`User ${userId} has already approved phase ${phase} for ${reqId}`);
  }

  await getDb()('requisition_approvals')
    .where({ id: row.id })
    .update({ approved_at: new Date(), updated_at: new Date() });

  // Check if all approvers in this phase have now approved
  const pending = await getDb()<ApprovalRow>('requisition_approvals')
    .where({ requisition_id: reqId, phase })
    .whereNull('approved_at')
    .count('* as cnt')
    .first();
  const count = Number((pending as unknown as Record<string, unknown>)?.cnt ?? 0);
  return { phaseComplete: count === 0 };
}

async function validateApproverIds(userIds: number[]): Promise<void> {
  const users = await getDb()('users')
    .whereIn('id', userIds)
    .select('id', 'role');
  if (users.length !== userIds.length) {
    const found = new Set(users.map((u: { id: number }) => u.id));
    const missing = userIds.filter((id) => !found.has(id));
    throw new Error(`Users not found: ${missing.join(', ')}`);
  }
  const invalid = users.filter((u: { role: string }) => u.role !== 'approver' && u.role !== 'admin');
  if (invalid.length > 0) {
    const names = invalid.map((u: { id: number; role: string }) => `${u.id} (${u.role})`);
    throw new Error(`Users must have role approver or admin: ${names.join(', ')}`);
  }
}

export async function setPhaseApprovers(
  reqId: string,
  phase: 1 | 2,
  userIds: number[],
  assignedBy: number,
): Promise<{ phaseComplete: boolean }> {
  if (userIds.length === 0) {
    throw new Error('At least one approver must be assigned per phase');
  }
  if (userIds.length > 3) {
    throw new Error('Maximum 3 approvers per phase');
  }
  const dedup = Array.from(new Set(userIds));
  await validateApproverIds(dedup);

  await getDb().transaction(async (trx) => {
    await trx('requisition_approvals')
      .where({ requisition_id: reqId, phase })
      .del();
    await trx('requisition_approvals').insert(
      dedup.map((uid) => ({
        requisition_id: reqId,
        phase,
        user_id: uid,
        approved_at: null,
        assigned_at: new Date(),
        assigned_by: assignedBy,
      })),
    );
  });

  // Check if phase is now complete (all new approvers start unapproved, so this
  // will be false — but included for consistency with the auto-advance edge case).
  return { phaseComplete: false };
}

export { validateApproverIds };
