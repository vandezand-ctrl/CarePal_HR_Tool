import * as XLSX from 'xlsx';
import { z } from 'zod';

/**
 * Canonical candidate field name -> list of accepted header spellings (lowercased).
 * Users' spreadsheets vary a lot; this normalises them.
 */
const HEADER_MAP: Record<string, string[]> = {
  name: ['name', 'candidate name', 'full name', 'candidate'],
  phone: ['phone', 'mobile', 'contact', 'mobile number', 'contact number'],
  email: ['email', 'email id', 'emailid', 'mail'],
  city: ['city', 'location'],
  currentRole: ['role', 'current role', 'designation', 'current designation', 'title'],
  company: ['company', 'current company', 'organization', 'organisation', 'employer'],
  currentCTC: ['current ctc', 'ctc', 'current salary', 'salary'],
  expectedCTC: ['expected ctc', 'expected', 'expected salary'],
  notice: ['notice', 'notice period'],
  reqId: ['requisition', 'req id', 'req', 'requisition id', 'job id'],
  bu: ['bu', 'business unit', 'unit'],
  ta: ['ta', 'recruiter', 'ta recruiter', 'assigned to'],
};

export interface RawRow {
  [key: string]: unknown;
}

export interface ImportRowInput {
  reqId: string;
  name: string;
  phone: string;
  email: string | null;
  city: string;
  currentRole: string;
  company: string;
  currentCTC: number | null;
  expectedCTC: number | null;
  notice: string | null;
  ta: string;
  bu: 'CPM' | 'IGIV';
}

export interface ValidRow {
  rowIndex: number;
  input: ImportRowInput;
}

export interface InvalidRow {
  rowIndex: number;
  raw: RawRow;
  errors: string[];
}

export interface ParseResult {
  valid: ValidRow[];
  invalid: InvalidRow[];
  totalRows: number;
}

function normHeader(h: string): string {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function mapHeaders(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const normHeaders = headers.map(normHeader);
  for (const [canonical, aliases] of Object.entries(HEADER_MAP)) {
    const match = normHeaders.findIndex((h) => aliases.some((a) => a === h));
    if (match !== -1) result[headers[match]] = canonical;
  }
  return result;
}

function cleanStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function cleanInt(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v).replace(/[,\s]/g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

const importRowSchema = z.object({
  reqId: z.string().regex(/^REQ-\d+$/, 'reqId must look like REQ-###'),
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().nullable(),
  city: z.string().min(1),
  currentRole: z.string().min(1),
  company: z.string().min(1),
  currentCTC: z.number().int().positive().nullable(),
  expectedCTC: z.number().int().positive().nullable(),
  notice: z.string().nullable(),
  ta: z.string().min(1),
  bu: z.enum(['CPM', 'IGIV']),
});

/**
 * Parse a buffer (xlsx or csv) into valid + invalid rows.
 * Does NOT check reqId FK against the DB — caller's responsibility.
 */
export function parseCandidatesSheet(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return { valid: [], invalid: [], totalRows: 0 };

  const rows = XLSX.utils.sheet_to_json<RawRow>(firstSheet, { defval: null });
  if (rows.length === 0) return { valid: [], invalid: [], totalRows: 0 };

  const headers = Object.keys(rows[0]);
  const headerMap = mapHeaders(headers);

  const valid: ValidRow[] = [];
  const invalid: InvalidRow[] = [];

  rows.forEach((raw, idx) => {
    const rowIndex = idx + 2; // 1-based accounting for header row
    const mapped: RawRow = {};
    for (const [sheetHeader, canonical] of Object.entries(headerMap)) {
      mapped[canonical] = raw[sheetHeader];
    }

    const candidate = {
      reqId: cleanStr(mapped.reqId) || '',
      name: cleanStr(mapped.name) || '',
      phone: cleanStr(mapped.phone) || '',
      email: cleanStr(mapped.email),
      city: cleanStr(mapped.city) || '',
      currentRole: cleanStr(mapped.currentRole) || '',
      company: cleanStr(mapped.company) || '',
      currentCTC: cleanInt(mapped.currentCTC),
      expectedCTC: cleanInt(mapped.expectedCTC),
      notice: cleanStr(mapped.notice),
      ta: cleanStr(mapped.ta) || '',
      bu: cleanStr(mapped.bu) || '',
    };

    const parsed = importRowSchema.safeParse(candidate);
    if (parsed.success) {
      valid.push({ rowIndex, input: parsed.data });
    } else {
      invalid.push({
        rowIndex,
        raw,
        errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(row)'}: ${i.message}`),
      });
    }
  });

  return { valid, invalid, totalRows: rows.length };
}
