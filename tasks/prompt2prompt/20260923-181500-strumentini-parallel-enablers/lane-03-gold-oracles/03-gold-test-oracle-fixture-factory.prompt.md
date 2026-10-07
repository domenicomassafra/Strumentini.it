<external-worker-contract>
You are an owner-launched external worker in `/Users/domenico/Code/Strumentini.it`. Execute only this lane. Preserve concurrent work. No destructive git operations. Final filesystem action must be the response file; chat reply only with its path.
</external-worker-contract>

# Mission

Create the **Gold correctness oracle / adversarial fixture factory** that lets Strumentini.it scale to hundreds of tools without trusting self-referential tests.

Use:

- `code-tdd`
- `research-primary-sources`
- `research-deep-research`
- `security-audit` where malformed/untrusted input is relevant

# Inputs

Read:

- `docs/07-tool-factory-quality-standard.md`
- `docs/architecture/lane-05-test-seams-and-acceptance.md`
- `research/tool-catalog-200-candidate-map-2026-09-23.md`
- `research/catalog-prioritization-v1-2026-09-23.md`

# Lane ownership

Own only:

- `quality/oracles/**`
- `quality/fixtures/**`
- `research/lanes/08-gold-oracle-factory.md`
- this lane's response file

# Required work

Build an oracle registry for **at least 80 candidate tools/families**, prioritizing first-wave and high-reuse engines.

For each entry define:

- candidate/tool family;
- maintenance class;
- independent source of truth;
- standard/RFC/spec/official example where available;
- invariants/property tests;
- adversarial cases;
- expected-output strategy;
- security/privacy edge cases;
- portability/browser edge cases;
- whether a second implementation can be used as cross-check;
- confidence and unresolved gaps.

Create actual machine-readable fixtures/golden vectors for at least **25 concrete tools/families**, including where applicable:

- Unicode normalization;
- Base64;
- SHA hashes;
- URL encoding/query normalization;
- UTM round trips;
- JSON parsing/formatting;
- date arithmetic;
- margin/markup math;
- CSV adversarial corpus;
- filename sanitization;
- MIME/file signatures;
- markdown/XSS inputs;
- image dimension/metadata cases if fixtures can be legally generated locally;
- BibTeX/RIS/DOI/ISBN standards examples.

Prefer primary specifications and official examples. Do not use the same algorithm as both implementation and expected-value generator.

Where licensed sample files are needed, create synthetic fixtures or use clearly redistributable public-domain/spec fixtures with provenance.

# Verification

- >=80 oracle registry entries;
- >=25 real fixture/golden families;
- provenance for every external fixture;
- no copyrighted sample corpus copied without permission;
- machine-readable indexes validate;
- `git diff --check` clean.

# Response file

`/Users/domenico/Code/Strumentini.it/tasks/prompt2prompt/20260923-181500-strumentini-parallel-enablers/lane-03-gold-oracles/03-gold-test-oracle-fixture-factory.response.md`

Use standard Prompt2Prompt terminal schema.

Required headers: `Status: COMPLETE | PARTIAL | BLOCKED`, `Continuation: CONTINUE_NOW | WAIT_FOR_OWNER | WAIT_FOR_EXTERNAL | ACCEPTANCE_ONLY | NONE`, `Stop-Reason: COMPLETE | TIMEBOX_OR_CONTEXT | OWNER_ACTION | EXTERNAL_DEPENDENCY | PERMISSION | PHYSICAL_ACCEPTANCE | BLOCKER | OTHER`, plus Attempt, Response-Covers-Through, Updated-At, Prompt and Lane. Required sections: Result, Changes, Verification, Conflicts or blockers, Residual work, Integration notes, Next exact action.
