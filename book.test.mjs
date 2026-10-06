import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRule, compileBook, bookToMarkdown } from './book.mjs';

test('renderRule: every rule form, compounds, and garbage', () => {
  assert.equal(renderRule({ kind: 'stump', feature: 0, threshold: 5, dir: 1 }), 'x0 ≥ 5');
  assert.equal(renderRule({ kind: 'stump', feature: 1, threshold: 3, dir: -1 }), 'x1 ≤ 3');
  assert.equal(renderRule({ kind: 'compare', a: 0, b: 1, op: '>' }), 'x0 > x1');
  assert.equal(renderRule({ kind: 'compare', a: 1, b: 2, op: '<' }), 'x1 < x2');
  assert.equal(renderRule({ kind: 'range', feature: 0, lo: 2, hi: 5 }), '2 ≤ x0 ≤ 5');
  assert.equal(renderRule([{ feature: 0, threshold: 5, dir: 1 }, { feature: 1, threshold: 5, dir: 1 }]), 'x0 ≥ 5 AND x1 ≥ 5');
  assert.equal(renderRule(null), '?');
  assert.equal(renderRule({ kind: 'what' }), '?');
  // the kind-less stump fallback needs BOTH feature AND threshold — half a rule is not a stump
  assert.equal(renderRule({ feature: 0 }), '?');
  assert.equal(renderRule({ threshold: 5 }), '?');
  assert.equal(renderRule({ feature: 0, threshold: 5 }), 'x0 ≥ 5');   // both present → renders
});

test('compileBook: only generalising patterns make the book, rendered + evidence-stamped', () => {
  const entries = [
    { domain: 'signal', rule: { kind: 'stump', feature: 0, threshold: 5, dir: 1 }, trainBA: 1, testBA: 1, bar: 0.75, source: 'forge' },
    { domain: 'conjunction', rule: [{ feature: 0, threshold: 5, dir: 1 }, { feature: 1, threshold: 5, dir: 1 }], trainBA: 1, testBA: 1, bar: 0.75, source: 'breed' },
    { domain: 'comparison', rule: { kind: 'compare', a: 0, b: 1, op: '>' }, trainBA: 1, testBA: 1, bar: 0.9, source: 'local qwen2.5:7b' },
    { domain: 'noise', rule: { kind: 'stump', feature: 2, threshold: 0, dir: 1 }, trainBA: 0.55, testBA: 0.5, bar: 0.75, source: 'forge' },
  ];
  const book = compileBook(entries);
  assert.equal(book.length, 3);                       // the noise entry (0.5 < 0.75) is excluded
  assert.deepEqual(book.map((b) => b.domain), ['signal', 'conjunction', 'comparison']);
  assert.equal(book[1].pattern, 'x0 ≥ 5 AND x1 ≥ 5');
  assert.equal(book[2].pattern, 'x0 > x1');
  assert.equal(book[2].source, 'local qwen2.5:7b');
  assert.ok(book.every((b) => b.heldOut >= b.bar));   // every booked pattern cleared its own bar
});

test('compileBook: garbage never throws, non-generalisers never slip in', () => {
  for (const g of [null, undefined, 5, 'x', [null, {}]]) assert.doesNotThrow(() => compileBook(g));
  assert.deepEqual(compileBook([]), []);
  // a pattern exactly AT the bar is in; just under is out
  assert.equal(compileBook([{ domain: 'd', rule: { kind: 'stump', feature: 0, threshold: 1, dir: 1 }, testBA: 0.75, bar: 0.75 }]).length, 1);
  assert.equal(compileBook([{ domain: 'd', rule: { kind: 'stump', feature: 0, threshold: 1, dir: 1 }, testBA: 0.74, bar: 0.75 }]).length, 0);
});

test('bookToMarkdown: a shippable table', () => {
  const md = bookToMarkdown(compileBook([{ domain: 'comparison', rule: { kind: 'compare', a: 0, b: 1, op: '>' }, testBA: 1, bar: 0.9, source: 'local qwen2.5:7b' }]));
  assert.ok(md.startsWith('# Pattern book'));
  assert.ok(md.includes('`x0 > x1`'));
  assert.ok(md.includes('local qwen2.5:7b'));
  assert.doesNotThrow(() => bookToMarkdown(null));
});
