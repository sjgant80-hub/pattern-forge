// ci-verify.mjs — re-derive the sealed facts from the witnessed kernel on the runner and prove they
// match predictions.json exactly. predictions.json is committed before run.json; CI recomputes here.
import { forge } from './pattern.mjs';
import { breed } from './breed.mjs';
import { readFileSync } from 'node:fs';

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
  return {
    signalTestBA: sig ? r4(sig.testBA) : 0,
    noiseRejected: r.proposed.filter((s) => s.feature !== 0 && s.testBA < r.bar).length,
    highConfidenceSurvivors: r.survivors.filter((s) => s.testBA > 0.9).length,
    overfitSurvivors: o.survivors.length,
    breedSingleBestTestBA: b.singleBestTestBA,
    breedChampionTestBA: b.champion ? b.champion.testBA : 0,
    breedChampionTerms: b.champion ? b.champion.terms : 0,
    breedImproved: b.improvedHeldOut,
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
    const { signalTestBA, noiseRejected, highConfidenceSurvivors, overfitSurvivors, breedSingleBestTestBA, breedChampionTestBA, breedChampionTerms, breedImproved } = m;
    // eslint-disable-next-line no-eval
    try { return !!eval(expr); } catch { return false; }
  };
  for (const c of preds.claims) if (!holds(c.check)) { console.error(`CLAIM FAIL ${c.id}: ${c.check}`); fail++; }
  if (fail) { console.error(`\n${fail} mismatch(es) — the code no longer matches the sealed claims.`); process.exit(1); }
  console.log('✓ re-derived facts match predictions.json exactly; all', preds.claims.length, 'claims hold.');
  console.log(JSON.stringify(m));
}
