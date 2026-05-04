/**
 * Gmail watcher — polls a mailbox for new application emails, extracts
 * attachments, and creates application rows.
 *
 * **Gated**: only starts when GMAIL_CLIENT_EMAIL + GMAIL_PRIVATE_KEY env vars
 * are set. These come from a GCP service account with domain-wide delegation
 * authorized by the Workspace admin (Sujeet).
 *
 * Polling approach (MVP):
 * - Every intervalMs (default 5 min), list messages matching
 *   `is:unread -label:carepal-processed`.
 * - For each new message: extract sender, subject, attachments.
 * - Upload attachments to storage under `applications/{id}/cv{ext}`.
 * - Create application row.
 * - Apply `carepal-processed` label + mark as read.
 *
 * Dependencies (install when enabling):
 * - googleapis: Gmail API client
 * - pdf-parse: extract text from PDF attachments for phone parsing
 */

import { createApplication } from '../models/application.js';
import { saveFile } from './storage.js';

const GMAIL_USER = process.env.GMAIL_DELEGATED_USER || 'ta1@impactguru.com';
const LABEL_NAME = 'carepal-processed';

let gmail: any = null;
let labelId: string | null = null;

async function initGmail(): Promise<void> {
  const clientEmail = process.env.GMAIL_CLIENT_EMAIL;
  const privateKey = process.env.GMAIL_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Gmail credentials not configured');

  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    subject: GMAIL_USER,
  });
  gmail = google.gmail({ version: 'v1', auth });
}

async function ensureLabel(): Promise<string> {
  if (labelId) return labelId;
  const { data } = await gmail.users.labels.list({ userId: 'me' });
  const existing = data.labels?.find((l: any) => l.name === LABEL_NAME);
  if (existing) { labelId = existing.id; return labelId!; }
  const { data: created } = await gmail.users.labels.create({
    userId: 'me',
    requestBody: { name: LABEL_NAME, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
  });
  labelId = created.id;
  return labelId!;
}

function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+91[\s-]?)?[6-9]\d{9}/);
  return match ? match[0].replace(/[\s-]/g, '') : null;
}

async function processMessage(messageId: string): Promise<void> {
  const { data: msg } = await gmail.users.messages.get({
    userId: 'me', id: messageId, format: 'full',
  });

  const headers = msg.payload?.headers || [];
  const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
  const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';

  // Parse "Name <email>" format
  const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
  const senderName = fromMatch ? fromMatch[1].replace(/["']/g, '').trim() : null;
  const senderEmail = fromMatch ? fromMatch[2] : fromHeader;

  const snippet = msg.snippet || '';

  // Extract attachments
  let cvStorageKey: string | null = null;
  let parsedPhone: string | null = null;
  const parts = msg.payload?.parts || [];

  for (const part of parts) {
    if (!part.filename || !part.body?.attachmentId) continue;
    const ext = part.filename.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext || '')) continue;

    const { data: attachment } = await gmail.users.messages.attachments.get({
      userId: 'me', messageId, id: part.body.attachmentId,
    });
    const buffer = Buffer.from(attachment.data, 'base64url');

    // Create application first to get an ID, then upload
    const app = await createApplication({
      gmailMessageId: messageId,
      senderEmail,
      senderName,
      subject,
      receivedAt: new Date(Number(msg.internalDate)),
      parsedName: senderName,
      parsedEmail: senderEmail,
      bodySnippet: snippet.slice(0, 500),
    });

    const storageKey = `applications/${app.id}/cv.${ext}`;
    const mime = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';
    await saveFile(storageKey, buffer, mime);
    cvStorageKey = storageKey;

    // Try to extract phone from PDF
    if (ext === 'pdf') {
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();
        parsedPhone = extractPhone(parsed.text);
      } catch { /* non-critical */ }
    }

    // Update the application with storage key and parsed phone
    const { getDb } = await import('../db/index.js');
    await getDb()('applications').where({ id: app.id }).update({
      cv_storage_key: cvStorageKey,
      parsed_phone: parsedPhone,
      updated_at: new Date().toISOString(),
    });

    break; // Only process first attachment as CV
  }

  // If no attachment found, still create the application
  if (!cvStorageKey) {
    await createApplication({
      gmailMessageId: messageId,
      senderEmail,
      senderName,
      subject,
      receivedAt: new Date(Number(msg.internalDate)),
      parsedName: senderName,
      parsedEmail: senderEmail,
      bodySnippet: snippet.slice(0, 500),
    });
  }

  // Label as processed + mark as read
  const lid = await ensureLabel();
  await gmail.users.messages.modify({
    userId: 'me', id: messageId,
    requestBody: { addLabelIds: [lid], removeLabelIds: ['UNREAD'] },
  });
}

async function poll(): Promise<void> {
  try {
    await ensureLabel();
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: `is:unread -label:${LABEL_NAME}`,
      maxResults: 20,
    });
    const messages = data.messages || [];
    for (const m of messages) {
      try {
        await processMessage(m.id);
      } catch (err) {
        console.error(`[gmail-watcher] Failed to process message ${m.id}:`, err);
      }
    }
    if (messages.length > 0) {
      console.log(`[gmail-watcher] Processed ${messages.length} new message(s)`);
    }
  } catch (err) {
    console.error('[gmail-watcher] Poll failed:', err);
  }
}

export async function startGmailWatcher(intervalMs = 5 * 60 * 1000): Promise<void> {
  await initGmail();
  console.log(`[gmail-watcher] Starting — polling ${GMAIL_USER} every ${intervalMs / 1000}s`);
  // Initial poll
  await poll();
  // Subsequent polls
  setInterval(poll, intervalMs);
}
