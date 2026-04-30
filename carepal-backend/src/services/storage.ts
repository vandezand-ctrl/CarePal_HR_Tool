import fs from 'node:fs/promises';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

/**
 * Storage abstraction. Uses AWS S3 when AWS_S3_BUCKET is set; otherwise
 * falls back to local disk under ./uploads (used by tests and bare local dev).
 */

const bucket = process.env.AWS_S3_BUCKET;
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

const s3 = bucket ? new S3Client({ region: process.env.AWS_REGION ?? 'ap-south-1' }) : null;

function resolveLocalPath(storageKey: string): string {
  const resolved = path.resolve(UPLOAD_ROOT, storageKey);
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep) && resolved !== UPLOAD_ROOT) {
    throw new Error(`Invalid storage key (path traversal attempt): ${storageKey}`);
  }
  return resolved;
}

export async function saveFile(storageKey: string, buffer: Buffer, mime: string): Promise<void> {
  if (s3 && bucket) {
    await s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: buffer, ContentType: mime }),
    );
    return;
  }
  const full = resolveLocalPath(storageKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
}

export async function readFile(storageKey: string): Promise<Buffer> {
  if (s3 && bucket) {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
    if (!res.Body) throw new Error(`Empty response for key: ${storageKey}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }
  return fs.readFile(resolveLocalPath(storageKey));
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (s3 && bucket) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    return;
  }
  try {
    await fs.unlink(resolveLocalPath(storageKey));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
