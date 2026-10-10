> **OWNER-ALIGNED PLANNING NOTICE (2026-10-10):** 2026-10-10 design status: this file remains the CURRENT implementation/token reference, because design-system tests compare its palette to CSS. The earlier familiar expected version is NOT owner-approved as the next design. New direction awaits #351 three complete alternatives and #352 dated explicit owner choice. Preserve present table and style sync until a gated full redesign, not a cosmetic palette swap.

---

# WORLD — the visual world of Strumentini.it

Status: **canonical design authority.** Every worker reads this before writing code.
It is kept in sync with `src/styles/global.css` by `tests/design-system.test.ts`: the
palette table below is parsed out of this file, so a token that drifts from this page
fails the suite. Product truth: `PRODUCT.md`. This file owns visual decisions only.

---

## THESIS

The owner has selected the **familiar, expected version** of this product and it is
executed at full fidelity, without irony and without smuggled quirks: a clean Italian
utility site that looks like the category it belongs to, because that is what a person
arriving with a two-minute job is looking for.

The one idea this surface owns: **one blue, one white card, one obvious action.** Every
screen answers the same three questions in the same order — what is this, what does it
cost me, and where do I click. The catalogue is large and that fact is present but never
the subject; the subject is the job in front of you.

What is refused: a hero that makes a claim we cannot prove, a badge that means nothing,
a control for a feature that does not exist, decoration that costs a millisecond and
buys nothing.

---

## PALETTE

Light values. `--brand` is the only accent that carries action; the tone wheel carries
category identity so a card can be recognised before it is read.

| Token | Value | Role |
|---|---|---|
| `--brand` | `#0b6cfd` | the one accent: primary action, link, active state, computed value |
| `--brand-hover` | `#0a5ce0` | the accent under the pointer |
| `--brand-soft` | `#ebf3ff` | accent at tint strength: selected rows, icon grounds |
| `--canvas` | `#f6faff` | the page ground |
| `--surface` | `#ffffff` | every card, the header, the footer |
| `--surface-subtle` | `#eff6ff` | recessed panels, table output, inputs at rest |
| `--surface-muted` | `#e4effd` | the third step, progress tracks, hairlines on blue |
| `--text` | `#0b1220` | headings and body ink |
| `--text-muted` | `#55637a` | secondary prose, labels, metadata |
| `--text-faint` | `#7c8a9e` | the quietest legible step: hints, counts, breadcrumbs |
| `--border` | `#e4edf9` | the hairline that makes a card a card |
| `--border-strong` | `#cfe0f4` | input edges and controls that must read as interactive |
| `--success` | `#0d7a3c` | verified, success, "done" |
| `--warning` | `#9a5b00` | in verifica, cautions that are not failures |
| `--danger` | `#c1292e` | errors and destructive actions |

Dark mode is not an inversion of the light palette: it redefines the same roles against
a deep navy ground (`--canvas` `#080e1a`, `--surface` `#0f1828`, `--text` `#e9f1fb`) and
lifts the accent to `#4d90ff` so it keeps its contrast on ink. Light and dark declare the
same vocabulary.

**Light is the default, on every machine.** Dark is an explicit choice — the header
switch, or `Tema` in `/impostazioni/`, which also offers `Sistema` for anyone who wants
the operating system to decide. The sheet contains no `prefers-color-scheme` rule at all:
a device setting the visitor did not make must never restyle the product, and a browser
without JavaScript gets the light world rather than an approximation of it.

The tone wheel is fixed: `--tone-1` `#0b6cfd`, `--tone-2` `#7c5cff`, `--tone-3` `#f2505f`,
`--tone-4` `#f59e0b`, `--tone-5` `#12a150`, `--tone-6` `#06a8c4`, `--tone-7` `#e0447f`,
`--tone-8` `#5566f0`. A category owns one tone for the whole site; a tinted ground is
derived with `color-mix(in srgb, var(--tile-tone) 12%, var(--surface))`, never written as
a second literal.

---

## TYPE

One face: **Inter**, self-hosted as a variable woff2, latin and latin-ext, `font-display:
swap`, both files preloaded. There is no display face and no second UI face — the
hierarchy is weight, size, and colour, which is what makes a 200-tool site feel calm.

**Roboto Mono** survives for one job only: code and machine output (`.json-result`,
`.result-code`, `.csv-preview`, `kbd`). Everything a person reads — including every
computed value — is Inter with `font-variant-numeric: tabular-nums lining-nums`, so digits
never shift width as they change.

No CDN, no font that fails to load and silently falls back.

---

## MATERIAL

- **Cards.** `1px solid var(--border)`, `--radius-lg` (16px), `--surface` ground,
  `--shadow-card` (a 1px edge plus one wide, very low shadow). A card is the only
  container; there is no second "panel" treatment.
- **Radius scale.** `6 / 8 / 12 / 16 / 22 / 999`. Pills are for tags, filters and the two
  round controls (search go, avatar); nothing else is a pill.
- **Depth.** Two shadows only: `--shadow-card` for resting cards, `--shadow-raised` for a
  card under the pointer or an overlay. Never a glow, never a bevel.
- **Icon tiles.** `--icon-tile` is a tinted square (12% tone over the surface) holding a
  `currentColor` glyph — 44px in a card, 64px in a page heading, 96–108px in a hero.
- **Buttons.** Primary is solid `--brand` with `--brand-ink` text and `--radius-md`;
  secondary is a white card with `--border-strong`; ghost is text with a tinted hover.
  Nothing is red except a destructive action.
- **Motion.** 120ms for colour and border, 200ms for a card lift. Reduced motion removes
  all of it.

---

## SURFACES

One shell: `SiteHeader` (brand, three destinations, search, theme, account chip) over
every page, `SiteFooter` under it. The palette (`⌘K` / `Ctrl+K`) is the only overlay and
the only element with the deep shadow.

1. **Homepage** — hero with the one-line promise, a search field, three trust items, the
   ten public categories, the device's own recent tools, an editorial starter set, and a
   closing band with four real numbers.
2. **Directory** (`/strumenti/`) — filters, tabs, sort, and all 200 tools, driven from the
   URL so a filtered view is linkable.
3. **Search** (`/cerca/`) — the query, the honest count, related searches, the device's own
   recent searches, and the ranked results.
4. **Category** (`/categorie/[slug]/`) — the ten public groups over the internal taxonomy.
5. **Tool** (`/tools/[slug]/`) — breadcrumb, tinted tile, title, summary, three trust pills,
   the tool's own surface, four properties, the three steps, the FAQ, related tools.
6. **Workspace** — the tool's own input and the result column, on `.tool-operation`.
7. **Area** (`/preferiti/`) — the tools kept, the tools used, and what the account knows.
8. **Settings** (`/impostazioni/`) — profile, preferences, theme, privacy and security.
9. **Access** (`/accedi/`) — sign in or create an account; the benefits column states only
   what an account really adds.
10. **Onboarding** (`/onboarding/`) — four steps: welcome, what you do, what you use, and
    the tools the answers produce.

Every surface owns the same promise about data: **the file never leaves the device.** A
page that cannot prove a claim does not make it.

---

## HONESTY RULES (binding on every surface)

- No invented number. Counts come from the generated catalog and quality index at build
  time; usage counts come from this device only, and are labelled as such.
- No invented feature. If a control cannot do what its label says, it is not rendered —
  not disabled, not "coming soon".
- No popularity claim: there is no popularity data, so no "più popolari" tab, no badge, no
  ranking. The substitutes are certification, category, alphabetical order, and an
  explicitly editorial selection.
- Nothing about a person's files is stored or displayed beyond the tool's name, the time,
  and — if the tool produced one — the last value it produced.

## ITALIAN-FIRST

Every user-facing string ships Italian-first and is authored in Italian. `lang="it"` is on
the document.

## ITS OWN TEST

`tests/design-system.test.ts` parses the palette table above, checks that the token sheet
declares exactly the same values, that no component stylesheet introduces a local colour
literal or a second spacing scale, that the contrast floors hold in both themes, and that
no declared token is dead. Change a token here and in `src/styles/global.css` together, or
the suite fails.
