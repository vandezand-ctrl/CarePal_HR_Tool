import path from 'node:path';
import { getDb } from '../db/index.js';
import { saveFile, deleteFile } from '../services/storage.js';

export const DOC_TYPES = [
  'Resume',
  'Motivation Letter',
  'Offer Letter',
  'ID Proof',
  'Relieving Letter',
  'Appointment Letter',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export interface Document {
  id: number;
  candidateId: string;
  docType: DocType;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  uploadedByUserId: number | null;
  uploadedAt: string;
}

interface DocumentRow {
  id: number;
  candidate_id: string;
  doc_type: string;
  filename: string;
  storage_key: string;
  size_bytes: number;
  mime_type: string;
  uploaded_by_user_id: number | null;
  uploaded_at: string;
}

function rowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    docType: row.doc_type as DocType,
    filename: row.filename,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
    uploadedByUserId: row.uploaded_by_user_id,
    uploadedAt: row.uploaded_at,
  };
}

/**
 * Build the storage key: uploads/{candidateId}/{docType_slug}{ext}
 * e.g. "C-001/resume.pdf"
 */
function buildStorageKey(candidateId: string, docType: DocType, filename: string): string {
  const ext = path.extname(filename).toLowerCase() || '';
  const slug = docType.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${candidateId}/${slug}${ext}`;
}

export async function listDocumentsForCandidate(candidateId: string): Promise<Document[]> {
  const rows = await getDb()<DocumentRow>('documents').where({ candidate_id: candidateId }).orderBy('uploaded_at', 'desc');
  return rows.map(rowToDocument);
}

export async function getDocumentRowForDownload(id: number): Promise<DocumentRow | null> {
  const row = await getDb()<DocumentRow>('documents').where({ id }).first();
  return row ?? null;
}

export interface UploadDocumentInput {
  candidateId: string;
  docType: DocType;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedByUserId: number;
}

/**
 * Upsert a document: if one already exists for (candidateId, docType), delete
 * the old file and replace the row. Keeps the "one active doc per type" invariant.
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<Document> {
  const db = getDb();
  const storageKey = buildStorageKey(input.candidateId, input.docType, input.filename);

  // Write the file first — if this fails we don't touch the DB
  await saveFile(storageKey, input.buffer, input.mimeType);

  const existing = await db<DocumentRow>('documents')
    .where({ candidate_id: input.candidateId, doc_type: input.docType })
    .first();

  let id: number;
  if (existing) {
    // If the storage key differs (different extension), clean up the old file
    if (existing.storage_key !== storageKey) {
      await deleteFile(existing.storage_key).catch(() => { /* non-critical */ });
    }
    await db('documents').where({ id: existing.id }).update({
      filename: input.filename,
      storage_key: storageKey,
      size_bytes: input.buffer.length,
      mime_type: input.mimeType,
      uploaded_by_user_id: input.uploadedByUserId,
      uploaded_at: new Date(),
    });
    id = existing.id;
  } else {
    const [newId] = await db('documents').insert({
      candidate_id: input.candidateId,
      doc_type: input.docType,
      filename: input.filename,
      storage_key: storageKey,
      size_bytes: input.buffer.length,
      mime_type: input.mimeType,
      uploaded_by_user_id: input.uploadedByUserId,
    });
    id = newId as number;
  }

  const row = await db<DocumentRow>('documents').where({ id }).first();
  if (!row) throw new Error('Failed to load document after upload');
  return rowToDocument(row);
}

export async function deleteDocument(id: number): Promise<boolean> {
  const db = getDb();
  const existing = await db<DocumentRow>('documents').where({ id }).first();
  if (!existing) return false;
  await deleteFile(existing.storage_key).catch(() => { /* non-critical */ });
  await db('documents').where({ id }).del();
  return true;
}
