# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing, not delegated: Astro 7 + Preact + TypeScript, static build, custom-property CSS (no utility framework), 200 generated tool routes through an in-repo Tool Factory, with Cloudflare Workers Static Assets as the default deployment target. The built `dist/` artifact remains ordinary static output and must stay provider-portable; the only server code is the optional account API in `worker/**`, which serves `/api/**` and delegates every other request to the static assets. A host without that Worker serves the whole site with every tool working and the account controls reporting themselves as unavailable.

## Users

Independent knowledge workers in Italy and elsewhere in the EU: freelancers, consultants, solopreneurs, professional creators, small-agency operators.

They are not "developers who like tools." They are people doing repetitive small jobs all day — cleaning a CSV before sending it to a client, working out how many business days a project has, checking a margin, renaming campaign links, extracting a domain list, preparing a handoff. Each job takes under two minutes of real work and up to fifteen minutes of hunting for the right tool.

The product is judged in the first ten seconds of a job, not over a session.

## Product Purpose

Two hundred small, deterministic, private utilities arranged as one personal workspace that is already set up for the way its owner works.

"Already set up" is the whole promise. The catalog being large is not the point and must never be the visible point; the installed set is the daily experience.

Success means a user opens one tiny tool, completes it, and never thinks about the other 199. It means the workspace is recognizable as theirs — their locale, their currency, their workweek, their recurring jobs — without them configuring anything twice.

## Positioning

The mechanism a neighbouring product cannot copy: **a persistent local workspace that remembers defaults and keeps installed tools, packs, and recent jobs, so the second use of any job is faster than the first, and nothing ever leaves the machine.**

A directory of tools is a catalogue. A workspace is an instrument that has been kept.

Explicit non-claims, from PRODUCT-SPEC.md and competitive research: not novel because of tool count, categories, favorites, client-side privacy, "all-in-one", freelancer-calculator collections, or formula transparency. ToopTools, TinyWow, IT-Tools-class projects, Moderrno, CyberChef, SolveKit, smarterfaster, and FreelTools each own parts of this. Novelty lives only in the full combination.

The public site is Italian-primary. English is present, not primary.

## Operating Context

Work happens in fragments: a message arrives, a file needs cleaning before it can be sent, a number needs checking before it goes in a quote. Files are real files on a real disk — invoices, CSVs, PDFs, images, logs. Time is real time — deadlines, workweeks, local holidays, the user's own timezone.

Most of these jobs are small, repeated, and boring. The user is not seeking novelty; they are trying to stop repeating themselves.

The product is anonymous-first and account-optional. Every tool, every preference and the whole workspace work with no account at all, stored in the browser. An account exists for exactly one reason: so the tools a person keeps follow them to another device. The server holds the account record (email, name, a PBKDF2 hash, sessions) and the list of kept tool ids — never a file, never the content or the result of a job.

## Capabilities and Constraints

Confirmed and binding:

- 200 tools, every one with a real route, real implementation, tests, and a quality receipt. Generated placeholders are prohibited.
- Deterministic and local for normal work. No per-use LLM requirement. No remote user-file database.
- An account is optional and additive: registering, signing in, and the account settings live under `/accedi/` and `/impostazioni/`, and nothing in the tool flow ever requires them. A control for a feature the running deployment cannot serve is not rendered, and the account chip falls back to "Accedi".
- Search and command palette available everywhere; `Cmd+K` on macOS, `Ctrl+K` elsewhere.
- Onboarding generates a small starter set and never interrupts a first task. No onboarding modal may block job completion.
- Anonymity is a functional requirement, not a setting: a shared link must let a visitor finish a job and only then optionally install the tool.
- A public catalog-size claim may count every tool with a real route and implementation (placeholders are prohibited, so the two sets are the same). Certification is a separate, visible fact — "Verificato" against a recorded oracle, "In verifica" otherwise — and the two numbers are never conflated.

Explicitly out of scope, never to reintroduce: ads, generic AI features, runtime plugins, PWA/offline marketing claims, the historical 40-tool wave, and the legacy "signed-in" shell. **Account and cross-device sync are in scope**, at the scope stated above and no wider: no social login, no magic link, no second factor, no email delivery, no server-side storage of anything a tool produces.

Resolved: the public brand name is StrumentiUtili.it. The logo, type licence/source, and accent colour remain design decisions recorded in DESIGN.md rather than product facts.

## Brand Commitments

StrumentiUtili.it is the owner-selected public brand and is the name that should ship on public product surfaces. Any legal/trademark review is tracked separately from implementation of the selected identity.

The public brand is **StrumentiUtili.it** and is Italian-primary. Product copy, repository identity, deployment metadata, and public discovery surfaces should use that identity consistently.

Confirmed voice traits, carried from PRODUCT-MARKETING-CONTEXT.md: plain, concrete, specific, un-hyped, no AI-adjacent language, no invented claims. An instrument does not congratulate you.

Standing category-standard alternative, held open permanently: the owner may at any point choose the familiar, expected version of this product. If chosen, it is executed at full fidelity without irony or smuggled quirks, and a canon card is built to the same craft bar as any alternative.

## Evidence on Hand

Real and must not be fabricated away. Operational counts belong in `PROJECT-STATUS.md`, `HANDOFF.md` and the generated certification index rather than being frozen in this product contract:

- `src/` — working Astro application with 200 tool routes and a generated/lazy runtime architecture.
- `design/WORLD.md` — the canonical visual authority: palette, type, material, surfaces, and the honesty rules. `src/styles/global.css` implements it and `tests/design-system.test.ts` refuses to let the two drift.
- `DESIGN.md` — the structural system: the catalogue (what exists), the tool surface, and the account area as three deliberately distinct layers.
- `worker/**` — the optional account API (Cloudflare Worker + D1): registration, sessions, profile, password, and the synced list of kept tool ids.
- `PRODUCT-SPEC.md` — the full acceptance-criterion contract, US-01 through US-17.
- `design/lane-04/UX-BLUEPRINT.md`, `design/lane-04/DESIGN-SYSTEM-CANDIDATE.md` — the historical "Quiet Workbench" direction, superseded as visual authority by `design/WORLD.md`.
- `.scratch/strumentiutili-v1/` — historical first-validation ticket/provenance material only; it is no longer an active execution queue.
- `quality/receipts/**` — per-tool certification.

Absences future work must not invent: no user testimonials, no customer logos, no performance benchmarks beyond the measured receipts, no pricing, no unapproved logo, no paid-traffic or conversion data, no market-share claims, **no user counts, no popularity ranking, and no "most used" badge** — there is no usage data to rank by, so popularity is never claimed and the substitutes are certification, category, alphabetical order, and an explicitly editorial selection. The public name is StrumentiUtili.it; the 200-tool figure is a build fact, not a popularity claim.

## Product Principles

1. **The installed set is the product.** The catalogue is supply infrastructure and is allowed to feel large only when someone explicitly goes looking.
2. **Never make the user repeat themselves.** A remembered default is worth more than a new tool.
3. **Finish the job before asking for anything.** No account wall, no onboarding modal, no newsletter, no interstitial between a visitor and the result they came for.
4. **Local is a feature you can feel.** Privacy shows up as speed, as files that never upload, as an offline-shaped interface — not as trust-icon theatre.
5. **An instrument, not a dashboard.** No streaks, no scores, no KPI furniture, no activity charts. The work is the content.

## Accessibility & Inclusion

WCAG 2.2 AA is the floor. Full keyboard operation including the command palette; visible focus at every interactive element; `prefers-reduced-motion` honoured; body text at 4.5:1 or better and large text at 3:1 or better; touch targets adequate at 390px. The light ground is what ships and what a first-time visitor gets on any machine; dark is an explicit choice in `/impostazioni/` (with a "Sistema" option for anyone who wants the operating system to decide), so the product is never restyled by a device setting the visitor did not make.

Italian is the primary language: `lang` attributes, and any user-facing string authored in Italian first.
