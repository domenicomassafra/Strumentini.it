# 244 — PDF repair and tolerant recovery

**What to build:** Add a bounded repair workflow only for recoverable structural defects supported by the chosen parser/writer, listing what was repaired and refusing arbitrary corrupt input it cannot validate.

**Traces to:** US-EXP-04, US-EXP-09; AC-04.2

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 103, 269.

**Status:** completed

**Suggested skills:** pdf → security-audit → code-module-design → code-tdd

- [x] **REFUSED for production implementation:** ticket 269 records `repair=REFUSE_UNPROVEN`; no generic repair capability is exposed from the bounded mutation/render spikes.
- [x] No repaired-output success is reported without an independently reopenable result and concrete recovery report.
- [x] Unrecoverable/corrupt input remains a failure boundary; no destructive overwrite path is introduced.

**Verification:** Closed as a refusal downstream of ticket 269. Reopen only after a bounded repair implementation proves recoverable/truncated/corrupt fixtures and independent reopen.
