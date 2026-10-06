// observer.mjs — the observer loop (Pattern organs #5, "improves itself" at the meta level).
//
// The forge validates proposals domain by domain. The observer WATCHES those runs and learns which rule
// FORMS tend to generalise (survive held-out). It writes that into a prior, then reprioritises future
// proposals so the historically-winning forms are tried first — the generalising rule surfaces earlier,
// with fewer held-out evaluations. Pure, deterministic, never throws.

/** observe past validation runs → a prior: kind → survival rate (survivors / proposals of that kind).
 *  A run is { graded:[{rule:{kind}, testBA}], bar }. Kinds never seen get no entry. */
export function observe(runs) {
  const seen = {}, won = {};
  for (const run of (Array.isArray(runs) ? runs : [])) {
    const bar = Number.isFinite(run?.bar) ? run.bar : 0.75;
    for (const g of (Array.isArray(run?.graded) ? run.graded : [])) {
      const kind = typeof g?.rule?.kind === 'string' ? g.rule.kind : '';
      if (kind === '') continue;
      seen[kind] = (seen[kind] || 0) + 1;
      if (Number.isFinite(g?.testBA) && g.testBA >= bar) won[kind] = (won[kind] || 0) + 1;
    }
  }
  const prior = {};
  for (const kind of Object.keys(seen)) prior[kind] = won[kind] ? won[kind] / seen[kind] : 0;
  return prior;
}

/** a finite survival rate for a kind under a prior, defended against a toxic getter; else 0. */
function rateOf(prior, kind) {
  try { const n = Number(prior?.[kind]); return Number.isFinite(n) ? n : 0; } catch { return 0; }
}

/** the kind the observer rates highest (most likely to generalise); ties keep the first-seen kind. '' if none. */
export function bestKind(prior) {
  if (!prior || typeof prior !== 'object') return '';
  let best = '';
  for (const k of Object.keys(prior)) {
    if (best === '' || rateOf(prior, k) > rateOf(prior, best)) best = k;
  }
  return best;
}

/** reprioritise candidate rules by the prior: higher survival-rate kinds first. Stable within a kind,
 *  so the model's original order is preserved among equals. Returns a new array. */
export function reprioritise(rules, prior) {
  const list = Array.isArray(rules) ? rules.slice() : [];
  return list
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rateOf(prior, a.r?.kind) === rateOf(prior, b.r?.kind)
      ? a.i - b.i                                             // equal rate → original order (stable)
      : rateOf(prior, b.r?.kind) - rateOf(prior, a.r?.kind))  // else higher rate first
    .map((x) => x.r);
}

/** 1-indexed position of the first rule whose held-out score clears the bar, scanning the given order.
 *  gradeOf(rule) must return the rule's held-out balanced accuracy. 0 if none clears the bar. */
export function firstSurvivorPosition(rules, gradeOf, bar = 0.75) {
  if (typeof gradeOf !== 'function') return 0;
  const list = Array.isArray(rules) ? rules : [];
  const b = Number.isFinite(bar) ? bar : 0.75;
  for (let i = 0; i < list.length; i++) {
    let s; try { s = gradeOf(list[i]); } catch { s = NaN; }
    if (Number.isFinite(s) && s >= b) return i + 1;
  }
  return 0;
}
