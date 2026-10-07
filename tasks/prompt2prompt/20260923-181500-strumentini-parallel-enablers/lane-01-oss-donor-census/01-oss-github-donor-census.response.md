Status: COMPLETE
Continuation: NONE
Stop-Reason: COMPLETE
Attempt: 1
Response-Covers-Through: 2026-09-23T18:44:59+02:00
Updated-At: 2026-09-23T18:44:59+02:00
Prompt: /Users/domenico/Code/Strumentini.it/tasks/prompt2prompt/20260923-181500-strumentini-parallel-enablers/lane-01-oss-donor-census/01-oss-github-donor-census.prompt.md
Lane: lane-01-oss-donor-census

## Result

Completed the deep OSS/GitHub donor census for Strumentini.it. The final corpus contains 123 distinct candidates: 113 validated npm packages plus 10 mature application/reference repositories. 55 package rows received deep assessment, exceeding the lane minimum of 30.

Final disposition across the full matrix:

- ADOPT: 3
- SPIKE: 28
- REFERENCE_ONLY: 86
- AVOID: 6

The report explicitly preserves a native-Web-Platform-first posture and separates reusable dependencies from study-only architectural donors and license/security rejects.

## Changes

Created:

- `/Users/domenico/Code/Strumentini.it/research/lanes/06-oss-github-donor-census.md`
- `/Users/domenico/Code/Strumentini.it/research/lanes/06-oss-donor-matrix.csv`
- `/Users/domenico/Code/Strumentini.it/research/lanes/06-oss-donor-evidence/package-seed.json`
- `/Users/domenico/Code/Strumentini.it/research/lanes/06-oss-donor-evidence/npm-latest-metadata.json`
- `/Users/domenico/Code/Strumentini.it/research/lanes/06-oss-donor-evidence/deep-primary-metadata.json`
- `/Users/domenico/Code/Strumentini.it/research/lanes/06-oss-donor-evidence/census-summary.json`
- `/Users/domenico/Code/Strumentini.it/research/lanes/06-oss-donor-evidence/build_census.py`

The Markdown report is 316 lines. The CSV is 124 lines including the header.

## Verification

- Census rows: 123; required >=80 — PASS.
- Deep rows: 55; required >=30 — PASS.
- Deep required-field validation: 0 missing fields across license, maintenance, browser assessment, security, release/date, test quality, TypeScript quality, worker compatibility, SSR/static compatibility, capability mapping, adoption and rationale — PASS.
- Primary/official links in the report: 84 `https://` occurrences, including >20 first-party sources — PASS.
- npm registry metadata fetched directly for 113 valid packages; one invalid seed (`ufuzzy`) returned HTTP 404 and was excluded rather than invented — PASS.
- GitHub repo/tree metadata and GitHub Advisory Database package queries captured for the 55 deep candidates where repository metadata resolved — PASS.
- `git diff --check -- research/lanes/06-oss-github-donor-census.md research/lanes/06-oss-donor-matrix.csv research/lanes/06-oss-donor-evidence` — clean.
- No dependency installed, no donor source copied, no destructive git operation performed.

## Conflicts or blockers

No lane blocker remains.

Five auxiliary ChatGPT workers were launched according to the primary-source research guidance, but all five failed to report back before the app deadline. Their output was not used as evidence. The prime worker completed the research independently from npm, GitHub APIs, GitHub Advisory Database queries, first-party project pages and the Strumentini.it input documents.

The repository currently has unrelated untracked concurrent work outside this lane (`DESIGN.md`, `IMPLEMENTATION-PLAN.md`, `PRODUCT-MARKETING-CONTEXT.md`, `PRODUCT-SPEC.md`, `quality/`, `research/lanes/07-core-engine-spike-results.md`, `spikes/`). These paths were not touched, staged or modified by this lane.

No commit was created because the lane contract did not require one and unrelated concurrent untracked work is present; only lane-owned paths were changed.

## Residual work

No residual work is required to satisfy this lane.

The report deliberately leaves dependency installation to focused implementation spikes. Advisory hits are recorded as package-history evidence and do not claim that every advisory affects the latest version; affected-version evaluation belongs in the eventual dependency pin/CI gate. For packages with nonzero direct dependencies, the matrix labels transitive closure as not exhaustively expanded rather than fabricating a count.

## Integration notes

Recommended focused dependency spikes, in priority order:

1. CSV: Papa Parse vs `csv-parse` using the adversarial/streaming corpus.
2. YAML: `yaml` 2.x with alias/recursion limits and hostile inputs.
3. Markdown: parser choice plus pinned DOMPurify and XSS regression corpus.
4. Text diff: `diff` behind the shared text engine.
5. Business math: `decimal.js` behind explicit Strumentini.it formulas and independent oracles.
6. Hashing: Web Crypto baseline vs `@noble/hashes` / `hash-wasm` for incremental large files.
7. QR: `qrcode` generation corpus; reader separately via ZXing if approved.
8. Image: native Canvas/ImageBitmap baseline vs `pica` / `compressorjs`; EXIF separately.
9. PDF: separate `pdfjs-dist` render/extract spike from `pdf-lib` mutation spike.
10. Archive: `fflate` vs `zip.js` with zip-bomb, size, progress and cancellation gates.
11. File type: `file-type` browser signature corpus.
12. Citation: Citation.js core + targeted BibTeX/RIS plugins with round-trip fixtures.
13. Search/persistence: Fuse/Minisearch only when the UX requires their semantics; `idb` only when native IndexedDB boilerplate proves repetitive.

Study-only donors include CyberChef, IT-Tools, Squoosh, BentoPDF, Stirling PDF, DevToys, PowerToys, MuPDF, qpdf and Zotero. The report documents the relevant license constraints and explicitly rejects wholesale source copying.

## Next exact action

Consume `research/lanes/06-oss-github-donor-census.md` and `research/lanes/06-oss-donor-matrix.csv` in the integrated Strumentini.it ticket/planning wave, creating bounded dependency-spike tickets rather than installing the shortlist wholesale.
