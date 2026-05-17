/**
 * Email service — sends emails via the Gmail API using a GCP service-account
 * with domain-wide delegation. Gated on GMAIL_CLIENT_EMAIL + GMAIL_PRIVATE_KEY.
 *
 * GMAIL_SEND_AS controls which mailbox the emails are sent from.
 */

let gmailClient: any = null;

function getSendAs(): string {
  return process.env.GMAIL_SEND_AS || 'noreply@impactguru.com';
}

async function getGmail(): Promise<any> {
  if (gmailClient) return gmailClient;

  const clientEmail = process.env.GMAIL_CLIENT_EMAIL;
  const privateKey = process.env.GMAIL_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('Email not configured: GMAIL_CLIENT_EMAIL / GMAIL_PRIVATE_KEY missing');
  }

  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: getSendAs(),
  });
  gmailClient = google.gmail({ version: 'v1', auth });
  return gmailClient;
}

export function isEmailConfigured(): boolean {
  return !!(process.env.GMAIL_CLIENT_EMAIL && process.env.GMAIL_PRIVATE_KEY);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

function buildRawMessage(input: SendEmailInput): string {
  const from = getSendAs();
  const lines = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    input.body,
  ];
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const gmail = await getGmail();
  const raw = buildRawMessage(input);
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
}

export interface SendEmailWithICSInput {
  to: string;
  subject: string;
  body: string;
  icsContent: string;
}

function buildRawMessageWithICS(input: SendEmailWithICSInput): string {
  const from = getSendAs();
  const boundary = `boundary_${Date.now()}`;
  const lines = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    input.body,
    '',
    `--${boundary}`,
    'Content-Type: text/calendar; charset=UTF-8; method=REQUEST',
    'Content-Disposition: attachment; filename="invite.ics"',
    '',
    input.icsContent,
    '',
    `--${boundary}--`,
  ];
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmailWithICS(input: SendEmailWithICSInput): Promise<void> {
  const gmail = await getGmail();
  const raw = buildRawMessageWithICS(input);
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
}

export function buildRejectionEmailBody(candidateName: string): string {
  return [
    `Dear ${candidateName},`,
    '',
    'Thank you for your interest in the position and for taking the time to go through our interview process.',
    '',
    'After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.',
    '',
    'We appreciate your effort and wish you all the best in your future career endeavors.',
    '',
    'Best regards,',
    'CarePal Money Talent Acquisition Team',
  ].join('\n');
}

// For testing: reset the cached client.
export function _resetForTesting(): void {
  gmailClient = null;
}
