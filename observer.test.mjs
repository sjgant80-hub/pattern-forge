import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observe, bestKind, reprioritise, firstSurvivorPosition } from './observer.mjs';
import { baRule } from './propose.mjs';

const compareDomain = () => { const c = []; for (let i = 0; i < 100; i++) c.push({ x: [i % 10, Math.floor(i / 10), (i * 7) % 10], y: (i % 10) > Math.floor(i / 10) ? 1 : 0 }); return c; };

// the local model's proposals (same order as proposals.json): compare x0>x1 is the 3rd one
const proposals = [
  { kind: 'stump', feature: 0, threshold: 5, dir: 1 },
  { kind: 'stump', feature: 1, threshold: 5, dir: 1 },
  { kind: 'compare', a: 0, b: 1, op: '>' },
  { kind: 'range', feature: 0, lo: 2, hi: 5 },
  { kind: 'compare', a: 1, b: 2, op: '>' },
];

// past runs the observer has seen: compare survived, stumps/ranges did not
const pastRuns = [
  { bar: 0.9, graded: [{ rule: { kind: 'stump' }, testBA: 0.74 }, { rule: { kind: 'compare' }, testBA: 1.0 }, { rule: { kind: 'range' }, testBA: 0.40 }] },
  { bar: 0.9, graded: [{ rule: { kind: 'stump' }, testBA: 0.60 }, { rule: { kind: 'compare' }, testBA: 0.95 }] },
];

test('observe: learns a per-kind survival prior from past runs', () => {
  const prior = observe(pastRuns);
  assert.equal(prior.compare, 1);      // 2 proposed, 2 survived
  assert.equal(prior.stump, 0);        // 2 proposed, 0 survived
  assert.equal(prior.range, 0);        // 1 proposed, 0 survived
  assert.deepEqual(observe(null), {}); // garbage → empty prior, no throw
});

test('bestKind: the kind most likely to generalise', () => {
  assert.equal(bestKind(observe(pastRuns)), 'compare');
  assert.equal(bestKind({}), '');
  assert.equal(bestKind(null), '');
  assert.equal(bestKind({ stump: 0 }), 'stump');                    // a single zero-rate kind is still the best
  assert.equal(bestKind({ apple: 0.1, compare: 0.9 }), 'compare');  // higher rate wins over earlier position
  assert.equal(bestKind({ bravo: 0.5, compare: 0.5 }), 'bravo');    // a tie keeps the first-seen kind
});

test('observe: a rule scoring EXACTLY at the bar counts as a survivor (>=, not >)', () => {
  const prior = observe([{ bar: 0.9, graded: [{ rule: { kind: 'edge' }, testBA: 0.9 }] }]);
  assert.equal(prior.edge, 1);   // 0.9 >= 0.9 counts; a > mutant would give 0
});

test('firstSurvivorPosition: a rule exactly at the bar is a survivor; bad gradeOf → 0', () => {
  const rules = [{ kind: 'a' }, { kind: 'b' }];
  assert.equal(firstSurvivorPosition(rules, () => 0.9, 0.9), 1);   // exactly at bar
  assert.equal(firstSurvivorPosition(rules, () => 0.89, 0.9), 0);  // just under
  assert.equal(firstSurvivorPosition(rules, null, 0.9), 0);        // not a function → 0, no throw
});

test('the observer surfaces the generalising rule EARLIER (position 3 → 1)', () => {
  const grade = (r) => baRule(r, compareDomain());
  // unguided: scan in the model's original order — the winner (compare) is 3rd
  const unguided = firstSurvivorPosition(proposals, grade, 0.9);
  assert.equal(unguided, 3);
  // guided by the learned prior: compare rules are tried first → winner is 1st
  const prior = observe(pastRuns);
  const reordered = reprioritise(proposals, prior);
  assert.equal(reordered[0].kind, 'compare');
  const guided = firstSurvivorPosition(reordered, grade, 0.9);
  assert.equal(guided, 1);
  assert.ok(guided < unguided, 'the observer loop must reduce the search position of the first survivor');
});

test('reprioritise / firstSurvivorPosition: stable and safe on garbage', () => {
  assert.deepEqual(reprioritise(null, {}), []);
  assert.deepEqual(reprioritise(proposals, null).map((r) => r.kind), proposals.map((r) => r.kind)); // no prior → original order
  assert.equal(firstSurvivorPosition([], () => 1, 0.9), 0);
  assert.equal(firstSurvivorPosition(proposals, () => 0, 0.9), 0);   // nothing clears → 0
});
