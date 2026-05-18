import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidate } from './cvScreener.js';

// parseAndValidate is the firewall between Claude's untrusted text output
// and the candidate row. Each branch here corresponds to a real failure
// mode the model has been observed to produce.

describe('parseAndValidate — happy path', () => {
  it('parses well-formed JSON', () => {
    const r = parseAndValidate('{"score": 75, "explanation": "Strong healthcare BD background."}');
    assert.equal(r.score, 75);
    assert.equal(r.explanation, 'Strong healthcare BD background.');
  });

  it('rounds non-integer scores', () => {
    const r = parseAndValidate('{"score": 72.6, "explanation": "Decent match overall."}');
    assert.equal(r.score, 73);
  });

  it('accepts score at the 0 boundary', () => {
    const r = parseAndValidate('{"score": 0, "explanation": "Background is unrelated."}');
    assert.equal(r.score, 0);
  });

  it('accepts score at the 100 boundary', () => {
    const r = parseAndValidate('{"score": 100, "explanation": "Ideal match across every dimension."}');
    assert.equal(r.score, 100);
  });

  it('trims surrounding whitespace in the explanation', () => {
    const r = parseAndValidate('{"score": 50, "explanation": "  Borderline match.  "}');
    assert.equal(r.explanation, 'Borderline match.');
  });
});

describe('parseAndValidate — markdown fence stripping', () => {
  it('strips ```json fences the model sometimes adds', () => {
    const r = parseAndValidate('```json\n{"score": 60, "explanation": "Adequate match overall."}\n```');
    assert.equal(r.score, 60);
  });

  it('strips bare ``` fences', () => {
    const r = parseAndValidate('```\n{"score": 30, "explanation": "Weak match."}\n```');
    assert.equal(r.score, 30);
  });
});

describe('parseAndValidate — score validation', () => {
  it('throws when score is negative', () => {
    assert.throws(
      () => parseAndValidate('{"score": -5, "explanation": "Negative."}'),
      /invalid score/i,
    );
  });

  it('throws when score is over 100', () => {
    assert.throws(
      () => parseAndValidate('{"score": 150, "explanation": "Over."}'),
      /invalid score/i,
    );
  });

  it('throws when score is NaN-ish', () => {
    assert.throws(
      () => parseAndValidate('{"score": "high", "explanation": "Not a number."}'),
      /invalid score/i,
    );
  });

  it('throws when score field is missing entirely', () => {
    assert.throws(
      () => parseAndValidate('{"explanation": "Only explanation present."}'),
      /invalid score/i,
    );
  });
});

describe('parseAndValidate — explanation validation', () => {
  it('throws when explanation is missing', () => {
    assert.throws(
      () => parseAndValidate('{"score": 70}'),
      /invalid explanation/i,
    );
  });

  it('throws when explanation is too short', () => {
    assert.throws(
      () => parseAndValidate('{"score": 70, "explanation": "ok"}'),
      /invalid explanation/i,
    );
  });

  it('throws when explanation is not a string', () => {
    assert.throws(
      () => parseAndValidate('{"score": 70, "explanation": 42}'),
      /invalid explanation/i,
    );
  });
});

describe('parseAndValidate — structural failures', () => {
  it('throws when response is not valid JSON', () => {
    assert.throws(
      () => parseAndValidate('here is your score: 75/100'),
      /non-JSON response/i,
    );
  });

  it('throws when response is a JSON array (not an object)', () => {
    assert.throws(
      () => parseAndValidate('[75, "good match"]'),
      /invalid score/i,
    );
  });

  it('throws when response is a JSON primitive', () => {
    assert.throws(
      () => parseAndValidate('"just a string"'),
      /not an object/i,
    );
  });

  it('throws when response is null', () => {
    assert.throws(
      () => parseAndValidate('null'),
      /not an object/i,
    );
  });
});
