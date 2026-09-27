Status: COMPLETE
Continuation: NONE
Stop-Reason: COMPLETE
Attempt: 1
Response-Covers-Through: Gold oracle registry, adversarial fixture factory, primary-source provenance, independent verification, and final acceptance gates
Updated-At: 2026-09-23T18:51:21+02:00
Prompt: /Users/domenico/Code/UtilityOS/tasks/prompt2prompt/20260923-181500-utilityos-parallel-enablers/lane-03-gold-oracles/03-gold-test-oracle-fixture-factory.prompt.md
Lane: lane-03-gold-oracles

## Result

Completed the Gold correctness-oracle/adversarial-fixture lane.

The final machine-readable authority contains:

- 200 oracle-registry entries, covering the entire current 200-candidate map and exceeding the required >=80;
- 44 concrete fixture/golden families, exceeding the required >=25;
- 44 registered source authorities/cross-check implementations;
- explicit provenance and rights statements for every indexed fixture family;
- locally generated synthetic PNG fixtures for dimensions, metadata and corruption cases;
- a fail-closed validator for counts, schemas, source references, provenance, fixture paths and referenced synthetic artifacts.

Expected values are kept independent from future production implementations: they come from small normative vectors, hand-worked literals, explicit project policy, synthetic local data, or a second implementation used only as a cross-check.

## Changes

Created under lane ownership:

- `quality/oracles/README.md`
- `quality/oracles/build_gold_data.py`
- `quality/oracles/validate.py`
- `quality/oracles/sources.json`
- `quality/oracles/registry.json`
- `quality/fixtures/README.md`
- `quality/fixtures/index.json`
- 44 `quality/fixtures/*/vectors.json` fixture families
- `quality/fixtures/image-metadata/synthetic-1x1-rgb.png`
- `quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png`
- `quality/fixtures/image-metadata/corrupt-truncated.png`
- `research/lanes/08-gold-oracle-factory.md`

The fixture set includes the prompt-required Unicode normalization, Base64, SHA/file hash, URL/query normalization, UTM round trips, JSON, date arithmetic, margin/markup/business math, adversarial CSV, filename sanitization, MIME/file signatures, Markdown/XSS, image dimensions/metadata, BibTeX, RIS, DOI and ISBN surfaces, plus additional Wave A/high-reuse primitives.

## Verification

- TDD RED observed before data creation: `python3 quality/oracles/validate.py` failed closed because `quality/oracles/sources.json` did not yet exist.
- Final rebuild: `generated sources=44 registry=200 fixtures=44` — PASS.
- Final `python3 quality/oracles/validate.py` — PASS: Gold oracle registry and fixture index internally valid.
- Final counts: registry 200; fixtures 44; sources 44 — PASS against >=80 / >=25 requirements.
- Independent standard-library/format spot checks: 33 checked, 0 failed. Coverage included Unicode normalization, RFC 4648 Base64 literals, SHA-2, HMAC-SHA256, RFC-shaped CSV rows, URL percent encoding, Europe/Rome DST instants, ISBN-13 check digits and PNG signatures/dimensions.
- All checked JSON payloads parsed successfully; the fail-closed validator also parses every indexed JSON fixture and validates all source references.
- Synthetic PNG artifact paths are validated and contain no third-party image content.
- Provenance validator requires `spec-vector`, `hand-worked`, `synthetic-local` or `project-policy` plus a non-empty `license_or_rights` statement for every fixture family.
- No external sample corpus was copied. BibTeX/RIS records and binary image fixtures are synthetic; ISO PDF/QR conformance corpora are not vendored.
- `git diff --check` — clean.
- Lane text trailing-whitespace scan — clean.
- No `__pycache__` or `.pyc` residue remains in `quality/`.
- Scoped status immediately before this response showed only `quality/fixtures/`, `quality/oracles/`, and `research/lanes/08-gold-oracle-factory.md` as this lane's filesystem outputs.

## Conflicts or blockers

No lane blocker remains.

Two optional background research workers were launched in accordance with the primary-source research guidance, but both failed to report back before the host-app deadline. Their output was not used. The prime worker completed the source research directly against standards/first-party authorities and recorded the evidence in `quality/oracles/sources.json` and `research/lanes/08-gold-oracle-factory.md`.

Concurrent work from other UtilityOS lanes appeared after this lane began, including lane-01 donor research, lane-02 core-engine spikes and unrelated product/spec files. None of those paths were edited, staged or removed by this lane.

## Residual work

No residual work is required to satisfy this lane.

Deliberate downstream gaps are recorded rather than hidden:

- full ISO/IEC 18004 QR and ISO 32000-2 PDF normative text/conformance corpora are not freely bundled; deeper Gold checks require an independently selected parser/source with license review;
- RIS has no single freely accessible normative authority treated as canonical here, so fixtures remain synthetic and an independent parser cross-check is required downstream;
- public holidays, social-platform limits, platform image presets and other live/data-backed tools need versioned freshness machinery before Gold;
- timezone receipts should record tzdb/runtime revision when results can drift;
- heavy PDF/image/archive tools still require real browser/device parser/decoder and resource-limit acceptance in their implementation lanes.

## Integration notes

- Treat `quality/oracles/registry.json` as the candidate-to-oracle plan and `quality/fixtures/index.json` as the fixture/provenance authority.
- Gold certification should resolve a tool to its declared fixture families, execute exact known-answer vectors before property checks, then run any required independent second implementation and browser/security acceptance.
- Do not reuse a production engine or the lane-02 spike implementation to generate expected values for its own tests.
- Project-policy fixtures intentionally distinguish product choices from external normative claims where no universal standard exists.
- The certification receipt should bind exact source, fixture and relevant data/runtime versions and fail closed on missing required oracles, source freshness failure, browser divergence or open correctness defects.

## Next exact action

Consume `research/lanes/08-gold-oracle-factory.md`, `quality/oracles/registry.json` and `quality/fixtures/index.json` in the integrated closure/spec wave, bind canonical production tool IDs to the relevant oracle/fixture families, and make the Gold certification pipeline fail closed against these independent vectors before any tool is counted as public Gold.
