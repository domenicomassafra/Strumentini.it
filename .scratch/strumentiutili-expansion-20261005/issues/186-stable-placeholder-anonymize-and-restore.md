# 186 — Stable-placeholder anonymize and restore

**What to build:** Add local text/CSV anonymize→restore with collision-resistant stable placeholders and an ephemeral/local mapping, refusing missing/duplicated/mutated placeholders.

**Traces to:** US-EXP-08, US-EXP-09; AC-08.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 92, 94.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-tdd → inclusive-design

- [x] Supported entity selection is user/deterministic, not LLM inference.
- [x] Exact restore detects placeholder mutations/collisions.
- [x] Mapping content never enters telemetry/network.

**Verification:** Adversarial placeholders, exact round trip and zero-network checks.

**Evidence (2026-10-06):** `stablePlaceholderTransform` uses explicit user selections, deterministic 128-bit placeholder labels, collision detection and exact occurrence-count validation on restore. Missing/mutated/unknown placeholders fail closed; the manifest is LOCAL/network-forbidden and mapping persistence is operation-local. Round-trip/mutation tests pass; cand-233 binds `text-expansion`.
