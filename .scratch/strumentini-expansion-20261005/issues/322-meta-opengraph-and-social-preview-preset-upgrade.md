# 322 — Meta OpenGraph and social preview preset upgrade

**What to build:** Centralize platform preview assumptions/presets and make meta/OpenGraph/social-limit previews show viewport/platform/date-of-preset context instead of pretending pixel-perfect third-party rendering.

**Traces to:** US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-09; extend existing shared engines/workspaces and avoid duplicate public routes for mere modes.

**Blocked by:** 99 — Migrate URL marketing QR and bespoke results to Result v2.

**Status:** completed

**Suggested skills:** research-primary-sources → design-impeccable → code-tdd → qa-browser

- [x] Preset authority/checked date is centralized in src/engines/url-marketing/preview-presets.ts.
- [x] Meta, OpenGraph and social-limit previews label platform/viewport assumptions and approximation copy.
- [x] Long titles, image URLs, Unicode and the 390px mobile viewport remain usable.

**Verification:** tests/url-marketing-upgrades.test.ts and tests/url-marketing-tools.test.ts cover preset selection/source/date/Unicode; scripts/acceptance-url-marketing-upgrades.mjs drives the real meta/OpenGraph/social components at 390px with long Unicode text and image metadata and verifies no horizontal overflow.

**Evidence:** Search and social preview assumptions are shared data rather than duplicated component literals; third-party rendering is explicitly described as approximate.
