import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Storage abstraction — local-disk implementation.
 *
 * When we swap to AWS S3 (per Apr 15 ATS decision with Sujeet), replace this
 * file with an S3-backed version that implements the same three functions.
 * Nothing else in the codebase needs to change.
 *
 *   saveFile(key, buffer, _mime) → writes to local disk / S3 putObject
 *   readFile(key)                → returns bytes as Buffer / S3 getObject
 *   deleteFile(key)              → unlinks / S3 deleteObject
 */

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

function resolveLocalPath(storageKey: string): string {
  // Prevent path traversal — storageKey must stay under UPLOAD_ROOT
  const resolved = path.resolve(UPLOAD_ROOT, storageKey);
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep) && resolved !== UPLOAD_ROOT) {
    throw new Error(`Invalid storage key (path traversal attempt): ${storageKey}`);
  }
  return resolved;
}

export async function saveFile(storageKey: string, buffer: Buffer, _mime: string): Promise<void> {
  const full = resolveLocalPath(storageKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
}

export async function readFile(storageKey: string): Promise<Buffer> {
  const full = resolveLocalPath(storageKey);
  return fs.readFile(full);
}

export async function deleteFile(storageKey: string): Promise<void> {
  const full = resolveLocalPath(storageKey);
  try {
    await fs.unlink(full);
  } catch (err: unknown) {
    // Missing file is fine — idempotent delete
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
