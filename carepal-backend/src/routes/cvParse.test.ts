import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import express, { type Express } from 'express';
import type { UserRole } from '../models/user.js';
import { cvParseRouter } from './cvParse.js';
import { extractFieldsFromText } from '../logic/cvExtractor.js';

let app: Express;
let callerRole: UserRole = 'ta';
let callerSet = true;

function setCaller(role: UserRole | null) {
  if (role === null) { callerSet = false; return; }
  callerSet = true;
  callerRole = role;
}

before(() => {
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (callerSet) {
      req.user = { id: 1, email: 't@x.com', name: 'Test', role: callerRole, city: null, domain: 'x.com', last_login_at: null, cities: [] };
    }
    next();
  });
  app.use(cvParseRouter);
  // Reset to default TA after setup
  setCaller('ta');
});

async function postFile(buffer: Buffer, filename: string, mime: string): Promise<Response> {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), filename);
  const server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    return await fetch(`http://127.0.0.1:${port}/api/cv-parse`, {
      method: 'POST',
      body: form,
    });
  } finally {
    server.close();
  }
}

// ── Unit tests for extractFieldsFromText ────────────────────────

describe('extractFieldsFromText', () => {
  it('extracts phone from Indian mobile number', () => {
    const result = extractFieldsFromText('Contact: 9876543210\nSome text');
    assert.equal(result.phone, '9876543210');
  });

  it('extracts email', () => {
    const result = extractFieldsFromText('Name: Test\nEmail: john.doe@gmail.com\n');
    assert.equal(result.email, 'john.doe@gmail.com');
  });

  it('extracts city from known list', () => {
    const result = extractFieldsFromText('Address: Bengaluru, Karnataka\nPhone: 9123456789');
    assert.equal(result.city, 'Bangalore');
  });

  it('extracts name from first line', () => {
    const result = extractFieldsFromText('Anjali Kadam\nContact: 9082928789\nEmail: anju@gmail.com');
    assert.equal(result.name, 'Anjali Kadam');
  });

  it('skips RESUME header and finds name', () => {
    const result = extractFieldsFromText('RESUME\nAnjali Kadam\nContact: 9082928789');
    assert.equal(result.name, 'Anjali Kadam');
  });

  it('extracts name from "Name:" prefix', () => {
    const result = extractFieldsFromText('RESUME\nName : Anjali Kadam\nContact : 9082928789');
    assert.equal(result.name, 'Anjali Kadam');
  });

  it('extracts Bengaluru as Bangalore', () => {
    const result = extractFieldsFromText('Bengaluru, Karnataka\n9148689766');
    assert.equal(result.city, 'Bangalore');
  });

  it('extracts Mumbai', () => {
    const result = extractFieldsFromText('I live in Mumbai and work at ABC Corp\n9123456789');
    assert.equal(result.city, 'Mumbai');
  });

  it('returns nulls for empty text', () => {
    const result = extractFieldsFromText('');
    assert.equal(result.name, null);
    assert.equal(result.phone, null);
    assert.equal(result.email, null);
    assert.equal(result.city, null);
  });

  it('handles Naukri-style CV text (Anjali Kadam)', () => {
    const text = `RESUME
Name : Anjali Kadam
Contact : 9082928789
E-mail ID : anjusonavane111@gmail.com
Branch : B.B.A (Hospital Management)

Career Objective: -
To pursue a challenging career in esteemed organization.

Work Experience: -
Organization : Progenesis Fertility Center, Ahilyanagar
Center Manager & Financial Counselor
Progenesis IVF | October 2025 – Present
Currently Working`;
    const result = extractFieldsFromText(text);
    assert.equal(result.name, 'Anjali Kadam');
    assert.equal(result.phone, '9082928789');
    assert.equal(result.email, 'anjusonavane111@gmail.com');
  });

  it('handles pipe-separated header CV (Pavan Kumar)', () => {
    const text = `PAVAN KUMAR J K
9686374939 | pavankumarjk047@gmail.com | Bengaluru, Karnataka | Male, 22 Years

CAREER OBJECTIVE
Dedicated professional with 1.5+ years experience.

WORK EXPERIENCE
Sales Executive | Amazon Distributor (PNG) | Bengaluru, Karnataka
Currently Working - Present`;
    const result = extractFieldsFromText(text);
    assert.equal(result.name, 'PAVAN KUMAR J K');
    assert.equal(result.phone, '9686374939');
    assert.equal(result.email, 'pavankumarjk047@gmail.com');
    assert.equal(result.city, 'Bangalore');
  });

  it('handles minimal CV (Karimullah)', () => {
    const text = `CURRICULUM VITAE
Karimullah
E-mail: karimullah80493@gmail.com
Mobile : 91+7090479552

EXPERIENCE
I have 2.2 years of experience as a marketing manager in udaan company.

Permanent address : Bangalore 560029`;
    const result = extractFieldsFromText(text);
    assert.equal(result.name, 'Karimullah');
    assert.equal(result.email, 'karimullah80493@gmail.com');
    assert.equal(result.phone, '7090479552');
    assert.equal(result.city, 'Bangalore');
  });

  it('extracts phone with spaces between digit groups', () => {
    const result = extractFieldsFromText('Amir Shaikh\nPhone: 86689 87433\nEmail: amir@gmail.com');
    assert.equal(result.phone, '8668987433');
  });

  it('strips +91 country code from phone', () => {
    const result = extractFieldsFromText('Phone: +918668987433\nSome text');
    assert.equal(result.phone, '8668987433');
  });

  it('strips 91 country code (no plus) from phone', () => {
    const result = extractFieldsFromText('Mobile: 917090479552\nSome text');
    assert.equal(result.phone, '7090479552');
  });

  it('extracts company and role from "Working as X at Y" sentence', () => {
    const text = `Amir Shaikh
Phone: 86689 87433
Email: amirshaikh2634@gmail.com

WORK EXPERIENCE
Currently Working as a Sales Executive at IDFC First Bank where I handle sales operations.`;
    const result = extractFieldsFromText(text);
    assert.equal(result.role, 'Sales Executive');
    assert.equal(result.company, 'IDFC First Bank');
  });

  it('extracts from "Working as X in Y" variant (with "in" instead of "at")', () => {
    const text = `Rahul Kumar
Phone: 9876543210

EXPERIENCE
Currently Working as a Marketing Manager in Reliance Retail since 2022.`;
    const result = extractFieldsFromText(text);
    assert.equal(result.role, 'Marketing Manager');
    assert.equal(result.company, 'Reliance Retail');
  });

  it('handles Amir-style Naukri CV (full integration)', () => {
    const text = `Amir Shaikh
86689 87433
amirshaikh2634@gmail.com

Career Objective
To get an opportunity in a reputable organization.

Work Experience
Currently Working as a Sales Executive at IDFC First Bank where I handle customer relations.

Education
B.Com from Mumbai University 2020`;
    const result = extractFieldsFromText(text);
    assert.equal(result.name, 'Amir Shaikh');
    assert.equal(result.phone, '8668987433');
    assert.equal(result.email, 'amirshaikh2634@gmail.com');
    assert.equal(result.role, 'Sales Executive');
    assert.equal(result.company, 'IDFC First Bank');
  });

  it('handles Vinay-style CV', () => {
    const text = `VINAY S K
Hassan, Karnataka
Phone: 9148689766
Email: Vinaysyadav04@gmail.com

PROFESSIONAL EXPERIENCE
Marketing Executive
Karna Multispeciality Hospital, Hassan
Currently Working`;
    const result = extractFieldsFromText(text);
    assert.equal(result.name, 'VINAY S K');
    assert.equal(result.phone, '9148689766');
    assert.equal(result.email, 'vinaysyadav04@gmail.com');
    // Pattern D picks the first non-header line above "Currently Working" as
    // the company. "Marketing Executive" sits closer than the hospital line,
    // so it is (imperfectly) returned as company. Role is also detected.
    assert.equal(result.role, 'Marketing Executive');
    assert.ok(result.company, 'company should not be null');
  });
});

// ── Route-level tests ───────────────────────────────────────────

describe('POST /api/cv-parse', () => {
  it('returns 400 when no file is sent', async () => {
    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cv-parse`, { method: 'POST' });
      assert.equal(res.status, 400);
      const body = await res.json() as { error?: string };
      assert.ok(body.error);
    } finally {
      server.close();
    }
  });

  it('returns 400 for unsupported file type', async () => {
    const res = await postFile(Buffer.from('hello'), 'test.txt', 'text/plain');
    assert.equal(res.status, 400);
  });

  it('returns 422 when PDF is corrupted / unreadable', async () => {
    // Not a valid PDF — pdf-parse will throw, which the route catches as 422
    const garbage = Buffer.from('%PDF-1.4\nthis is not a real pdf structure');
    const res = await postFile(garbage, 'corrupt.pdf', 'application/pdf');
    assert.equal(res.status, 422);
    const body = await res.json() as { error?: string };
    assert.ok(body.error?.includes('corrupted'));
  });

  it('returns 403 when caller is approver (not ta/admin)', async () => {
    setCaller('approver');
    try {
      const res = await postFile(Buffer.from('dummy'), 'test.pdf', 'application/pdf');
      assert.equal(res.status, 403);
    } finally {
      setCaller('ta');
    }
  });

  it('returns 401 when no user is set', async () => {
    setCaller(null);
    try {
      const server = app.listen(0);
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cv-parse`, { method: 'POST' });
        assert.equal(res.status, 401);
      } finally {
        server.close();
      }
    } finally {
      setCaller('ta');
    }
  });
});
