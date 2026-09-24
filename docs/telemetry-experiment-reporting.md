# Privacy-safe telemetry and experiment reporting

This validation build keeps deterministic product behavior independent from analytics. The default adapter is a no-op. Longitudinal custom telemetry is enabled only when an application explicitly supplies a disclosed validation cohort and a transport; the tool runtime, Workbench persistence, onboarding, search, handoff, and configuration import/export do not wait for or depend on that transport.

## Event contract

`src/telemetry/schema.ts` is the fail-closed allowlist. The approved event names are:

- `tool_opened`: tool ID and `public`, `search`, or `workbench` entry source;
- `tool_completed`: tool ID and a normalized duration bucket;
- `tool_failed`: tool ID and a normalized error code;
- `workspace_tool_added` and `workspace_tool_removed`: tool ID;
- `onboarding_completed`: approved categorical context ID;
- `pack_installed` and `pack_removed`: pack ID;
- `profile_default_applied` and `profile_default_overridden`: approved profile field key only;
- `search_zero_result`: approved intent code and optional category code;
- `handoff_used`: source tool ID, target tool ID, and descriptor type;
- `config_exported` and `config_imported`: version, safe counts, and import outcome.

Validation rejects unknown event names, unknown properties, nested values, URL-like identifiers, filenames, raw text, search queries, file bytes, output, and profile values. Rejection is local and the rejection reason never echoes the submitted value. Identifiers are stable catalog IDs or constrained experiment codes; they are not user-entered task data.

## Adapter boundary

`createAllowlistedTelemetryAdapter` validates before calling its transport and catches synchronous transport failures. `createHttpTelemetryTransport` is an optional separate network path. A blocked endpoint or a disabled cohort produces a disabled, rejected, or blocked tracking result without throwing into product code. The browser singleton is no-op until `configureTelemetry` receives an explicit disclosed validation cohort.

The Workbench uses only safe IDs and counts for add/remove and portable configuration events. The runtime emits tool completion/failure, entry source, duration bucket, and profile-default provenance without passing tool input, output, file metadata, or profile values to telemetry. Search records a zero-result intent code after classifying locally; the query itself is not passed to the adapter. Explicit typed handoff records only tool IDs and the descriptor type.

## Reporting

`deriveExperimentReport` accepts validated event records and derives:

- 7- and 30-day Workbench return;
- distinct tools reused and subjects with reuse;
- public/search/Workbench launch counts and shares;
- profile-default apply/override counts by field key;
- pack install/remove behavior;
- zero-result intent/category counts;
- handoff descriptor counts;
- configuration export/import counts and success rate.

The report also returns observations for `EXP-01` through `EXP-06`. Each observation contains the decision question, a narrow-or-reject signal, and observed counts or rates. A report is evidence for a validation decision, not a claim of market success. Invalid or unapproved records are omitted, so a report cannot become a secondary content export.

## Verification seam

The focused `tests/telemetry.test.ts` suite covers valid allowlisted events, representative forbidden payloads, cohort gating, blocked transport behavior, successful tool execution with blocked analytics, and a synthetic cohort that exercises every derived report metric. The browser integration records only the same allowlisted fields; blocking the adapter does not block the underlying operation.
