# 202 — Sitemap XML generator

**What to build:** Add sitemap.xml generation from validated normalized URLs with lastmod/change metadata only when provided, producing downloadable standards-valid XML.

**Traces to:** US-EXP-05, US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 99 — Migrate URL marketing QR and bespoke results to Result v2.

**Status:** completed

**Suggested skills:** research-primary-sources → code-typescript → code-tdd

- [x] Invalid/non-http(s) URLs are rejected precisely.
- [x] No invented lastmod/changefreq/priority values are added.
- [x] Output validates against documented sitemap constraints/bounds.

**Verification:** Standards vectors, URL normalization and max-count/size boundary tests.

**Evidence (2026-10-06):** `src/engines/url-marketing/index.ts` now provides sitemap generation on the existing URL engine: every row must contain a valid HTTP(S) URL, credential-bearing and mixed-host inputs fail closed, query serialization follows the shared URL normalizer, and XML text is entity-escaped. Optional TSV columns `lastmod`, `changefreq`, and `priority` are validated and emitted only when non-empty; no defaults are invented. The generator enforces the Sitemaps.org bounds of 50,000 URLs, 50 MiB uncompressed UTF-8 output and fewer than 2,048 characters per normalized `loc`. `src/components/tools/SitemapXmlGeneratorTool.tsx` exposes a local Result v2 surface with bounded preview and complete `sitemap.xml` download; the manifest declares `LOCAL` / network forbidden. `tests/sitemap-xml-generator.test.ts` passes 7 focused tests covering fixture vectors, HTTP(S) normalization, XML escaping, metadata omission, malformed/non-http/credential/cross-host failures, date/changefreq/priority validation, exact loc/count/size boundaries and a real 50,000-URL generation. `python3 quality/oracles/validate.py`, backlog validation and `git diff --check` pass; `npx tsc --noEmit` also passed after the sitemap implementation before later concurrent audio edits. Oracle `cand-245`, source `sitemaps-protocol`, and fixture family `sitemap-xml` record the protocol evidence. Current shared-tree catalog/typecheck failures are outside ticket 202: concurrent `audio-generator` references missing `cand-248` / `browser-audio-utilities`, `browser-text-to-speech` has a >160-character summary, and `AudioGeneratorTool.tsx` currently has a Float32Array buffer type mismatch. No catalog/typecheck error points to the sitemap files.
