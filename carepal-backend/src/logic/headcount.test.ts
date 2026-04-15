import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeficit } from './headcount.js';

describe('calculateDeficit', () => {
  it('returns target minus active', () => {
    assert.equal(calculateDeficit(10, 3), 7);
  });
  it('returns 0 when fully staffed', () => {
    assert.equal(calculateDeficit(5, 5), 0);
  });
  it('returns a negative value when over-staffed (Active > Target)', () => {
    assert.equal(calculateDeficit(5, 9), -4);
  });
  it('does NOT subtract offered — client rule (Apr 9 2026)', () => {
    // If the function accepted `offered`, this test would be a regression guard.
    // The function signature is (target, active) — no `offered` param, by design.
    const target = 10, active = 5;
    assert.equal(calculateDeficit(target, active), 5);
  });
});
