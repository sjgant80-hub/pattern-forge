import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelBody, receiptFor, mint, verifyMint, economics, fingerprint } from './mint.mjs';

test('modelBody: a runnable body for each rule form; garbage → ?', () => {
  assert.equal(modelBody({ kind: 'compare', a: 0, b: 1, op: '>' }), 'predict 1 if x0 > x1');
  assert.equal(modelBody({ kind: 'range', feature: 0, lo: 2, hi: 5 }), 'predict 1 if 2 <= x0 <= 5');
  assert.equal(modelBody({ kind: 'stump', feature: 1, threshold: 5, dir: -1 }), 'predict 1 if x1 <= 5');
  assert.equal(modelBody(null), '?');
});

test('receiptFor: BEATS/TIES/LOSES and the certified margin', () => {
  assert.deepEqual(receiptFor(1, 0.77), { kind: 'fallforge-gate-receipt', base: 0.77, candidate: 1, verdict: 'BEATS', certified: true });
  assert.equal(receiptFor(0.8, 0.75).certified, false);   // margin 0.05 < 0.1 → not certified
  assert.equal(receiptFor(0.5, 0, 0.5).certified, true);   // margin EXACTLY 0.5 → certified (>=, not >)
  assert.equal(receiptFor(0.7, 0.7).verdict, 'TIES');
  assert.equal(receiptFor(0.6, 0.8).verdict, 'LOSES');
});

test('MINT: the pattern-forge classifier (x0>x1) mints — it beats its base, certified', () => {
  const m = mint({ kind: 'compare', a: 0, b: 1, op: '>' }, 1, 0.7684);  // held-out 1.0 vs best stump 0.7684
  assert.equal(m.minted, true);                 // certified BEATS → minted (fallforgemint's own rule)
  assert.equal(m.body, 'predict 1 if x0 > x1');
  assert.ok(m.bytes > 0 && m.bytes < 40);       // a tiny, owned model — bytes, not gigabytes
  assert.equal(m.heldOut, 1);
  assert.equal(m.receipt.verdict, 'BEATS');
  assert.ok(verifyMint(m));                      // fingerprint matches the body
  assert.equal(verifyMint({ ...m, body: 'predict 1 if x0 < x1' }), false);  // tampered body → fails
});

test('MINT: a classifier that does NOT beat its base is NOT minted', () => {
  const m = mint({ kind: 'stump', feature: 0, threshold: 5, dir: 1 }, 0.77, 0.77);  // ties the base
  assert.equal(m.minted, false);
  assert.equal(m.receipt.verdict, 'TIES');
});

test('economics: fallforgemint own-vs-rent favours owning the tiny local model on a real workload', () => {
  const e = economics({ callsPerMonth: 100000, tokensPerCall: 50, rentPerMillion: 3, setupCost: 0, runPerMonth: 0 });
  assert.equal(e.ok, true);
  assert.equal(e.verdict, 'OWN_WINS');          // owning (local, free to run) beats renting per token
  assert.ok(e.monthlySaving > 0);
});

test('fingerprint / verify: deterministic, exact, and total', () => {
  assert.equal(fingerprint('predict 1 if x0 > x1'), '1b64e2ed');   // exact — pins the full scan (no off-by-one)
  assert.equal(fingerprint('x'), fingerprint('x'));
  assert.notEqual(fingerprint('a'), fingerprint('b'));
  for (const g of [null, undefined, 5, {}, []]) { assert.doesNotThrow(() => mint(g, 1, 0.5)); assert.equal(verifyMint(g), false); }
  assert.equal(verifyMint({ body: 123, fingerprint: 'x' }), false);        // non-string body → false
  assert.equal(verifyMint({ body: 'predict 1 if x0 > x1', fingerprint: 5 }), false); // non-string fp → false
  assert.equal(economics(null).ok, false);
});
