# Skill routing — StrumentiUtili.it expansion backlog

Status: implementation routing authority for tickets 01–327.

## Routing rule

Use the smallest skill chain that matches the ticket. The `Suggested skills` field on tickets 70–327 is the ticket-specific authority. For older umbrella tickets, use this file and treat the umbrella as integration/closure work rather than re-implementing its children.

## Default order by work type

| Work type | Skill order |
|---|---|
| Backlog/DAG/ownership | `plan-tickets` → `code-architecture-review` |
| Primary-source / Italy / standards | `research-primary-sources` → domain implementation skill → `code-tdd` |
| TypeScript contracts / parsers | `code-typescript` → `code-module-design` → `code-tdd` |
| Architecture / deep runtime seams | `code-architecture-review` → `code-module-design` → `code-typescript` → `code-tdd` |
| Security-sensitive parsing / archives / crypto | `security-audit` → `code-module-design` → `code-typescript` → `code-tdd` |
| Result/UI interaction | `interaction-design` → `inclusive-design` → `code-tdd` → `qa-browser` |
| Visual system / production polish | `design-system` → `design-impeccable` → `inclusive-design` → `qa-browser` |
| PDF | `pdf` → `code-module-design` → `security-audit` where relevant → `code-tdd` → `qa-browser` |
| Heavy browser/WASM/media | `browser-performance-benchmark` + `security-audit` during feasibility, then `code-module-design` → `code-tdd` → `qa-browser` |
| Browser evidence / release | `qa-browser`; add `browser-performance-benchmark` for performance-sensitive paths |

## Existing ticket families

- **01–06 Result System v2:** `code-architecture-review`, `code-module-design`, `design-system`, `interaction-design`, `inclusive-design`, `code-typescript`, `code-tdd`, `qa-browser`. Implement children 70–99; parents are closure gates.
- **07–18 Italy / CalcolaTutto:** `research-primary-sources` first for normative values, then `code-module-design`, `code-typescript`, `code-tdd`, `inclusive-design`. Never encode an annually changing Italian rule without source/version metadata.
- **19–27 calculators / developer / structured data:** `code-module-design`, `code-typescript`, `code-tdd`; add `security-audit` for parsers, expressions, certificates, passwords, network/security formats.
- **28–33 images/PDF:** `interaction-design`, `code-module-design`, `code-tdd`, `qa-browser`; add `pdf` for PDF work and `security-audit` for redaction/encryption/metadata.
- **34–38 heavy OCR/Office/audio/video:** feasibility children 267–275 use `security-audit`, `browser-performance-benchmark`, `qa-browser`; production work only consumes an accepted capability decision.
- **39–44 long-tail helpers:** `code-module-design`, `code-typescript`, `code-tdd`; add `research-primary-sources` for linguistic/standards claims, `design-system` for visual helpers, `security-audit` for generators/credential-like data.
- **45–46 discovery/release:** `code-architecture-review`, `interaction-design`, `design-system`, `qa-browser`, `browser-performance-benchmark`.
- **47–69 compression/conversion/upgrade parents:** integration gates only; implement their child tickets. Use `pdf` for PDF, `security-audit` for archives/file parsing, and `browser-performance-benchmark` for codecs/heavy dependencies.

## Evidence rules

- `qa-browser` desktop emulation does **not** satisfy a physical-device receipt.
- Physical **iOS Safari web** evidence stays browser QA; do not route it to native-app `ios-qa`.
- A feasibility ticket may end in `REFUSE`; that is a valid outcome and must not be converted into a fake implementation ticket.
- `design-impeccable` is for final surface quality after the semantic/interaction contract exists; it is not a replacement for `design-system` or `inclusive-design`.
- Primary-source research is mandatory for tax, contribution, administrative, standards or time-varying platform claims.
- Security-sensitive file handling must prove bounded resource use and reject unsafe paths/content before materialization.
- Certification/release tickets consume fresh evidence from the current source fingerprint; historical PASS does not automatically carry forward.

## Physical-device and deployment tickets

- 277: real Android Chrome `image-resize` acceptance → `qa-browser`.
- 278: real iOS Safari `image-resize` acceptance → `qa-browser`.
- 280–281: reusable heavy-tool physical web lanes → `qa-browser` + `browser-performance-benchmark`.
- 282–283: domain cutover/runbook and post-cutover evidence → `deploy-ship` + `qa-browser`; 282 is planning-only and must not mutate DNS.

## Enforcement

When assigning a ticket to an agent, give it the ticket file plus this routing authority. The agent must read the listed skill(s) before implementation and must not silently broaden scope into sibling tickets.
