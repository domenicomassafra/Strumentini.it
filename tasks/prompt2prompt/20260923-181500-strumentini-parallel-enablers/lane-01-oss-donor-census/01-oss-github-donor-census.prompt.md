<external-worker-contract>
You are an owner-launched external worker operating directly inside `/Users/domenico/Code/Strumentini.it`. Execute this lane, do not merely advise. Change only lane-owned paths. Preserve concurrent work. No destructive git operations. Before ending for any reason, write the response file below as your final filesystem action. Chat reply only: `Risposta salvata in: <absolute-response-path>`.
</external-worker-contract>

# Mission

Build a **deep GitHub/OSS donor census** for Strumentini.it so we know what to adopt as dependencies, what to wrap, what to learn from, and what to avoid instead of reimplementing everything blindly.

Use these DStack skills/guidance:

- `/Users/domenico/.dstack/.agents/skills/research-deep-research/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/research-primary-sources/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/github-repo-management/SKILL.md`
- `/Users/domenico/.dstack/.agents/skills/security-audit/SKILL.md` for supply-chain/security posture

# Inputs

Read:

- `research/tool-catalog-200-candidate-map-2026-09-23.md`
- `research/catalog-prioritization-v1-2026-09-23.md`
- `research/platform-decision-spike-2026-09-23.md`
- `docs/07-tool-factory-quality-standard.md`
- `docs/architecture/lane-05-tool-factory-architecture.md`

# Lane ownership

Own only:

- `research/lanes/06-oss-github-donor-census.md`
- `research/lanes/06-oss-donor-matrix.csv`
- optional machine-readable evidence under `research/lanes/06-oss-donor-evidence/`
- this lane's response file

# Required work

Search GitHub, npm and official project sites for reusable libraries/repos covering at least these capability families:

- CSV/tabular
- JSON/YAML/TOML
- Markdown/sanitization
- diff/list/text
- URL/query/UTM
- date/time/timezone/business days
- business math/decimal/financial arithmetic
- hashing/checksum/encoding
- QR/barcode
- image resize/convert/compress/metadata
- PDF mutate/render/extract/metadata/compress
- ZIP/archive
- EXIF/metadata
- MIME/file-signature detection
- BibTeX/RIS/DOI/ISBN/citation processing
- local search/fuzzy matching
- IndexedDB/OPFS helpers only if genuinely justified

Minimum census: **80 distinct repos/packages**, with at least **30 deeply assessed**.

For every deep candidate record:

- canonical repo/package;
- exact license and license source;
- latest release/date;
- maintenance activity;
- browser support;
- ESM/tree-shaking;
- approximate bundle/runtime footprint where discoverable;
- transitive dependency burden;
- WASM/native requirements;
- security advisories/CVEs/GitHub advisories found;
- test quality;
- TypeScript quality;
- worker compatibility;
- SSR/static-build compatibility;
- capability coverage;
- mapping to Strumentini.it tool families;
- adoption category: `ADOPT`, `SPIKE`, `REFERENCE_ONLY`, `AVOID`;
- rationale.

Also search mature full applications (CyberChef, IT-Tools, Stirling PDF, BentoPDF, Squoosh-class projects, etc.) for **architectural patterns and algorithms**, while respecting licenses. Do not recommend copying source just because it exists.

Produce a final shortlist of:

- 10–20 dependency candidates worth a focused spike;
- 10 repos worth studying but not depending on;
- clear `DO NOT USE` candidates with reasons.

Explicitly identify where the native web platform or a tiny local implementation is preferable to any dependency.

# Verification

- >=80 census rows;
- >=30 deep rows;
- every deep row has license + maintenance + browser + security + adoption verdict;
- at least 20 official/primary-source links;
- no invented package metadata;
- `git diff --check` clean;
- commit only owned paths if committing.

# Response file

`/Users/domenico/Code/Strumentini.it/tasks/prompt2prompt/20260923-181500-strumentini-parallel-enablers/lane-01-oss-donor-census/01-oss-github-donor-census.response.md`

Use Prompt2Prompt fields: Status, Continuation, Stop-Reason, Attempt, Response-Covers-Through, Updated-At, Prompt, Lane, then Result / Changes / Verification / Conflicts or blockers / Residual work / Integration notes / Next exact action.

Required header values:

`Status: COMPLETE | PARTIAL | BLOCKED`

`Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE`

`Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER`
