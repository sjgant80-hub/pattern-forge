# pattern-forge

**Live:** https://sjgant80-hub.github.io/pattern-forge/

The defensible **core** of Pattern organs (#5). Feed it a domain's labelled cases; it proposes simple patterns from a training split and keeps **only** the ones that still predict a **held-out** split — graded by balanced accuracy, a deterministic rule, **never an LLM judge**. A pattern that merely memorised the training noise is rejected on data it never saw. A pattern survives only if it **generalises**.

The live page runs the forge in your browser on two domains — a real signal buried in noise, and an overfit trap — from the gated `pattern.mjs`, with a self-check.

## Proof-of-play

- `pattern.mjs` — one pure kernel. **11 unit tests**, **mutation gate CLEAN (score 1.0, 0 survivors, 0 baselines)**, **fuzz gate CLEAN**.
- **Sealed before measurement:** `predictions.json` (claims) before `run.json` (measured). `ci-verify.mjs` re-derives on GitHub's runner and fails on drift.
- CI: `.github/workflows/ci.yml` (`proof-of-play`): tests + mutation + fuzz + re-derive.

## Measured

| fact | value |
|---|---|
| real signal, held-out balanced accuracy | **1.0** (generalises) |
| non-generalising patterns rejected on held-out | ≥ 1 |
| high-confidence survivors (held-out BA > 0.9) | 1 (the signal) |
| overfit domain survivors | **0** (nothing certified) |

## Honest scope

This ships the held-out, rule-graded **survival test** — the anti-theatre heart. The fuller #5 — an LLM proposing richer patterns, `kard-evolve` breeding the survivors, the observer loop rewriting them, and a pattern book + minted small model + Deck card — are stages on top, flagged, not yet claimed.

Built by **Kar · AI-Native Solutions** (sjgant80-hub).
