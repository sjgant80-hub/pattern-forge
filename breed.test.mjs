import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predictCompound, baCompound, breed } from './breed.mjs';

// a conjunction domain: y = (x0>=5 AND x1>=5); x2 is noise. No single feature separates it.
const andDomain = () => {
  const c = [];
  for (let i = 0; i < 100; i++) c.push({ x: [i % 10, Math.floor(i / 10), (i * 7) % 10], y: (i % 10 >= 5 && Math.floor(i / 10) >= 5) ? 1 : 0 });
  return c;
};
// a sparse grid where ANDing train-tuned stumps overfits the threshold (held-out must catch it)
const sparseAnd = () => {
  const c = [];
  for (let i = 0; i < 36; i++) c.push({ x: [i % 6, Math.floor(i / 6), (i * 5) % 6], y: (i % 6 >= 3 && Math.floor(i / 6) >= 3) ? 1 : 0 });
  return c;
};

test('predictCompound: logical AND of the stumps; empty/garbage → 0', () => {
  const comp = { stumps: [{ feature: 0, threshold: 5, dir: 1 }, { feature: 1, threshold: 5, dir: 1 }] };
  assert.equal(predictCompound(comp, [5, 5, 0]), 1);   // both fire
  assert.equal(predictCompound(comp, [5, 4, 0]), 0);   // second fails
  assert.equal(predictCompound(comp, [4, 9, 0]), 0);   // first fails
  assert.equal(predictCompound({ stumps: [] }, [9, 9]), 0);  // empty → 0, not vacuous-true
  assert.equal(predictCompound(null, [1]), 0);
});

test('baCompound: perfect on the true conjunction, chance-ish on a single term', () => {
  const truth = { stumps: [{ feature: 0, threshold: 5, dir: 1 }, { feature: 1, threshold: 5, dir: 1 }] };
  assert.equal(baCompound(truth, andDomain()), 1);
  const single = { stumps: [{ feature: 0, threshold: 5, dir: 1 }] };
  assert.ok(baCompound(single, andDomain()) < 0.9);    // one feature can't capture the AND
  assert.equal(baCompound(truth, []), 0);
});

test('BREED improves held-out by finding the conjunction a single stump cannot', () => {
  const r = breed(andDomain(), { generations: 3, keep: 8, maxTerms: 3 });
  assert.equal(r.improvedHeldOut, true);
  assert.ok(r.champion.testBA > r.singleBestTestBA, `bred ${r.champion.testBA} must beat single ${r.singleBestTestBA}`);
  assert.ok(r.champion.testBA > 0.99);                 // the conjunction generalises
  assert.equal(r.champion.terms, 2);                   // exactly the two true features
  assert.deepEqual(r.champion.stumps.map((s) => s.feature).sort(), [0, 1]);
  // no overfit: held-out matches train for the champion
  assert.ok(Math.abs(r.champion.testBA - r.champion.trainBA) < 1e-9);
});

test('BREED is deterministic — same data, same champion', () => {
  const a = breed(andDomain(), { generations: 3, keep: 8 });
  const b = breed(andDomain(), { generations: 3, keep: 8 });
  assert.deepEqual(a.champion, b.champion);
  assert.deepEqual(a.history, b.history);
});

test('BREED does NOT claim improvement when it overfits — held-out catches it', () => {
  // on the sparse grid, the train-optimal threshold generalises poorly; the system must report honestly
  const r = breed(sparseAnd(), { generations: 3, keep: 6, maxTerms: 3 });
  assert.equal(r.improvedHeldOut, false);              // held-out BA did NOT beat the best single
  assert.ok(r.champion.trainBA > r.champion.testBA);   // the overfit is visible in the train/test gap
});

// a single-feature signal: y = (x0>=5); one stump already wins, so breeding has nothing to improve
const singleSignal = () => {
  const c = [];
  for (let i = 0; i < 60; i++) c.push({ x: [i % 10, (i * 7) % 10, (i * 3) % 10], y: i % 10 >= 5 ? 1 : 0 });
  return c;
};

test('BREED runs exactly `generations` generations', () => {
  const r = breed(andDomain(), { generations: 3, keep: 8 });
  assert.equal(r.history.length, 3);
  assert.deepEqual(r.history.map((h) => h.gen), [0, 1, 2]);
  const r2 = breed(andDomain(), { generations: 5, keep: 8 });
  assert.equal(r2.history.length, 5);
});

test('BREED respects the maxTerms cap — with maxTerms 1 it cannot form the conjunction', () => {
  const r = breed(andDomain(), { generations: 3, keep: 8, maxTerms: 1 });
  assert.equal(r.champion.terms, 1);       // never extends past 1 term
  assert.equal(r.improvedHeldOut, false);  // so it cannot find the 2-term AND → no improvement
});

test('BREED does not FALSELY claim improvement when a single feature already wins', () => {
  const r = breed(singleSignal(), { generations: 3, keep: 8 });
  assert.ok(r.singleBestTestBA > 0.99);                 // one feature already predicts perfectly
  assert.equal(r.improvedHeldOut, false);               // equal is not an improvement (strict >, not >=)
  assert.ok(Math.abs(r.champion.testBA - r.singleBestTestBA) < 1e-9);
});

test('baCompound coerces a non-array x to [] (not to the raw value)', () => {
  const comp = { stumps: [{ feature: 0, threshold: 0, dir: 1 }] };  // x[0]>=0; on [] reads undefined→0, fires
  // x is a bare number, not an array → must be treated as [] (fires), NOT passed through to predict (which
  // would reject a non-array and return 0). Distinguishes the `&& Array.isArray` guard from an `||` mutant.
  assert.equal(baCompound(comp, [{ x: 5, y: 1 }]), 1);
  assert.equal(baCompound(comp, [{ x: [5], y: 1 }]), 1);            // a real array fires too
});

test('garbage never throws', () => {
  for (const g of [null, undefined, 5, 'x', [{}], [{ x: 'no', y: 2 }]]) {
    assert.doesNotThrow(() => breed(g, {}));
    assert.doesNotThrow(() => baCompound(g, g));
    assert.doesNotThrow(() => predictCompound(g, g));
  }
});
