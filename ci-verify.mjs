// ci-verify.mjs — re-derive the sealed facts from the witnessed kernel on the runner and prove they
// match predictions.json exactly. predictions.json is committed before run.json; CI recomputes here.
import { forge } from './pattern.mjs';
import { breed } from './breed.mjs';
import { validate, baRule } from './propose.mjs';
import { observe, bestKind, reprioritise, firstSurvivorPosition } from './observer.mjs';
import { readFileSync } from 'node:fs';

// the comparison domain the local model proposed rules for: y = (x0 > x1); x2 noise
export function compareDomain(n = 100) {
  const c = [];
  for (let i = 0; i < n; i++) c.push({ x: [i % 10, Math.floor(i / 10), (i * 7) % 10], y: (i % 10) > Math.floor(i / 10) ? 1 : 0 });
  return c;
}

// a conjunction domain: y = (x0>=5 AND x1>=5); no single feature separates it — breeding must.
export function andDomain(n = 100) {
  const c = [];
  for (let i = 0; i < n; i++) c.push({ x: [i % 10, Math.floor(i / 10), (i * 7) % 10], y: (i % 10 >= 5 && Math.floor(i / 10) >= 5) ? 1 : 0 });
  return c;
}

// the two deterministic domains (kept here, not in the kernel, so the kernel stays pure/witnessed)
export function signalDomain(n = 30) {
  const c = [];
  for (let i = 0; i < n; i++) c.push({ x: [i % 10, (i * 7) % 10, (i * 3 + 1) % 10], y: i % 10 >= 5 ? 1 : 0 });
  return c;
}
export function overfitDomain(n = 30) {
  const c = [];
  for (let i = 0; i < n; i++) { const y = i % 2; c.push({ x: [i % 3, i < 20 ? y : 1 - y], y }); }
  return c;
}

export function derive() {
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const r = forge(signalDomain(30), { holdoutFrac: 1 / 3, bar: 0.75 });
  const sig = r.survivors.find((s) => s.feature === 0);
  const o = forge(overfitDomain(30), { holdoutFrac: 1 / 3, bar: 0.75 });
  const b = breed(andDomain(100), { generations: 3, keep: 8, maxTerms: 3 });
  // the local model's SEALED proposals, validated on held-out (deterministic re-check of a frozen input)
  const proposals = JSON.parse(readFileSync(new URL('./proposals.json', import.meta.url), 'utf8'));
  const v = validate(proposals.rules, compareDomain(100), { holdoutFrac: 1 / 3, bar: 0.9 });
  const champ = v.survivors[0];
  const bestStump = v.graded.filter((g) => g.rule.kind === 'stump').reduce((m, g) => Math.max(m, g.testBA), 0);
  // observer loop: learn a prior from the run, reprioritise, measure how early the survivor is found
  const prior = observe([{ bar: v.bar, graded: v.graded }]);
  const grade = (rule) => baRule(rule, compareDomain(100));
  const unguidedPos = firstSurvivorPosition(proposals.rules, grade, 0.9);
  const guidedPos = firstSurvivorPosition(reprioritise(proposals.rules, prior), grade, 0.9);
  return {
    signalTestBA: sig ? r4(sig.testBA) : 0,
    noiseRejected: r.proposed.filter((s) => s.feature !== 0 && s.testBA < r.bar).length,
    highConfidenceSurvivors: r.survivors.filter((s) => s.testBA > 0.9).length,
    overfitSurvivors: o.survivors.length,
    breedSingleBestTestBA: b.singleBestTestBA,
    breedChampionTestBA: b.champion ? b.champion.testBA : 0,
    breedChampionTerms: b.champion ? b.champion.terms : 0,
    breedImproved: b.improvedHeldOut,
    llmProposed: v.graded.length,
    llmSurvivors: v.survivors.length,
    llmChampionKind: champ ? champ.rule.kind : 'none',
    llmChampionTestBA: champ ? champ.testBA : 0,
    llmBestStumpTestBA: r4(bestStump),
    observerBestKind: bestKind(prior),
    observerUnguidedPos: unguidedPos,
    observerGuidedPos: guidedPos,
  };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('ci-verify.mjs')) {
  const preds = JSON.parse(readFileSync(new URL('./predictions.json', import.meta.url), 'utf8'));
  const m = derive();
  let fail = 0;
  for (const [k, v] of Object.entries(preds.expected)) {
    if (m[k] !== v) { console.error(`MISMATCH ${k}: expected ${v}, got ${m[k]}`); fail++; }
  }
  const holds = (expr) => {
    const { signalTestBA, noiseRejected, highConfidenceSurvivors, overfitSurvivors, breedSingleBestTestBA, breedChampionTestBA, breedChampionTerms, breedImproved, llmProposed, llmSurvivors, llmChampionKind, llmChampionTestBA, llmBestStumpTestBA, observerBestKind, observerUnguidedPos, observerGuidedPos } = m;
    // eslint-disable-next-line no-eval
    try { return !!eval(expr); } catch { return false; }
  };
  for (const c of preds.claims) if (!holds(c.check)) { console.error(`CLAIM FAIL ${c.id}: ${c.check}`); fail++; }
  if (fail) { console.error(`\n${fail} mismatch(es) — the code no longer matches the sealed claims.`); process.exit(1); }
  console.log('✓ re-derived facts match predictions.json exactly; all', preds.claims.length, 'claims hold.');
  console.log(JSON.stringify(m));
}
