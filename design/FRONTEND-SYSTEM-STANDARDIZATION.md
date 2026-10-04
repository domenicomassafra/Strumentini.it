# Frontend System Standardization — implementation plan

Status: **proposal, not applied.** No shared frontend source, CSS, or tool component
was modified in producing this document; other agents are working in the tool
families. This file is the contract a later implementation wave executes against.

Authority order (unchanged): `PRODUCT.md` (product truth) → `design/WORLD.md` (visual
authority) → `DESIGN.md` (structure) → this document (how the existing system becomes
one system). Where this plan and `WORLD.md` disagree about a *visual* decision,
`WORLD.md` wins and this plan is wrong.

The brief is **standardize, not flatten**. Nothing here proposes a new aesthetic, a
new palette, a new type voice, or a new layout for any surface. Every recommendation
either (a) makes an existing decision reachable from one place instead of five, or
(b) extends an existing contract. The approved redesign is the fixed point.

---

## 1. Verdict

**The frontend already is a system.** It has one token sheet, one shared vocabulary,
one design-system test that refuses drift, one icon language, one result-column
grammar, and a `tests/design-system.test.ts` gate that already forbids local colour
literals and second spacing scales. That is a rare and valuable position, and the
plan below is built to deepen it rather than replace it.

The real problem is **not** absence of a system. It is that the system's *mechanical
layer* — shells, buttons, fields, file inputs, result actions, empty states, icon
tiles, breakpoints, browser defaults — was grown per tool family instead of lifted
once, and each family left a slightly different copy behind. Standardization here is
mostly **deletion of near-duplicates**, not invention.

The single most important scope fact: of 191 tool components, **164 are ≤15-line
config re-exports** and only **15 own more than 120 lines of UI**. The real
standardization surface is therefore ~41 tool files, 33 Astro files with scoped
`<style>`, and 3 shared stylesheets — not 200 pages.

---

## 2. Measured baseline

Counts taken from the working tree at commit `5f1b429`. Reproduce with the greps in
§11.3.

| Measure | Value |
|---|---|
| Tool `.tsx` components (excluding `shared/`) | 191 |
| … ≤15 lines (config re-export, no UI) | 164 |
| … 41–120 lines | 10 |
| … >120 lines (the actual UI owners) | 15 |
| Files owning scoped `<style>` | 33 (2 593 lines total) |
| Shared stylesheets | `global.css` 1 102, `tool-surface.css` 264, `account.css` 352, `Onboarding.module.css` 412 |
| Distinct `@media` widths in `src/` | **13** (900 ×15, 1060 ×6, 700 ×3, 1200 ×2, 640 ×3, 560 ×2, 899/max ×2, 760, 600, 1059/max, 900/max) |
| Breakpoints declared in `global.css` | **2** (900, 1200) |
| Raw dimensional literals inside scoped `<style>` | **112** |
| Declaration bodies duplicated verbatim across ≥2 files | **103** |
| Token references inside scoped `<style>` | ~1 100 (the token discipline *is* working) |
| Distinct icon stroke weights | **7** (1.1, 1.35, 1.4, 1.5, 1.6, 1.7, 1.75) across 5 icon producers |
| Tool shell shapes in use | **5** (see D1) |
| `type="file"` inputs, each with its own handler | 9 files |
| Own `URL.createObjectURL` download implementations | 9 files |
| Clipboard implementations | 1 (`TextWritingTool`) |

Primitives already in use (files, of 191): `ToolOperation` 30, `ToolResultPanel` 32,
`ToolActions` 33, `ToolSubmitButton` 33, `ToolFormCard` 21, `InlineError` 33,
`JsonResult` 18, `useToolOperation` 30, `CONTROL` 36, `ToolResetButton` 14,
`ToolCancelButton` 5, `ToolProgress` 3, `ToolStatus` 2, `ToolGutter` 1,
`ToolSurface` 1.

---

## 3. Duplication and drift map

Each item: **what** → **where (concrete selectors/files)** → **why it is a defect** →
**target**. Severity: `S1` ships a visible inconsistency, `S2` costs maintenance,
`S3` is hygiene.

### D1 — Five competing tool shells `S1`

The single most consequential drift. The same product idea ("inputs left, running
result right") is expressed five ways:

| Shape | Files | Markup |
|---|---|---|
| **A** `ToolSurface` + `ToolGutter` | `DeveloperWebTool.tsx` | form is *not* in a card |
| **B** `ToolOperation` + `ToolFormCard` + `ToolResultPanel` | 17 files (`BulkDomainExtractorTool`, `CanonicalUrlHelperTool`, `ConversionRateScenarioTool`, `CpaCpcCpmCalculatorTool`, `DomainSubdomainGrouperTool`, `EmailDomainExtractorTool`, `MetaPreviewTool`, `OpenGraphPreviewTool`, `QrGeneratorTool`, `RedirectChainInspectorTool`, `RoasCalculatorTool`, `RobotsDirectiveHelperTool`, `SocialCharacterLimitTool`, `UrlBulkNormalizerTool`, `UrlComparisonTool`, `UtmBuilderTool`, `UtmParserTool`) + `QrReaderTool` | canonical |
| **C** `ToolOperation` + bare `<form>` (no form card) + `ToolResultPanel` | `MarginMarkupTool`, `RateConverterTool`, `TrackingCleanerTool`, `business-math/BusinessMathTool`, `date-time/DateTimeOperation`, `file-hash/FileHashTool`, `file-privacy/FilePrivacyTool`, `image-visual/ImageVisualTool`, `table/TableWorkbench`, `text-writing/TextWritingTool`, `TextDiffTool`, `research-knowledge/ResearchKnowledgeTool` | the input column has **no card**, so the left column loses the surface, border and shadow the right column keeps |
| **D** raw `class="tool-operation"` + raw `class="tool-form-card"` + raw `class="result-panel"` | `csv-cleaner/CsvCleanerTool`, `csv-column-map/CsvColumnMapTool`, `pdf/PdfTool`, `CampaignNameTool`, `csv-dedupe/CsvDedupeTool` | bypasses the primitives entirely |
| **E** raw `class="tool-operation"` + raw `class="result-panel"`, no form card | `BusinessDayTool`, `DoiIsbnNormalizerTool`, `ListCompareTool`, `TimezoneOverlapTool`, `image-resize/ImageResizeTool`, `research-knowledge/ResearchKnowledgeTool` | same defect as C |

Twelve files write `class="tool-operation"` / `class="tool-form-card"` /
`class="result-panel"` directly (D4/D5 lists below). One file — `CampaignNameTool.tsx:28`
— renders `<section class="result-panel">` with **no `gutter`, no `data-state`, no
`aria-busy`**, so it announces nothing when it changes.

**Target:** exactly one shell, `ToolWorkbench`, with `ToolSurface`/`ToolOperation`
reduced to a thin alias or removed. All 41 UI-owning files converge on it.

### D2 — Four button vocabularies `S1`

`global.css` defines three parallel button class systems that all render the same box:

- `.btn` + `.btn-primary` / `.btn-ghost` / `.btn-block` / `.btn-lg` — 18 / 3 / 3 / 5 uses
- `.button` + `.button.primary` — 4 uses
- `.actions button` / `.actions .button` / `.tool-submit` — `global.css:943-982` restates
  the entire button box *inside* an `.actions` scope, then adds
  `.actions button:first-child { background: var(--brand) }` (`:967`) — i.e. **the
  first button in any actions row turns primary by position, not by intent**
- `.text-button` — 6 uses

`PdfTool.tsx:289` and `FilePrivacyTool.tsx:254` and `TextWritingTool.tsx:348` each
hand-write `<div class="actions"><button class="primary" …>` / `<button type="button">`
— the last one has no `.primary` at all, so a *download* button renders as secondary
in one tool and primary in another.

**Target:** one `Button` primitive with `variant: "primary" | "secondary" | "ghost" |
"danger"`, and an `Actions` row that never infers emphasis from `:first-child`.

### D3 — No `Field` primitive; the label idiom is re-typed 173 times `S1`

`class="field"` appears **173 times in 44 files**. The canonical shape is

```
.field > span (label) > input|textarea|select   +   .field > small (hint)
```

and it is hand-written in every renderer. There is no component behind it, so
`DeveloperWebTool.tsx:354` uses `for={id}`, `BusinessMathTool.tsx:272` uses
`htmlFor={inputId}`, `TableWorkbench.tsx:337` uses neither (label wrapping only), and
`TextWritingTool.tsx:340` compensates with a stray `aria-label="Delimitatore CSV"` on
the control. The four spellings of the same label association are the accessibility
drift, not the repetition.

Compounding: three different checkbox captions —
`.choice-line` (14 uses, 3 files), `.checkbox-field` (10 uses, 4 files),
`.check-field` (1 use, `tool-surface.css:30`) — where `.check-field` exists *only* in
CSS and its one consumer (`.checkbox-field span span`, `tool-surface.css:52`) is a
selector nobody authors by hand.

**Target:** `Field` (label + control + hint + error), `ChoiceRow` (checkbox/radio
with caption), `ChoiceGroup` (fieldset + legend + rows), `Segmented` (the pill radio
row already in `global.css:892`).

### D4 — Nine hand-rolled file inputs `S1`

`TableWorkbench.tsx:339`, `ImageVisualTool.tsx:113` and `:120`, `FilePrivacyTool.tsx:177`,
`PdfTool.tsx:271-272`, `QrReaderTool.tsx:19`, `FileHashTool.tsx:109-112`,
`ImageResizeTool.tsx:165-168`, `CsvColumnMapTool`, `CsvDedupeTool`.

Each has its own `accept` string, its own size formatter (`(file.size/1024).toFixed(1)`
+ " KiB" appears in at least three spellings), its own error copy
("Impossibile leggere il file selezionato."), and its own confirmation line
(`role="status"` in one, `small` in another). The approved reference screen **06**
("Workspace dello strumento") shows the target form: a dashed dropzone, a file list with
name + size, reorder and remove, and one clear-all.

**Target:** `FileDropzone` (input + drag/drop + one accept contract) and `FileList`
(rows with move/remove/clear). Surface-specific: which `accept` set, and whether a
tool accepts one file or many.

### D5 — Two result-column vocabularies `S1`

`ToolResultPanel` emits `class="result-panel gutter"` (both classes, by design —
`ToolResultPanel.tsx:33` documents the reconciliation). The ten raw-markup files in
D1/D5 emit only `result-panel`, or `gutter`, or neither, so:

- `.gutter { font-variant-numeric: tabular-nums lining-nums }` (`global.css:713`) is
  lost wherever the raw path is used → **digits shift width in the result column**
- `.result-panel { position: sticky; top: … }` (`global.css:1073`) is lost → the
  column stops tracking while scrolling
- `.gutter-placeholder` styling is lost → `CampaignNameTool.tsx:28` falls back to
  `.result-placeholder`, which has no `font-size`

**Target:** `ResultPanel` only. The class pair becomes internal.

### D6 — `CONTROL.copy` is defined once and used once `S2`

`controlLabels.ts:26-27` defines `copy` / `copied` / `copyFailed` — Italian, with the
failure recovery already written ("Copia non riuscita. Seleziona il testo e copialo
manualmente."). Exactly one tool uses it (`TextWritingTool.tsx:348`), and that tool
re-implements all three strings inline at `:311-321` with *different* wording
("Gli appunti non sono disponibili…", "L'accesso agli appunti è stato bloccato…").
Roughly 40 text-producing tools have a result and no copy affordance at all.

`WORLD.md` §THESIS says "one obvious action"; a result a person cannot take with them
is not finished. This is a **missing shared capability**, not a duplication.

**Target:** `useCopyToClipboard()` + a `ResultActions` row that renders
copy / download / reset / hand-off from capability flags.

### D7 — Nine hand-rolled download paths `S2`

`URL.createObjectURL` in `PdfTool` (×2), `ImageVisualTool` (×2), `TableWorkbench`,
`ImageResizeTool`, `FilePrivacyTool` (+ its own `downloadBlob`, `FilePrivacyTool.tsx:90`),
`DateTimeOperation`, `CsvDedupeTool`, `CsvColumnMapTool`, `CsvCleanerTool`.
Each picks its own extension, MIME type, and object-URL lifetime; two of them
(`PdfTool.tsx:304`) render `<a class="button primary" download>` anchors instead of
buttons, which is a different control with different keyboard behaviour.

**Target:** `downloadBlob(blob, filename)` in `src/components/workbench/download.ts`
(mirrors the existing `copy.ts` pattern), plus `ResultActions`.

### D8 — Four empty / loading / error / success vocabularies `S1`

| Concern | Implementations |
|---|---|
| placeholder | `.gutter-placeholder` (6), `.result-placeholder` (13), `.directory-empty` (`CatalogDirectory.astro:207`), `.area-empty` (`preferiti.astro`), `.zero-results` (`GlobalSearch.astro:96/134/173`), `.noResults` (`Onboarding.module.css`) |
| error | `.error` (17 uses / 12 files, via `InlineError`), `.ac-field-error` (`account.css:147`), `.csv-warning` (`tool-surface.css:128`), `.filtri-error` |
| success | `.success` (3 uses), `.gutter-note[data-state="success"]`, `.ac-connected` |
| busy | `<progress>` bare (`tool-surface.css:54`), `ToolProgress` (3), `ToolStatus` (2), `role="status"` inline strings (≥6), `directory-count` |
| in-progress copy | `CONTROL.working` ("Elaborazione in corso…") in most tools; `PdfTool.tsx:289` inlines it; `ImageResizeTool` and `BusinessDayTool` have none |

The craft floor requires hover / disabled / loading / error / empty on every surface.
Right now a given tool may have three of the five.

**Target:** one `StateMessage` (`tone: info|success|warning|danger`, `role` chosen by
tone), one `BusyIndicator`, one `EmptyState` (title + body + optional recovery action).

### D9 — Four icon-tile implementations `S2`

`.icon-tile` 44px/`--radius-md` (`global.css:540`), `.tool-title-icon-wrap` 64px/`--radius-lg`
(`global.css:576`), `.site-nav-panel-icon` 34px/`--radius-sm` (`SiteHeader.astro:256`),
`.tool-features-icon` 40px/`--brand-soft` (`ItalianToolPage.astro:286`), `.tool-steps-icon`
40px (`:327`), `.ac-art-tile` (`account.css:57`), `.home-hero-tile` (`HomeHero.astro:35`).

All are the same idea at seven sizes with three radii and two grounds. `WORLD.md`
§MATERIAL already fixes the rule (44 / 64 / 96–108, 12 % tone over surface) — the
implementation has simply never been held to it.

**Target:** `IconTile` with `size: "sm" | "md" | "lg" | "xl"` mapped to exactly those
four documented sizes, one radius per size, one ground rule.

### D10 — Three badge vocabularies `S2`

`.pill` + `.pill-brand|success|warning|danger` (`global.css:458`), `.tool-quality-status`
+ `.verified|.checking` (`global.css:616` — the same soft/solid pair, re-derived),
`.ac-pills`/`ac-stat` (`account.css:229`), `.filtri-count` / `.directory-count`,
`.home-stats`. `.pill-danger` is declared and used **zero** times — dead CSS.

Note the "Verificato / In verifica" pair is rendered three times from three places:
`ItalianToolPage.astro:123-126` (`.pill-success`/`.pill-warning`), `ToolCard`, and the
`GlobalSearch`/`cerca` `qualityLabel()` string. A single `CertificationBadge` reads
`qualityIndex` once.

**Target:** `Badge` (`tone`), `CertificationBadge` (the only consumer of
`goldToolIds(qualityIndex)` in the UI layer), `Stat` for number+label.

### D11 — The card box is declared six times `S2`

`padding: var(--space-6); border: var(--border-width) solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-card)`
appears verbatim in `.card`, `.tool-form-card`, `.result-panel`, `.method-card`,
`.gutter`, `.ac-block`, plus `.diff-result` (`tool-surface.css:194`, with
`--radius-lg` and no padding token discipline).

**Target:** one `.card` (already exists at `global.css:342`) and every container
either uses it or names why it differs. `.tool-form-card`, `.result-panel`,
`.method-card`, `.ac-block`, `.diff-result` become `.card` + a purpose class.

### D12 — Grid columns re-typed instead of a layout scale `S2`

`repeat(4, minmax(0,1fr))` in 6 files, `repeat(3, …)` in 5, `repeat(2, …)` in 3 — for
the same three ideas (a 4-up feature/stat row, a 3-up card/step grid, a 2-up grid).
There is no `.grid-2|3|4` in the sheet, so each consumer re-declares the track.

**Target:** `.grid` + `.grid-2/3/4` in `global.css`, mobile-first, consumed by all.

### D13 — Section heading block re-typed 13 times `S2`

`.section-head` + `.section-title` + `.section-sub` (+ optional `.section-link`) is the
document's one editorial pattern; it is restated in `ItalianToolPage.astro:148/167/200`,
`risorse.astro`, `preferiti.astro`, `cerca.astro`, `categorie/[slug].astro`. The
global definitions exist (`global.css:352-388`) and are partly re-implemented.

**Target:** `SectionHead` (Astro + Preact wrappers over one class contract).

### D14 — Thirteen breakpoint widths against two declared `S1`

`DESIGN.md` §9 and `global.css:7-13` declare 900 and 1200 as *the* shared
breakpoints, and `tests/design-system.test.ts:229` asserts exactly those two — but only
inside `global.css`. Elsewhere: **1060/1059** (header rail — 6 uses, the header/mobile
split), **700**, **640**, **560**, **600**, **760**, and **`max-width: 899px`**
(`account.css:275`) which is the same edge as `min-width: 900px` written backwards.

Result: there is no single answer to "where does the header collapse", and
`account.css` and `SiteHeader.astro` disagree about which side of 900px they are on.

**Target:** three documented breakpoints — 900 (`--bp-desk`), 1060 (`--bp-rail`),
1200 (`--bp-wide`) — with 640/560/700 demoted to documented *component* refinements or
removed. `DESIGN.md` §9 is updated to name `--bp-rail`; the design-system test's
allowlist becomes `["900", "1060", "1200"]` **with the reason in the test name**.
Every `max-width: 899px` becomes `min-width: 900px`-composed or is deleted.

### D15 — 112 raw dimensional literals in scoped styles `S2`

Concentrated in `HomeHero.astro` (15), `cerca.astro` (13), `ItalianToolPage.astro` (13),
`preferiti.astro` (11), `SiteHeader.astro` (7). Examples: `min-height: 38px`
(`GlobalSearch.astro:254`, `account.css:96`), `font-size: 0.6875rem` (kbd),
`letter-spacing: -0.02em` (bypasses `--tracking-heading`), `width: 30px; height: 30px`
(`.ac-reveal`), `font-size: 800` (`HomeHero.astro:71` — `--font-weight-bold` is 700).

The token discipline holds for colour and spacing-as-token; it does not hold for raw
sizes, control heights, font weights, or tracking. **No new tokens are needed** —
every one of these maps onto an existing step (`38px → var(--control-height)`,
`800 → var(--font-weight-bold)`, `-0.02em → var(--tracking-heading)`).

### D16 — Browser surfaces ship almost unt themed `S1` (craft floor, cheapest signal)

- **No `caret-color` anywhere.** The caret is the one thing a person sees in every
  text field on the site, and it is the platform default.
- **Scrollbars are themed in neither direction.** Two rules *hide* them
  (`account.css:325`, `CatalogDirectory.astro:839`); the rest are default.
- **`.visually-hidden` is defined three times**: `global.css:305` (`clip-path:
  inset(50%)`), `GlobalSearch.astro:402` (`clip: rect(0,0,0,0)`), and used from three
  files. Two different mechanisms.
- **`kbd` is styled in three files** with three different type sizes
  (`GlobalSearch.astro:268/392`, `DirectoryHero.astro`, `404.astro`).
- **No `text-underline-offset` / `text-decoration-thickness`**, so link underlines sit
  on the baseline everywhere.
- **`accent-color` is applied in 6 places** rather than once on `:root`, and
  `appearance` is never used, so every checkbox/radio/select is the platform default
  next to a fully-styled text input.

This is explicitly the craft-floor item the floor says models "skip most reliably".

### D17 — Five icon producers, seven stroke weights `S2`

`UiIcon.astro:109` (39 glyphs, stroke 1.6, 24×24) is the canonical set.
`tool-icons.ts:106` (20 glyphs, stroke **1.35**, **16×16**) is a second set with its own
box and weight. `ShellIcon.astro:52` (1.5), `StatusMark.tsx` (1.75 via
`tool-surface.css:107`), the two inline SVGs in `GlobalSearch.astro:6,16` (1.7 and
1.4 — hand-drawn copies of the `search` glyph that `UiIcon` already has), the one in
`cerca.astro:205` (1.7), and `accedi.astro:272` (1.6). `BrandMark.astro` and
`Onboarding.tsx:275` draw a *third* mark geometry for the same cube.

The craft floor requires "one consistent stroke and weight".

### D18 — Focus is killed three times and rebuilt by hand `S1`

`global.css:298` sets one correct `:focus-visible` rule. Then:
`.field input:focus { outline: none; box-shadow: 0 0 0 3px var(--brand-soft-strong) }`
(`global.css:869`), `.directory-head:focus-visible { outline: none }`
(`CatalogDirectory.astro`), `.palette-input:focus { outline: none }`
(`GlobalSearch.astro:316`), `.search-field input:focus` (`cerca.astro`). Three
different focus rings (default 2px brand + 2px offset; 3px brand-soft-strong halo;
none).

### D19 — Red used for a non-destructive action `S1` (material rule)

`ToolCard.astro:90-94`:

```css
.tool-card-favorite[data-installed="true"] { background: var(--brand-soft); color: var(--danger); }
```

The "I have kept this tool" heart renders in **danger red** on a soft-blue ground.
`WORLD.md` §MATERIAL: "Nothing is red except a destructive action." This is a
one-line fix and a visible one.

### D20 — Two provenance grammars `S3`

`Provenance.tsx` emits `<span class="provenance">` (5 tools). Elsewhere
`ToolResultPanel` labels the gutter with an all-caps `.eyebrow` +
`.gutter-label` combination (`ToolResultPanel.tsx:54`), which declares the *same*
uppercase/label treatment twice, and `DeveloperWebTool`'s config field is literally
named `eyebrow` (`:34`) while `ToolGutter`'s prop is named `label` (`:49`).

The craft floor bans the eyebrow/kicker outright. The honest reading: a *gutter column
label* is legitimate (it names what the column holds), the all-caps brand treatment on
it is the banned part, and the repo's own `workbench/copy.ts:5-7` already states the
intent — "a surface is identified by its heading rather than by a duplicated all-caps
eyebrow" — which was never carried out. `.eyebrow` survives in only three real places
(`404.astro:24`, `ListCompareTool.tsx:91`, `csv-cleaner/CsvCleanerTool.tsx:53`).

---

## 4. What becomes a reusable primitive, and what must stay surface-specific

### Becomes a primitive (shared, one implementation, both Astro and Preact)

| Primitive | Replaces | Why it is safe to share |
|---|---|---|
| `ToolWorkbench` | all 5 shells in D1 | the frame is the product's signature move; `WORLD.md` §MATERIAL fixes it |
| `Button` | 4 vocabularies in D2 | one box, one focus ring, one disabled state |
| `Actions` | `.actions` + `:first-child` inference | emphasis must be declared, never positional |
| `Field` / `ChoiceRow` / `ChoiceGroup` / `Segmented` | 173 hand-written labels | label association is an a11y contract, not a look |
| `FileDropzone` / `FileList` | 9 file inputs | accept + size formatting + error copy are identical |
| `ResultPanel` | 2 result vocabularies | sticky + tabular numerals must never be optional |
| `ResultActions` | 9 downloads + 1 clipboard | copy/download/clear are capability flags |
| `StateMessage` / `BusyIndicator` / `EmptyState` | 4 state vocabularies | the craft floor's five states must exist everywhere |
| `IconTile` | 7 tile sizes | `WORLD.md` fixes the sizes |
| `Badge` / `CertificationBadge` / `Stat` | 3 badge vocabularies + the triple "Verificato" string | one source of certification truth |
| `SectionHead`, `Grid` | 13 restatements | pure layout, no semantics |
| `Pagination` | `directory-page*` (scoped, 60 lines) | one keyboard/aria pattern |
| `Tabs` | `.directory-tab` (pill-as-tab), `.ac-tabs` (segmented) | two implementations of one control |
| `Disclosure` | `<details>` restyled 3× | one marker reset + one rotate rule |
| `useCopyToClipboard`, `downloadBlob` | D6, D7 | pure behaviour, no view |

### Stays surface-specific (do **not** generalise)

- **The 13 family renderers' option sets.** `TableWorkbench`'s 17 modes, `PdfTool`'s
  `optionMode`, `BusinessMathTool`'s declared numeric fields. Their *inputs* become
  `Field`; their *configuration* stays theirs.
- **Result payload shapes.** `.csv-preview`, `.table-preview`, `.diff-list`,
  `.status-list`, `.markdown-output`, `.handoff-card`, `.column-map-row`,
  `.palette-row`, `.rule-row`. These are the content, not the chrome.
- **The tone wheel and category→tone mapping.** `toneForCategory`, `--tile-tone`.
- **The 10-page information architecture.** `DESIGN.md` §2 owns it.
- **Trust copy, the four features, the three steps, the four FAQs**
  (`ItalianToolPage.astro:43-93`) — per-tool truth derived from the manifest.
- **Account auth specifics**: Google sign-in, sessions, password, PBKDF2, Turnstile.
  `account.css` stays a file; only its *control* vocabulary is shared.
- **The palette dialog** and the directory's URL-state controller. One dialog exists
  (`GlobalSearch.astro:12`); do not build a generic dialog engine for it.
- **Onboarding's step machine.** `Onboarding.module.css` stays; it borrows primitives.

---

## 5. Proposed API

### 5.1 The architectural decision that makes this work

The stack is Astro (33 files) **and** Preact (41 files). A primitive must be
reachable from both without hydrating anything. Therefore:

> **One CSS class contract in one stylesheet; a thin Preact component per primitive;
> a thin Astro wrapper per primitive that emits the identical class string. A test
> asserts the two emit the same classes.**

```
src/styles/tokens.css          (extracted from global.css :root — no behaviour)
src/styles/base.css            (element defaults, focus, selection, browser surfaces)
src/styles/primitives.css      (the shared component classes — the contract)
src/styles/global.css          (imports the three above, keeps the layout vocabulary)
```

Splitting `global.css` is **optional and last** (§6 W6). It is listed because
`global.css` at 1 102 lines is the reason "add it to global.css" keeps happening.

**Naming rule: no prefix.** The existing vocabulary is unprefixed (`.card`, `.btn`,
`.field`, `.pill`). A `ui-` prefix would create the second vocabulary this plan exists
to remove. New primitives take plain names and *extend* the existing ones.

### 5.2 Tokens

**Add none for spacing/type** — D15 is a mapping exercise, not a token request.
Add exactly four, each with a `WORLD.md` row in the same commit (colour roles are the
documented table; non-colour roles go in the `:root` block):

| Token | Value | Replaces |
|---|---|---|
| `--focus-ring-shadow` | `0 0 0 3px var(--brand-soft-strong)` | the 3 hand-built focus rings in D18 |
| `--surface-sunken` | alias of `--surface-subtle` | **withdrawn** — `--surface-subtle` already exists; do not add |
| `--breakpoint-*` | *not tokens* — documented numbers in `global.css:7-13` + `DESIGN.md` §9 | D14's 13 widths |
| `--state-surface` | `var(--surface-subtle)` | do not add |

Net: **one** new token (`--focus-ring-shadow`), **one** documented breakpoint
(`--bp-rail: 1060px`), **one** widened test allowlist. Everything else is deletion.
This is deliberate: the token sheet is already correct, and adding tokens is the most
common way a design system starts drifting.

### 5.3 Primitive signatures

```ts
// src/components/ui/Button.tsx  (+ src/components/ui/Button.astro)
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "lg";
interface ButtonProps {
  variant?: ButtonVariant;      // default "secondary"
  size?: ButtonSize;            // default "md"
  type?: "button" | "submit" | "reset";
  busy?: boolean; busyLabel?: string;
  disabled?: boolean;
  href?: string;                // renders <a class="button …">, not <button>
  onClick?: () => void;
  children: ComponentChildren;
}
// class contract: "button" + "button--" + variant + (size === "lg" && " button--lg")
// NEVER .btn-primary, NEVER .actions button:first-child.

// src/components/ui/Actions.tsx  (+ .astro)
interface ActionsProps { children: ComponentChildren; align?: "start" | "between"; }

// src/components/ui/Field.tsx  (+ .astro)  — replaces 173 hand-written labels
type FieldControl =
  | { kind: "text"|"url"|"email"|"number"|"search"|"password"|"color"|"date"; … }
  | { kind: "textarea"; rows?: number; … }
  | { kind: "select"; options: readonly { value: string; label: string }[]; … };
interface FieldProps {
  label: string; hint?: string; error?: string;
  control: FieldControl; value: string; disabled?: boolean; required?: boolean;
  onInput: (value: string) => void;
}
// guarantees exactly one of: wrapping <label>, htmlFor+id, or aria-label — never two.

interface ChoiceRowProps { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; }
interface ChoiceGroupProps { legend: string; children: ComponentChildren; inline?: boolean; }

// src/components/ui/FileDropzone.tsx  (+ .astro)
interface FileDropzoneProps {
  accept: string; multiple?: boolean; disabled?: boolean;
  files: readonly FileEntry[]; onFiles: (files: File[]) => void; onClear: () => void;
  label: string; hint?: string; error?: string;
}
interface FileEntry { readonly id: string; readonly name: string; readonly size: number; }
// owns: the accept contract, `formatBytes`, the drag/drop affordance, the 44px target.
// does NOT own: which accept set, or how many files a tool takes.

export function formatBytes(bytes: number): string; // one implementation, IT, "1,2 MiB"

// src/components/ui/ResultPanel.tsx  (absorbs ToolResultPanel + ToolGutter)
type ResultTone = "idle" | "running" | "success" | "warning" | "error" | "info";
interface ResultPanelProps {
  label: string;                    // was `eyebrow` — see D20
  state?: ResultTone;
  placeholder?: string;             // CONTROL.gutterIdle by default
  value?: string; unit?: string;    // headline + previous-value delta (PreviousValue)
  entries?: readonly { label: string; value: string; key?: string }[];
  actions?: ResultAction[];         // copy | download | clear | hand-off
  busy?: boolean; children?: ComponentChildren;
}
// guarantees: sticky column, tabular lining numerals, aria-live=polite, data-state.

// src/components/ui/ResultActions.tsx
type ResultAction =
  | { kind: "copy";  text: string }
  | { kind: "download"; blob: Blob; filename: string }
  | { kind: "clear"; onClick: () => void }
  | { kind: "handoff"; target: { id: string; name: string; href: string }; payload: unknown };

// src/components/ui/StateMessage.tsx  (+ .astro)
type Tone = "info" | "success" | "warning" | "danger";
interface StateMessageProps { tone: Tone; title?: string; children: ComponentChildren; }
// role: danger → "alert"; everything else → "status". One place decides.

interface EmptyStateProps { title: string; body: string; action?: { label: string; href?: string; onClick?: () => void }; }
interface BusyIndicatorProps { label: string; value?: number; max?: number; }

// src/components/ui/IconTile.tsx  (+ .astro)   — WORLD.md §MATERIAL sizes only
type IconTileSize = "sm" | "md" | "lg" | "xl";   // 34 / 44 / 64 / 108

// src/components/ui/Badge.tsx  (+ .astro)
interface BadgeProps { tone: "neutral" | "brand" | "success" | "warning" | "danger"; icon?: IconName; children: ComponentChildren; }
interface CertificationBadgeProps { toolId: string; }  // reads qualityIndex ONCE

// src/components/ui/SectionHead.tsx  (+ .astro)
interface SectionHeadProps { title: string; id?: string; sub?: string; action?: { label: string; href: string }; }
interface GridProps { cols?: 2 | 3 | 4; as?: "ul" | "div"; children: ComponentChildren; }

interface PaginationProps { page: number; pageCount: number; href: (page: number) => string; }
interface TabsProps { items: readonly { label: string; href: string; current: boolean; count?: number }[]; }
interface DisclosureProps { summary: string; children: ComponentChildren; }   // the ONE <details> restyle

// src/components/workbench/download.ts   (mirrors the existing copy.ts)
export function downloadBlob(blob: Blob, filename: string): void;
// src/components/workbench/copy.ts       (existing file — extend, do not duplicate)
export function useCopyToClipboard(): { copy: (text: string) => Promise<boolean>; status: "" | "copied" | "failed" };
```

### 5.4 Class contract additions to `primitives.css`

Everything below is a **rename or a merge of existing rules**; nothing introduces a
new visual decision.

```css
/* one card box, six consumers */
.card { padding/border/radius/surface/shadow }   /* existing global.css:342 */
/* .tool-form-card, .result-panel, .method-card, .ac-block, .diff-result, .gutter → .card + purpose */

/* one button box, one modifier syntax */
.button            { … }              /* merge of .btn/.button (global.css:392) */
.button--primary   { … }              /* was .btn-primary AND .button.primary */
.button--ghost     { … }
.button--lg        { … }
.button--danger    { border/background: danger — the ONLY red button (account.css:204 today) */
/* DELETE: .btn, .btn-primary, .btn-ghost, .btn-block, .btn-lg, .actions button, .tool-submit */

/* one field block */
.field            { display:block; margin-block-end: var(--space-5) }
.field__label     { … }              /* was .field > span / .field > label (global.css:835) */
.field__control   { … }              /* was .field input|textarea|select (global.css:848) */
.field__hint      { … }              /* was .field small (global.css:846) */
/* focus: box-shadow: var(--focus-ring-shadow); border-color: var(--brand) */

/* browser surfaces — the craft floor's cheapest signal (D16) */
:root { accent-color: var(--brand); caret-color: var(--brand); }
:root { scrollbar-color: var(--border-strong) var(--canvas); scrollbar-width: thin; }
::selection, ::marker, :focus-visible, kbd, .visually-hidden  /* ONE definition each */

/* one grid scale */
.grid { display: grid; gap: var(--space-5); }
.grid-2 { grid-template-columns: 1fr; }  /* → repeat(2,…) at 900px */
.grid-3 { … }  .grid-4 { … }

/* breakpoints, declared once (D14) */
/* 900  --bp-desk   two-column tool surfaces, grid-2/3/4, sticky result */
/* 1060 --bp-rail   header nav appears, mobile panel retires */
/* 1200 --bp-wide   container measure, grid-4, wider gutters */
```

### 5.5 Naming conventions (binding for the migration)

1. One class per variant. **No** `.btn-*` / `.button.*` split. Use `.button--x`.
2. `__element` for a part of a primitive (`.field__label`), never a new colour or step.
3. No `is-`/`has-` state classes on primitives — use the native attribute
   (`[aria-selected]`, `[data-state]`, `[disabled]`, `:checked`) so state is testable.
4. A `data-*` attribute for anything JavaScript reads
   (`data-membership-toggle`, `data-directory-query`, `data-onboarding-action`).
5. Italian-first copy in one module per surface; never inline in a component.
6. `--tile-tone` stays the only local custom property a component may set (already
   whitelisted by `tests/design-system.test.ts:278`).

---

## 6. Migration order (minimises visual and regression risk)

Ordering principle: **add before you move; move one owner at a time; never change a
shared file and the files that depend on it in the same commit.** Other agents are
active in the tool families, so W0–W2 (shared vocabulary only, no tool edits) can land
independently; W3+ must be serialised per family.

| Wave | Scope | Files touched | Visual risk | Regression risk | Gate |
|---|---|---|---|---|---|
| **W0** | Land this plan. Fix the two one-line material violations: D19 red heart, D20 `.eyebrow` in `404.astro` | `ToolCard.astro`, `404.astro` | **visible, intended** | ~none | design-system test |
| **W1** | Browser surfaces (D16): `accent-color`, `caret-color`, `scrollbar-color` on `:root`; one `kbd`; one `.visually-hidden` (delete `GlobalSearch.astro:402`); `text-underline-offset` | `global.css`, `GlobalSearch.astro` | low, site-wide | low | contrast + a11y in family-matrix |
| **W2** | Breakpoints (D14) + raw literals (D15) + focus ring (D18) + icon stroke (D17). **Pure CSS; no markup change.** | `global.css`, `account.css`, `SiteHeader.astro`, 20 Astro styles | low | low | 390 px overflow check on all 11 families |
| **W3** | Add primitives **alongside** existing rules. Nothing is deleted. Add `Button`, `Actions`, `Field`, `StateMessage`, `EmptyState`, `IconTile`, `Badge`, `SectionHead`, `Grid` in `primitives.css` + `src/components/ui/**` + `useCopyToClipboard` + `downloadBlob`; extend `tool-shared.test.ts` | new files only | **none** | none | new unit tests must pass before any consumer moves |
| **W4a** | Migrate the **shell** (D1, D5): introduce `ToolWorkbench`; move shape **B** (18 files, already canonical) first as the proof; then C (12), then D (5), then E (6), then A (1) | 41 files, one per commit | medium — sticky/tabular restoration in D/E | **highest** — the result column is the product | `acceptance:family-matrix` per file; `gold:*` untouched |
| **W4b** | Migrate **actions + results** (D2, D6, D7, D8): `ResultActions` everywhere; delete the `:first-child` rule; give the ~40 copy-less tools a copy action | 41 files | medium | medium | family-matrix invalid-input step must still find `role="alert"` |
| **W4c** | Migrate **fields** (D3): `Field`/`ChoiceGroup`/`Segmented`; delete `.check-field`; resolve the 4 label-association spellings | 44 files | low | medium — the a11y audit is strict | `unlabeled controls` assertion in family-matrix |
| **W4d** | Migrate **file inputs** (D4): `FileDropzone` + `FileList`; adopt the reference-06 form | 9 files | **medium-high** — a new affordance | medium | `gold:image-resize`, `acceptance:pdf`, `acceptance:data-table`, `acceptance:image-resize:physical` |
| **W5** | Catalogue + account + onboarding: `Tabs` (unify pill-tab and segmented), `Pagination`, `Disclosure`, `Grid`, `CertificationBadge`, `Stat`, browser surfaces in `account.css` | 15 files | medium | low | `acceptance:discovery`, `acceptance:onboarding`, `acceptance:auth` |
| **W6** | Delete the superseded rules; split `global.css` into tokens/base/primitives; add `primitives.css` + `global.css` + `tool-surface.css` + `account.css` + `Onboarding.module.css` to the "no raw dimension" gate; update `DESIGN.md` §9 | 6 files | none (deletion) | medium — a missing rule shows up as an unstyled element | full `npm test`, `astro check`, `build`, `inspect-build` |
| **W7** | Extend `tests/design-system.test.ts` with the new invariants (§7.2); update `design/WORLD.md` §MATERIAL with the resolved icon-weight and focus-ring decisions | tests + doc | none | none | the gate itself is the deliverable |

**Rules for whoever executes this:**

- **W3 and W4 must not overlap.** Primitives exist and are tested before any consumer
  moves.
- **One file per commit in W4.** Each commit passes `acceptance:family-matrix` alone.
  This is what makes the work mergeable alongside the other agents' tool-family edits.
- **`tool-surface.css` keeps its own job** (renderer payload blocks per its own header
  comment) and is *not* folded into `primitives.css`. The split already documented at
  `tool-surface.css:1-10` is correct; keep it.
- If a migration cannot be made pixel-identical, **stop and record it** — do not
  "improve" it silently. Visual deltas need an explicit owner decision.

---

## 7. Tests and gates

### 7.1 Existing gates (must stay green at every wave)

`npm test` (catalog build → certification check → vitest, 51 files) ·
`npm run check` (`astro check`) · `npm run build` + `scripts/inspect-build.ts` ·
`npm run deploy:check` ·
`npm run acceptance:family-matrix` (11 families, 1280×900 **and** 390×844, with
`main`/`<h1>` presence, an unlabeled-control audit, network privacy, console errors,
lazy-implementation-load proof, and a horizontal-overflow assertion) ·
`acceptance:discovery` · `acceptance:onboarding` · `acceptance:auth` ·
the per-family `gold:*` certifiers.

### 7.2 New invariants to add to `tests/design-system.test.ts`

| # | Assertion | Kills |
|---|---|---|
| 1 | Every `<style>` block and `.css` file contains **no raw dimensional literal** in `padding|margin|gap|min-height|width|height|font-size|font-weight|letter-spacing|border-radius` | D15 |
| 2 | Only **900 / 1060 / 1200** appear as `(min|max)-width` in `src/**` | D14 |
| 3 | `.visually-hidden`, `kbd`, `::selection`, `:focus-visible` are each declared in **exactly one** file | D16 |
| 4 | `caret-color`, `accent-color`, `scrollbar-color` are declared on `:root` | D16 |
| 5 | Exactly **one** stroke weight across `UiIcon.astro`, `tool-icons.ts`, `ShellIcon.astro`, `StatusMark.tsx` | D17 |
| 6 | No `color: var(--danger)` outside a `danger`-variant selector | D19 |
| 7 | Astro wrapper and Preact component for each primitive emit the **same class string** | §5.1 |
| 8 | No tool component writes `class="tool-operation"`, `class="tool-form-card"`, or `class="result-panel"` directly | D1, D5 |
| 9 | Every `ToolWorkbench` renders `aria-live`, `data-state`, and `aria-busy` | D5, `CampaignNameTool.tsx:28` |
| 10 | Zero dead classes (`.pill-danger` today) — a class in a stylesheet must appear in a template | D10 |
| 11 | `createObjectURL` appears in exactly one module; `navigator.clipboard` in exactly one | D6, D7 |
| 12 | `formatBytes` has one definition | D4 |

Each is a pure source-scan, matching the file's existing style. They must be added
**with the wave that makes them pass**, never before — a gate that is red on arrival
blocks everyone.

### 7.3 Screenshot and browser acceptance

There is currently **no screenshot capture** in any acceptance script
(`acceptance-family-matrix.mjs` writes only a JSON receipt to
`quality/receipts/cross-family/`). Since this plan's whole risk is *visual*, add:

- `scripts/acceptance/visual-regression.mjs` — Playwright, `1280×900` and `390×844`,
  **light and dark** (dark is an explicit choice, so both must be proven), for the
  10 reference surfaces + 5 sentinel tools (one per shell shape in D1:
  `json-formatter` (A), `csv-viewer` (B), `margin-markup` (C), `pdf-merge` (D),
  `business-day` (E)). Baseline PNGs in `quality/receipts/visual/`; `toHaveScreenshot`
  with a documented `maxDiffPixelRatio`. Run after **every** wave; a delta must be
  either intended-and-recorded or reverted.
- Extend the family matrix with the states the floor requires and the matrix does not
  currently assert: `disabled` submit mid-run, `error`, `empty` filter result, and
  keyboard traversal of the actions row. Today it asserts invalid input only.
- Keep `MANUAL_DETECTOR_REQUIRED`: after each wave, run
  `node /Users/domenico/.agents/skills/design-impeccable/scripts/detect.mjs --json <changed targets>`
  **once**, at the end of the wave, not per edit.
- `.impeccable/build/state.json` is at `phase: "comps"`, `status: "open"`. Per
  `COMP_ROUND_OPEN`, run
  `node /Users/domenico/.agents/skills/design-impeccable/scripts/build-phase.mjs status`
  and follow its NEXT line before W4 writes any UI. **This plan does not close that
  gate and must not be read as doing so.**

---

## 8. Explicit check against the Impeccable craft floor

| Floor item | Verdict | Action |
|---|---|---|
| **Contrast** | **Pass (gated)** — `design-system.test.ts:182` holds 11 pairs in both themes | none |
| **Depth: offset + blur** | **Pass** — `--shadow-card/raised/elevation-2` all offset+blur; no zero-blur block shadow, no glow, no bevel | none |
| **Spacing: tight groups, more space above a heading** | **Pass with drift** — token discipline holds; 112 raw literals (D15) | W2 |
| **Type: measure 65–75ch, tracking ≥ −0.04em, real copy at every breakpoint** | **Pass** — `--tracking-display: −0.022em`, `--tracking-heading: −0.014em`; the widest literal is `−0.03em` at `HomeHero.astro:67`, inside the floor's −0.04em limit. Two hardcoded `clamp()` sizes sit outside the scale: `HomeHero.astro:64` (`clamp(2.25rem, 5vw, 3.5rem)`, `font-weight: 800` at `:65`) versus `--font-size-display`'s `clamp(1.875rem, 3.4vw, 2.75rem)`, and `ItalianToolPage.astro:234` (`clamp(1.625rem, 3vw, 2.25rem)`). Display max 3.5 rem is still under the 6 rem ceiling | W2: route display sizes through `--font-size-display` or a declared `--font-size-hero` |
| **Motion: one authored moment, exponential ease-out, reduced motion honoured** | **Pass** — `--motion-ease: cubic-bezier(0.2,0,0,1)`, one global `prefers-reduced-motion` block, no scattered entrance animations | none |
| **States: hover, disabled, loading, error, empty** | **Partial** — hover/disabled are systematic; loading/error/empty are per-tool (D8) | W4b |
| **Browser surfaces themed** | **Fail** — no `caret-color`, unthemed scrollbars, 3 `.visually-hidden`, 3 `kbd`, no underline offset (D16) | W1 — **the cheapest, highest-signal win in the plan** |
| **Copy: controls name their action; errors name problem + recovery** | **Partial** — `InlineError` + `friendlyToolErrorIt` + `CONTROL.copyFailed` do this well; copy/download/reset strings are re-invented per file (D2, D6, D7) | W4b |
| **Coverage of brief requirements** | **Pass** — all 10 surfaces exist and route | none |
| **Refuse: same-size icon+heading+text cards as page structure** | **Pass** — `.tool-card` has a category line and a real action; `.home-category-card` carries counts | none |
| **Refuse: hero-metric template** | **Pass (deliberately inverted)** — `ClosingBanner.astro` uses four *real* facts (`catalog.length`, `0` uploads, `100%`, `Istantaneo`), not a metric hero | none |
| **Refuse: eyebrow/kicker above a heading** | **Fail (3 real uses)** — `404.astro:24`, `ListCompareTool.tsx:91`, `csv-cleaner/CsvCleanerTool.tsx:53`; plus the duplicated `.gutter-label eyebrow` pair in `ToolResultPanel.tsx:54` | W0 + W4a |
| **Refuse: section numbers 01/02/03** | **Pass by argument** — `ItalianToolPage.astro:158` numbers three *ordered* steps; the sequence carries the information. **Keep.** | none |
| **Refuse: modal for a task needing none** | **Pass** — one `<dialog>` (the palette) with focus restore; mobile nav is a panel; no onboarding modal | none |
| **Refuse: gradient text** | **Pass** — the two-colour headings use a solid second line, not a gradient (`HomeHero.astro:71`, `ClosingBanner.astro:23` + `:64`); gradients appear only as ≤18 % ground washes | none |
| **Refuse: glass/blur as decoration** | **Pass with intent** — `backdrop-filter` on the sticky header (`SiteHeader.astro:169`) and the mobile settings rail (`account.css:318`), both for legibility over scrolling content | none |
| **Refuse: coloured `border-left` > 1px on list items** | **Judgement call — needs an owner decision** — `.diff-row` (`tool-surface.css:211`) is a 3px rule on a list item, tinted `--success`/`--danger`. The code comment calls it "a semantic mark, not a decoration", which is the floor's own escape hatch, but the floor's wording covers "list items" literally. **Options:** (a) accept and record the reasoning; (b) drop the rule and rely on the `.diff-symbol` `+`/`−` column that already exists at `:222`, tinting only the ground | **PENDING-OWNER** |
| **Refuse: hard offset shadows / zero-blur block** | **Pass** — none present | none |
| **Refuse: sparklines, progress rings, soft-shadowed rounded rectangles standing in for content** | **Pass** — `.table-chart` is a labelled `role="img"` bar chart of real values with real numbers beside each bar, not a sparkline | none |
| **Refuse: monospace as costume** | **Pass** — `WORLD.md` §TYPE confines Roboto Mono to `.json-result`, `.result-code`, `.csv-preview`, `kbd`; computed values are tabular Inter | none |
| **Refuse: system display face** | **Pass** — Inter self-hosted, variable, latin + latin-ext, preloaded, `font-display: swap`; no CDN | none |
| **Refuse: Unicode glyphs/emoji as icons** | **Pass** — five authored-SVG producers, zero emoji. **But** stroke weight is inconsistent (D17) | W2 |
| **Refuse: geometric masks for organic contours** | **Pass** — `HomeHero.astro` uses flat tinted tiles, not a cut-out; the reference comps' 3D floating tiles were correctly not adopted | none |
| **Refuse: light/dark by category** | **Pass — strongly** — no `prefers-color-scheme` anywhere; light is the product and dark is one explicit block, asserted by `design-system.test.ts:162` | none |
| **Declare elevation once, border or shadow; 12–16px card radii** | **Pass** — `--radius-lg: 16px` on every card; `--radius-xl: 22px` only on the hero art tile and the CTA band | none |
| **Real illustration or none; no sketch/doodle/turbulence** | **Pass** — no `feTurbulence`, no sketch classes, no figure-bearing SVG | none |
| **Backgrounds are surfaces** | **Pass** — `radial-gradient` washes only over `--canvas`/`--surface-subtle` at ≤18 % tone; no `repeating-linear-gradient`, no two-axis grid | none |
| **Claims come from supplied truth** | **Pass — and this is where the build is *ahead* of the reference comps** (§9) | none |
| **Operate mode: world lends type, palette, density, one signature move; standard web controls** | **Pass** — one face, one accent + an 8-tone category wheel, a 4-up/3-up/2-up density ladder, one signature move (the fixed-width running result column with the dimmed previous value, `PreviousValue.tsx`). Every control is a native `button`/`input`/`select`/`details`/`dialog`. **No terminal/instrument costume.** | none |

**Net craft-floor position: 3 failures (D16 browser surfaces, D20 eyebrow, D17 icon
weight), 1 partial (states), 1 item pending an owner decision (the diff rule).** All
three failures are cheap, mechanical, and sit in W0–W2 — they do not require touching a
tool's behaviour.

---

## 9. Acceptance against the 10 approved reference screens

`design/references/redesign-20261003/01..10.png` are 941 × 1672 annotated
"Roadmap UX/UI" comps — one per `WORLD.md` §SURFACES surface, each with a browser
frame, handwritten annotations, 3D product tiles and a figure illustration.

**Two rules govern this matrix, and they point in opposite directions.**

1. **The comps are the visual reference; the implemented truth rules are the content
   authority.** The comps contain claims `WORLD.md` §HONESTY RULES and `PRODUCT.md`
   §Evidence explicitly forbid: `1M+ Utenti ogni anno`, `Strumenti più usati —
   Preferiti dalla nostra community`, a `Più usati (100+)` tab, a `Più popolari`
   sort, `100+` counts, a `Blog` nav destination, and settings sections for `Lingua`
   and `Notifiche` that no feature implements. `PRODUCT.md` §Evidence: "**no user
   counts, no popularity ranking, and no 'most used' badge**". The current build
   correctly omits every one. **Standardization must not import them.**
2. **The comps' craft-floor items were correctly not adopted** — 3D floating product
   tiles, a figure illustration, gradient hero washes, sketch annotations. Waving them
   in would *lower* craft. Do not "close the gap" on those.

**Numbering note (real drift):** `WORLD.md` §SURFACES numbers Settings=8,
Access=9, Onboarding=10. The comps number **Onboarding=08, Access=09, Settings=10**.
01–07 agree. Use the comp numbering below and fix `WORLD.md` §SURFACES in W6.

| # | Screen | Structural acceptance (match the comp) | Truth rules (keep the build) | Status |
|---|---|---|---|---|
| 01 | Homepage | Hero: promise → lede → **one search control (same control as ⌘K)** → hint line. Three trust facts as one 3-up row. Ten public categories with real counts. Editorial starter set. Closing band: copy + primary/secondary actions + four-fact row. | Category counts from `groups.ts`; closing facts from `catalog.length` and real properties; "this device" recent block, never community favourites | **Match** |
| 02 | Directory | Three tabs; left facet rail with **counts per facet**; honest live count; sort control; 3-up card grid; real pagination. | **No `Più usati` tab and no `Più popolari` sort** (honesty rule). Comp's "Tipi di strumento / Dispositivo" facets are not declared by the catalogue — keep `inputTypes` + certification, do not invent a device facet | **Match, with two comp elements correctly refused** |
| 03 | Search | Query + honest count + suggested searches + **this device's** recent searches + category facet + ranked rows. | Recent searches stay local and are labelled as such | **Match** |
| 04 | Category | Hero, sub-category pills with real counts, editorial trio, full grid with the shared sort, other groups. | Counts from `memberCategories` | **Match** |
| 05 | Tool | Breadcrumb → tinted tile + title → lede → **three trust pills** → the tool's surface → four properties → three steps → FAQ → related tools → closing band. | Pill copy from `tool.runtime` (`localOnly` switches "Contratto dichiarato" → "Riservato"); no invented property | **Match.** Trust pills are `pill-brand` + `pill` + `pill-success|warning` → collapse to `Badge` (D10) |
| 06 | **Workspace** | Dashed **dropzone** ("Trascina qui i tuoi file / Seleziona file"), a right options column, a **file list with name + size + reorder + remove + clear-all**, a determinate **progress bar with a percentage**, a **success card** with file chip + download button, three re-assurance facts. | Real byte counts, real progress, real filenames | **Largest gap.** Today: plain `<input type="file">`, no dropzone, no file list, no reorder, `role="status"` text instead of a determinate bar, no success card. Closed by W4d (`FileDropzone`/`FileList`) + W4b (`ResultActions`) — **as a shared primitive, not a per-tool redesign** |
| 07 | Area (Preferiti e recenti) | Tools kept, tools used on this device, recent activity (names + times only), derived suggestions. | Never a file name or a result; suggestions labelled as derived | **Match** |
| 08 | Onboarding | Four steps, per-step counter, option grid with icons, back/next, review step with a **per-item computed reason**, catalogue search for manual additions. | Reasons computed from context/job metadata; no interruption of a first task | **Match** |
| 09 | Access | Two-column: benefits + card; tabs; a primary action; trust line. | No social login beyond the one implemented provider; no password-reset link; a deployment without the API says so | **Match** |
| 10 | Settings | Sidebar of sections + panel blocks; identity header; inline-editable field row with a save button; session list; local-data keys with export and delete. | **No `Lingua` and no `Notifiche`** — controls for features that cannot do what their label says are not rendered (honesty rule). Stats are real counts of what this device/account holds | **Match, with two comp sections correctly refused** |

**Cross-screen acceptance, per wave:**

- Every one of the 10 at **1280 × 900 and 390 × 844**, **light and dark**.
- Every one with `scrollWidth ≤ clientWidth` at 390 px.
- Every one with exactly one `<h1>`, a `<main>` landmark, and **zero unlabeled
  controls** (the assertion already exists in `acceptance-family-matrix.mjs:52-70`).
- Every interactive element reachable by keyboard with a visible focus ring that
  matches the one ring (D18).
- Italian-first on every string; `lang="it"`.
- Zero horizontal overflow inside the result column when a value is long
  (`overflow-wrap: anywhere`, `tool-surface.css:76/89`).

---

## 10. Quick wins and risky refactors

### Quick wins — do these first, each under an hour, each independently shippable

| # | Change | File | Why it is safe |
|---|---|---|---|
| 1 | Danger-red "kept" heart → `var(--brand)` | `ToolCard.astro:93` | one declaration; restores a binding material rule |
| 2 | Delete the 3 real `.eyebrow` uses | `404.astro:24`, `ListCompareTool.tsx:91`, `csv-cleaner/CsvCleanerTool.tsx:53` | removes the floor's only outright banned element |
| 3 | Drop `.eyebrow` from `ToolResultPanel.tsx:54` (`.gutter-label` already declares it) and rename the prop `eyebrow` → `label` | `ToolResultPanel.tsx` + 32 call sites, mechanical | removes a double declaration and the banned idiom's last systemic hold |
| 4 | Delete the duplicate `.visually-hidden` | `GlobalSearch.astro:402` | one definition already exists at `global.css:305` |
| 5 | `caret-color` + `accent-color` + `scrollbar-color` on `:root` | `global.css` | three lines; the craft floor's named "cheapest signal" |
| 6 | Replace the two hand-drawn search SVGs with `<UiIcon name="search">` | `GlobalSearch.astro:6,16`, `cerca.astro:205` | removes two stroke-weight outliers and two copies of a glyph that already exists |
| 7 | Extract `--focus-ring-shadow`; use it in the 3 bespoke focus rules | `global.css`, `CatalogDirectory.astro`, `cerca.astro` | one focus ring |
| 8 | Delete the dead `.pill-danger` rule | `global.css:476` | zero references |
| 9 | `38px → var(--control-height)`; `font-weight: 800 → var(--font-weight-bold)` (`HomeHero.astro:65`); `letter-spacing: -0.02em → var(--tracking-heading)` (`SiteHeader.astro:195`); `-0.03em → var(--tracking-display)` (`HomeHero.astro:67`) | `GlobalSearch.astro:254`, `account.css:96`, `HomeHero.astro:65-67`, `SiteHeader.astro:195` | pure literal→token, zero visual change |
| 10 | Add `aria-busy`/`data-state`/`aria-live` to `CampaignNameTool.tsx:28` | one file | a result column that currently announces nothing |
| 11 | `formatBytes()` and `downloadBlob()` extracted; the 9 call sites switched | `src/components/workbench/` + 9 files | pure behaviour, no markup |

### Risky refactors — these need an explicit owner go-ahead

| # | Change | Why it is risky |
|---|---|---|
| R1 | **Collapsing the 5 tool shells into one** (D1, W4a) | Touches all 41 UI-owning tool files, some owned by other agents right now. Restoring `.gutter` to the raw paths changes sticky behaviour and tabular numerals — a **visible** change on ~17 tools. Highest-conflict, highest-blast-radius item. Do it last among the tool work, one file per commit |
| R2 | **File dropzone + file list** (D4, W4d) | Introduces drag-and-drop, a reorder interaction and a new success card — real new behaviour, not a refactor. It changes how a person loads a file, which is the first thing they do. Touches `gold:image-resize` and the physical-fixture acceptance path |
| R3 | **Splitting `global.css`** (W6) | Pure move, but a build artefact of 200 routes and 3 stylesheets. If one rule is lost, it surfaces as an unstyled element on one surface only. Must be a no-op diff verified by the visual regression baseline |
| R4 | **Deleting the `.actions button:first-child` primary rule** (D2) | 11 tools rely on positional emphasis today. Removing it changes which button is blue in each — a deliberate, visible improvement, but a diff on 11 tool pages at once |
| R5 | **Adding a copy action to ~40 tools** (D6) | New capability, not a refactor. Changes the actions row on every text-producing tool and must use the existing `CONTROL.copy` wording rather than inventing new copy |
| R6 | **Resolving the 4 label-association spellings** (D3, W4c) | Touches the strictest existing assertion (`unlabeled controls`). A mistake fails 11 families at once. Doing it with `Field` rather than by hand is what makes it safe |
| R7 | **Unifying `.directory-tab` (pill-as-tab) and `.ac-tabs` (segmented)** (D5/W5) | Two genuinely different controls — one is a link set, one is an in-page tab set. Unifying them wrong breaks URL-driven navigation on `/strumenti/` |
| R8 | **Widening the breakpoint allowlist in `design-system.test.ts:231`** | Editing a gate to permit more. Only defensible with `--bp-rail` documented in `DESIGN.md` §9 in the same commit and the reason in the test name. Without both, this is gate-weakening and must be refused |
| R9 | **The `.diff-row` 3px rule decision** | Either direction changes a diff's readability. It is a judgement call against a literal floor clause — **PENDING-OWNER**, not an engineer's call |

---

## 11. Definition of done

### 11.1 The system is one system when

1. Exactly **one** tool shell exists, and no tool component writes
   `tool-operation` / `tool-form-card` / `result-panel` as a class string.
2. Every control on every surface is one of the §5.3 primitives or a native element.
3. `src/styles/` holds tokens + base + primitives, and no stylesheet declares a raw
   dimensional literal.
4. Three breakpoints, declared once, documented in `DESIGN.md` §9.
5. `.visually-hidden`, `kbd`, `::selection`, `:focus-visible`, `accent-color`,
   `caret-color`, `scrollbar-color` each exist exactly once.
6. One icon weight across all producers; no hand-drawn copy of a glyph that
   `UiIcon` already carries.
7. One `downloadBlob`, one `formatBytes`, one clipboard path, one
   `CertificationBadge` reading `qualityIndex`.
8. `tests/design-system.test.ts` asserts all twelve §7.2 invariants.
9. `quality/receipts/visual/` holds a light + dark, desktop + mobile baseline for the
   10 surfaces and the 5 shell sentinels, and `visual-regression.mjs` is in the
   per-wave gate list.
10. `design/WORLD.md` §MATERIAL and §SURFACES agree with the code and with the comp
    numbering; `DESIGN.md` §4 and §9 name the one shell.

### 11.2 Explicitly **not** in scope

New aesthetic direction · new palette or type voice · any change to the 10-surface
information architecture · any change to a tool's *computation* · any change to the
account API or its storage scope · the reference comps' forbidden claims, 3D tiles, or
figure illustration · closing `.impeccable`'s open comps round.

### 11.3 Reproducing the measurements

```bash
# tool components and shell shapes
python3 - <<'PY'
import pathlib,collections
tools=[p for p in sorted(pathlib.Path('src/components/tools').rglob('*.tsx')) if 'shared' not in p.parts]
print(len(tools), collections.Counter(
  'ToolSurface' if '<ToolSurface' in p.read_text() else
  'ToolOperation' if '<ToolOperation' in p.read_text() else
  'raw tool-operation' if 'class="tool-operation' in p.read_text() else 'config re-export'
  for p in tools))
PY
# breakpoints
rg -o '@media[^{]*' src --glob '*.{astro,css,tsx}' | sed 's/^[^:]*://' | sort | uniq -c | sort -rn
# raw dimensional literals in scoped styles
rg -o '\b(padding|margin|gap|min-height|height|width|font-size|font-weight|letter-spacing|border-radius):\s*-?[0-9.]+(px|rem|em)\b' \
   src --glob '*.astro' | sed 's/.*: *//' | sort | uniq -c | sort -rn
# duplicate declaration bodies across files
#   (extract <style> blocks, split rules, group by normalised body, keep groups spanning >=2 files)
# icon weights
rg -o 'stroke-width(=|:)\s*"?[0-9.]+' src --glob '*.{astro,ts,tsx,css}' | sort | uniq -c
# primitives in use
for s in ToolOperation ToolResultPanel ToolActions ToolSubmitButton ToolFormCard InlineError \
         JsonResult ToolGutter ToolSurface useToolOperation CONTROL; do
  printf '%-18s %s files\n' "$s" "$(rg -l "\b$s\b" src/components/tools | wc -l | tr -d ' ')"
done
```

**Verification constraint on this document:** it is a static audit of the working tree
at `5f1b429`. This worktree has no `node_modules`, so `npm test`, `npm run check`,
`npm run build` and the Playwright acceptance scripts **could not be executed here**;
the pass/fail claims above are inherited from the suite's source, not from a fresh run.
Whoever executes W1 must run `npm test` and `npm run acceptance:family-matrix` first
to establish the real baseline.