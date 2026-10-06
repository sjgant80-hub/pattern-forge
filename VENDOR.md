# Vendored — provenance & credit

- `vendor/fallforgemint/kernel.mjs` — the mint kernel of **FallForge Mint**
  (https://sjgant80-hub.github.io/fallforgemint/, AI-Native Solutions / Simon Gant), copied **unchanged**
  from `sjgant80-hub/fallforgemint` at pinned commit `2db5257bd79562679a908573f4489d2ccc580aa8`.
  `mint.mjs` uses its real `mintVerdict` (a node mints only on a certified BEATS receipt) and `ownVsRent`
  (the honest own-vs-rent economics). fallforgemint is a self-contained product and is **not modified** by
  this repo — only its kernel is vendored, credited, and pinned.

- `proposals.json` — the local model's (qwen2.5:7b, via Ollama) frozen candidate rules, proposed from 12
  sample cases on 2026-10-06; a sealed input, validated deterministically by `propose.mjs`.
