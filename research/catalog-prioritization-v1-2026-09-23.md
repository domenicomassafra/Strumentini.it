# Catalog prioritization v1 — 2026-09-23

Status: research prioritization, not implementation authorization.

## Principle

The project can own a 200+ candidate catalog while publishing only tools that pass Gold quality.

Do not launch 200 tools at once.

Use waves:

- Wave A: foundational primitives and high-frequency utilities;
- Wave B: professional-pack depth;
- Wave C: heavy/local file capabilities;
- Wave D: live-data and regulated tools only after update machinery exists.

## Scoring dimensions

Every candidate should eventually receive 0–5 scores for:

- task frequency;
- usefulness to multiple packs;
- browser/local feasibility;
- correctness testability;
- maintenance burden;
- competitor saturation;
- search/discovery value;
- repeat-use potential;
- Work Profile leverage;
- context-handoff leverage.

Tools with high maintenance and weak differentiation should not enter early waves even if they have search volume.

## Wave A — first 40 Gold targets

These are selected because they create shared primitives and useful professional packs without depending on volatile regulation or AI.

### Text / lists

1. Word/character/line counter
2. Whitespace normalizer
3. Invisible-character detector
4. Line sorter
5. Line deduplicator
6. List intersection/difference
7. Text diff
8. Markdown preview

### Data / tables

9. CSV viewer
10. CSV cleaner
11. CSV delimiter/encoding detector
12. CSV deduplicator
13. CSV column select/reorder
14. CSV filter/sort
15. CSV to JSON
16. JSON to CSV

### Developer / web

17. JSON formatter/validator
18. YAML formatter/validator
19. Base64 encode/decode
20. Hash generator
21. UUID generator
22. URL encode/decode
23. Query-string editor
24. Unix timestamp converter

### Work / planning

25. Business-day calculator
26. Timezone converter
27. Multi-timezone overlap
28. Decimal-hours converter
29. Hour/day/project rate converter
30. Effective hourly rate
31. Margin/markup calculator
32. Project profitability calculator

### Marketing / URLs

33. UTM builder
34. UTM parser
35. Tracking-parameter cleaner
36. QR generator

### Files / images

37. Image resize
38. Image format conversion
39. Image compression
40. File hash/checksum verifier

## Why these 40

They establish reusable engines:

- text transform;
- diff/set operations;
- CSV/table engine;
- structured-data parsing;
- encoding/hashing;
- date/time engine;
- business calculation engine;
- URL engine;
- image pipeline;
- file stream/hash pipeline.

Those engines can later generate many Gold tools without duplicating implementation logic.

## Wave B — pack depth

After Wave A works:

- proposal budget checker;
- scope-creep cost;
- utilization/capacity;
- retainer capacity;
- payment-fee gross-up;
- deadline calculator;
- campaign naming;
- social character limits;
- ROAS/CPA/CPC;
- quick charts;
- DOI/ISBN helpers;
- BibTeX/RIS;
- citation dedupe;
- timeline sorter;
- PDF basic operations.

Goal: make Consultant, Marketing, Research and Developer/Data packs genuinely different.

## Wave C — heavy local capabilities

Only after worker/WASM/performance infrastructure exists:

- PDF merge/split/render/extract;
- large file/folder inventories;
- ZIP/archive operations;
- perceptual image duplicates;
- metadata risk inspection;
- contact/calendar import/export tools;
- OCR if quality and mobile cost are acceptable.

## Wave D — live/regulatory

Delay until provenance/update machinery exists:

- currency live rates;
- public holiday data;
- country-specific VAT/tax;
- payroll;
- legal or statutory calculations.

These can be valuable acquisition tools, but they have a different maintenance contract.

## Explicitly deprioritized

- AI rewriting/summarization as generic features;
- video/audio conversion in early waves;
- social-media downloaders;
- health-risk calculators;
- legal advice;
- password/security claims that require specialist audit;
- fake novelty through dozens of near-identical calculators;
- tools whose only purpose is another SEO page.

## Pack coverage after Wave A

### Consultant / Independent Work

- rate converter;
- effective hourly rate;
- margin/markup;
- profitability;
- business days;
- timezone overlap;
- CSV/PDF/image helpers as universal dependencies.

### Marketing

- UTM builder/parser;
- tracking cleanup;
- QR;
- CSV tools;
- image tools;
- timezone/business-day utilities.

### Research

- text stats/diff;
- CSV/JSON;
- timestamps/dates;
- hashing;
- Markdown.

### Developer/Data

- JSON/YAML;
- Base64;
- hashes;
- UUID;
- URL/query;
- timestamps;
- CSV transforms.

The first wave already supports four visibly different workspaces without building four independent products.

## Scale rule

Do not set a launch target such as "200 tools by date X".

Set a quality rule:

> Publish the next batch only when the previous public Gold set remains green.

This is how the project can exploit abundant coding/research capacity without turning abundance into maintenance debt.

