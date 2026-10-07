# 325 — Robots canonical campaign and naming helper upgrades

**What to build:** Audit and deepen remaining marketing/web helper modes—robots directives, canonical URL, campaign naming/social character limits—using current engines and sourced platform rules, without duplicate routes for aliases.

**Traces to:** US-EXP-05, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 99, 104.

**Status:** completed

**Suggested skills:** research-primary-sources → code-tdd → inclusive-design

- [x] Each route has a concrete functional-audit record.
- [x] Time-varying platform limits carry source/checked date and expose that context in the result UI.
- [x] Local canonical/robots helpers distinguish syntax guidance from live-site verification in both output metadata and UI copy.

**Verification:** Existing functional-audit records for robots-directive-helper, canonical-url-helper, campaign-name, and social-character-limit remain the concrete audit source; tests/url-marketing-tools.test.ts, tests/campaign-url-engine.test.ts, and tests/url-marketing-upgrades.test.ts cover sourced limits, local syntax scope and edge inputs.

**Evidence:** Canonical/robots results now carry guidance source/checked date, guidanceScope: "local-syntax" and network: "not-used"; social limits retain their per-platform source/checked date and shared preview context.
