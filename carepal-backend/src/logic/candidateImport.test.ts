import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { mapHeaders, parseCandidatesSheet } from './candidateImport.js';

function sheetBuffer(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('mapHeaders', () => {
  it('maps exact canonical names', () => {
    const m = mapHeaders(['name', 'phone', 'email']);
    assert.deepEqual(m, { name: 'name', phone: 'phone', email: 'email' });
  });
  it('is case-insensitive and strips punctuation', () => {
    const m = mapHeaders(['Full Name', 'Email ID', 'Current-CTC']);
    assert.equal(m['Full Name'], 'name');
    assert.equal(m['Email ID'], 'email');
    assert.equal(m['Current-CTC'], 'currentCTC');
  });
  it('accepts alternate spellings', () => {
    const m = mapHeaders(['Designation', 'Organisation', 'Mobile Number']);
    assert.equal(m['Designation'], 'currentRole');
    assert.equal(m['Organisation'], 'company');
    assert.equal(m['Mobile Number'], 'phone');
  });
  it('ignores unknown headers', () => {
    const m = mapHeaders(['name', 'gibberish column']);
    assert.equal(m['name'], 'name');
    assert.equal(m['gibberish column'], undefined);
  });
  it('accepts camelCase headers (the canonical names themselves)', () => {
    const m = mapHeaders(['reqId', 'currentRole', 'currentCTC', 'expectedCTC']);
    assert.equal(m['reqId'], 'reqId');
    assert.equal(m['currentRole'], 'currentRole');
    assert.equal(m['currentCTC'], 'currentCTC');
    assert.equal(m['expectedCTC'], 'expectedCTC');
  });
  it('accepts snake_case headers', () => {
    const m = mapHeaders(['req_id', 'current_role', 'current_ctc']);
    assert.equal(m['req_id'], 'reqId');
    assert.equal(m['current_role'], 'currentRole');
    assert.equal(m['current_ctc'], 'currentCTC');
  });
  it('accepts ALL-CAPS acronym headers', () => {
    const m = mapHeaders(['BU', 'TA', 'CTC']);
    assert.equal(m['BU'], 'bu');
    assert.equal(m['TA'], 'ta');
    // CTC alone matches the 'currentCTC' alias 'ctc'
    assert.equal(m['CTC'], 'currentCTC');
  });
});

describe('parseCandidatesSheet', () => {
  it('parses a clean row', () => {
    const buf = sheetBuffer([{
      'Name': 'Priya K',
      'Phone': '9876543210',
      'Email': 'priya@example.com',
      'City': 'Bangalore',
      'Current Role': 'BDA',
      'Company': 'Pristyn',
      'Current CTC': 30000,
      'Expected CTC': 40000,
      'Notice': '30 Days',
      'Req ID': 'REQ-001',
      'BU': 'CPM',
      'TA': 'Namita',
    }]);
    const r = parseCandidatesSheet(buf);
    assert.equal(r.totalRows, 1);
    assert.equal(r.valid.length, 1);
    assert.equal(r.invalid.length, 0);
    assert.equal(r.valid[0].input.name, 'Priya K');
    assert.equal(r.valid[0].input.currentCTC, 30000);
    assert.equal(r.valid[0].input.bu, 'CPM');
  });

  it('collects invalid rows with reasons without blocking valid ones', () => {
    const buf = sheetBuffer([
      { 'Name': 'Valid One', 'Phone': '9876543210', 'City': 'Delhi', 'Current Role': 'BDA', 'Company': 'Acme', 'Req ID': 'REQ-003', 'BU': 'IGIV', 'TA': 'Riddhi' },
      { 'Name': 'Missing Phone', 'City': 'Delhi', 'Current Role': 'BDA', 'Company': 'Acme', 'Req ID': 'REQ-003', 'BU': 'IGIV', 'TA': 'Riddhi' },
      { 'Name': 'Bad BU', 'Phone': '9876543210', 'City': 'Delhi', 'Current Role': 'BDA', 'Company': 'Acme', 'Req ID': 'REQ-003', 'BU': 'WRONG', 'TA': 'Riddhi' },
      { 'Name': 'Bad ReqId', 'Phone': '9876543210', 'City': 'Delhi', 'Current Role': 'BDA', 'Company': 'Acme', 'Req ID': 'not-a-req', 'BU': 'CPM', 'TA': 'Riddhi' },
    ]);
    const r = parseCandidatesSheet(buf);
    assert.equal(r.totalRows, 4);
    assert.equal(r.valid.length, 1);
    assert.equal(r.invalid.length, 3);
    assert.equal(r.valid[0].input.name, 'Valid One');
    // Each invalid row has row index >= 2 (header is row 1) and at least one error
    for (const inv of r.invalid) {
      assert.ok(inv.rowIndex >= 2);
      assert.ok(inv.errors.length > 0);
    }
  });

  it('treats missing TA column as null (route handler defaults it)', () => {
    // Same row as the "clean row" test but with no TA column at all.
    const buf = sheetBuffer([{
      'Name': 'No TA', 'Phone': '9876543210', 'Email': null, 'City': 'Delhi',
      'Current Role': 'BDA', 'Company': 'Acme', 'Req ID': 'REQ-003', 'BU': 'CPM',
    }]);
    const r = parseCandidatesSheet(buf);
    assert.equal(r.valid.length, 1, 'row should validate without TA');
    assert.equal(r.invalid.length, 0);
    assert.equal(r.valid[0].input.ta, null, 'ta is null, route handler will default it');
  });

  it('cleans CTC values with commas or whitespace', () => {
    const buf = sheetBuffer([{
      'Name': 'X', 'Phone': '9876543210', 'City': 'Delhi', 'Current Role': 'BDA',
      'Company': 'Acme', 'Req ID': 'REQ-003', 'BU': 'CPM', 'TA': 'Riddhi',
      'Current CTC': '  1,50,000 ', 'Expected CTC': '200000',
    }]);
    const r = parseCandidatesSheet(buf);
    assert.equal(r.valid.length, 1);
    assert.equal(r.valid[0].input.currentCTC, 150000);
    assert.equal(r.valid[0].input.expectedCTC, 200000);
  });

  it('treats empty CTC as null (optional field)', () => {
    const buf = sheetBuffer([{
      'Name': 'X', 'Phone': '9876543210', 'City': 'Delhi', 'Current Role': 'BDA',
      'Company': 'Acme', 'Req ID': 'REQ-003', 'BU': 'CPM', 'TA': 'Riddhi',
      'Current CTC': '', 'Expected CTC': null,
    }]);
    const r = parseCandidatesSheet(buf);
    assert.equal(r.valid.length, 1);
    assert.equal(r.valid[0].input.currentCTC, null);
    assert.equal(r.valid[0].input.expectedCTC, null);
  });

  it('returns empty for an empty sheet', () => {
    const buf = sheetBuffer([]);
    const r = parseCandidatesSheet(buf);
    assert.equal(r.totalRows, 0);
    assert.equal(r.valid.length, 0);
  });
});
