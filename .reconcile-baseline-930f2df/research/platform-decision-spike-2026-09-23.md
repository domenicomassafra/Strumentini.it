# Platform decision spike — 2026-09-23

Status: implementation-input research. Recommendations for the closure/spec worker, not production code.

## Executive recommendations

- Deploy on **Cloudflare Workers Static Assets**, not a new Pages project.
- Prefer **Astro static-first** for crawlable tool/pack pages plus one lightweight client UI runtime for Workbench/tool islands.
- Preferred client UI spike: **Preact**, unless final design integration exposes a concrete incompatibility.
- Use strict TypeScript.
- Support current + previous major Chrome/Edge/Firefox/Safari and current + previous iOS Safari, with graceful degradation elsewhere.
- Use standard File/Blob input, drag/drop and browser downloads as the universal file baseline.
- Treat File System Access picker/write APIs as progressive enhancement only.
- Use OPFS only as optional scratch/cache storage, never as the user's sole durable copy.
- Use Web Workers for heavy local execution.
- Validate tool manifests at build time; ship runtime validators only at real trust boundaries.
- **No account/sync in the first validation build.**
- **No v1 PWA/offline marketing promise.**
- Cloudflare Web Analytics for traffic/performance; custom product events only for falsification metrics.
- Custom-event candidate: Workers Analytics Engine, not D1 as an event log.
- No v1 ads.

## Hosting

Cloudflare's current docs recommend Workers Static Assets for new static sites, SPAs and full-stack apps instead of starting new projects on Pages.

Sources:

- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/

Decision candidate:

> Start as Workers Static Assets. Add a Worker entry point only when the first server-valued feature exists.

Ordinary deterministic tool execution must not route through a Worker.

## Framework shape

UtilityOS needs both hundreds of crawlable public pages and a highly interactive personal Workbench. Astro is well aligned because static content renders to HTML with no client JavaScript by default while explicit client islands hydrate only the interactive pieces.

Sources:

- https://docs.astro.build/en/concepts/islands/
- https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/

Strong recommendation: use Astro as the page/build shell unless a focused implementation spike proves that the Workbench becomes materially harder than the static-first benefits justify.

Do not mix multiple UI frameworks just because Astro permits it.

## Client UI runtime

Preact describes itself as a roughly 3 kB React-compatible UI library, deliberately close to browser DOM/event semantics.

Sources:

- https://preactjs.com/
- https://preactjs.com/about/project-goals/
- https://preactjs.com/guide/v10/differences-to-react/

Why it fits:

- lane 04 chose a conventional stateful Personal Workbench rather than an AI-first shell;
- public tool pages should hydrate only what they need;
- a small runtime supports the performance/low-ops thesis;
- React ecosystem compatibility remains available selectively.

Risk: compatibility is high but not identical. If the final dependency set relies heavily on React-only behavior, full React may be simpler.

Recommendation: spike Preact first and do not enable the React compatibility layer globally by default.

## Browser and file-access floor

Web Workers are broadly supported in current desktop/mobile browsers.

Source: https://caniuse.com/webworkers

The user-visible File System Access picker/write API is not a universal baseline: Safari and Firefox do not support it, and mobile support is inconsistent.

Source: https://caniuse.com/native-filesystem-api

Therefore no core user story may require file-system pickers, directory handles or writable handles.

Universal baseline:

- HTML file input;
- drag/drop where appropriate;
- Blob/File APIs;
- object URLs;
- ordinary browser download.

File System Access can enhance Chromium desktop flows only.

### OPFS

MDN marks Origin Private File System as widely available and available in workers.

Source: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system

Use it only for temporary large-work scratch, caches and optional local processing state. Clearing site data can remove it, so explicit user-exported files/config remain the portability authority.

## PWA/offline

Do not promise works-offline behavior in v1 marketing. The architecture should remain cache-friendly, but a full PWA promise introduces service-worker invalidation, cache versioning, install-platform differences and extra QA before retention is proven.

Recommendation: no install prompt and no offline SLA in the first validation build.

## Schema validation

Zod 4 provides TypeScript-aligned runtime validation and JSON Schema conversion; Zod Mini exists for tighter client bundle constraints.

Sources:

- https://zod.dev/packages/zod
- https://zod.dev/packages/mini
- https://zod.dev/json-schema

Recommendation:

- use normal Zod in the build/catalog compiler and server trust boundaries;
- validate static manifests once at build time and emit trusted typed data;
- do not load Zod in every deterministic tool;
- where a browser trust boundary genuinely needs schema validation, benchmark Zod Mini before complex handwritten validation;
- simple narrow payloads may still use explicit manual checks.

## CSV/table engine candidate

Papa Parse supports local browser files, streaming and Web Worker execution.

Sources:

- https://www.papaparse.com/
- https://www.papaparse.com/docs
- https://www.papaparse.com/demo

Adopt only after an adversarial corpus passes. Required cases include quoted fields, embedded delimiters/newlines, BOM, CRLF/LF, empty trailing cells, duplicate/odd headers, malformed quotes, UTF-8 accents, large streaming files and delimiter detection.

Do not add SheetJS to a CSV-only tracer. Add spreadsheet libraries only when XLSX/ODS is an approved vertical requirement.

## YAML

The yaml project has a current stable 2.x line; its v3 line is still prerelease and explicitly warns against loose prerelease ranges.

Source: https://github.com/eemeli/yaml/releases

Recommendation: if YAML is in first scope, pin stable 2.x, constrain aliases/recursion, include hostile-input fixtures, and do not adopt v3 prerelease for v1.

## Markdown sanitization

Marked explicitly does not sanitize HTML output.

Source: https://marked.js.org/

DOMPurify supports current browsers, but 2026 advisories reinforce that sanitizer configuration/versioning remains security-sensitive.

Sources:

- https://github.com/cure53/DOMPurify
- https://github.com/cure53/DOMPurify/security/advisories/GHSA-h8r8-wccr-v5f2

If Markdown preview enters v1: sanitize output with a current patched sanitizer, never trust user HTML, add XSS fixtures, and avoid expanding this into a rich editor.

## PDF and image dependencies

pdf-lib is browser-capable and MIT, but its current package metadata/toolchain is old enough that it should not become the unquestioned PDF authority.

Source: https://github.com/Hopding/pdf-lib/blob/master/package.json

Defer PDF engine choice to a focused spike by capability: page mutation, rendering, extraction, metadata and compression may justify separate deep modules.

Squoosh remains evidence that high-quality image processing can run locally via browser/WASM.

Source: https://github.com/GoogleChromeLabs/squoosh

For images: native Canvas/ImageBitmap paths first for basic transforms; WASM codecs lazy-loaded only for explicit compression/format needs; mobile memory guardrails and cancellation are mandatory.

## Analytics

Cloudflare Web Analytics is free and privacy-first for page/performance analytics.

Source: https://developers.cloudflare.com/web-analytics/about/

The workspace thesis needs a few custom falsification events, for example: tool completed, add to tools, onboarding completed, profile default used/overridden, pack installed, zero-result search, workspace launch and handoff used.

Workers Analytics Engine supports custom events with non-blocking writes. Its current Free tier includes 100,000 datapoints/day and 10,000 read queries/day.

Sources:

- https://developers.cloudflare.com/workers/examples/analytics-engine/
- https://developers.cloudflare.com/analytics/analytics-engine/pricing/

Recommendation: use Analytics Engine only if an experiment needs server aggregation; never send file contents, raw tool input, document names or profile values; define the event taxonomy before code; do not use D1 as an event log.

## Account and sync

Google Identity Services provides Sign in with Google, but authentication alone does not provide UtilityOS account/session/config-sync storage.

Source: https://developers.google.com/identity/gsi/web/guides/overview

Recommended first validation build: **no account and no cloud sync**.

Persist installed tools, packs, layout, safe Work Profile and presets locally, with explicit export/import for portability.

Only introduce Google account/sync after repeat Workbench use is proven and cross-device loss becomes observed friction.

If sync later becomes justified, Workers + D1 is a plausible low-ops path. Current D1 Free limits include 5M rows read/day, 100k rows written/day and 5 GB storage.

Source: https://developers.cloudflare.com/d1/platform/pricing/

## Decisions this research can close

Recommend accepting unless final closure finds contradictory evidence:

- DEPLOY-01 — Cloudflare Workers Static Assets.
- BROWSER-01 — progressive enhancement; File System Access not required.
- WORKER-01 — Web Workers are the heavy-work seam.
- OPFS-01 — scratch/cache only.
- SYNC-01 — no account/sync in first validation build.
- PWA-01 — no v1 install/offline marketing promise.
- ANALYTICS-01 — Cloudflare Web Analytics baseline; custom events only for falsification.
- ADS-01 — no v1 ads.
- SCHEMA-01 — build-time manifest validation; runtime validation only at trust boundaries.

Strong but still closure-dependent:

- SHELL-01 — Astro.
- UI-01 — Preact.
- CSV-01 — Papa Parse after adversarial-corpus spike.

Deferred:

- PDF engine;
- QR engine;
- heavy image codec selection;
- account/session library;
- sync schema.

## Low-ops consequence

The intended normal path remains:

static HTML/CSS/JS → lazy tool chunk → local engine → local result.

No server request is required for an ordinary deterministic operation. Server features remain separately valuable and optional: falsification analytics, later auth/sync, and future team/private packs.

That preserves a credible full-free / brand-asset operating model.
