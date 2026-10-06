# pattern-forge

**Live:** https://sjgant80-hub.github.io/pattern-forge/

The defensible **core** of Pattern organs (#5). Feed it a domain's labelled cases; it proposes simple patterns from a training split and keeps **only** the ones that still predict a **held-out** split — graded by balanced accuracy, a deterministic rule, **never an LLM judge**. A pattern that merely memorised the training noise is rejected on data it never saw. A pattern survives only if it **generalises**.

It then **breeds** the survivors into compound patterns that beat any single feature on held-out — the "improves itself" half. The live page runs it in your browser on three domains (a real signal in noise, an overfit trap, and a conjunction no single feature catches) from the gated kernels, with a self-check.

## Proof-of-play

- `pattern.mjs` (find) + `breed.mjs` (improve) — pure kernels. **21 unit tests**, **mutation gate CLEAN** (pattern.mjs score 1.0; breed.mjs 1 argued-equivalent baselined), **fuzz gate CLEAN**.
- **Sealed before measurement:** `predictions.json` (claims) before `run.json` (measured). `ci-verify.mjs` re-derives on GitHub's runner and fails on drift.
- CI: `.github/workflows/ci.yml` (`proof-of-play`): tests + mutation + fuzz + re-derive.

## Measured

| fact | value |
|---|---|
| real signal, held-out balanced accuracy | **1.0** (generalises) |
| non-generalising patterns rejected on held-out | ≥ 1 |
| high-confidence survivors (held-out BA > 0.9) | 1 (the signal) |
| overfit domain survivors | **0** (nothing certified) |
| breeding: best single vs bred compound (held-out) | **0.827 → 1.0** (finds the conjunction) |

## Honest scope

This ships the held-out, rule-graded **survival test** (the anti-theatre heart) AND the **self-improvement step** — breeding survivors into compound patterns that beat any single feature on held-out, selecting on train and judged on held-out. The remaining #5 stages — an LLM proposing richer candidate patterns, the observer loop, and a pattern book + minted small model + FallWorld Deck card — are flagged, not yet claimed.

Built by **Kar · AI-Native Solutions** (sjgant80-hub).
