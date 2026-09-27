# RESTRETTO — the visual world for the StrumentiUtili.it redesign

Status: **canonical design authority for the redesign wave.** Every worker reads this before writing code.
Supersedes `DESIGN.md` §2–§6 (structure and content survive; the visual world is replaced). `DESIGN.md` is rewritten at finish from the built result.
Product truth: `PRODUCT.md`. This file owns visual decisions only.

---

## THESIS

An independent worker's week is a **libro delle scritture** — the ruled ledger they keep their jobs in.

The obvious way to build a 200-tool utility site is a card wall, a bento grid, a hero metric, a purple gradient, a search bar, a "trusted by" row. We refuse that arrangement entirely.

We build the product as a **registro**: a bound, ruled, hand-annotated working ledger where every value the product produces lands in the same fixed gutter position, so the eye learns one place to look and never has to search again. The tool count is invisible. What is visible is a page that already knows your numbers.

The one idea this surface owns: **the running gutter.** A persistent right-hand column where results arrive in a fixed position, always aligned, always the same width, with the previous value still legible while you change the input. A product with 200 tools should feel like a book with one number column you already know how to read.

---

## OWN-WORLD

**Palette — ink on paper, one red pen.**

| Role | Value | Notes |
|---|---|---|
| `--carta` | `#F4F1EA` warm laid paper | the ground. Never pure white. |
| `--carta-alta` | `#FBF9F4` | the leaf that sits on the desk — raised surfaces |
| `--carta-fonda` | `#E8E3D7` | the desk beneath, rails, gutters |
| `--inchiostro` | `#1A1714` iron-gall black | body ink |
| `--inchiostro-2` | `#4A443C` | second ink, for rules and borders |
| `--inchiostro-3` | `#6B6459` | faded ink — corrected to clear the 4.5:1 secondary-text floor on `--carta` |
| `--rossa` | `#9E2B1F` | **the accountant's red pen. The only accent.** |
| `--rossa-tenue` | `#F2E3E0` | red at 12% — fills, never text |
| `--verde` | `#3C5A45` | semantic: success/local |
| `--ambra` | `#8A5A12` | semantic: warning |
| `--blu-nota` | `#2F4A6B` | semantic: info/reference |

Red is **committed, not scattered**: it carries the running total, the active row marker, the primary action, and nothing else. Budget: 4–8% of any viewport. If red appears twice in one component, one of them is wrong.

Dark mode is **not** an inversion. It is the same ledger under a desk lamp at night: `--carta` becomes `#15130F`, ink becomes `#EDE7DA`, red becomes `#D9634F`. Warm throughout, never neutral grey, never blue-black.

**Type — two faces, no third.**

- **Display/label:** a grotesque with real ink on paper, tight but not crushed, tracking between −0.02em and −0.03em. Never Fraunces, Playfair, Space Grotesk, IBM Plex, Inter-as-display, or the platform sans.
- **Body/UI:** a workhorse humanist sans with good numerals at 12–14px.
- **Numeric gutter:** a **tabular-lining** mono or the body face with `font-variant-numeric: tabular-nums lining-nums`. This is mandatory in the gutter. Digits must not shift width as they change — that is the whole point of the column.
- Self-host, subset latin + latin-ext, `font-display: swap`, preload the two above-the-fold files. No CDN. No font that fails to load and silently falls back — the current `--font-family-ui: Inter, …` with nothing loading Inter is exactly the failure we are deleting.

**Material.**

- 1px `--inchiostro-3` hairlines at 30–40% for interior rules; `--inchiostro-2` at 1px for the gutter and page edges.
- **No shadows on content.** A ledger is flat. Depth is a single 1px edge plus a background step, never a soft glow. One exception: the command palette and any true overlay gets one shadow with offset *and* blur, per the craft floor.
- Ruled lines run the full content width. Where a line separates, it is a *ruled* line, not a card gap.
- **Banned:** glass, gradient text, neon, glow edges, `border-left`/`border-right` > 1px as a colour device, zero-blur block shadows, pill-shaped everything, sparklines, progress rings, generic icon tiles.

**The gutter — the signature element.**

- Fixed-width right column, `clamp(9rem, 22vw, 15rem)`, on every tool surface and every result.
- Every produced value lands there, top-aligned, tabular numerals, no wrapping.
- The previous value stays visible, dimmed, directly above the new one, for ~4s. You always see what changed.
- On mobile the gutter drops below the input as a full-width ruled block. It never disappears and never becomes a modal.
- Semantic state is a 3px left rule *inside* the gutter's own left border, in ink, never a coloured card.

---

## FIRST VIEWPORT

The home page is the **apertura del libro** — the day-book opened to today.

1. **No hero, no banner, no big number.** The largest type on the page is a heading that names a state, not the product.
2. **Your Tools** leads, in ledger rows, at reading density. Each row: name · one-line task · the *value* it last produced, in the gutter position, right-aligned tabular. The gutter column on the Workbench is not empty — it holds each tool's last result or its runtime state.
3. The gutter column is visible from the first pixel of the content area, on every page, at the same x-offset. One place to look.
4. **Recent** sits directly beneath, same row grammar, same gutter.
5. **Suggestions** at most 2–4, each with one visible deterministic reason, set in the same rows.
6. **Work Profile** is a ruled block, not a card. Six fields on a baseline grid, workweek as seven small toggles in a single ruled strip.
7. **Library is never the first thing you see.** It is one link, and the search palette is one keystroke (`Cmd+K` / `Ctrl+K`).

The page must survive: if someone left after one viewport, what would they describe an hour later? Answer: *a ledger with my tools in it, and the numbers in the same place every time.* If the answer is "a nice green website", the concept has not committed.

---

## SIGNATURE INTERACTION

**Il total corrente.**

Type in any input → the gutter value re-renders in place, tabular numerals, no reflow, no layout shift, the delta from the previous value visible for 4s. Nothing animates into the gutter; the gutter is a physical column and values settle into it.

This is the only "showy" moment in the product and it appears in exactly two places: the tool gutter, and the Workbench's per-tool last-value column. Everything else moves at 120ms or not at all.

---

## CROSS-SURFACE REACH

The world must survive: home · 200 tool pages · Library · command palette · onboarding (4 stages) · 404 · empty · error · loading · dark. It is built as **one token sheet plus one component vocabulary**, consumed by every surface. A second spacing system is a defect.

Concretely that means: one `:root` token sheet; the shell, palette, and Library stop being hardcoded-pixel documents; CSS Modules consume the same tokens as globals; a single `.field`, `.field-grid`, `.actions`, `.gutter`, `.rule-row` vocabulary shared by all 13 tool renderers and the 28 bespoke tools.

---

## HONEST RISK

The ledger is a *quiet* world. It will not look like a 2026 SaaS launch page, and it will be judged against the "innovative site never seen before" brief. The defence is that the innovation is structural, not decorative: a fixed-position result gutter that makes a 200-tool product legible at 10 tools, executed with real typographic craft and real paper-and-ink material. Risk accepted deliberately.

Second risk: ruled ledger grammar can read as "retro" or "accounting software". Prevented by execution — a ledger drawn with a contemporary grotesque at contemporary density is not nostalgia. Do not add distressed textures, sepia, torn edges, or typewriter effects.

---

## ITALIAN-FIRST

Every user-facing string ships Italian-first. English exists as a secondary, not as the source. `lang` is set per content, not a hardcoded `<html lang="en">`.

---

## WORKER OWNERSHIP MAP

Disjoint. Do not edit another lane's files.

| Lane | Owns |
|---|---|
| **W1 — Foundation** | `src/styles/**` (new token sheet + base elements), `src/layouts/BaseLayout.astro`, font assets, `design/WORLD.md` is read-only for everyone |
| **W2 — Shell & navigation** | `src/components/shell/**`, mobile nav, icon set, route-swap safety |
| **W3 — Tool surface** | `src/components/tools/**` — the gutter, the 13 renderers, the 28 bespoke tools |
| **W4 — Library & search** | `src/components/library/**`, `src/components/search/**` |
| **W5 — Workbench & onboarding** | `src/components/workbench/**`, `src/components/onboarding/**`, home page composition |
| **W6 — Tickets & proof** | `quality/**`, `scripts/**`, `.scratch/**` — no visual files; owns ticket completion + acceptance |

Shared boundary rule: W1 owns `src/styles/**` and nothing else touches it. If a lane needs a token that does not exist, it adds a *consumer* rule in its own file and reports the missing token; it does not edit the token sheet.
