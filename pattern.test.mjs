import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitCases, predict, balancedAccuracy, proposeStumps, forge } from './pattern.mjs';

// deterministic domain: feature 0 is the REAL signal (y === (x0 >= 5)); features 1,2 are noise.
function dataset(n = 30) {
  const cases = [];
  for (let i = 0; i < n; i++) {
    const x0 = i % 10;                 // 0..9, the signal
    const x1 = (i * 7) % 10;           // unrelated noise
    const x2 = (i * 3 + 1) % 10;       // unrelated noise
    cases.push({ x: [x0, x1, x2], y: x0 >= 5 ? 1 : 0 });
  }
  return cases;
}

test('splitCases: deterministic, disjoint, covers every case', () => {
  const cases = dataset(30);
  const { train, test } = splitCases(cases, 1 / 3);
  assert.equal(train.length + test.length, 30);
  assert.ok(test.length > 0 && train.length > 0);
  // deterministic — same split every time
  const again = splitCases(cases, 1 / 3);
  assert.deepEqual(again.test, test);
  assert.deepEqual(splitCases(null, 1 / 3), { train: [], test: [] });
});

test('predict / balancedAccuracy on a known stump', () => {
  const s = { feature: 0, threshold: 5, dir: 1 };     // positive when x0 >= 5
  assert.equal(predict(s, [5, 0, 0]), 1);
  assert.equal(predict(s, [4, 9, 9]), 0);
  assert.equal(predict(s, 'x'), 0);                   // garbage → 0
  const cases = dataset(30);
  assert.equal(balancedAccuracy(s, cases), 1);        // the signal stump is perfect
  assert.equal(balancedAccuracy(s, []), 0);
});

test('proposeStumps: finds the separating threshold on the signal feature', () => {
  const { train } = splitCases(dataset(30), 1 / 3);
  const stumps = proposeStumps(train);
  assert.equal(stumps.length, 3);                     // one best stump per feature
  const f0 = stumps.find((s) => s.feature === 0);
  assert.ok(f0.trainBA > 0.99);                       // feature 0 separates train perfectly
  assert.equal(f0.dir, 1);
  assert.ok(f0.threshold >= 5 && f0.threshold <= 6);
  assert.deepEqual(proposeStumps([]), []);
});

test('FORGE keeps the generalising pattern and rejects noise on held-out', () => {
  const r = forge(dataset(30), { holdoutFrac: 1 / 3, bar: 0.75 });
  assert.equal(r.proposed.length, 3);
  // the signal feature survives with a near-perfect HELD-OUT score
  const top = r.survivors[0];
  assert.equal(top.feature, 0);
  assert.ok(top.testBA > 0.99, `signal held-out BA ${top.testBA} must be ~1`);
  // at least one noise feature was proposed but did NOT survive the held-out bar
  const rejected = r.proposed.filter((s) => s.feature !== 0 && s.testBA < r.bar);
  assert.ok(rejected.length >= 1, 'a noise pattern must be rejected by held-out');
  // and the signal is the ONLY high-confidence survivor
  assert.equal(r.survivors.filter((s) => s.testBA > 0.9).length, 1);
});

test('FORGE: overfit is caught — a train-only pattern fails the held-out bar', () => {
  // feature 0 noise, but feature 1 == label ONLY on the first (training-heavy) half → overfit trap
  const cases = [];
  for (let i = 0; i < 30; i++) {
    const y = i % 2;                       // alternating label, no real signal in x0
    const x1 = i < 20 ? y : (1 - y);       // matches label early (train), inverts late (test)
    cases.push({ x: [i % 3, x1], y });
  }
  const r = forge(cases, { holdoutFrac: 1 / 3, bar: 0.75 });
  // nothing should clear a 0.75 held-out bar — there is no generalising pattern
  assert.equal(r.survivors.length, 0, 'no pattern generalises, so none may survive');
});

test('splitCases: index 0 goes to the held-out set; invalid holdoutFrac falls back to 1/3', () => {
  const cases = dataset(30);
  const { test: t } = splitCases(cases, 1 / 3);
  assert.equal(t[0].x[0], 0);                         // case index 0 (x0===0) is the first held-out
  for (const bad of [0, 1, -1, 2, 'x', NaN, null]) {
    assert.deepEqual(splitCases(cases, bad), splitCases(cases, 1 / 3));  // fallback to 1/3
  }
});

test('predict: guards and the dir=-1 boundary are exact', () => {
  assert.equal(predict(null, [5]), 0);               // null stump → 0, never throws
  assert.equal(predict({ feature: 0, threshold: 5, dir: 1 }, null), 0);
  assert.equal(predict({ feature: 0, threshold: 5, dir: -1 }, [5]), 1);  // v<=t at equality
  assert.equal(predict({ feature: 0, threshold: 5, dir: -1 }, [6]), 0);
  assert.equal(predict({ feature: 0, threshold: 5, dir: 1 }, [5]), 1);   // v>=t at equality
});

test('labels accept 1/true; invalid bar falls back to 0.6', () => {
  const s = { feature: 0, threshold: 1, dir: 1 };
  assert.equal(balancedAccuracy(s, [{ x: [1], y: true }, { x: [0], y: 0 }]), 1); // y:true counts positive
  const r = forge(dataset(30), { bar: 'x' });          // invalid bar → 0.6
  assert.equal(r.bar, 0.6);
});

test('proposeStumps: on a genuine tie, the FIRST stump (dir +1) is kept, deterministically', () => {
  // non-monotonic data: (t=1,dir+1) and (t=1,dir-1) both score BA 0.75 — a real tie at the max.
  const train = [{ x: [0], y: 0 }, { x: [1], y: 1 }, { x: [2], y: 0 }];
  const [s] = proposeStumps(train);
  assert.equal(s.feature, 0);
  assert.equal(s.threshold, 1);
  assert.equal(s.dir, 1);                              // first-encountered wins the tie, not the later
  assert.ok(Math.abs(s.trainBA - 0.75) < 1e-9);
});

test('forge: the survivor bar is inclusive — a pattern exactly AT the bar still survives', () => {
  const r = forge(dataset(30), { holdoutFrac: 1 / 3, bar: 1 });  // signal's held-out BA is exactly 1
  assert.ok(r.survivors.some((s) => s.feature === 0), 'testBA===bar must pass (>=, not >)');
});

test('garbage never throws', () => {
  for (const g of [null, undefined, 5, 'x', [{}], [{ x: 'no', y: 2 }]]) {
    assert.doesNotThrow(() => forge(g, {}));
    assert.doesNotThrow(() => proposeStumps(g));
    assert.doesNotThrow(() => balancedAccuracy(g, g));
  }
});
