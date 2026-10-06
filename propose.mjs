// propose.mjs — richer candidate patterns + held-out validation (Pattern organs #5, the "LLM proposes"
// stage). The local model proposes patterns in three forms the stump-enumeration cannot express:
//   · stump    { kind:'stump',   feature, threshold, dir }   x[f] ≥ t  (dir -1 → ≤)
//   · compare  { kind:'compare', a, b, op }                  x[a] > x[b]  (or <)   ← no single stump catches this
//   · range    { kind:'range',   feature, lo, hi }           lo ≤ x[f] ≤ hi
// Whatever the model proposes, a pattern SURVIVES only if it predicts a HELD-OUT split above the bar,
// graded by balanced accuracy. Pure, deterministic, never throws on garbage.

import { splitCases } from './pattern.mjs';

const num = (x) => (Number.isFinite(x) ? x : 0);
const at = (x, i) => (Array.isArray(x) ? num(x[i]) : 0);

/** evaluate a rule on a feature vector → 0 or 1. Unknown kind / garbage → 0. */
export function evalRule(rule, x) {
  if (!rule || typeof rule !== 'object') return 0;
  if (rule.kind === 'stump') {
    const v = at(x, rule.feature), t = num(rule.threshold);
    return (rule.dir === -1 ? v <= t : v >= t) ? 1 : 0;
  }
  if (rule.kind === 'compare') {
    const a = at(x, rule.a), b = at(x, rule.b);
    return (rule.op === '<' ? a < b : a > b) ? 1 : 0;
  }
  if (rule.kind === 'range') {
    const v = at(x, rule.feature);
    return (v >= num(rule.lo) && v <= num(rule.hi)) ? 1 : 0;
  }
  return 0;
}

/** balanced accuracy of a rule on cases, in [0,1]. */
export function baRule(rule, cases) {
  if (!Array.isArray(cases) || cases.length === 0) return 0;
  let tp = 0, fn = 0, tn = 0, fp = 0;
  for (const c of cases) {
    const y = (c && (c.y === 1 || c.y === true)) ? 1 : 0;
    const p = evalRule(rule, c && c.x);
    if (y === 1) { if (p === 1) tp++; else fn++; } else { if (p === 0) tn++; else fp++; }
  }
  const sens = (tp + fn) === 0 ? 1 : tp / (tp + fn);
  const spec = (tn + fp) === 0 ? 1 : tn / (tn + fp);
  return (sens + spec) / 2;
}

/** VALIDATE a list of PROPOSED rules: grade each on train + held-out; keep those whose held-out BA >= bar.
 *  Returns { trainN, testN, bar, graded:[{rule,trainBA,testBA}], survivors (held-out desc) }. */
export function validate(rules, cases, { holdoutFrac = 1 / 3, bar = 0.75 } = {}) {
  const { train, test } = splitCases(cases, holdoutFrac);
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const list = Array.isArray(rules) ? rules : [];
  const graded = list.map((rule) => ({ rule, trainBA: r4(baRule(rule, train)), testBA: r4(baRule(rule, test)) }));
  const b = Number.isFinite(bar) ? bar : 0.75;
  const survivors = graded.filter((g) => g.testBA >= b).sort((x, y) => y.testBA - x.testBA);
  return { trainN: train.length, testN: test.length, bar: b, graded, survivors };
}
