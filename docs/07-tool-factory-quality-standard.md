# Tool Factory and quality standard

## Purpose

The project may eventually contain hundreds of utilities.

This is acceptable only if adding a tool is closer to adding a well-tested module than creating a new mini-application.

Every tool must satisfy the same quality contract.

## Tool lifecycle

1. DISCOVER
2. SPEC
3. IMPLEMENT
4. VERIFY
5. CERTIFY
6. PUBLISH
7. OBSERVE
8. MAINTAIN or RETIRE

No tool enters the public catalog directly from implementation.

## Required tool specification

Every tool needs:

- stable ID;
- human name;
- one-sentence job;
- category;
- pack memberships;
- maintenance class;
- input schema;
- output schema;
- profile fields consumed;
- privacy behavior;
- browser/runtime requirements;
- dependencies and licenses;
- deterministic or semantic classification;
- edge cases;
- error states;
- accessibility notes;
- test oracle/source.

## Functional gate

Every deterministic tool must have automated fixtures covering:

- normal cases;
- boundary cases;
- invalid input;
- empty input;
- very large but supported input;
- Unicode where relevant;
- locale where relevant;
- known tricky cases for its domain.

For calculations:

- known-answer vectors;
- rounding tests;
- unit tests for intermediate formulas;
- source/version metadata for regulated formulas.

For converters:

- round-trip tests when meaningful;
- structure/count checks;
- corruption detection;
- format-signature checks.

For file tools:

- sample corpus;
- corrupt files;
- weird filenames;
- large files;
- cancellation;
- output validation.

## Independent oracle rule

Where possible, do not test an implementation only against itself.

Use one or more:

- official examples;
- published standard test vectors;
- second independent implementation;
- golden fixtures;
- property-based invariants.

Example:

A Base64 encoder should be checked against standard vectors, not merely decode its own output.

## Quality levels

### Bronze — internal

- core logic works;
- unit tests exist;
- not publicly indexed.

### Silver — public beta

- edge-case fixtures;
- responsive UI;
- accessible keyboard operation;
- privacy behavior verified;
- performance acceptable;
- clear error states.

### Gold — catalog default

- independent oracle/golden vectors where possible;
- cross-browser acceptance;
- mobile acceptance;
- documented behavior;
- stable tool ID/schema;
- telemetry/feedback hooks;
- no open correctness bug.

Only Gold tools count toward public catalog-size claims.

## Performance budgets

Simple tool:

- no heavyweight framework/runtime loaded solely for it;
- instant interaction after route load;
- no main-thread long task caused by normal input.

Heavy tool:

- runtime lazy-loaded;
- work moved to worker where practical;
- visible progress;
- cancel action;
- clear file-size guidance;
- graceful mobile fallback.

Catalog shell:

- tool count must not increase initial bundle linearly;
- search metadata can be compact/static;
- tool code is loaded on demand.

## UX contract

Every tool should have:

- immediate understanding of what it does;
- input above output;
- obvious primary action when an action is needed;
- usable defaults;
- reset;
- copy/download only when relevant;
- visible assumptions;
- no fake progress;
- no forced signup;
- no ad adjacent to critical controls.

## Work Profile contract

If a tool uses a profile default:

- show the default;
- allow override;
- indicate where it came from;
- never silently use a sensitive profile field;
- do not persist tool input unless the user requests it.

## Privacy contract

Each tool declares one of:

- LOCAL — input never leaves device;
- REFERENCE — only a non-sensitive lookup is sent externally;
- REMOTE — content must be uploaded;
- AI — content may be sent to a model/provider.

LOCAL should be the default.

Remote/AI tools require explicit disclosure before data leaves the device.

## Maintenance classes

Every tool is tagged:

- E Evergreen;
- D Data-backed;
- R Rule/regulatory;
- H Heavy local compute;
- S Semantic/AI.

This tag controls review cadence and catalog planning.

## Review cadence

Evergreen:

- automated CI continuously;
- manual review only on dependency/browser changes or reported bug.

Data-backed:

- source freshness monitor;
- scheduled source contract tests.

Rule/regulatory:

- effective-date monitoring;
- explicit human review before publishing changed rules.

Heavy:

- browser/device regression suite;
- dependency/WASM update review.

Semantic/AI:

- eval dataset;
- model/provider change gate;
- cost and privacy review.

## Catalog growth gate

A wave of new tools can merge only when:

- existing Gold tools remain green;
- initial bundle/performance budgets remain green;
- duplicated jobs are rejected or merged;
- every new tool has an owner/maintenance class;
- no tool exists solely to create another SEO keyword page.

## Retirement

Remove or archive tools when:

- browser/platform now provides the function natively and the wrapper adds no value;
- correctness cannot be maintained;
- source data disappears;
- usage is negligible and maintenance cost is non-trivial;
- a better tool supersedes it.

Large catalog does not mean permanent catalog.

## Quality KPI

Primary:

- correctness incidents per 1,000 tool uses;
- Gold tools / total public tools;
- automated test coverage of declared edge cases;
- median and p95 task completion time;
- repeat-use rate;
- unresolved bug age.

Do not use raw tool count as the main engineering KPI.

