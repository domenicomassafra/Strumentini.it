# Strumentini.it — Structural Design

The visual authority is `design/WORLD.md`; this document owns the **structure** —
what surfaces exist, what each one is for, and how they fit together. Where the
two disagree about a colour, `WORLD.md` wins; where they disagree about a route,
this document wins.

## 1. Outcome

A visitor arrives with one small job. Within one screen they can either describe
it in a search field or recognise it on a card, and within one more click they
are running it. Nothing is asked of them: no account, no install, no cookie
banner, no modal. Everything the site keeps — the tools they chose, their work
profile, their theme — is kept in their own browser, and that fact is stated on
the surfaces that store it rather than buried in a policy page.

An account exists and is optional. It carries exactly one thing the browser
cannot: the list of tools a person keeps, so it follows them to another device.

## 2. The three layers

| Layer | Routes | Question it answers |
|---|---|---|
| **Catalogue** | `/`, `/strumenti/`, `/categorie/`, `/categorie/<slug>/`, `/cerca/`, `/risorse/` | "Which tool do I need?" |
| **Tool** | `/tools/<slug>/` (×200) | "Do the job." |
| **Account** | `/accedi/`, `/preferiti/`, `/impostazioni/` | "What is mine, and what do you know about me?" |

Plus one shell that every page shares (`src/components/shell/**`): a header with
the brand, three destinations, the search control, the theme switch and the
account chip; a footer with the catalogue columns and the telemetry disclosure.

`/onboarding/` is the one-time path that fills the workspace from four answers.
`/library/` is a permanent redirect to `/strumenti/` — kept so old links and
bookmarks keep working.

## 3. Catalogue layer

### Homepage — `/`
Hero (one-line promise, the search field, which is the same control as `⌘K`),
three trust facts, the ten public categories, the tools **this device** last used
(hidden when there are none), an explicitly editorial starter set of eight, and a
closing band with four real numbers. No popularity, no testimonials, no user
counts — see `WORLD.md` § HONESTY RULES.

### Directory — `/strumenti/`
All 200 tools, server-rendered. Tabs: everything / verified / by category.
Filters: free text over name and category, plus the ten public groups, the input
types the catalogue actually declares, and certification state. Sort: name A–Z,
name Z–A, category, verified first. Pagination: 24 per page. Every filter, the
sort and the page live in the URL (`?q=&gruppo=&tipo=&qualita=&ordine=&vista=&pagina=`)
so a view can be linked, bookmarked and restored on back-navigation.

### Public categories — `/categorie/` and `/categorie/<slug>/`
The ten public groups in `src/catalog/groups.ts` sit **over** the thirteen
internal `ToolManifest.category` values, which are bound into 200 manifests and
the certification index and are therefore not renamed. `memberCategories` is the
entire mapping. A group page carries: hero, sub-category pills drawn from the
internal categories (real counts), an editorial trio, the full grid with the same
sort, and the other groups.

### Search — `/cerca/`
The results surface behind the palette: the query, the honest count, suggested
searches, **this device's** recent searches, the category facet of the current
result set, and the ranked rows. `noindex`.

### Resources — `/risorse/`
One hub for what does not belong on a tool page: how a tool runs, what is stored
locally (with the real key names), the faq, what certification means, and what an
account does and does not add. It is the page the header's `Risorse` link opens.

## 4. Tool layer

Every one of the 200 pages is `src/pages/tools/<slug>.astro` wrapping
`ItalianToolPage` around one implementation island. `ItalianToolPage` renders, in
order: breadcrumb, tinted icon tile, title, summary, three trust pills, the island,
four properties, the three steps, the why/faq block, related tools, and a closing
band. It is generated from the manifest — no page carries bespoke structure.

The tool's own surface is the two-column frame in `src/styles/global.css`:
`.tool-operation` is the input column plus `--gutter-width` on the right for the
result, which drops below the input at 900px and never disappears.

**Everything visual for all 200 pages comes from two stylesheets** —
`src/styles/global.css` (tokens + the shared vocabulary) and
`src/components/tools/tool-surface.css` (renderer-specific blocks). No tool
component declares a colour, a spacing step or a radius; this is enforced by
`tests/design-system.test.ts`.

## 5. Account layer

- `/accedi/` — sign in or create an account. The benefits column states only what
  an account really adds. No social login, no magic link, no password-reset link
  (no email provider is configured), and a deployment without the API says so
  instead of pretending.
- `/preferiti/` — the area: what this device used last, the tools kept, recent
  activity (tool names and times only — never a file name or a result), and
  suggestions derived from the categories actually in use.
- `/impostazioni/` — account (name, sessions, password, deletion), work profile,
  theme, and the privacy panel which lists the exact local keys and offers to
  clear or export them.

The member list is `WorkbenchState.installedTools` in IndexedDB — one concept,
not a second "favourites" store. `src/workbench/membership.ts` is its only
reader/writer and reconciles it with the account when a session exists.

## 6. Onboarding — `/onboarding/`

Four steps, pre-filled from stored state on every visit:

1. **Benvenuto** — what is about to happen, and a skip to the catalogue.
2. **Cosa vuoi fare?** — up to three work contexts (max 3, at least one).
3. **Quali categorie usi di più?** — the recurring jobs.
4. **I tuoi strumenti consigliati** — the generated set with a visible,
   computed reason per tool, plus a catalogue search for manual additions.

Save writes `installedTools`, the chosen packs and a default work profile, then
goes to `/`. The work profile itself is edited in `/impostazioni/`, not here.

## 7. Search and command

One implementation (`src/search/search.ts`) behind two entry points: the `⌘K` /
`Ctrl+K` palette (available on every page, its trigger is the header control) and
`/cerca/`. It scores name, alias, jobs, category, input types, pack tags and
summary, and tiers results by context (installed, recent, pack, catalogue). The
full catalogue projection is imported lazily — never on first paint, asserted by
`tests/catalog-performance.test.ts` and by the discovery acceptance script.

## 8. Local state, and what leaves the device

| Where | Key | Holds |
|---|---|---|
| IndexedDB | `utility-workbench` / `state` / `workbench/state:v1` | kept tools, packs, work profile, preferences, recents |
| localStorage | `strumentini:last-values:v1` | the last value each tool produced (bounded, truncated) |
| localStorage | `strumentini:theme:v1` | `light` \| `dark` \| `system`; absent means light |
| localStorage | `strumentini:recent-searches:v1` | the last few search queries |
| sessionStorage | `strumentini:workbench-context:v1` | search ⇄ workbench context for this tab |

Nothing else. No file a visitor opens is uploaded, and no result of a job is sent
anywhere. On the server side the account API stores only: email, name, a PBKDF2
hash, session records, and the list of kept tool ids.

## 9. Responsive hierarchy

Mobile-first, two shared breakpoints (900px, 1200px) declared once in
`src/styles/global.css`. Below 1060px the header collapses to brand + search +
account + menu, and navigation, theme and the account links move into a panel.
The result column, the directory sidebar and the account sidebar all stack. Every
surface is checked at 390px; horizontal overflow is a defect.

## 10. Accessibility floor

WCAG 2.2 AA. Visible focus everywhere via one `:focus-visible` rule; native
`<dialog>` for the palette with focus restored to the invoking control; native
`<details>` for menus; `aria-current` on navigation; touch targets of 44px in the
mobile range; `prefers-reduced-motion` honoured; colour pairs held to their
contrast floor by `tests/design-system.test.ts`.
