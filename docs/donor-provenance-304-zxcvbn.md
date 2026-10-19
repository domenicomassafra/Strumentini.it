# STR-304 — password-strength-estimator / zxcvbn-ts (2026-10-19)

## Decision and origin

**ADOTTA** the `ZxcvbnFactory` scorer, with a lazy, cancellable, same-origin browser Worker and the existing heuristic estimator retained as the fallback/rollback path. The final score is the more conservative (lower) of the old and donor scores. The donor response never enters persisted state, telemetry, console or result payloads with password or matched substrings; only score and pattern *types* cross the Worker boundary. Network/breach lookup is absent. The page requests the bundled Worker only after an explicit estimate; it never sends password input to an API.

| Package | Source commit (`gitHead` of published package) | npm version | npm SHA-512 `dist.integrity` | License |
| --- | --- | --- | --- | --- |
| [`@zxcvbn-ts/core`](https://github.com/zxcvbn-ts/zxcvbn) | `642ef8f0c40d8267e9fc2d4de29ab2691e87a10e` | `4.2.0` | `sha512-tuwzwOcYVca9MufHuUvzKGRyL04iP52OjCNoRDuGXjzzrtPiPcl8r5QtOotbx0AyTR/CMcDTU9qLkN16b9fXiw==` | MIT |
| [`@zxcvbn-ts/language-common`](https://github.com/zxcvbn-ts/zxcvbn) | `c938c0b2df389c481cf15c103ca640c17d4e978f` | `4.1.3` | `sha512-g2bg4skmlJG9aJqC/nWziZzgYpSe/f3rKeGobrkdFiOrfZVFqqzUgC6BUQWuX54Sua9j0Jxxt+1bf4f/Mal1Kg==` | MIT |
| [`fastest-levenshtein`](https://github.com/ka-weihe/fastest-levenshtein) (transitive) | npm source package | `1.0.16` | `sha512-eRnCtTTtGZFpQCwhJiUOuxPQWRXVKYDn0b2PeHfXL6/Zi53SLAzAHfVhVWK2AryC/WH05kGfxhFIPvTF0SXQzg==` | MIT |
| [`@zxcvbn-ts/dictionary-compression`](https://github.com/zxcvbn-ts/dictionary-compression) (transitive) | npm source package | `3.0.1` | `sha512-p3KyPzxGc3vWSap5hHA6SllbUCmh7s+NtpGyC3qEWrxYJT9t9TUAzjPm48Okipo+UUyPQfDlIvTcs9JRShBFiQ==` | MIT |

The exact package versions and integrity hashes are pinned by `package-lock.json`. MIT notices remain in the distributed packages (`LICENSE.txt`); distribution clearance and the broader asset/license gate in #126 remain in force. No certification promotion, production deployment or production release is implied by this integration.

## Dictionary and rights gate

The tested [`@zxcvbn-ts/language-it@4.1.1`](https://github.com/zxcvbn-ts/zxcvbn) includes a derived **OpenSubtitles 2024 / OPUS dataset, ODC-BY**, and requires retention of its `NOTICE.md` on redistribution. It was **not adopted** (and is absent from the final lockfile). Its complete dictionary increased the local test's heap usage and scoring latency. The selected Italian words come solely from the existing, locally curated `src/reference-data/italian-passphrase-v1.ts` (`it-passphrase-2026-10-v1`); the donor English/common-password list is bounded to the first 5,000 ranked words of `passwords-common`. There is no downloaded user-specific dictionary, external query or breach dataset. The package's common dictionaries are MIT; no additional asset notice was present in the published `language-common` package.

## Behavior and rollback

- Original API: `estimatePasswordStrength(password)` unchanged and sync; tested length, classes, repeated blocks, repetitions, sequences and common patterns retained.
- New API: `estimatePasswordStrengthWithDonor(password, signal?)`; lazy Worker, abort via `terminate`, browser error fallback to the original result, Node integration via dynamic import. Runtime `run` uses the new API. An already-aborted request and values over **1,024 Unicode code points** reject before loading the donor.
- zxcvbn-ts caps its own inspection at **256 UTF-16 code units** to bound expensive matcher work; the original estimator continues to examine all 1,024 code points. This limitation is disclosed in the result. No score increase over the existing estimator is possible.
- Rollback: restore `module.run` and `PasswordStrengthEstimatorTool` to call `estimatePasswordStrength`; then remove the donor Worker, donor core and pinned npm packages in a new PR. The old estimator is intentionally preserved in the source.
- Environment: static Astro/Vite output with same-origin module Worker in Chromium, Firefox and WebKit; no Worker or server endpoint is necessary for the fallback. CSP must permit `worker-src 'self'` (or the browser's same-origin fallback).

## Differential benchmark (Mac Studio, Node v24.18.0, 2026-10-19)

Synthetic vectors included repeated characters, patterned strings, random-looking strings, common password structures, Italian phrases and a 1,024-code-point Unicode case. The comparison records **only aggregate timings and counts**, never actual user passwords or raw donor matches. Environment is a local CPU test, not a mobile-device performance claim.

| Configuration | Initialization | Mean per check | Max observed check | Heap change |
| --- | ---: | ---: | ---: | ---: |
| Full `core + language-common + language-it` (10 vectors) | 993 ms | ~732 ms | ~2,173 ms | ~22 MiB |
| `core + language-common` (first 5,000 common passwords) + 128 curated Italian words (7 vectors) | ~7 ms | ~42 ms | ~264 ms | ~2 MiB |

The second variant is adopted to keep the detector practical and avoid the ODC-BY dataset. Heap changes are Node `heapUsed` differences, **not process peak RSS**. Browser memory and latencies depend on browser/hardware; browser smoke tests should accompany release checks. Bundle transfer impact is evaluated separately by the build. The prior heuristic remains available if the donor fails to initialize in a browser.

**Peak sample** (`node --expose-gc --import tsx`, same seven public synthetic vectors): prior heuristic mean 9.3 ms, maximum 34.8 ms, observed peak `heapUsed` 12.1 MiB and RSS 90.7 MiB; selected donor mean 53.4 ms, maximum 211.2 ms, observed peak `heapUsed` 15.4 MiB and RSS 102.9 MiB. These are process-level observations (Node with tooling loaded), not isolation of the package or a hardware-wide memory guarantee. The browser Worker keeps this computation off the UI thread.

**Static build footprint** (`npm run build`): `donor-worker-*.js` 462,085 bytes raw / 236,901 bytes gzip; `donor-core.*.js` 460,795 bytes raw / 236,169 bytes gzip (only the Node/no-Worker dynamic path imports this chunk); page `PasswordStrengthEstimatorTool.*.js` 2,700 bytes raw / 1,429 bytes gzip. These values exclude ordinary shared framework chunks. No third-party request is needed; both lazy chunks are emitted under `dist/_astro/`.
