import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalRule, baRule, validate } from './propose.mjs';

// a comparison domain: y = (x0 > x1); x2 noise. NO single-feature threshold separates it.
const compareDomain = () => {
  const c = [];
  for (let i = 0; i < 100; i++) c.push({ x: [i % 10, Math.floor(i / 10), (i * 7) % 10], y: (i % 10) > Math.floor(i / 10) ? 1 : 0 });
  return c;
};

test('evalRule: the three rule forms, and garbage → 0', () => {
  assert.equal(evalRule({ kind: 'stump', feature: 0, threshold: 5, dir: 1 }, [5]), 1);
  assert.equal(evalRule({ kind: 'stump', feature: 0, threshold: 5, dir: -1 }, [5]), 1);
  assert.equal(evalRule({ kind: 'compare', a: 0, b: 1, op: '>' }, [7, 3]), 1);
  assert.equal(evalRule({ kind: 'compare', a: 0, b: 1, op: '>' }, [3, 7]), 0);
  assert.equal(evalRule({ kind: 'compare', a: 0, b: 1, op: '<' }, [3, 7]), 1);
  assert.equal(evalRule({ kind: 'range', feature: 0, lo: 2, hi: 5 }, [4]), 1);
  assert.equal(evalRule({ kind: 'range', feature: 0, lo: 2, hi: 5 }, [9]), 0);
  assert.equal(evalRule({ kind: 'nonsense' }, [1]), 0);
  assert.equal(evalRule(null, [1]), 0);
  assert.equal(evalRule({ kind: 'compare', a: 0, b: 1, op: '>' }, 'x'), 0);
});

test('baRule: the compare rule is perfect on the comparison domain; a stump is not', () => {
  const cmp = { kind: 'compare', a: 0, b: 1, op: '>' };
  assert.equal(baRule(cmp, compareDomain()), 1);
  const stump = { kind: 'stump', feature: 0, threshold: 5, dir: 1 };
  assert.ok(baRule(stump, compareDomain()) < 0.8);   // no single threshold captures x0>x1
  assert.equal(baRule(cmp, []), 0);
});

test('VALIDATE keeps the generalising compare rule, rejects the stumps that cannot catch it', () => {
  const proposed = [
    { kind: 'compare', a: 0, b: 1, op: '>' },       // the truth
    { kind: 'stump', feature: 0, threshold: 5, dir: 1 },
    { kind: 'stump', feature: 1, threshold: 5, dir: -1 },
    { kind: 'range', feature: 2, lo: 0, hi: 9 },     // noise (always true) → BA 0.5
  ];
  const r = validate(proposed, compareDomain(), { holdoutFrac: 1 / 3, bar: 0.9 });
  assert.equal(r.graded.length, 4);
  assert.equal(r.survivors.length, 1);              // only the compare clears a 0.9 held-out bar
  assert.equal(r.survivors[0].rule.kind, 'compare');
  assert.ok(r.survivors[0].testBA > 0.99);
});

test('evalRule boundaries are exact (direction, strict compare, inclusive range)', () => {
  assert.equal(evalRule({ kind: 'stump', feature: 0, threshold: 5, dir: 1 }, [4]), 0);   // +1 is v>=t, not v<=t
  assert.equal(evalRule({ kind: 'stump', feature: 0, threshold: 5, dir: -1 }, [6]), 0);   // -1 is v<=t
  assert.equal(evalRule({ kind: 'compare', a: 0, b: 1, op: '<' }, [5, 5]), 0);            // a===b is not a<b
  assert.equal(evalRule({ kind: 'compare', a: 0, b: 1, op: '>' }, [5, 5]), 0);            // nor a>b
  assert.equal(evalRule({ kind: 'range', feature: 0, lo: 2, hi: 5 }, [2]), 1);            // lo inclusive
  assert.equal(evalRule({ kind: 'range', feature: 0, lo: 2, hi: 5 }, [5]), 1);            // hi inclusive
});

test('VALIDATE bar is inclusive — a rule exactly at the bar survives', () => {
  const r = validate([{ kind: 'compare', a: 0, b: 1, op: '>' }], compareDomain(), { bar: 1 });
  assert.equal(r.survivors.length, 1);   // held-out BA is exactly 1.0, bar is 1.0 → >= keeps it
});

test('VALIDATE: empty/garbage proposals never throw', () => {
  for (const g of [null, undefined, 5, 'x', [null, {}, { kind: 'compare' }]]) {
    assert.doesNotThrow(() => validate(g, compareDomain(), {}));
  }
  assert.equal(validate([], compareDomain()).survivors.length, 0);
});
