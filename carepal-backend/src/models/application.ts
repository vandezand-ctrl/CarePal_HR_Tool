import path from 'node:path';
import { getDb } from '../db/index.js';
import { createCandidate, type CreateCandidateInput } from './candidate.js';
import { readFile, saveFile } from '../services/storage.js';

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';

export interface Application {
  id: number;
  gmailMessageId: string | null;
  senderEmail: string;
  senderName: string | null;
  subject: string | null;
  receivedAt: string;
  cvStorageKey: string | null;
  coverLetterStorageKey: string | null;
  parsedName: string | null;
  parsedPhone: string | null;
  parsedEmail: string | null;
  bodySnippet: string | null;
  status: ApplicationStatus;
  reviewedBy: number | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  candidateId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApplicationRow {
  id: number;
  gmail_message_id: string | null;
  sender_email: string;
  sender_name: string | null;
  subject: string | null;
  received_at: string;
  cv_storage_key: string | null;
  cover_letter_storage_key: string | null;
  parsed_name: string | null;
  parsed_phone: string | null;
  parsed_email: string | null;
  body_snippet: string | null;
  status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  candidate_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    gmailMessageId: row.gmail_message_id,
    senderEmail: row.sender_email,
    senderName: row.sender_name,
    subject: row.subject,
    receivedAt: row.received_at,
    cvStorageKey: row.cv_storage_key,
    coverLetterStorageKey: row.cover_letter_storage_key,
    parsedName: row.parsed_name,
    parsedPhone: row.parsed_phone,
    parsedEmail: row.parsed_email,
    bodySnippet: row.body_snippet,
    status: row.status as ApplicationStatus,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectReason: row.reject_reason,
    candidateId: row.candidate_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ApplicationFilters {
  status?: string;
}

export async function listApplications(filters: ApplicationFilters = {}): Promise<Application[]> {
  const q = getDb()<ApplicationRow>('applications').select('*').orderBy('received_at', 'desc');
  if (filters.status) q.where('status', filters.status);
  return (await q).map(rowToApplication);
}

export async function getApplication(
  id: number,
  conn?: import('knex').Knex | import('knex').Knex.Transaction,
): Promise<Application | null> {
  const db = conn ?? getDb();
  const row = await db<ApplicationRow>('applications').where({ id }).first();
  return row ? rowToApplication(row) : null;
}

export interface CreateApplicationInput {
  gmailMessageId?: string | null;
  senderEmail: string;
  senderName?: string | null;
  subject?: string | null;
  receivedAt: string | Date;
  cvStorageKey?: string | null;
  coverLetterStorageKey?: string | null;
  parsedName?: string | null;
  parsedPhone?: string | null;
  parsedEmail?: string | null;
  bodySnippet?: string | null;
}

export async function createApplication(input: CreateApplicationInput): Promise<Application> {
  const [id] = await getDb()('applications').insert({
    gmail_message_id: input.gmailMessageId ?? null,
    sender_email: input.senderEmail,
    sender_name: input.senderName ?? null,
    subject: input.subject ?? null,
    received_at: input.receivedAt instanceof Date ? input.receivedAt.toISOString() : input.receivedAt,
    cv_storage_key: input.cvStorageKey ?? null,
    cover_letter_storage_key: input.coverLetterStorageKey ?? null,
    parsed_name: input.parsedName ?? null,
    parsed_phone: input.parsedPhone ?? null,
    parsed_email: input.parsedEmail ?? null,
    body_snippet: input.bodySnippet ?? null,
    status: 'pending',
  });
  const created = await getApplication(id as number);
  if (!created) throw new Error('Failed to create application');
  return created;
}

export async function acceptApplication(
  id: number,
  candidateInput: CreateCandidateInput,
  reviewedByUserId: number,
): Promise<{ application: Application; candidateId: string; cvCopyFailed: boolean }> {
  const app = await getApplication(id);
  if (!app) throw new Error('Application not found');
  if (app.status !== 'pending') throw new Error(`Application is already ${app.status}`);

  return getDb().transaction(async (trx) => {
    const candidate = await createCandidate(candidateInput, reviewedByUserId, trx);

    let cvCopyFailed = false;
    if (app.cvStorageKey) {
      try {
        const buffer = await readFile(app.cvStorageKey);
        const ext = path.extname(app.cvStorageKey).toLowerCase() || '.pdf';
        const newKey = `${candidate.id}/resume${ext}`;
        await saveFile(newKey, buffer, ext === '.pdf' ? 'application/pdf' : 'application/octet-stream');
        await trx('documents').insert({
          candidate_id: candidate.id,
          doc_type: 'Resume',
          filename: `resume${ext}`,
          storage_key: newKey,
          size_bytes: buffer.length,
          mime_type: ext === '.pdf' ? 'application/pdf' : 'application/octet-stream',
          uploaded_by_user_id: reviewedByUserId,
        });
      } catch (err) {
        console.warn('[acceptApplication] CV copy failed:', err);
        cvCopyFailed = true;
      }
    }

    await trx('applications').where({ id }).update({
      status: 'accepted',
      reviewed_by: reviewedByUserId,
      reviewed_at: new Date(),
      candidate_id: candidate.id,
      updated_at: new Date(),
    });

    const updated = await getApplication(id, trx);
    if (!updated) throw new Error('Failed to load application after accept');
    return { application: updated, candidateId: candidate.id, cvCopyFailed };
  });
}

export async function rejectApplication(
  id: number,
  reviewedByUserId: number,
  reason?: string,
): Promise<Application> {
  const app = await getApplication(id);
  if (!app) throw new Error('Application not found');
  if (app.status !== 'pending') throw new Error(`Application is already ${app.status}`);

  await getDb()('applications').where({ id }).update({
    status: 'rejected',
    reviewed_by: reviewedByUserId,
    reviewed_at: new Date(),
    reject_reason: reason ?? null,
    updated_at: new Date(),
  });

  const updated = await getApplication(id);
  if (!updated) throw new Error('Failed to load application after reject');
  return updated;
}

export async function countUnseenApplications(userId: number): Promise<number> {
  const db = getDb();
  const user = await db('users').where({ id: userId }).select('last_inbox_seen_at').first();
  const lastSeen = user?.last_inbox_seen_at;

  const q = db('applications').where('status', 'pending');
  if (lastSeen) {
    q.where('received_at', '>', lastSeen);
  }
  const result = await q.count('* as count').first();
  return Number(result?.count ?? 0);
}

export async function markInboxSeen(userId: number): Promise<void> {
  const now = new Date().toISOString();
  await getDb()('users').where({ id: userId }).update({
    last_inbox_seen_at: now,
    updated_at: now,
  });
}
