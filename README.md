# pattern-forge

**Live:** https://sjgant80-hub.github.io/pattern-forge/

The defensible **core** of Pattern organs (#5). Feed it a domain's labelled cases; it proposes simple patterns from a training split and keeps **only** the ones that still predict a **held-out** split — graded by balanced accuracy, a deterministic rule, **never an LLM judge**. A pattern that merely memorised the training noise is rejected on data it never saw. A pattern survives only if it **generalises**.

It then **breeds** survivors into compound patterns, and validates the **local model's own proposals** on held-out (a sovereign qwen running on your metal proposes; the gate keeps only what generalises). The live page runs it in your browser on four domains (a real signal in noise, an overfit trap, a conjunction, and a feature-comparison the model proposed) from the gated kernels, with a self-check.

## Proof-of-play

- `pattern.mjs` (find) + `breed.mjs` (improve) + `propose.mjs` (validate the local model's proposals) + `observer.mjs` (learn which forms generalise) + `book.mjs` (compile the catalog) + `mint.mjs` (mint the owned model) — pure kernels. **43 unit tests**, **mutation gate CLEAN** (pattern/propose/observer/book/mint score 1.0; breed.mjs 1 argued-equivalent baselined), **fuzz gate CLEAN**.
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
| local model proposes x0>x1; held-out keeps it (stumps fail) | **1.0** vs best stump 0.77 |
| observer reprioritises; winner found at | **position 1** (vs 3 unguided) |
| pattern book: generalising patterns cataloged | **3** (x0≥5 · x0≥5 AND x1≥5 · x0>x1) |
| minted model: owned, tiny, gated by fallforgemint | **20 bytes · MINTED · OWN_WINS** |

## Honest scope

This ships the held-out survival test (the anti-theatre heart), the **self-improvement step** (breeding), and the **sovereign LLM-proposal step** (the local model proposes; the gate keeps what generalises), the **observer loop** (learns which forms generalise and reprioritises), and the **pattern book** (a generated, shippable catalog of every validated pattern, `book.md`). It mints the classifier as an owned, tiny model (gated by fallforgemint&rsquo;s own rule) and ships a FallWorld Deck card. The full #5 pattern organ is COMPLETE: find → breed → propose → observe → book → mint. See VENDOR.md for the fallforgemint credit.

Built by **Kar · AI-Native Solutions** (sjgant80-hub).
