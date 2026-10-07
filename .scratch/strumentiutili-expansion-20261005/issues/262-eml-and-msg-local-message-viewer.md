# 262 — EML and MSG local message viewer

**What to build:** Implement local EML/MSG inspection only for formats accepted by the mail-document feasibility gate, sanitizing HTML and attachments and never executing active content.

**Traces to:** US-EXP-04, US-EXP-09

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, explicit fidelity limits, verified output, lazy heavy dependencies.

**Blocked by:** 103, 275.

**Status:** completed

**Suggested skills:** security-audit → code-module-design → code-tdd → qa-browser

- [x] **REFUSED for production implementation:** ticket 275 independently refuses EML and MSG because no approved local parser with proven fidelity/security/mobile cost exists; no partial parser is exposed as if headers/body/attachments were reliable.
- [x] The hostile EML feasibility fixture proves script/remote-resource markers are detected before render and records zero external requests across the desktop browser matrix.
- [x] MSG has only a deliberately invalid CFB-signature fixture, so proprietary/encrypted/semantic MSG parsing remains explicitly unsupported rather than guessed.

**Verification:** Closed as a refusal downstream of ticket 275. Evidence remains in the heavy-local feasibility receipt/report; reopen only when an approved parser and hostile-content/mobile evidence satisfy the feasibility gate.
