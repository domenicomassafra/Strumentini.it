# 204 — EAN-13 and Code-128 barcode generator

**What to build:** Add local barcode generation with strict format/checksum validation, readable human text option and clean raster/vector download only for formats the chosen implementation verifies.

**Traces to:** US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-module-design → code-typescript → code-tdd → qa-browser

- [x] EAN-13 check digit is validated/generated under explicit mode.
- [x] Code-128 supported character set is documented.
- [x] Downloaded barcode decodes in an independent verifier fixture.

**Verification:** Known barcode vectors and independent decode checks.

Evidence (2026-10-06): `src/engines/barcode/index.ts` implements strict EAN-13 generate (exactly 12 digits → calculated check digit) and validate (exactly 13 digits → supplied versus calculated check digit) modes. Code 128 is deliberately limited to Code Set B printable ASCII U+0020–U+007E, maximum 80 characters; FNC, Code A/C, set switching, GS1-128, controls and Unicode are explicitly unsupported. `quality/fixtures/barcode-linear/vectors.json` binds the GS1 ISBN-derived EAN vector `9780471384298` and hand-worked Code 128 B codewords/checksum. `tests/barcode-generator.test.ts` reconstructs module bits from the generated SVG rectangle geometry and decodes EAN-13 and Code 128 B with separate test-only decoders/tables, including checksum verification and unsupported-character refusals. SVG output is generated geometry only; Chromium source-module acceptance also produced a real `image/png` whose bytes begin with the PNG signature. The dedicated `scripts/acceptance-barcode.mjs` additionally covers the public route/download/mobile/locality path once the shared catalog can be rebuilt.
