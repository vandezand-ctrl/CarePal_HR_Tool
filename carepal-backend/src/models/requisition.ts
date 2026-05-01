import { getDb } from '../db/index.js';

// Domain type (camelCase) — matches what the frontend expects
export interface Requisition {
  id: string;
  city: string;
  hospital: string;
  area: string | null;
  bdType: 'Focus' | 'Floater';
  bu: 'CPM' | 'IGIV';
  hireType: 'New' | 'Replacement';
  replacementFor: string | null;
  raisedBy: string;
  date: string;
  closureDate: string | null;
  status: 'Pending Approval' | 'Approved' | 'Active' | 'Filled';
  notes: string | null;
}

// DB row type (snake_case)
interface RequisitionRow {
  id: string;
  city: string;
  hospital: string;
  area: string | null;
  bd_type: string;
  bu: string;
  hire_type: string;
  replacement_for: string | null;
  raised_by: string;
  date: string;
  closure_date: string | null;
  status: string;
  notes: string | null;
}

// SQLite returns dates as strings already; this normalises Date instances
// (some drivers/JSON paths) back to YYYY-MM-DD so the API shape stays stable.
function toDateString(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Knex sometimes returns "YYYY-MM-DD HH:MM:SS" for date columns on certain
  // drivers; trim to the date portion.
  return v.length >= 10 ? v.slice(0, 10) : v;
}

function rowToRequisition(row: RequisitionRow): Requisition {
  return {
    id: row.id,
    city: row.city,
    hospital: row.hospital,
    area: row.area,
    bdType: row.bd_type as 'Focus' | 'Floater',
    bu: row.bu as 'CPM' | 'IGIV',
    hireType: row.hire_type as 'New' | 'Replacement',
    replacementFor: row.replacement_for,
    raisedBy: row.raised_by,
    date: row.date,
    closureDate: toDateString(row.closure_date),
    status: row.status as Requisition['status'],
    notes: row.notes,
  };
}

export interface RequisitionFilters {
  bu?: string;
  city?: string;
  hospital?: string;
  status?: string;
}

export async function listRequisitions(filters: RequisitionFilters = {}): Promise<Requisition[]> {
  const q = getDb()<RequisitionRow>('requisitions').select('*').orderBy('date', 'desc');
  if (filters.bu) q.where('bu', filters.bu);
  if (filters.city) q.where('city', filters.city);
  if (filters.hospital) q.where('hospital', filters.hospital);
  if (filters.status) q.where('status', filters.status);
  const rows = await q;
  return rows.map(rowToRequisition);
}

export async function getRequisition(id: string): Promise<Requisition | null> {
  const row = await getDb()<RequisitionRow>('requisitions').where({ id }).first();
  return row ? rowToRequisition(row) : null;
}

export interface CreateRequisitionInput {
  city: string;
  hospital: string;
  area?: string | null;
  bdType: 'Focus' | 'Floater';
  bu: 'CPM' | 'IGIV';
  hireType: 'New' | 'Replacement';
  replacementFor?: string | null;
  raisedBy: string;
  notes?: string | null;
}

async function nextRequisitionId(): Promise<string> {
  const row = await getDb()<RequisitionRow>('requisitions')
    .select('id')
    .orderBy('id', 'desc')
    .first();
  if (!row) return 'REQ-001';
  const n = Number(row.id.replace('REQ-', '')) + 1;
  return `REQ-${String(n).padStart(3, '0')}`;
}

export async function createRequisition(input: CreateRequisitionInput): Promise<Requisition> {
  const id = await nextRequisitionId();
  const today = new Date().toISOString().slice(0, 10);
  await getDb()('requisitions').insert({
    id,
    city: input.city,
    hospital: input.hospital,
    area: input.area ?? null,
    bd_type: input.bdType,
    bu: input.bu,
    hire_type: input.hireType,
    replacement_for: input.replacementFor ?? null,
    raised_by: input.raisedBy,
    date: today,
    status: 'Pending Approval',
    notes: input.notes ?? null,
  });
  const created = await getRequisition(id);
  if (!created) throw new Error('Failed to create requisition');
  return created;
}

export interface UpdateRequisitionInput {
  status?: 'Pending Approval' | 'Approved' | 'Active' | 'Filled';
  notes?: string | null;
  closureDate?: string | null;
}

export async function updateRequisition(
  id: string,
  input: UpdateRequisitionInput,
): Promise<Requisition | null> {
  const patch: Partial<RequisitionRow> & { updated_at: Date } = { updated_at: new Date() };
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.closureDate !== undefined) patch.closure_date = input.closureDate;
  const affected = await getDb()('requisitions').where({ id }).update(patch);
  if (affected === 0) return null;
  return getRequisition(id);
}
