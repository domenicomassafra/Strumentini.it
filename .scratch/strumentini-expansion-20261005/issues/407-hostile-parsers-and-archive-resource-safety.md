# 407 — Hostile parsers and archive resource safety

**What to build:** File parsers refuse dangerous zip SVG XML PDF object graphs before materializing

**Traces to:** OWN-03 OWN-10; owner decisions 2026-10-10

**Constraints:** Current Astro/Preact stack; local-first optional server consent only; proprietary rights and donor provenance, financial source year, mobile and WCAG 2.2 AA, cost zero initially; no waived historical AC

**Blocked by:** None

**Status:** ready-for-agent

**Suggested skills:** plan-spec → plan-tickets → code-architecture-review → code-tdd → qa-browser; research-primary-sources/pdf/security-audit as needed

**Level:** cross-cutting

**Priority:** P1 source/security/fidelity or P2 advanced

**Current evidence:** Historical audit dated 2026-10-10; no new implementation/evidence implied

**Donor / reuse decision:** Review installed engine first; if external ensure maintained release, license assets/transitives, runtime size, security, costs, migration and fallback

## Acceptance criteria

- [ ] AC-407.1: File parsers refuse dangerous zip SVG XML PDF object graphs before materializing.
- [ ] AC-407.2: Zip bombs XXE script/path traversal cannot escape sandbox/limits.
- [ ] AC-407.3: On the scoped input and failure cases, verify: Threat fixtures adversarial and resource tests. Record the current source/date, independently checked outcome and NOT_RUN/NO_GO where evidence is absent.

**Verification:** Threat fixtures adversarial and resource tests; run rejected/huge/partial/cancel cases and inspect output beyond UI mock.

**Failure / recovery:** Unsupported inputs and exceeded quota/memory return explicit refusal, no silent fallback or corruption; preserve valid prior output.

**External / owner gate:** A missing official source, vendor approval, physical device or security review blocks the affected production AC, not drafting/specification.

**Rollback / migration:** Keep previous behavior and stored project versions accessible until targeted canary and rollback proof.

**Out of scope:** Shipping functionality, buying licenses, changing receipt source fingerprints, broad desktop-only advanced exemptions.

**Execution prompt:** Routed by canonical EXECUTION-PROMPTS.md with gates.

## 2026-10-11 implementation wave 03 — scoped evidence

`src/runtime/file-threat-gate-407.ts` integrated with real `src/runtime/file-detection.ts` candidate screening and `tests/file-threat-gate-407.test.ts` 12/12 plus detector 18/18 PASS. Bounded ZIP symlink/traversal/descriptor/gaps/nested compressed XML/SVG/XXE/script, PDF risky tokens observed; signal cancellation/resource caps and no upload. It does not certify deep PDFs >256KiB/unparsed object streams, all parsers, full archive extraction or malicious file handling past detector; no full production Gold.

**Disposition:** verified implementation slice only; original unchecked AC and ticket lifecycle remain open for the explicitly unproven capability/device/provider limits. No publication, purchase, credential or release authority.

## 2026-10-11 wave 09 — ZIP pathname normalization and Windows reserved targets

An independent hostile ZIP fixture demonstrated that two central-directory names `archive/report.txt` and `archive/ｒｅｐｏｒｔ.txt` were both accepted despite resolving to the same NFKC-normalized path, and `CON`, `NUL.txt`, `AUX.xml`, `COM1`, `LPT9.log` and fullwidth device aliases were accepted as members. A fullwidth separator `folder／file.txt` could also change path segmentation after normalization. These cases are not safe assumptions for consumers extracting onto different filesystems.

The bounded preflight now checks duplicate *canonical* member identities (`normalize('NFKC').toLowerCase()`), rejects reserved DOS/Windows device names with extensions in any segment, and rejects Unicode normalization that changes segment count or exceeds path-depth limits. No ZIP extraction, upload or new dependency was added. Two tests reproduced these failures **RED** before the fix; `vitest run tests/file-threat-gate-407.test.ts tests/file-detection-333.test.ts` **32/32 PASS** afterward, preserving ordinary ZIP and OOXML examples. This is an additional fail-closed pathname gate, NOT proof that every downstream extraction implementation is sandbox-safe, nor deep PDF/SVG analysis. Ticket remains `ready-for-agent`, with original global AC unmarked, release and Gold NO-GO.

**Independent reviewer P2 follow-up (2026-10-11):** ZIP also allowed a regular member `docs` alongside directory `docs/` or child `docs/readme.txt`, which can result in an ambiguous filesystem extraction layout. Reproduced RED, then canonical uniqueness removes trailing directory slash for comparisons and the scanner refuses a regular-file member whose canonical name is a parent of any archive member. A valid directory `docs/` with `docs/readme.txt` remains supported. Relevant existing #407/#333 tests **32/32 PASS** after the fix. Still an early candidate preflight, not an extraction security certification; original ticket OPEN.

## 2026-10-11 independent hostile preflight follow-up — namespace, references and ZIP source-view suffix

Direct `detectLocalFile()` fixtures were accepted **before** the patch even though the bounded ZIP text included: SVG `<s:script>` and `<s:foreignObject>` with prefixes bound to the SVG namespace; SMIL `<animateMotion>`; OOXML `TargetMode="Ex&#x74;ernal"`; or XML `Target="file:///etc/passwd"` without an explicit mode. All five independently failed the initial focused Vitest RED run (`supported` when `UNSUPPORTED` was expected). A sixth RED case showed `<s:svg><s:animateTransform .../></s:svg>` under a `.xml` entry also passed, because namespace-prefixed SVG roots escaped the SVG-specific branch.

The #407 helper now refuses active elements with XML namespace prefixes, SMIL animation and external-load elements, inspects SVG roots even when their ZIP member uses `.xml`, refuses entity-encoded values in reference-bearing XML attributes, and refuses external references in `Target` regardless of `TargetMode`. Two further RED cases proved that arbitrary namespace aliases for XInclude and character references inside `xmlns:inc="...XIncl&#x75;de"` also passed preflight; the helper now refuses the XInclude namespace URI and entity-encoded namespace declarations. A `feImage` fixture and two benign controls guard the boundary: namespace-prefixed SVG paths and ordinary internal OOXML relationships remain candidates. No XML DOM, network fetch or additional dependency was introduced.

Separate RED: `views/render.svg?source` passed ZIP member validation, so a URL query/fragment could obscure an active SVG suffix. Filename policy now refuses `?`, `#`, Windows-incompatible wildcard/quote/bracket/pipe characters and percent-encoded path delimiters/dots (including NFKC aliases). Benign `docs/discount%20offer.txt` remains permitted. Adversarial names include `%3F`, fullwidth `？`, `％`, and encoded `%2f` separators. Focused #407 + #333 detector Vitest run: **43/43 PASS** after all fixes. `astro check` performed during this wave: **0 errors, 0 warnings, 22 hints**; final scoped `git diff --check` PASS. No production release or parser certification claimed.

**Residual gate: OPEN / NO-GO for full AC-407.1–3.** This is a bounded candidate preflight, not an archive extractor or comprehensive hostile-graph validator. PDF checks observe only at most the first and last 128 KiB for large PDFs, with no guarantee for compressed/unparsed object streams or nested objects, and downstream decoders still need resource isolation, parser quotas and adversarial integration/rollback proof. No global AC has been checked off, and no commit, push or deployment was performed in this worker lane.
