# Lane 08 — Gold correctness oracle and adversarial fixture factory

Date: 2026-09-23
Status: historical implementation record; superseded by the expanded version-controlled oracle/fixture authority documented in `quality/oracles/README.md`.

## Result

StrumentiUtili.it now has a fail-closed, implementation-independent correctness layer for the catalog. The machine-readable registry covers all 200 candidates in the current discovery map rather than stopping at the required 80. The fixture index contains 44 concrete families rather than the required 25, including all families called out in the lane prompt.

The artifacts are deliberately separate from future production engines:

- `quality/oracles/sources.json` records normative/primary authorities and secondary independent implementations.
- `quality/oracles/registry.json` maps each candidate to maintenance class, source-of-truth references, invariants, adversarial cases, expected-output strategy, security/privacy edges, portability edges, independent cross-check, confidence and gaps.
- `quality/fixtures/index.json` records every fixture family, provenance, rights statement, source references and coverage.
- `quality/fixtures/*/vectors.json` contains known-answer, hand-worked, policy or synthetic vectors.
- `quality/oracles/validate.py` fails closed on count, schema, missing source references, missing provenance, missing fixture files and missing synthetic artifacts.
- `quality/oracles/build_gold_data.py` is preserved only as the retired bootstrap that originally produced this 200-candidate snapshot. It now fails before any filesystem mutation and must not be used to regenerate current canonical data.

## Oracle hierarchy

Gold correctness uses this precedence, consistent with the project quality standard and Lane 05 acceptance seams:

1. Published normative test vector or worked example from the standard owner.
2. Small literal derived directly from a normative grammar/format rule.
3. Independently hand-worked expected result with formula/policy recorded in the fixture.
4. Independent second implementation used as a cross-check, never as the sole unexamined truth source.
5. Property/invariant checks such as idempotence, semantic round-trip, reconstruction or chunk-size independence.

The future implementation under test is never allowed to create its own golden expected result. A cross-check also does not replace a normative literal when one exists.

## Primary-source research

The exhaustive machine-readable bibliography is `quality/oracles/sources.json`. High-reuse authorities checked for this lane include:

| Domain | Primary authority | Exact source used | Oracle role |
|---|---|---|---|
| Unicode normalization | Unicode Consortium | UAX #15, https://www.unicode.org/reports/tr15/ | NFC/NFD/NFKC/NFKD, canonical equivalence, idempotence |
| Unicode segmentation | Unicode Consortium | UAX #29, https://www.unicode.org/reports/tr29/ | grapheme/word boundary policy |
| Unicode security | Unicode Consortium | UTS #39, https://www.unicode.org/reports/tr39/ | confusables and identifier-security adversarial cases |
| Base64 | IETF / RFC Editor | RFC 4648 section 10, https://www.rfc-editor.org/rfc/rfc4648.html | exact empty/f/fo/foo/foob/fooba/foobar vectors |
| SHA-2 | NIST | FIPS PUB 180-4, https://csrc.nist.gov/pubs/fips/180-4/upd1/final | known-answer hash vectors and algorithm authority |
| JSON | IETF / RFC Editor | RFC 8259, https://www.rfc-editor.org/rfc/rfc8259.html | grammar, UTF-8 interoperability, duplicate-name caveat |
| CSV | IETF / RFC Editor | RFC 4180, https://www.rfc-editor.org/rfc/rfc4180.html | quoted delimiters/newlines, escaped quotes, CRLF |
| UUID | IETF / RFC Editor | RFC 9562, https://www.rfc-editor.org/rfc/rfc9562.html | version/variant bits and canonical textual form |
| URLs/query | WHATWG | URL Living Standard, https://url.spec.whatwg.org/ | parsing/serialization, percent encoding, repeated query values, idempotence |
| Time zones | IANA | Time Zone Database, https://www.iana.org/time-zones | zone identifiers and DST transitions |
| Internet timestamps | IETF / RFC Editor | RFC 3339, https://www.rfc-editor.org/rfc/rfc3339.html | UTC/offset date-time grammar |
| iCalendar | IETF / RFC Editor | RFC 5545, https://www.rfc-editor.org/rfc/rfc5545.html | DATE, DATE-TIME and content-line folding |
| Markdown | CommonMark | CommonMark 0.31.2, https://spec.commonmark.org/0.31.2/ | structural Markdown behavior including raw HTML parsing |
| XSS safety | OWASP | XSS Prevention Cheat Sheet, https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html | sanitization boundary and unsafe sinks |
| PNG | W3C | PNG Specification Third Edition, https://www.w3.org/TR/png-3/ | signature, IHDR, dimensions and chunk structure |
| WebP | Google | WebP Container Specification, https://developers.google.com/speed/webp/docs/riff_container | RIFF/WEBP signature and metadata container |
| MIME registry | IANA | https://www.iana.org/assignments/media-types/media-types.xhtml | registered media-type authority |
| ZIP | PKWARE | APPNOTE, https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT | local-header/central-directory signatures |
| DOI | DOI Foundation | DOI Handbook, https://www.doi.org/doi-handbook/html/ | DOI representation and resolver/encoding rules |
| ISBN | International ISBN Agency | Users Manual 7th edition, https://www.isbn-international.org/content/isbn-users-manual/29 | ISBN-10/13 and check-digit authority |
| BibTeX | BibTeX/CTAN | Base distribution, https://www.ctan.org/tex-archive/biblio/bibtex/base/ | entry syntax and standard types; StrumentiUtili.it records remain synthetic |
| QR | ISO | ISO/IEC 18004:2024 metadata, https://www.iso.org/standard/83389.html | format authority only; full normative text is not silently assumed |
| PDF | ISO | ISO 32000-2:2020 metadata, https://www.iso.org/standard/75839.html | format authority only; full conformance requires a licensed parser/standard |

Secondary implementations registered for cross-check include the CPython standard library, OpenSSL digest tooling and the web-platform-tests URL suite. These are cross-checks, not replacements for the owning specification.

## Fixture coverage

The 44 indexed fixture families cover the required prompt surface and additional Wave A/high-reuse primitives. Required families include Unicode normalization; invisible characters and Unicode counting; Base64; SHA-2/file hash; URL percent encoding; query parameters; UTM build/parse/clean; JSON; CSV parsing/cleaning/conversion; date arithmetic; timezone DST; business-day and decimal-hour arithmetic; margin/markup/profitability and marketing math; filename sanitization; MIME/file signatures; Markdown/XSS; synthetic PNG dimensions/metadata/corruption; DOI; ISBN; BibTeX; RIS; and iCalendar.

Additional families cover list/set operations, line sorting, text diff, HTML entities, URL security, QR independent-decode contracts, ZIP/PDF preflight, percentage math, HMAC, JWT inspection, HTTP status semantics and robots directives.

## Provenance and redistribution policy

No external sample corpus is vendored in this lane.

- Specification-backed fixtures use only small factual/known-answer values required to state interoperability behavior.
- BibTeX and RIS bibliographic records are synthetic and authored for StrumentiUtili.it.
- PNG files are generated locally from a tiny deterministic chunk writer and contain synthetic pixels/metadata only.
- No ISO PDF or QR copyrighted conformance corpus is copied. The machine-readable registry explicitly records that the full normative ISO text is paywalled and that deeper Gold conformance needs an independently selected parser/test source with license review.
- Every fixture-index row carries a provenance kind and an explicit `license_or_rights` statement plus source IDs.

## Security and adversarial model

Malformed fixture content is inert test data. Gold tests must exercise parsers or rendered browser surfaces without executing attacker-controlled payloads.

The registry systematically includes the relevant boundaries:

- Markdown/HTML/URL previews: script/event-handler/JavaScript-URL payloads must never execute; sanitization is distinct from parsing.
- Structured text: depth, size, duplicate-key/header and malformed-escape cases must fail recoverably rather than exhaust resources or silently lose data.
- Files/images/PDF/ZIP: signature and extension are not safety claims; corrupted/truncated files, mismatched type labels, decompression/resource bombs and path traversal are adversarial inputs.
- Filename sanitization: the sanitizer returns one filename component only; path authorization remains a separate boundary.
- Secret/token scanners: scanner results can themselves contain sensitive values and must not be uploaded or logged verbatim by default.
- Remote/reference tools: fixture inputs remain local unless an individual tool manifest explicitly declares and discloses network transfer.

## Important policy boundaries

Some product behavior is not defined by a universal standard. In those cases the fixture is explicitly labeled `project-policy` rather than pretending the choice is normative. Examples include whitespace cleaning, stable line-sort comparator, business-day inclusivity, UTM/tracking-key cleanup, filename replacement rules, safe Markdown preview mode and RIS unknown-tag preservation.

The maintenance classes also preserve future review boundaries. Data-backed or regulatory tools cannot inherit an evergreen oracle just because their arithmetic is deterministic; their source version/effective date must be separately bound before Gold.

## Known gaps and fail-closed decisions

1. ISO/IEC 18004 QR and ISO 32000-2 PDF are authoritative but full normative text is not freely bundled. The registry marks this rather than hallucinating hidden clauses or vectors.
2. RIS has legacy vendor lineage and inconsistent freely accessible normative material. The current corpus is intentionally synthetic; an integration lane should pick at least one independent parser and retain unknown tags losslessly.
3. Public holidays, social-platform limits, platform image-size presets and similar live-data tools need versioned source snapshots/freshness monitors before Gold. They are not certified by static fixtures alone.
4. Timezone output depends on tzdb revision. A Gold receipt should record the tzdb/runtime version when the expected result can drift historically.
5. Image/PDF/ZIP correctness beyond signatures and synthetic PNG primitives requires independently maintained decoder/parser acceptance in the implementation lane.

## Integration contract

The future Gold certification pipeline should consume this layer through public behavior seams only:

1. resolve the candidate/tool ID to `quality/oracles/registry.json`;
2. require all declared fixture families for that tool/engine;
3. run exact literal/spec vectors before property tests;
4. run the registered independent cross-check where marked required/recommended;
5. run security/privacy/capability acceptance in the real browser for active-content/file/network boundaries;
6. fail Gold closed on any unresolved required oracle, source freshness failure, cross-browser divergence or correctness bug;
7. write the exact source/fixture versions into the Gold receipt.

The registry is an oracle plan, not production logic. Engines remain free to change implementation as long as public behavior keeps satisfying independent expected values.

## Verification commands

The historical lane is now checked against the current authority with:

    python3 quality/oracles/validate.py
    python3 -m json.tool quality/oracles/sources.json >/dev/null
    python3 -m json.tool quality/oracles/registry.json >/dev/null
    python3 -m json.tool quality/fixtures/index.json >/dev/null
    git diff --check

The final lane response records the observed counts and independent spot-check results.
