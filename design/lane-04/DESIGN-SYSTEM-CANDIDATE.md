# Strumentini.it Design System Candidate

Status: candidate only — intended to guide prototypes and implementation planning
Date: 2026-09-23
Design territory: **Quiet Workbench**

## Intent

The visual system should make hundreds of capabilities feel like one dependable instrument.

The memorable trait is not decoration. It is **calm precision at professional density**.

This candidate intentionally avoids:

- generic SaaS gradients;
- glassmorphism;
- giant rounded cards;
- neon “AI” palettes;
- literal toolbox/wrench motifs;
- dashboard KPI furniture;
- excessive pill controls;
- marketing illustration inside task surfaces;
- animations that delay work.

## Aesthetic direction

**Direction:** industrial/utilitarian softened by warm paper-like neutrals
**Decoration:** minimal, intentional
**Layout:** grid-disciplined application shell; slightly more editorial freedom on public marketing pages
**Color:** restrained — one action accent plus semantic colors
**Motion:** minimal-functional
**Density:** comfortable-compact on desktop, comfortable on touch

### Safe choices

- conventional left navigation on desktop;
- visible global search;
- familiar list, input, table and button affordances;
- strong text contrast;
- 4 px spacing basis;
- obvious keyboard focus.

### Deliberate risks

1. **Warm neutral canvas instead of sterile blue-gray SaaS chrome.**
   Gain: calmer, more distinctive “desk surface” quality.
   Cost: must keep white/surface layers crisp enough to avoid looking beige or editorial.

2. **Rows and slots instead of a default bento/card grid.**
   Gain: scales to hundreds of tools and feels like software rather than a landing page.
   Cost: visual design has to rely on typography, spacing and icon quality rather than decorative cards.

3. **Runtime/privacy status as plain language, not trust-icon theater.**
   Gain: useful trust signal and clear differentiation.
   Cost: requires accurate runtime metadata for every tool.

## Typography

Recommended pairing:

- **Display / headings:** Instrument Sans
- **Body / UI:** Instrument Sans
- **Data / code / identifiers:** IBM Plex Mono

Why:

- Instrument Sans is neutral but not anonymous, with enough character for a brand-neutral prototype;
- one sans family keeps dense application surfaces coherent;
- IBM Plex Mono provides strong tabular/technical rhythm without making the whole product feel developer-only.

Fallback stack:

```css
font-family: "Instrument Sans", "Helvetica Neue", Arial, sans-serif;
font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
```

Do not use monospace for ordinary labels or navigation.

### Type scale

| Token | Size / line | Weight | Use |
|---|---:|---:|---|
| display | 40 / 44 | 600 | public hero only |
| h1 | 30 / 36 | 600 | tool / workspace title |
| h2 | 22 / 28 | 600 | major section |
| h3 | 17 / 24 | 600 | subsection |
| body-lg | 17 / 26 | 400 | explanatory lead |
| body | 15 / 22 | 400 | default UI copy |
| body-sm | 13 / 18 | 400 | secondary text |
| label | 12 / 16 | 600 | section / field meta |
| mono | 13 / 20 | 450 | data, hashes, code |

Use sentence case. Avoid uppercase for navigation and buttons. Small uppercase is permitted only for very short metadata labels with increased tracking.

## Color

### Light theme

| Token | Value | Purpose |
|---|---|---|
| canvas | `#F7F6F2` | app background |
| surface | `#FFFFFF` | working surface |
| surface-subtle | `#EFEEE8` | secondary rows / selected regions |
| ink | `#141512` | primary text |
| ink-muted | `#5E625A` | secondary text |
| ink-faint | `#7C8077` | metadata |
| border | `#D8D7D0` | default dividers |
| border-strong | `#B8BAB1` | emphasized control boundary |
| action | `#2459D3` | primary interactive accent |
| action-hover | `#1D49AF` | hover/pressed |
| action-soft | `#E7EDFC` | selected / information tint |
| success | `#1D704B` | success |
| warning | `#8A5A00` | warning |
| danger | `#B52A2A` | destructive / error |
| info | `#315E9B` | informational |

### Dark theme

Dark mode is a surface redesign, not a simple inversion.

| Token | Value |
|---|---|
| canvas | `#11120F` |
| surface | `#191A17` |
| surface-subtle | `#22231F` |
| ink | `#F4F3EF` |
| ink-muted | `#B5B7AF` |
| ink-faint | `#8E9188` |
| border | `#343630` |
| border-strong | `#4B4E46` |
| action | `#7B9EF7` |
| action-hover | `#9AB5FA` |
| action-soft | `#1D2A4A` |
| success | `#67C392` |
| warning | `#E4B25B` |
| danger | `#F07A78` |
| info | `#7EABE8` |

### Color rules

- action color is rare and means “interactive or selected,” not decoration;
- semantic colors never carry meaning alone;
- tool categories should use glyphs/text before color coding;
- pack colors, if introduced, must not become a rainbow sidebar;
- backgrounds never use gradients in the work surface;
- public marketing may use extremely subtle tonal fields, not glossy blobs.

## Spacing

Base unit: **4 px**

Scale:

- 2: 2 px
- 4: 4 px
- 8: 8 px
- 12: 12 px
- 16: 16 px
- 20: 20 px
- 24: 24 px
- 32: 32 px
- 40: 40 px
- 48: 48 px
- 64: 64 px

Default desktop control gap: 8–12 px.
Default section gap: 24–32 px.
Public marketing can use 48–80 px section spacing.

## Layout

### Desktop application

- 12-column conceptual grid;
- 24–32 px page gutter;
- 216–248 px left rail;
- work surface max width 1120–1280 px for form-like tools;
- data-heavy tools may expand to available width;
- optional context panel 280–340 px.

### Tablet

- collapse persistent rail to icon/label drawer;
- preserve two-pane tool layouts where both panes remain >= 320 px;
- otherwise switch to vertical operation flow.

### Mobile

- one primary column;
- 16 px edge gutter;
- full-width controls;
- 44 px minimum interactive target;
- fixed bottom navigation only at top-level product surfaces;
- no horizontal scrolling except purpose-built data tables with explicit affordance.

## Radius and border system

Use radii to clarify nesting, not to make every surface “friendly.”

- radius-xs: 3 px — chips, focus geometry
- radius-sm: 6 px — inputs, buttons
- radius-md: 10 px — dialogs, grouped surfaces
- radius-lg: 14 px — rare public/empty-state containers
- full: 999 px — status dots/tags only

Most list rows do not need a bounding card.

Borders:

- 1 px default;
- use separators between dense rows;
- avoid shadow + border + tinted background simultaneously.

## Elevation

Elevation is exceptional.

Level 0:

- page and inline surfaces;
- no shadow.

Level 1:

- menus, command palette, popovers;
- subtle shadow plus border.

Level 2:

- blocking dialog only.

Avoid floating cards throughout the dashboard.

## Icon approach

Use one consistent outline icon set with:

- 1.5–2 px stroke;
- 16 px default;
- 20 px major navigation;
- 24 px only for empty states / tool identity.

Tool glyphs should communicate input/action where possible:

- table;
- image;
- document;
- code brackets;
- calendar;
- calculator;
- link.

Avoid unique illustrated icons for hundreds of tools; they become noisy and expensive to maintain.

Category distinction should come from:

1. label;
2. consistent glyph family;
3. optional subdued accent.

## Component inventory

### Shell

- AppRail
- MobileBottomNav
- GlobalSearchTrigger
- CommandPalette
- PageHeader
- Breadcrumbs
- AccountSyncStatus

### Workspace

- ToolRow
- ToolSlot
- RecentRow
- SuggestionRow
- ReasonLabel
- PackSourceLabel
- WorkspaceEmptyState
- ReorderHandle

### Library

- LibrarySearch
- FilterBar
- FilterChip
- ResultList
- ToolResultRow
- PackResultRow
- ZeroResultsState
- RequestToolAction

### Tool operation

- ToolHeader
- RuntimeBadge
- ProfileDefaultBadge
- Field
- UnitField
- TextArea
- FilePicker
- FileQueue
- DropZone
- PrimaryAction
- ResultPanel
- ResultActionBar
- CopyAction
- DownloadAction
- ResetAction
- HandoffRow
- MethodologyDisclosure
- RelatedToolRow

### Packs

- PackHeader
- PackToolChecklist
- PackInstallSummary
- PackReason
- InstalledCount

### Profile

- ProfileField
- UsedByList
- LocalSyncBadge
- OverrideExplanation

### Feedback / state

- InlineError
- Banner
- Toast
- Progress
- Skeleton
- EmptyState
- CapabilityWarning
- ConfirmationDialog

## Component anatomy

### ToolRow

Height:

- desktop compact: 44 px;
- desktop comfortable: 52 px;
- touch: 52–56 px.

Slots:

```
[icon] [name + optional task] [reason/meta] [runtime] [Open/Add]
```

Only the primary action uses action color.

### Search result

Search results should be list rows, not cards.

```
Image Compressor
Resize/compress images locally
Image · Runs on this device                Open
```

Matched query terms may be emphasized with weight, not fluorescent highlights.

### Runtime badge

Three core visual states:

- local;
- network;
- upload.

Badge text is always visible. Icon alone is insufficient.

### Reason label

Format:

> Because you chose Marketing + URLs

Max one line in lists. Full explanation is available on demand.

## Form system

### Labels

Always persistent above the control.

Optional / required status is textual when ambiguity matters.

### Inputs

Desktop default height: 40 px.
Touch default height: 44–48 px.

Focus:

- 2 px outer ring;
- high-contrast action color;
- never rely on border-color change alone.

### Help text

Only include when it prevents an error.

Prefer:

> Used as the source timezone.

Avoid:

> Please enter your timezone in the field above.

### Errors

Show:

- what is wrong;
- where;
- how to fix it.

Preserve the user's input.

## Tables and data

- use tabular numerals;
- sticky headers when vertical scrolling is meaningful;
- left-align text, right-align comparable numbers;
- do not center whole tables;
- row height 36–44 px desktop;
- visible selected row state;
- allow horizontal scrolling on mobile only for inherently tabular data;
- provide a stacked summary alternative for critical result data.

## Command palette

Width: 640–760 px desktop.
Max height: ~70 vh.

Structure:

```
[search ................................]

YOUR TOOLS
...
RECENT
...
LIBRARY
...

[↑↓ navigate] [Enter open] [Esc close]
```

Keyboard behavior:

- arrow keys move active result;
- Enter opens;
- Cmd/Ctrl+K toggles;
- Esc closes;
- focus returns to the invoking control;
- active option is announced to assistive tech.

## Empty states

Every empty state must answer:

1. what is empty;
2. why that is normal;
3. what the user can do next.

Example — Your Tools:

> No tools added yet.
> Add a few from the Library or build a starter set from your work profile.

Primary: **Build my starter set**
Secondary: **Browse Library**

No decorative illustration is required.

## Loading and progress

For local sub-100 ms operations: no spinner; update immediately.

For perceptible local operations:

- inline progress;
- keep controls stable;
- allow cancel when meaningful.

For uploads/network:

- name the network step;
- show progress when measurable;
- keep privacy/runtime detail accessible.

Never fake progress bars.

## Motion

Motion should explain state, not add spectacle.

Durations:

- focus/hover: 80–120 ms;
- menu/palette: 120–180 ms;
- panel change: 160–220 ms;
- no long entrance choreography.

Properties:

- opacity;
- transform <= 4 px;
- background/border transition.

Avoid:

- springy cards;
- hover lifts on every row;
- looping gradients;
- animated backgrounds;
- count-up numbers;
- staggered dashboard entrances.

Respect `prefers-reduced-motion`.

## Accessibility contract

Minimum:

- WCAG 2.2 AA target;
- 4.5:1 body text contrast;
- 3:1 large text and meaningful UI graphics;
- 44×44 px touch targets where touch applies;
- visible keyboard focus;
- semantic landmarks;
- sequential heading structure;
- explicit form labels;
- error summary for multi-field tools when useful;
- status updates exposed through appropriate live regions;
- no color-only state;
- drag/drop always has button/keyboard equivalent;
- dialogs trap focus and restore it on close;
- command palette follows combobox/listbox semantics;
- skip link on long public/tool pages;
- reduced-motion support;
- zoom to 200% without loss of function;
- layouts tolerate long localized strings.

### Keyboard baseline

Users can:

- navigate top-level app chrome;
- open search;
- move through results;
- add/remove a tool;
- operate every form field;
- submit;
- reach output actions;
- follow a compatible handoff;
- open/close disclosures and dialogs;
- recover from errors.

No core action is hover-only.

## Responsive behavior rules

Responsive does not mean “stack all cards.”

At each breakpoint, decide:

- what remains visible;
- what becomes a disclosure;
- what moves to a different navigation surface;
- which actions become sticky;
- whether two-pane operations still fit;
- whether dense metadata is hidden behind “Details.”

### Recommended breakpoints

- compact: < 640 px;
- medium: 640–959 px;
- wide: >= 960 px;
- very wide: >= 1440 px.

Do not bind layout logic to device names.

## Public / marketing surface

The application shell and public pages should be related but not identical.

Public page can use:

- larger typography;
- more whitespace;
- one strong product screenshot;
- proof-driven sections.

Still avoid:

- three generic benefit cards immediately under a gradient hero;
- floating logos;
- giant “AI” orb;
- “Built for modern teams” boilerplate;
- fake dashboards with meaningless metrics.

Public page hierarchy:

1. problem / promise;
2. live or visual example of the personal workbench;
3. anonymous-use proof;
4. Work Profile / packs explanation;
5. privacy/runtime proof;
6. Library breadth as supporting evidence, not hero.

## Trust presentation

Trust claims live close to the relevant action.

Examples:

File picker:

> Runs on this device. The file is not uploaded.

Network lookup:

> Checks this public URL over the network. Your Work Profile is not sent.

Synced preference:

> Currency is synced with your account. Tool inputs are not.

Avoid a single global “Privacy-first” badge as a substitute for per-tool truth.

## Ad treatment if monetization introduces ads

Allowed:

- clearly labeled block after the operation and primary result;
- reserved-size placement to avoid layout shift;
- public editorial/library page placement.

Not allowed:

- inside form groups;
- next to primary buttons in a way that causes misclicks;
- between operation and result;
- inside command palette;
- inside onboarding;
- inside Work Profile;
- inside sensitive security/secret utilities;
- modal/interstitial inventory.

## Design QA checklist

Before a screen is considered design-complete:

- can the user identify the primary action in three seconds?
- is the full catalog absent unless intentionally requested?
- is search visible or one obvious action away?
- are installed and catalog states visually distinct?
- are profile-fed defaults visible?
- is runtime/privacy behavior stated near the operation?
- are empty, loading, success and error states specified?
- can the flow be completed by keyboard?
- do 200% zoom and long strings preserve function?
- does mobile preserve task hierarchy rather than merely stack desktop regions?
- is any decorative element competing with the work?
- does every card/panel earn its boundary?
- does the screen still make sense with all icons removed?
- is AI absent unless it provides measurable task value?

## Candidate token block

```css
:root {
  --canvas: #F7F6F2;
  --surface: #FFFFFF;
  --surface-subtle: #EFEEE8;
  --ink: #141512;
  --ink-muted: #5E625A;
  --ink-faint: #7C8077;
  --border: #D8D7D0;
  --border-strong: #B8BAB1;
  --action: #2459D3;
  --action-hover: #1D49AF;
  --action-soft: #E7EDFC;
  --success: #1D704B;
  --warning: #8A5A00;
  --danger: #B52A2A;
  --info: #315E9B;

  --radius-xs: 3px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

These values are candidates, not brand-locked tokens. The structure is more important than preserving a particular accent before the public naming/identity sprint is complete.
