/**
 * Gmail watcher — polls one or more mailboxes for new application emails,
 * extracts attachments, and creates application rows.
 *
 * **Gated**: only starts when GMAIL_CLIENT_EMAIL + GMAIL_PRIVATE_KEY env vars
 * are set. These come from a GCP service account with domain-wide delegation
 * authorized by the Workspace admin (Sujeet).
 *
 * Mailboxes are configured via GMAIL_DELEGATED_USERS (comma-separated).
 * Falls back to GMAIL_DELEGATED_USER (single) for backward compat, then
 * to 'ta1@impactguru.com'.
 *
 * Polling approach (MVP):
 * - Every intervalMs (default 5 min), list messages matching
 *   `is:unread -label:carepal-processed` in each mailbox.
 * - For each new message: extract sender, subject, attachments.
 * - Upload attachments to storage under `applications/{id}/cv{ext}`.
 * - Create application row with source_mailbox set.
 * - Apply `carepal-processed` label + mark as read.
 *
 * Dependencies (install when enabling):
 * - googleapis: Gmail API client
 * - pdf-parse: extract text from PDF attachments for phone parsing
 */

import { createApplication, getApplicationByGmailMessageId } from '../models/application.js';
import { saveFile } from './storage.js';

const LABEL_NAME = 'carepal-processed';

function parseMailboxList(): string[] {
  const multi = process.env.GMAIL_DELEGATED_USERS;
  if (multi) return multi.split(',').map((s) => s.trim()).filter(Boolean);
  const single = process.env.GMAIL_DELEGATED_USER;
  if (single) return [single.trim()];
  return ['ta1@impactguru.com'];
}

interface MailboxState {
  gmail: any;
  labelId: string | null;
  consecutiveFailures: number;
}

const mailboxes = new Map<string, MailboxState>();

async function initGmailForUser(userEmail: string): Promise<void> {
  const clientEmail = process.env.GMAIL_CLIENT_EMAIL;
  const privateKey = process.env.GMAIL_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Gmail credentials not configured');

  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    subject: userEmail,
  });
  const gmail = google.gmail({ version: 'v1', auth });
  mailboxes.set(userEmail, { gmail, labelId: null, consecutiveFailures: 0 });
}

async function ensureLabel(userEmail: string): Promise<string> {
  const state = mailboxes.get(userEmail)!;
  if (state.labelId) return state.labelId;
  const { data } = await state.gmail.users.labels.list({ userId: 'me' });
  const existing = data.labels?.find((l: any) => l.name === LABEL_NAME);
  if (existing) { state.labelId = existing.id; return state.labelId!; }
  const { data: created } = await state.gmail.users.labels.create({
    userId: 'me',
    requestBody: { name: LABEL_NAME, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
  });
  state.labelId = created.id;
  return state.labelId!;
}

function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+91[\s-]?)?[6-9]\d{9}/);
  return match ? match[0].replace(/[\s-]/g, '') : null;
}

async function processMessage(messageId: string, userEmail: string): Promise<void> {
  const existing = await getApplicationByGmailMessageId(messageId);
  if (existing) {
    console.log(`[gmail-watcher] Skipping duplicate message ${messageId} (application ${existing.id})`);
    return;
  }

  const state = mailboxes.get(userEmail)!;
  const { data: msg } = await state.gmail.users.messages.get({
    userId: 'me', id: messageId, format: 'full',
  });

  const headers = msg.payload?.headers || [];
  const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
  const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';

  const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
  const senderName = fromMatch ? fromMatch[1].replace(/["']/g, '').trim() : null;
  const senderEmail = fromMatch ? fromMatch[2] : fromHeader;

  const snippet = msg.snippet || '';

  let cvStorageKey: string | null = null;
  let parsedPhone: string | null = null;
  const parts = msg.payload?.parts || [];

  for (const part of parts) {
    if (!part.filename || !part.body?.attachmentId) continue;
    const ext = part.filename.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext || '')) continue;

    const { data: attachment } = await state.gmail.users.messages.attachments.get({
      userId: 'me', messageId, id: part.body.attachmentId,
    });
    const buffer = Buffer.from(attachment.data, 'base64url');

    const app = await createApplication({
      gmailMessageId: messageId,
      senderEmail,
      senderName,
      subject,
      receivedAt: new Date(Number(msg.internalDate)),
      parsedName: senderName,
      parsedEmail: senderEmail,
      bodySnippet: snippet.slice(0, 500),
      sourceMailbox: userEmail,
    });

    const storageKey = `applications/${app.id}/cv.${ext}`;
    const mime = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';
    await saveFile(storageKey, buffer, mime);
    cvStorageKey = storageKey;

    if (ext === 'pdf') {
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();
        parsedPhone = extractPhone(parsed.text);
      } catch (pdfErr) {
        console.warn(`[gmail-watcher] PDF phone extraction failed for message ${messageId}:`, pdfErr);
      }
    }

    const { getDb } = await import('../db/index.js');
    await getDb()('applications').where({ id: app.id }).update({
      cv_storage_key: cvStorageKey,
      parsed_phone: parsedPhone,
      updated_at: new Date().toISOString(),
    });

    break;
  }

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
      sourceMailbox: userEmail,
    });
  }

  const lid = await ensureLabel(userEmail);
  await state.gmail.users.messages.modify({
    userId: 'me', id: messageId,
    requestBody: { addLabelIds: [lid], removeLabelIds: ['UNREAD'] },
  });
}

async function pollMailbox(userEmail: string): Promise<void> {
  const state = mailboxes.get(userEmail)!;
  try {
    await ensureLabel(userEmail);
    const { data } = await state.gmail.users.messages.list({
      userId: 'me',
      q: `is:unread -label:${LABEL_NAME}`,
      maxResults: 20,
    });
    const messages = data.messages || [];
    for (const m of messages) {
      try {
        await processMessage(m.id, userEmail);
      } catch (err) {
        console.error(`[gmail-watcher] Failed to process message ${m.id} in ${userEmail}:`, err);
      }
    }
    if (messages.length > 0) {
      console.log(`[gmail-watcher] Processed ${messages.length} new message(s) from ${userEmail}`);
    }
    state.consecutiveFailures = 0;
  } catch (err) {
    state.consecutiveFailures++;
    console.error(`[gmail-watcher] Poll failed for ${userEmail}:`, err);
  }
}

const MAX_INTERVAL = 30 * 60 * 1000;

export async function startGmailWatcher(intervalMs = 5 * 60 * 1000): Promise<void> {
  const users = parseMailboxList();
  for (const user of users) {
    await initGmailForUser(user);
  }
  console.log(`[gmail-watcher] Starting — polling [${users.join(', ')}] every ${intervalMs / 1000}s`);

  async function schedulePoll(): Promise<void> {
    for (const user of users) {
      await pollMailbox(user);
    }
    const maxFailures = Math.max(...users.map((u) => mailboxes.get(u)!.consecutiveFailures));
    const delay = maxFailures === 0
      ? intervalMs
      : Math.min(intervalMs * Math.pow(2, maxFailures), MAX_INTERVAL);
    if (maxFailures > 0) {
      console.warn(`[gmail-watcher] failure(s) detected, next poll in ${Math.round(delay / 1000)}s`);
    }
    setTimeout(schedulePoll, delay);
  }

  await schedulePoll();
}
