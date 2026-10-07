# Prompt2Prompt coordinator — Strumentini.it product-definition wave

Created: 2026-09-23T16:04:15+02:00

Repository: `/Users/domenico/Code/Strumentini.it`

Current branch: `main`

Purpose: run five independent evidence lanes before freezing the product plan.

## Launch now

1. Lane 01 — market demand / jobs-to-be-done census
2. Lane 02 — competitor / business-model / full-free stress test
3. Lane 03 — brand / naming / go-to-market
4. Lane 04 — product UX / design / information architecture
5. Lane 05 — engineering architecture / Tool Factory / quality model

## Shared constraints

- Historical note: this wave predates the owner decision selecting Strumentini.it. Current authority is Strumentini.it as the public brand.
- Current product thesis: person-first, web-native utility workspace for independent knowledge workers, with hundreds of reliable tools as the supply layer rather than the default UI.
- Full-free / OSS / light-ads are hypotheses, not locked decisions.
- No production implementation in this wave.
- No edits to shared authorities `README.md`, `ROADMAP.md`, `HANDOFF.md`, or existing canonical docs unless a prompt explicitly owns them.
- Each lane writes only to its assigned lane-specific output paths and its adjacent Prompt2Prompt response file.
- Workers must preserve concurrent unrelated changes.

## Next wave after responses

Ingest all five responses, reconcile contradictions, update the canonical product/spec authorities, then use `plan-tickets` to create a tracer-bullet dependency DAG. Only after ticket approval should implementation workers use `code-implement`, `code-tdd`, `code-review`, design QA, and deployment skills on the unblocked frontier.
