# 65 — Format-operation matrix coverage gate

**What to build:** Materialize `docs/11-format-operation-matrix.md` as a machine-readable coverage report so every high-priority compression/conversion direction is classified as implemented, spike-blocked or deliberately refused with a reason, and no advertised route lacks verified output/fidelity evidence.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1, AC-09.1, AC-10.1; DEC-EXP-01, DEC-EXP-05, DEC-EXP-06, DEC-EXP-07; C-EXP-01, C-EXP-02, C-EXP-08

**Constraints:** “Refused” is valid when fidelity/local feasibility is poor; silent omission is not. Coverage must not reward adding combinatorial low-value routes.

**Blocked by:** 47, 48, 49, 51, 52, 53, 54, 55, 56, 57, 58, 59, 67, 68, 108, 109.

**Status:** completed

- [x] Every high-priority matrix row has route/tool evidence, an active blocker, or a documented refusal.
- [x] Every implemented conversion verifies output signature/type and declares fidelity loss.
- [x] Every compressor reports actual before→after bytes and target-size truthfulness.

**Verification:** CI coverage generator fails on unclassified high-priority rows, missing route evidence, or unsupported claims.

**2026-10-10 acceptance evidence:** `quality/format-operations/registry.json` +
`coverage.json` + `coverage-report.json` classify all **63** high-priority
directional rows: **41** technically implemented within the documented input
subset, **16** blocked and **6** explicitly refused. The `format:coverage:check`
command is now a dependency of `npm test`, `npm run check`, and `npm run build`;
it rejects missing/duplicate/untracked rows, absent executable engine/test/route
evidence, invented output checks, forged byte/signature/reopen receipts,
unjustified refusals and missing binary direction proofs. One verified production
refusal was previously mislabeled implementation in each of #207 JPEG,
#207 WebP, #208 PNG lossy palette, #222 ZIP DEFLATE and #223 GZIP; all five
have explicit reason/source corrections, without introducing phantom downloads.

`tests/format-operation-coverage-65.browser.mjs --write` ran 23 real local
Chromium operations covering all **21 distinct image/PDF directional IDs**;
each observed actual encoded bytes, MIME/header signatures and an independent
bitmap/PDF reopen. `conversion-output-proof.json` is the machine-verifiable
binary receipt. Existing `scripts/acceptance-conversion-matrix.mjs` separately
checks multi-page PDF ZIP packaging; office and spreadsheet semantic exports
retain explicit `engine-only` exposure, never invented public routes.
`tests/format-operation-coverage-65.test.ts` includes a generated *real*
lossless PNG example independently decoded with Sharp (RGBA byte equality,
final output bytes and true/false exact ceiling), together with sabotage of
missing directions, fake routes, bogus proof and refusal omissions.
Other accepted engines are exercised by `tests/image-compression-47.test.ts`,
`tests/pdf-target-batch-219.test.ts`, `tests/ooxml-media-264.test.ts`,
`tests/office-downstream.test.ts`, and `tests/spreadsheet-interchange.test.ts`.
**47/47 focused tests PASS**, `npx tsc --noEmit` PASS, the machine report gate
PASS. These are engineering contracts for bounded supported inputs. All four
HEIC source conversion rows have explicit **`releaseEligible: false`**:
the browser corpus uses synthetic HEIC; genuine iPhone-origin media and
physical #280/#281 acceptance remain unverified. No physical Gold, full
codec uniformity, or universal compression-to-target guarantee is claimed.
