import { getDb } from '../db/index.js';
import { getApproverIdsForBU } from '../config/approvalRouting.js';

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
  phase: 1;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  approvedAt: string | null;
  assignedAt: string;
}

export interface PhaseStatus {
  phase: 1;
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
    phase: 1,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    userRole: row.user_role,
    approvedAt: toISOString(row.approved_at),
    assignedAt: toISOString(row.assigned_at)!,
  };
}

function buildPhaseStatus(entries: ApprovalEntry[]): PhaseStatus[] {
  if (entries.length === 0) return [{ phase: 1, approvers: [], complete: false }];
  const anyApproved = entries.some((a) => a.approvedAt !== null);
  return [{ phase: 1, approvers: entries, complete: anyApproved }];
}

const APPROVAL_SELECT = [
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
] as const;

export async function getApprovalsForRequisition(reqId: string): Promise<PhaseStatus[]> {
  const rows = await getDb()<ApprovalJoinRow>('requisition_approvals as ra')
    .join('users as u', 'u.id', 'ra.user_id')
    .where('ra.requisition_id', reqId)
    .select(...APPROVAL_SELECT)
    .orderBy('u.name', 'asc');
  return buildPhaseStatus(rows.map(rowToEntry));
}

export async function getApprovalsForRequisitions(
  reqIds: string[],
): Promise<Map<string, PhaseStatus[]>> {
  const map = new Map<string, PhaseStatus[]>();
  if (reqIds.length === 0) return map;
  const rows = await getDb()('requisition_approvals as ra')
    .join('users as u', 'u.id', 'ra.user_id')
    .whereIn('ra.requisition_id', reqIds)
    .select<Array<ApprovalJoinRow & { requisition_id: string }>>(...APPROVAL_SELECT)
    .orderBy('u.name', 'asc');

  const byReq = new Map<string, ApprovalEntry[]>();
  for (const row of rows) {
    const list = byReq.get(row.requisition_id) ?? [];
    list.push(rowToEntry(row));
    byReq.set(row.requisition_id, list);
  }
  for (const reqId of reqIds) {
    map.set(reqId, buildPhaseStatus(byReq.get(reqId) ?? []));
  }
  return map;
}

export async function createInitialApprovals(
  reqId: string,
  bu: string,
): Promise<void> {
  const userIds = await getApproverIdsForBU(bu);
  const rows = userIds.map((uid) => ({
    requisition_id: reqId,
    phase: 1,
    user_id: uid,
    approved_at: null,
    assigned_at: new Date(),
    assigned_by: null,
  }));
  await getDb()('requisition_approvals').insert(rows);
}

export async function recordApproval(
  reqId: string,
  userId: number,
): Promise<{ phaseComplete: boolean }> {
  const row = await getDb()<ApprovalRow>('requisition_approvals')
    .where({ requisition_id: reqId, phase: 1, user_id: userId })
    .first();

  if (!row) {
    throw new Error(`User ${userId} is not assigned as a req-approver for ${reqId}`);
  }
  if (row.approved_at !== null) {
    throw new Error(`User ${userId} has already approved ${reqId}`);
  }

  await getDb()('requisition_approvals')
    .where({ id: row.id })
    .update({ approved_at: new Date(), updated_at: new Date() });

  // Any-one-of: a single approval completes the phase
  return { phaseComplete: true };
}

export async function validateApproverIds(userIds: number[]): Promise<void> {
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
