import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { funnelCounts, topLineCounts, pendingApprovals, cityBreakdown } from './dashboard.js';

describe('funnelCounts', () => {
  it('returns a row for every canonical stage, even zero-count ones', () => {
    const result = funnelCounts(['Sourced', 'Joined']);
    // 9 canonical stages after PR-E (added Training + Active)
    assert.equal(result.length, 9);
    const sourced = result.find((r) => r.stage === 'Sourced');
    const joined = result.find((r) => r.stage === 'Joined');
    const r1sched = result.find((r) => r.stage === 'R1 Scheduled');
    assert.equal(sourced?.count, 1);
    assert.equal(joined?.count, 1);
    assert.equal(r1sched?.count, 0);
  });
  it('keeps canonical stage order (left-to-right pipeline)', () => {
    const result = funnelCounts([]);
    assert.deepEqual(result.map((r) => r.stage), [
      'Sourced', 'R1 Scheduled', 'R1 Complete', 'R2 Scheduled', 'R2 Complete',
      'Offered', 'Joined', 'Training', 'Active',
    ]);
  });
});

describe('topLineCounts', () => {
  it('counts open positions (non-Filled) + pipe + offers + joins', () => {
    const reqStatuses = ['Pending Approval', 'Approved', 'Active', 'Filled', 'Filled'];
    const candStages = ['Sourced', 'R1 Scheduled', 'Offered', 'Joined', 'Joined'] as const;
    const r = topLineCounts(reqStatuses, candStages as unknown as []);
    assert.equal(r.openPositions, 3); // 3 non-Filled
    assert.equal(r.candidatesInPipe, 2); // Sourced + R1 Scheduled
    assert.equal(r.offersExtended, 3); // Offered + Joined + Joined
    assert.equal(r.confirmedJoins, 2); // 2 Joined
  });

  // PR-E (C3): extending stages with Training + Active makes the cumulative
  // semantics easier to verify — anyone post-offer counts as 'offered',
  // anyone post-join counts as 'joined'.
  it('Training + Active candidates roll up into offers + joins (cumulative)', () => {
    const candStages = [
      'Sourced', 'R1 Scheduled', 'Offered', 'Joined', 'Training', 'Active',
    ] as const;
    const r = topLineCounts([], candStages as unknown as []);
    assert.equal(r.candidatesInPipe, 2);    // Sourced + R1 Scheduled
    assert.equal(r.offersExtended, 4);      // Offered + Joined + Training + Active
    assert.equal(r.confirmedJoins, 3);      // Joined + Training + Active
  });
});

describe('pendingApprovals', () => {
  it('filters + projects to slim shape', () => {
    const reqs = [
      { id: 'REQ-001', city: 'Bangalore', hospital: 'X', bu: 'CPM', bdType: 'Focus', hireType: 'New', raisedBy: 'A', date: '2026-01-01', status: 'Approved' },
      { id: 'REQ-002', city: 'Delhi', hospital: 'Y', bu: 'IGIV', bdType: 'Floater', hireType: 'Replacement', raisedBy: 'B', date: '2026-02-01', status: 'Pending Approval' },
      { id: 'REQ-003', city: 'Mumbai', hospital: 'Z', bu: 'CPM', bdType: 'Focus', hireType: 'New', raisedBy: 'C', date: '2026-03-01', status: 'Pending Approval' },
    ];
    const result = pendingApprovals(reqs);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'REQ-002');
    assert.equal(result[1].id, 'REQ-003');
  });
});

describe('cityBreakdown', () => {
  // Helper: zero out the new fields the merged-Dashboard cityBreakdown takes,
  // so individual tests focus on what they actually exercise.
  const hc = (
    city: string,
    aop: number,
    active: number,
    extra: Partial<{ notice: number; pip: number; training: number; offered: number }> = {},
  ) => ({
    city,
    aop,
    active,
    notice: extra.notice ?? 0,
    pip: extra.pip ?? 0,
    training: extra.training ?? 0,
    offered: extra.offered ?? 0,
    deficit: aop - active,
  });

  it('aggregates headcount totals per city and open req counts per hospital', () => {
    const headcountRows = [
      hc('Bangalore', 7, 3),
      hc('Bangalore', 5, 2, { offered: 1, notice: 2 }),
      hc('Chennai', 3, 2),
    ];
    const reqs = [
      { city: 'Bangalore', hospital: 'Sakra', status: 'Active' },
      { city: 'Bangalore', hospital: 'Sakra', status: 'Pending Approval' },
      { city: 'Bangalore', hospital: 'Fortis', status: 'Approved' },
      { city: 'Chennai', hospital: 'Apollo', status: 'Filled' }, // excluded
    ];
    const result = cityBreakdown(headcountRows, reqs);
    const bangalore = result.find((r) => r.city === 'Bangalore');
    const chennai = result.find((r) => r.city === 'Chennai');
    assert.ok(bangalore);
    assert.ok(chennai);
    assert.equal(bangalore.aopTotal, 12);
    assert.equal(bangalore.activeTotal, 5);
    assert.equal(bangalore.deficitTotal, 7);
    assert.equal(bangalore.offeredTotal, 1);
    assert.equal(bangalore.noticeTotal, 2);
    assert.equal(bangalore.openReqs, 3);
    const sakra = bangalore.hospitals.find((h) => h.hospital === 'Sakra');
    const fortis = bangalore.hospitals.find((h) => h.hospital === 'Fortis');
    assert.equal(sakra?.openReqs, 2);
    assert.equal(fortis?.openReqs, 1);
    assert.equal(chennai.openReqs, 0); // Apollo was Filled
  });
  it('returns sorted by city name', () => {
    const result = cityBreakdown([hc('Zebra', 1, 0), hc('Alpha', 1, 0)], []);
    assert.equal(result[0].city, 'Alpha');
    assert.equal(result[1].city, 'Zebra');
  });
});
