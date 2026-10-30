# STR-353 — Visual direction candidates (2026-10-25)

**Status:** comparison prepared for owner selection; **no final direction approved**. Do not merge a candidate palette or information architecture into the public Astro application before the owner's dated choice is recorded in [Prove personali #437](https://github.com/domenicomassafra/Strumentini.it/issues/437) and linked from [#113](https://github.com/domenicomassafra/Strumentini.it/issues/113). [#114](https://github.com/domenicomassafra/Strumentini.it/issues/114) remains open for later implementation.

Open [index.html](index.html) on the Mac Studio in a browser. Select A/B/C, Home/Tool/Result/Account and light/dark. The URL query parameters variant, view and theme are reproducible. File selection, processing, download, login and storage are intentionally absent: this prototype compares information architecture and visual hierarchy, not a running application. The published product remains governed by [design/WORLD.md](../WORLD.md).

## The same evaluation journey across all three directions

1. **Home**: start with an operation, find the local-processing explanation and follow a task.
2. **Tool**: understand the permitted inputs, constraints and next step, then open a visibly fictional result.
3. **Result**: distinguish a non-executed example from a successful computation; do not offer a fake download.
4. **Account**: show an honest empty state, theme choice and privacy without implying a successful login or stored activity.

All three directions have these four views and the same sample text. The preview intentionally uses only local HTML, CSS, JavaScript and system fonts. No external asset or font download is needed.

## Direction A — Essential and rigorous

Flat horizontal navigation, predictable aligned cards, one blue action hue and modest radii. The home scan begins with search and a concise tool list. The result page privileges certainty over decorative success states.

- Proposed tokens: page #f5f8fb, surface #ffffff, text #15263b, secondary #4d6074, action #145c99, radius 6px.
- Dark sample: page #0e1825, surface #192838, text #f1f7fd, action #80c3fb.
- Opportunity: quickest path for first-time visitors and the least risky transition from the current canonical design.
- Cost: conservative visual identity; may not meet the owner's ambition for a clearly different product.

## Direction B — Editorial and recognisable

A warm reference desk: two-column page, serif Georgia headlines, terracotta accents and a numbered left index on desktop. On mobile the index moves to a short top navigation.

- Proposed tokens: page #f7f1e6, surface #fffdf6, text #382219, secondary #765047, action #963c26, square radius.
- Dark sample: page #221a18, surface #302421, text #fff3e7, action #ffbc97.
- Opportunity: more distinctive without imported illustrations or proprietary font files.
- Cost: larger headings and lower information density demand extra attention to Italian copy and narrow layouts.

## Direction C — Task and workspace

A workspace shell with persistent wide-screen task rail, two-panel operation and result layouts, violet focus/action hierarchy and grouped step-by-step controls. The rail becomes top navigation on tablets and phones.

- Proposed tokens: page #f0f0fb, surface #ffffff, text #231b41, secondary #524a70, action #6242b5, radius 15px.
- Dark sample: page #0d1227, surface #19203d, text #f0ecff, action #c2adff.
- Opportunity: strongest continuity for repeat multi-tool workflows.
- Cost: more permanent navigation consumes desktop space; mobile must preserve keyboard and touch access.

## Owner decision rubric

| Criterion | A | B | C |
|---|---|---|---|
| Immediate first-task comprehension | Strong | Good | Strong |
| Distinctive editorial identity | Restrained | Strong | Distinctive |
| Repeat multi-tool workflow | Good | Moderate | Strong |
| Small-screen density | Strong | Good | Good after rail collapse |
| Migration from current token system | Simplest | Medium | Medium |

These are design hypotheses to help the owner's choice, not user-study scores or acceptance PASS.

## Existing sources and rights

- Canonical existing code and tokens: [design/WORLD.md](../WORLD.md), source styles, Astro pages and components at the worktree's starting main SHA 3f716074cebefb996e26d7c30b2835aecdab4401.
- Historical existing donor: [lane-04 quiet-workbench](../lane-04/prototypes/quiet-workbench.html), together with its UX blueprint and design-system candidate. Its workbench concept informed proposal C; its source markup and its Google Fonts imports have not been copied into these proposals.
- Owner requirements: [OWN-17](../../docs/HANDOFF-DECISIONI-E-TICKET-STRUMENTINI-2026-10-10.md) demands three genuinely different directions on Home/Tool/Result/Account, desktop/mobile, before owner selection.
- Latest instruction: [#437 comment of 2026-10-25 14:49 UTC](https://github.com/domenicomassafra/Strumentini.it/issues/437#issuecomment-6399102136), explicitly asking agents to prepare 2–3 complete proposals.

All prototype markup/styles are authored in this repository. No new third-party dependency, logo, artwork or redistributed font files; built-in system UI/Georgia stacks avoid new font-license obligations. Separate contrast computation on the action/text pairs yields 6.48:1–16.1:1 in light/dark, but full WCAG validation is still required after a choice.

## Preview acceptance and final integration gate

Run the browser acceptance with the Mac Studio resource guard and Node:

    python3 ~/.local/share/controlcenter/resource-guard/workload_launcher.py build -- node tests/str-353-proposals.browser.mjs

The test covers 3 variants × 4 screens × 5 widths (320, 390, 768, 1024, 1440), theme switching, keyboard focus, simulated 200% CSS zoom, in-preview task routing and URL readback, and verifies that the preview makes no external network requests. Browser checks do not simulate account or file processing.

**When the owner chooses:** record the date/variant in #437/#113 and then implement the selected direction in the canonical source: update WORLD.md and CSS token roles together, preserve Italian SEO and actual routes, tool/refusal behavior, guest/account states, local-file privacy, focus and keyboard navigation. Compare compiled before/after golden screens at 320/390/768/1024/1440 in both themes and 200% zoom. Validate positive input and truthful refusal with a built consumer, CI and remote main readback. If a new font is approved, perform source/license diligence. Publishing remains governed separately by release gates #80/#162.

This candidate PR is not itself completion of AC-353.1–3: those explicitly require the owner-selected, implemented baseline.
