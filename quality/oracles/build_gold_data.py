#!/usr/bin/env python3
from __future__ import annotations

import binascii
import json
import re
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ORACLES = ROOT / "quality" / "oracles"
FIXTURES = ROOT / "quality" / "fixtures"

# RETIRED HISTORICAL BOOTSTRAP. This file is kept only to preserve the original
# 200-candidate construction history. It must never write current canonical
# oracle/fixture data. Fail unconditionally before mkdir(), dump(), or any other
# filesystem mutation so missing/corrupt current metadata cannot reopen the old
# destructive bootstrap path.
raise SystemExit(
    "build_gold_data.py is retired and cannot write canonical oracle/fixture data; edit the version-controlled authority and run quality/oracles/validate.py instead."
)

# Historical implementation below is intentionally unreachable.
ORACLES.mkdir(parents=True, exist_ok=True)
FIXTURES.mkdir(parents=True, exist_ok=True)


def dump(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


SOURCES = [
    {"id":"strumentini-quality","source_class":"project-policy","authority":"Strumentini.it","locator":"docs/07-tool-factory-quality-standard.md","supports":["Gold quality gate","independent oracle rule","maintenance classes"]},
    {"id":"strumentini-lane05","source_class":"project-policy","authority":"Strumentini.it","locator":"docs/architecture/lane-05-test-seams-and-acceptance.md","supports":["public behavior seams","Wave A oracle mapping","fixture dimensions"]},
    {"id":"unicode-uax15","source_class":"official-primary","authority":"Unicode Consortium","url":"https://www.unicode.org/reports/tr15/","locator":"UAX #15 Unicode Normalization Forms, revision 58 / Unicode 18.0.0","supports":["NFC","NFD","NFKC","NFKD","normalization idempotence"],"checked_at":"2026-09-23"},
    {"id":"unicode-uax29","source_class":"official-primary","authority":"Unicode Consortium","url":"https://www.unicode.org/reports/tr29/","locator":"UAX #29 Unicode Text Segmentation","supports":["grapheme","word and sentence boundaries"],"checked_at":"2026-09-23"},
    {"id":"unicode-uts39","source_class":"official-primary","authority":"Unicode Consortium","url":"https://www.unicode.org/reports/tr39/","locator":"UTS #39 Unicode Security Mechanisms","supports":["confusables","identifier security"],"checked_at":"2026-09-23"},
    {"id":"whatwg-encoding","source_class":"official-primary","authority":"WHATWG","url":"https://encoding.spec.whatwg.org/","locator":"Encoding Standard","supports":["UTF-8","BOM","decoder behavior"],"checked_at":"2026-09-23"},
    {"id":"whatwg-url","source_class":"official-primary","authority":"WHATWG","url":"https://url.spec.whatwg.org/","locator":"URL Living Standard, last updated 2026-09-10","supports":["URL parsing","serialization","percent encoding","URLSearchParams","idempotence"],"checked_at":"2026-09-23"},
    {"id":"whatwg-html","source_class":"official-primary","authority":"WHATWG","url":"https://html.spec.whatwg.org/","locator":"HTML Living Standard","supports":["named character references","HTML parsing"],"checked_at":"2026-09-23"},
    {"id":"rfc4648","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc4648.html","locator":"RFC 4648, section 10 test vectors","supports":["Base64","Base32","Base16"],"checked_at":"2026-09-23"},
    {"id":"nist-fips180-4","source_class":"official-primary","authority":"NIST","url":"https://csrc.nist.gov/pubs/fips/180-4/upd1/final","locator":"FIPS PUB 180-4 Secure Hash Standard","supports":["SHA-1","SHA-224","SHA-256","SHA-384","SHA-512"],"checked_at":"2026-09-23"},
    {"id":"nist-fips202","source_class":"official-primary","authority":"NIST","url":"https://csrc.nist.gov/pubs/fips/202/final","locator":"FIPS PUB 202 SHA-3 Standard","supports":["SHA3 family"],"checked_at":"2026-09-23"},
    {"id":"rfc2104","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc2104.html","locator":"RFC 2104 HMAC","supports":["HMAC construction"],"checked_at":"2026-09-23"},
    {"id":"rfc8259","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc8259.html","locator":"RFC 8259 JSON","supports":["JSON grammar","UTF-8 interoperability","duplicate-name caveat"],"checked_at":"2026-09-23"},
    {"id":"yaml12","source_class":"official-primary","authority":"YAML Language Development Team","url":"https://yaml.org/spec/1.2.2/","locator":"YAML 1.2.2 specification","supports":["YAML grammar","scalars","anchors"],"checked_at":"2026-09-23"},
    {"id":"toml10","source_class":"official-primary","authority":"TOML","url":"https://toml.io/en/v1.0.0","locator":"TOML v1.0.0 specification","supports":["TOML grammar","dates","tables"],"checked_at":"2026-09-23"},
    {"id":"rfc7519","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc7519.html","locator":"RFC 7519 JSON Web Token","supports":["JWT structure","registered claims"],"checked_at":"2026-09-23"},
    {"id":"rfc9562","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc9562.html","locator":"RFC 9562 UUIDs","supports":["UUID versions","variant bits","canonical textual form"],"checked_at":"2026-09-23"},
    {"id":"ecma262","source_class":"official-primary","authority":"Ecma TC39","url":"https://tc39.es/ecma262/","locator":"ECMAScript Language Specification","supports":["RegExp grammar and browser JavaScript semantics"],"checked_at":"2026-09-23"},
    {"id":"posix-crontab","source_class":"official-primary","authority":"The Open Group","url":"https://pubs.opengroup.org/onlinepubs/9799919799/utilities/crontab.html","locator":"POSIX.1-2024 crontab","supports":["crontab syntax boundary"],"checked_at":"2026-09-23"},
    {"id":"rfc3339","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc3339.html","locator":"RFC 3339 Internet timestamps","supports":["date-time grammar","UTC offsets"],"checked_at":"2026-09-23"},
    {"id":"iana-tzdb","source_class":"official-primary","authority":"IANA","url":"https://www.iana.org/time-zones","locator":"IANA Time Zone Database","supports":["timezone identifiers","transitions"],"checked_at":"2026-09-23"},
    {"id":"rfc5545","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc5545.html","locator":"RFC 5545 iCalendar","supports":["ICS content lines","folding","DATE-TIME"],"checked_at":"2026-09-23"},
    {"id":"rfc4180","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc4180.html","locator":"RFC 4180 CSV format and text/csv registration","supports":["quoted fields","embedded CRLF","escaped quotes"],"checked_at":"2026-09-23"},
    {"id":"iana-media-types","source_class":"official-primary","authority":"IANA","url":"https://www.iana.org/assignments/media-types/media-types.xhtml","locator":"Media Types registry","supports":["MIME types"],"checked_at":"2026-09-23"},
    {"id":"rfc9110","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc9110.html","locator":"RFC 9110 HTTP Semantics","supports":["HTTP status semantics","redirection"],"checked_at":"2026-09-23"},
    {"id":"rfc9309","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc9309.html","locator":"RFC 9309 Robots Exclusion Protocol","supports":["robots rules"],"checked_at":"2026-09-23"},
    {"id":"rfc5322","source_class":"official-primary","authority":"IETF / RFC Editor","url":"https://www.rfc-editor.org/rfc/rfc5322.html","locator":"RFC 5322 Internet Message Format","supports":["addr-spec syntax"],"checked_at":"2026-09-23"},
    {"id":"commonmark","source_class":"official-primary","authority":"CommonMark","url":"https://spec.commonmark.org/0.31.2/","locator":"CommonMark 0.31.2","supports":["Markdown parsing","raw HTML behavior"],"checked_at":"2026-09-23"},
    {"id":"owasp-xss","source_class":"official-primary","authority":"OWASP","url":"https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html","locator":"XSS Prevention Cheat Sheet","supports":["untrusted HTML","sanitization","safe sinks"],"checked_at":"2026-09-23"},
    {"id":"iso-qr-18004","source_class":"official-primary","authority":"ISO","url":"https://www.iso.org/standard/83389.html","locator":"ISO/IEC 18004:2024 metadata page","supports":["QR Code symbology authority"],"checked_at":"2026-09-23","notes":"Full normative text is paywalled. Strumentini.it does not fabricate unavailable vectors; Gold requires an independent decoder cross-check."},
    {"id":"w3c-png3","source_class":"official-primary","authority":"W3C","url":"https://www.w3.org/TR/png-3/","locator":"PNG Specification Third Edition","supports":["PNG signature","IHDR","IDAT","IEND","dimensions"],"checked_at":"2026-09-23"},
    {"id":"google-webp","source_class":"official-primary","authority":"Google","url":"https://developers.google.com/speed/webp/docs/riff_container","locator":"WebP Container Specification","supports":["RIFF/WEBP signature","chunks","dimensions","metadata"],"checked_at":"2026-09-23"},
    {"id":"cipa-exif","source_class":"official-primary","authority":"CIPA","url":"https://www.cipa.jp/std/documents/e/DC-008-Translation-2023-E.pdf","locator":"Exif 3.0 / CIPA DC-008-Translation-2023","supports":["Exif metadata structure"],"checked_at":"2026-09-23"},
    {"id":"w3c-wcag22","source_class":"official-primary","authority":"W3C","url":"https://www.w3.org/TR/WCAG22/","locator":"WCAG 2.2","supports":["contrast ratios","accessibility"],"checked_at":"2026-09-23"},
    {"id":"iso-pdf2","source_class":"official-primary","authority":"ISO","url":"https://www.iso.org/standard/75839.html","locator":"ISO 32000-2:2020 PDF 2.0 metadata page, confirmed current in 2026","supports":["PDF format authority"],"checked_at":"2026-09-23","notes":"Full normative standard is paid. Fixture claims are limited to observable signatures/structure unless a licensed parser/conformance source is added."},
    {"id":"pkware-appnote","source_class":"official-primary","authority":"PKWARE","url":"https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT","locator":"APPNOTE.TXT ZIP File Format Specification","supports":["ZIP signatures","central directory"],"checked_at":"2026-09-23"},
    {"id":"doi-handbook","source_class":"official-primary","authority":"DOI Foundation","url":"https://www.doi.org/doi-handbook/html/","locator":"DOI Handbook","supports":["DOI syntax","representation","percent encoding","case handling"],"checked_at":"2026-09-23"},
    {"id":"isbn-manual","source_class":"official-primary","authority":"International ISBN Agency","url":"https://www.isbn-international.org/content/isbn-users-manual/29","locator":"ISBN Users Manual, 7th edition","supports":["ISBN-13","ISBN-10 legacy conversion","check digit"],"checked_at":"2026-09-23"},
    {"id":"bibtex-ctan","source_class":"official-primary","authority":"BibTeX / CTAN distribution","url":"https://www.ctan.org/tex-archive/biblio/bibtex/base/","locator":"BibTeX base distribution, btxdoc and xampl.bib","supports":["BibTeX syntax","standard entry types"],"checked_at":"2026-09-23","notes":"Strumentini.it fixtures are synthetic rather than copied from xampl.bib."},
    {"id":"fixture-policy","source_class":"project-policy","authority":"Strumentini.it","locator":"quality/fixtures/README.md","supports":["hand-worked literal oracle policy","synthetic fixture provenance","no self-generated expected values"]},
    {"id":"ris-policy","source_class":"project-policy","authority":"Strumentini.it","locator":"docs/RESEARCH-DECISIONS-2026-10-27.md","supports":["RIS minimal tagged-record policy"],"notes":"RIS vendor lineage has uneven freely accessible normative documentation. Use synthetic records plus independent parser cross-check."},
    {"id":"zotero-translators","source_class":"independent-implementation","authority":"Zotero","url":"https://github.com/zotero/translators","locator":"commit 3d1c78530f42892328e08741b7cac8474ff687b8; RIS.js and BibTeX.js translator fixtures","supports":["independent RIS import/export field mapping","independent BibTeX import/export type mapping","translator expected-result test cases"],"checked_at":"2026-10-05"},
    {"id":"python-stdlib","source_class":"independent-implementation","authority":"CPython","url":"https://docs.python.org/3/library/","locator":"Python standard library used only as a secondary test implementation","supports":["csv","json","base64","hashlib","urllib","datetime","zoneinfo"]},
    {"id":"openssl-cli","source_class":"independent-implementation","authority":"OpenSSL Project","url":"https://docs.openssl.org/master/man1/openssl-dgst/","locator":"openssl dgst CLI","supports":["hash and HMAC cross-check"]},
    {"id":"wpt-url","source_class":"independent-implementation","authority":"web-platform-tests","url":"https://github.com/web-platform-tests/wpt/tree/master/url","locator":"URL conformance suite","supports":["WHATWG URL cross-check"]},
]
dump(ORACLES / "sources.json", {"schema_version":1,"generated_at":"2026-09-23","sources":SOURCES})

FAMILY_ROWS = []


def fixture(fid, candidates, payload, sources, coverage, kind="hand-worked", rights=None):
    rel = Path("quality") / "fixtures" / fid / "vectors.json"
    dump(ROOT / rel, payload)
    FAMILY_ROWS.append({
        "id":fid,
        "candidate_families":candidates,
        "path":rel.as_posix(),
        "format":"json",
        "provenance":{
            "kind":kind,
            "license_or_rights":rights or "Hand-worked facts/literals or synthetic data authored for Strumentini.it; no external corpus copied."
        },
        "truth_sources":sources,
        "coverage":coverage,
    })


fixture("unicode-normalization",["Unicode normalizer"],{
    "schema_version":1,
    "vectors":[
        {"form":"NFC","input":"e\u0301","expected":"é"},
        {"form":"NFD","input":"é","expected":"e\u0301"},
        {"form":"NFKC","input":"①","expected":"1"},
        {"form":"NFD","input":"q\u0307\u0323","expected":"q\u0323\u0307"},
        {"form":"NFC","input":"Å","expected":"Å"}
    ],
    "properties":["normalization is idempotent for a fixed form","canonically equivalent inputs normalize identically under the appropriate canonical form"]
},["unicode-uax15"],["NFC/NFD/NFKC","combining-mark order","idempotence"],"spec-vector")

fixture("invisible-characters",["Invisible-character detector"],{
    "schema_version":1,
    "vectors":[
        {"input":"a\u200Bb","code_points":["U+200B"],"label":"ZERO WIDTH SPACE"},
        {"input":"a\u200Db","code_points":["U+200D"],"label":"ZERO WIDTH JOINER"},
        {"input":"a\u2060b","code_points":["U+2060"],"label":"WORD JOINER"},
        {"input":"\uFEFFhello","code_points":["U+FEFF"],"label":"ZERO WIDTH NO-BREAK SPACE"}
    ],
    "policy":"Detection reports code point and position; it never silently mutates text."
},["unicode-uts39","unicode-uax15"],["format controls","joiner","BOM-like character","non-mutating detection"])

fixture("whitespace-normalization",["Whitespace normalizer"],{
    "schema_version":1,
    "policy":{"line_endings":"LF","trim_line_ends":True,"collapse_horizontal_runs":False},
    "vectors":[
        {"input":"a\r\nb\r\n","expected":"a\nb\n"},
        {"input":" a \t \n","expected":" a\n"},
        {"input":"","expected":""}
    ],
    "properties":["normalize(normalize(x)) == normalize(x)"]
},["fixture-policy","unicode-uax15"],["CRLF/LF","tabs/spaces","empty","idempotence"],"project-policy")

fixture("word-character-line-count",["Word/character/line counter"],{
    "schema_version":1,
    "policy":{"word_boundary":"Unicode UAX #29 default","character_modes":["code_point","grapheme_cluster"],"crlf":"one line break"},
    "vectors":[
        {"input":"","words":0,"lines":0},
        {"input":"hello world","words":2,"lines":1},
        {"input":"hello\r\nworld","words":2,"lines":2},
        {"input":"e\u0301","code_points":2,"grapheme_clusters":1}
    ]
},["unicode-uax29","fixture-policy"],["empty","CRLF","word count","code-point/grapheme distinction"],"project-policy")

fixture("list-set-ops",["Line deduplicator","List intersection","List difference"],{
    "schema_version":1,
    "policy":{"order":"preserve first occurrence"},
    "vectors":[
        {"a":["a","b","b","c"],"b":["b","d"],"dedupe_a":["a","b","c"],"intersection":["b"],"difference_a_minus_b":["a","c"]},
        {"a":[],"b":["x"],"intersection":[],"difference_a_minus_b":[]}
    ],
    "properties":["dedupe is idempotent","intersection is commutative under set semantics","difference contains no element from the subtracting set"]
},["fixture-policy","strumentini-lane05"],["duplicates","empty","algebraic properties","stable order"])

fixture("line-sorting",["Line sorter"],{
    "schema_version":1,
    "policy":{"comparison":"Unicode code-point order","stable":True,"locale_aware":False},
    "vectors":[
        {"input":["b","a","A"],"expected":["A","a","b"]},
        {"input":["é","e\u0301"],"expected":["e\u0301","é"],"note":"No implicit normalization"},
        {"input":[],"expected":[]}
    ]
},["fixture-policy","unicode-uax15"],["explicit comparator","normalization distinction","empty"],"project-policy")

fixture("text-diff",["Text diff","File-list diff"],{
    "schema_version":1,
    "vectors":[
        {"before":"a\nb\n","after":"a\nc\n","expected_ops":[{"op":"equal","text":"a\n"},{"op":"delete","text":"b\n"},{"op":"insert","text":"c\n"}]},
        {"before":"","after":"x","expected_ops":[{"op":"insert","text":"x"}]}
    ],
    "property":"Applying the emitted edit script to before must reconstruct after exactly. Exact visual hunk formatting is presentation policy."
},["strumentini-lane05","fixture-policy"],["replacement","empty-to-content","reconstruction invariant"])

fixture("markdown-xss",["Markdown preview"],{
    "schema_version":1,
    "policy":{"raw_html":"sanitize-or-escape","javascript_urls":"blocked","event_handlers":"blocked","scripts_execute":False},
    "vectors":[
        {"input":"# Hello\n\n**world**","security":"safe","expected_contains":["h1","strong"]},
        {"input":"<script>alert(1)</script>","security":"unsafe-raw-html","must_not_execute":True},
        {"input":"<img src=x onerror=alert(1)>","security":"unsafe-event-handler","must_not_execute":True},
        {"input":"[x](javascript:alert(1))","security":"unsafe-url-scheme","must_not_navigate":True},
        {"input":"<svg><a xlink:href=\"javascript:alert(1)\">x</a></svg>","security":"unsafe-active-content","must_not_execute":True}
    ]
},["commonmark","owasp-xss","fixture-policy"],["normal Markdown","raw HTML","event handler","javascript URL","SVG active content"],"project-policy")

fixture("csv-rfc4180",["CSV viewer","CSV cleaner","CSV delimiter detector","CSV deduplicator","CSV column selector","CSV filter","CSV sort","CSV to JSON","JSON to CSV"],{
    "schema_version":1,
    "vectors":[
        {"input":"a,b\r\n1,2\r\n","rows":[["a","b"],["1","2"]]},
        {"input":"name,note\r\nAlice,\"x,y\"\r\n","rows":[["name","note"],["Alice","x,y"]]},
        {"input":"a,b\r\n1,\"He said \"\"Hi\"\"\"\r\n","rows":[["a","b"],["1","He said \"Hi\""]]},
        {"input":"a,b\r\n1,\"two\r\nlines\"\r\n","rows":[["a","b"],["1","two\r\nlines"]]},
        {"input":"a,b,c\r\n,2,\r\n","rows":[["a","b","c"],["","2",""]]}
    ],
    "adversarial":[
        {"input":"a,b\r\n1,\"unterminated","expected":"typed-parse-error"},
        {"input":"a,a\r\n1,2\r\n","expected":"duplicate-header-warning-not-silent-overwrite"}
    ]
},["rfc4180"],["quoted delimiter","escaped quote","quoted newline","empty fields","malformed quote","duplicate header"],"spec-vector")

fixture("csv-cleaning",["CSV cleaner","CSV delimiter/encoding detector"],{
    "schema_version":1,
    "vectors":[
        {"input":"\ufeffa,b\r\n 1 , 2 \r\n","policy":{"strip_utf8_bom":True,"line_endings":"LF","trim_unquoted_outer_space":False},"expected":"a,b\n 1 , 2 \n"},
        {"input":"a;b\n1;2\n","detected_delimiter":";","confidence":"high"},
        {"input":"a\tb\n1\t2\n","detected_delimiter":"TAB","confidence":"high"},
        {"input":"a,b\n1,2,3\n","expected":"ragged-row-warning"}
    ]
},["rfc4180","whatwg-encoding","fixture-policy"],["BOM","semicolon/tab","ragged row","cleaning policy distinction"],"project-policy")

fixture("json-grammar",["JSON formatter/validator"],{
    "schema_version":1,
    "vectors":[
        {"input":"null","valid":True,"semantic":None},
        {"input":"[1,true,\"x\"]","valid":True,"semantic":[1,True,"x"]},
        {"input":"{\"a\":1,\"b\":2}","valid":True,"semantic":{"a":1,"b":2}},
        {"input":"True","valid":False},
        {"input":"01","valid":False},
        {"input":"{\"a\":1,}","valid":False},
        {"input":"{\"a\":1,\"a\":2}","valid":True,"warning":"member names SHOULD be unique; duplicate handling differs across implementations"}
    ],
    "format_policy":{"indent":2,"line_ending":"LF","duplicate_names":"warn before any lossy format"}
},["rfc8259"],["valid scalars","invalid literal","leading zero","trailing comma","duplicate member interoperability"],"spec-vector")

fixture("yaml-core",["YAML formatter/validator","JSON/YAML converter"],{
    "schema_version":1,
    "vectors":[
        {"input":"a: 1\nb: true\n","semantic":{"a":1,"b":True}},
        {"input":"list:\n  - a\n  - b\n","semantic":{"list":["a","b"]}},
        {"input":"a: &x [1, 2]\nb: *x\n","semantic":{"a":[1,2],"b":[1,2]}},
        {"input":"a:\n\t- tab-indent\n","expected":"typed-parse-error-or-explicit-parser-policy"}
    ],
    "security":["bound aliases/nesting/input size","never instantiate application objects from tags"]
},["yaml12","fixture-policy"],["scalars","sequence","anchor/alias","tab indentation","resource bounds"],"project-policy")

fixture("base64-rfc4648",["Base64 encode/decode"],{
    "schema_version":1,
    "vectors":[
        {"utf8":"","base64":""},{"utf8":"f","base64":"Zg=="},{"utf8":"fo","base64":"Zm8="},{"utf8":"foo","base64":"Zm9v"},
        {"utf8":"foob","base64":"Zm9vYg=="},{"utf8":"fooba","base64":"Zm9vYmE="},{"utf8":"foobar","base64":"Zm9vYmFy"}
    ],
    "invalid":["===","A===","Zm9v*"]
},["rfc4648"],["empty","padding variants","invalid alphabet"],"spec-vector")

fixture("sha2-known-answers",["Hash generator","File hash","Checksum verifier"],{
    "schema_version":1,
    "vectors":[
        {"algorithm":"SHA-256","input_utf8":"","digest_hex":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
        {"algorithm":"SHA-256","input_utf8":"abc","digest_hex":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"},
        {"algorithm":"SHA-512","input_utf8":"abc","digest_hex":"ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"}
    ],
    "properties":["digest is invariant to chunking of identical bytes"]
},["nist-fips180-4","openssl-cli"],["empty","abc known answer","SHA-256","SHA-512","chunk independence"],"spec-vector")

fixture("uuid-rfc9562",["UUID generator"],{
    "schema_version":1,
    "vectors":[
        {"value":"00000000-0000-4000-8000-000000000000","version":4,"variant_bits":"10"},
        {"value":"00000000-0000-4000-9000-000000000000","version":4,"variant_bits":"10"},
        {"value":"00000000-0000-4000-a000-000000000000","version":4,"variant_bits":"10"},
        {"value":"00000000-0000-4000-b000-000000000000","version":4,"variant_bits":"10"},
        {"value":"00000000-0000-0000-0000-000000000000","special":"Nil UUID"}
    ],
    "note":"Collision smoke tests are non-authoritative and cannot prove randomness quality."
},["rfc9562"],["version bits","variant bits","nil UUID"],"spec-vector")

fixture("url-percent-encoding",["URL encode/decode"],{
    "schema_version":1,
    "vectors":[
        {"operation":"percent-encode-byte","input_hex":"23","expected":"%23"},
        {"operation":"percent-encode-byte","input_hex":"7f","expected":"%7F"},
        {"operation":"utf8-userinfo","input":"≡","expected":"%E2%89%A1"},
        {"operation":"utf8-userinfo","input":"‽","expected":"%E2%80%BD"},
        {"operation":"utf8-userinfo","input":"Say what‽","expected":"Say%20what%E2%80%BD"},
        {"operation":"percent-decode","input":"%25%s%1G","expected_utf8":"%%s%1G"}
    ]
},["whatwg-url"],["UTF-8 encoding","uppercase hex","space","malformed percent sequence"],"spec-vector")

fixture("query-params",["Query-string editor"],{
    "schema_version":1,
    "vectors":[
        {"input":"a=1&a=2&blank=&space=hello+world","pairs":[["a","1"],["a","2"],["blank",""],["space","hello world"]],"serialize":"a=1&a=2&blank=&space=hello+world"},
        {"input":"q=%E2%80%BD","pairs":[["q","‽"]],"serialize":"q=%E2%80%BD"},
        {"input":"plus=%2B&literal=+","pairs":[["plus","+"],["literal"," "]],"serialize":"plus=%2B&literal=+"}
    ],
    "properties":["ordered repeated keys survive round trip"]
},["whatwg-url"],["repeated keys","blank value","space plus","literal plus"],"spec-vector")

fixture("utm-roundtrip",["UTM builder","UTM parser","Tracking-parameter cleaner"],{
    "schema_version":1,
    "canonical_fields":["utm_source","utm_medium","utm_campaign","utm_term","utm_content"],
    "vectors":[
        {"base":"https://example.com/landing","params":[["utm_source","newsletter"],["utm_medium","email"],["utm_campaign","fall sale"]],"built":"https://example.com/landing?utm_source=newsletter&utm_medium=email&utm_campaign=fall+sale"},
        {"url":"https://example.com/?utm_source=a&utm_source=b&utm_campaign=x%20y","parsed":[["utm_source","a"],["utm_source","b"],["utm_campaign","x y"]]},
        {"url":"https://example.com/?a=1&utm_source=x&gclid=token#frag","cleaned":"https://example.com/?a=1#frag","dropped":["utm_source","gclid"]}
    ],
    "policy":{"preserve_unknown_query":True,"preserve_fragment":True,"known_tracking_match":"ASCII case-insensitive"}
},["whatwg-url","fixture-policy"],["builder/parser round-trip","duplicates","tracking removal","fragment"],"project-policy")

fixture("date-arithmetic",["Unix timestamp converter","Date difference","Add/subtract days","Duration calculator"],{
    "schema_version":1,
    "vectors":[
        {"unix_seconds":0,"utc":"1970-01-01T00:00:00Z"},
        {"unix_seconds":-1,"utc":"1969-12-31T23:59:59Z"},
        {"start":"2024-02-28","add_days":1,"expected":"2024-02-29"},
        {"start":"2024-02-28","add_days":2,"expected":"2024-03-01"},
        {"start":"2023-12-31","add_days":1,"expected":"2024-01-01"},
        {"a":"2024-03-01","b":"2024-02-28","difference_days":2}
    ]
},["rfc3339","fixture-policy"],["epoch","negative timestamp","leap day","month/year boundary","difference"],"hand-worked")

fixture("timezone-dst",["Timezone converter","Multi-timezone overlap","Meeting-time planner"],{
    "schema_version":1,
    "zone":"Europe/Rome",
    "vectors":[
        {"instant":"2024-01-15T12:00:00Z","local":"2024-01-15T13:00:00+01:00"},
        {"instant":"2024-07-15T12:00:00Z","local":"2024-07-15T14:00:00+02:00"},
        {"instant":"2024-03-31T01:30:00Z","local":"2024-03-31T03:30:00+02:00","case":"spring-forward"},
        {"instant":"2024-10-27T00:30:00Z","local":"2024-10-27T02:30:00+02:00","case":"fall-back-first"},
        {"instant":"2024-10-27T01:30:00Z","local":"2024-10-27T02:30:00+01:00","case":"fall-back-second"}
    ],
    "property":"zone rendering preserves the UTC instant; tzdb version is captured by the test runner"
},["iana-tzdb","rfc3339"],["winter/summer","DST gap","DST overlap","instant preservation"],"hand-worked")

fixture("business-days",["Business-day calculator"],{
    "schema_version":1,
    "policy":{"working_days":["MON","TUE","WED","THU","FRI"],"holidays":[],"inclusive_start":False,"inclusive_end":True},
    "vectors":[
        {"start":"2026-09-18","add_business_days":1,"expected":"2026-09-21"},
        {"start":"2026-09-18","add_business_days":5,"expected":"2026-09-25"},
        {"start":"2026-09-21","business_days_until":"2026-09-25","expected":4}
    ],
    "note":"Holiday-aware variants require a versioned external data source and are not silently inferred."
},["fixture-policy","strumentini-lane05"],["weekend crossing","inclusivity","no hidden holiday source"],"project-policy")

fixture("decimal-hours",["Decimal-hours converter","Timesheet totaler"],{
    "schema_version":1,
    "vectors":[
        {"hhmm":"01:30","decimal_hours":"1.5"},
        {"hhmm":"00:45","decimal_hours":"0.75"},
        {"hhmm":"02:15","decimal_hours":"2.25"},
        {"decimal_hours":"1.1","minutes":66}
    ],
    "policy":"Decimal strings are exact fixture expectations; no intermediate binary-float rounding is permitted."
},["fixture-policy"],["quarter hour","non-quarter decimal","exact decimal"])

fixture("business-math",["Margin calculator","Markup calculator","Project profitability calculator","Hour/day/project rate converter","Effective hourly rate","Break-even calculator"],{
    "schema_version":1,
    "vectors":[
        {"case":"margin-vs-markup","cost":"80.00","price":"100.00","profit":"20.00","margin_percent":"20","markup_percent":"25"},
        {"case":"profitability","revenue":"1000.00","cost":"750.00","profit":"250.00","profit_margin_percent":"25"},
        {"case":"hour-day","hourly":"50.00","hours_per_day":"8","daily":"400.00"},
        {"case":"effective-hourly","revenue":"1200.00","hours":"24","effective_hourly":"50.00"},
        {"case":"break-even","fixed_cost":"1000.00","unit_price":"25.00","unit_variable_cost":"15.00","units":"100"}
    ],
    "invalid":[
        {"case":"margin-zero-price","expected":"typed-undefined-error"},
        {"case":"markup-zero-cost","expected":"typed-undefined-or-explicit-policy-result"}
    ],
    "policy":"Use decimal arithmetic and do not round intermediate results unless a tool manifest explicitly states otherwise."
},["fixture-policy","strumentini-lane05"],["margin/markup distinction","zero denominator","rates","profitability","break-even"])

fixture("marketing-math",["ROAS calculator","CPA/CPC/CPM calculator","Conversion-rate scenario calculator"],{
    "schema_version":1,
    "vectors":[
        {"spend":"200.00","revenue":"1000.00","roas":"5","roas_percent":"500"},
        {"spend":"200.00","conversions":"8","cpa":"25.00"},
        {"spend":"200.00","clicks":"100","cpc":"2.00"},
        {"spend":"200.00","impressions":"100000","cpm":"2.00"},
        {"conversions":"25","visits":"1000","conversion_rate_percent":"2.5"}
    ],
    "invalid":[{"denominator":"0","expected":"typed-undefined-error"}]
},["fixture-policy"],["ROAS","CPA","CPC","CPM","conversion rate","zero denominator"])

fixture("filename-sanitization",["Filename sanitizer","Batch rename preview"],{
    "schema_version":1,
    "policy":{"output":"single filename component","replacement":"_","windows_reserved_names":"suffix underscore","unicode_normalization":"NFC"},
    "vectors":[
        {"input":"../secret.txt","expected":".._secret.txt","flags":["path-separator"]},
        {"input":"a/b\\c.txt","expected":"a_b_c.txt","flags":["path-separator"]},
        {"input":"CON","expected":"CON_","flags":["windows-reserved-name"]},
        {"input":"report. ","expected":"report","flags":["windows-trailing-dot-space"]},
        {"input":"e\u0301.txt","expected":"é.txt","flags":["unicode-normalized"]},
        {"input":"\u0000bad.txt","expected":"_bad.txt","flags":["nul-control"]}
    ],
    "security":"A sanitized name is not an authorized path. Callers must separately constrain the destination directory."
},["fixture-policy","unicode-uax15"],["path separators","NUL","Windows reserved","trailing dot/space","Unicode"],"project-policy")

fixture("mime-file-signatures",["MIME type lookup","File signature/type detector"],{
    "schema_version":1,
    "vectors":[
        {"type":"image/png","offset":0,"magic_hex":"89504e470d0a1a0a"},
        {"type":"image/jpeg","offset":0,"magic_hex":"ffd8ff","note":"prefix only; complete structural validation is separate"},
        {"type":"image/webp","offset":0,"magic_ascii":"RIFF","secondary_offset":8,"secondary_ascii":"WEBP"},
        {"type":"application/pdf","offset":0,"magic_ascii":"%PDF-","note":"preflight discriminator, not full conformance"},
        {"type":"application/zip","offset":0,"magic_hex_any":["504b0304","504b0506","504b0708"]},
        {"type":"image/gif","offset":0,"magic_ascii_any":["GIF87a","GIF89a"]}
    ],
    "policy":"Magic bytes are evidence, not proof of safety. Extension and MIME labels do not override content validation."
},["iana-media-types","w3c-png3","google-webp","iso-pdf2","pkware-appnote"],["PNG/JPEG/WebP/PDF/ZIP/GIF signatures","signature safety boundary"],"hand-worked")

def png_chunk(kind: bytes, body: bytes) -> bytes:
    return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", binascii.crc32(kind + body) & 0xffffffff)


def make_png(width: int, height: int, rgba: bool, comment: str | None = None) -> bytes:
    color_type = 6 if rgba else 2
    channels = 4 if rgba else 3
    out = b"\x89PNG\r\n\x1a\n"
    out += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0))
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            px = [(20 + x * 51) % 256, (40 + y * 67) % 256, 120]
            if channels == 4:
                px.append(255 if (x + y) % 2 == 0 else 160)
            raw.extend(px)
    if comment is not None:
        out += png_chunk(b"tEXt", b"Comment\x00" + comment.encode("latin-1"))
    out += png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    out += png_chunk(b"IEND", b"")
    return out

image_dir = FIXTURES / "image-metadata"
image_dir.mkdir(parents=True, exist_ok=True)
(image_dir / "synthetic-1x1-rgb.png").write_bytes(make_png(1, 1, False))
full = make_png(2, 3, True, "synthetic Strumentini.it fixture")
(image_dir / "synthetic-2x3-rgba-text.png").write_bytes(full)
(image_dir / "corrupt-truncated.png").write_bytes(full[:24])

fixture("image-metadata",["Image resize","Image format conversion","Image compression","Image metadata viewer","Image dimensions batch inspector"],{
    "schema_version":1,
    "artifacts":[
        {"path":"quality/fixtures/image-metadata/synthetic-1x1-rgb.png","format":"PNG","width":1,"height":1,"color_type":2},
        {"path":"quality/fixtures/image-metadata/synthetic-2x3-rgba-text.png","format":"PNG","width":2,"height":3,"color_type":6,"metadata":{"Comment":"synthetic Strumentini.it fixture"}},
        {"path":"quality/fixtures/image-metadata/corrupt-truncated.png","decode":"error","reason":"truncated"}
    ],
    "provenance":"Generated locally from PNG chunk rules; no third-party pixels or metadata."
},["w3c-png3"],["1x1","2x3","RGB/RGBA","text metadata","truncated input"],"synthetic-local","Locally generated synthetic pixels and metadata; no third-party copyrighted sample.")

fixture("isbn",["ISBN validator/converter"],{
    "schema_version":1,
    "vectors":[
        {"input":"0-306-40615-2","kind":"ISBN-10","digits":"0306406152","valid":True,"isbn13":"9780306406157"},
        {"input":"978-0-306-40615-7","kind":"ISBN-13","digits":"9780306406157","valid":True},
        {"input":"9780306406158","kind":"ISBN-13","valid":False,"reason":"check digit mismatch"}
    ]
},["isbn-manual"],["ISBN-10","ISBN-13","bad check digit","10-to-13 conversion"],"hand-worked")

fixture("doi",["DOI normalizer","DOI link builder"],{
    "schema_version":1,
    "vectors":[
        {"input":"10.1000/182","normalized":"10.1000/182","url":"https://doi.org/10.1000/182"},
        {"input":"doi:10.1000/182","normalized":"10.1000/182","url":"https://doi.org/10.1000/182"},
        {"input":"https://doi.org/10.1000/182","normalized":"10.1000/182","url":"https://doi.org/10.1000/182"},
        {"input":" 10.1000/ABC def ","normalized":"10.1000/ABC def","url":"https://doi.org/10.1000/ABC%20def"}
    ],
    "policy":"Strip recognized presentation prefixes and surrounding whitespace; do not resolve over network during local normalization."
},["doi-handbook","whatwg-url"],["plain","doi prefix","resolver URL","percent encoding"],"hand-worked")

fixture("bibtex",["BibTeX formatter","BibTeX deduplicator","Citation key generator"],{
    "schema_version":1,
    "vectors":[
        {"input":"@article{smith2026,\n  author = {Ada Smith},\n  title = {A Synthetic Fixture},\n  year = {2026}\n}\n","semantic":{"type":"article","key":"smith2026","fields":{"author":"Ada Smith","title":"A Synthetic Fixture","year":"2026"}}},
        {"input":"@book{quoted, title=\"Quoted Title\", author={Doe, Jane}, year=2020}\n","semantic":{"type":"book","key":"quoted","fields":{"title":"Quoted Title","author":"Doe, Jane","year":"2020"}}}
    ],
    "formatter_policy":{"field_order":"preserve by default","indent":2,"lossy_macro_expansion":False},
    "provenance":"Synthetic records written for Strumentini.it."
},["bibtex-ctan"],["brace/quoted values","entry type/key","lossless default"],"synthetic-local","Synthetic bibliographic records; no xampl.bib or external citation corpus copied.")

fixture("ris",["RIS/BibTeX converter"],{
    "schema_version":1,
    "vectors":[
        {"input":"TY  - JOUR\nTI  - A Synthetic Fixture\nAU  - Smith, Ada\nPY  - 2026\nER  - \n","semantic":{"TY":["JOUR"],"TI":["A Synthetic Fixture"],"AU":["Smith, Ada"],"PY":["2026"]}},
        {"input":"TY  - JOUR\r\nKW  - alpha\r\nKW  - beta\r\nER  - \r\n","semantic":{"TY":["JOUR"],"KW":["alpha","beta"]}}
    ],
    "policy":{"repeat_tags":"preserve ordered list","unknown_tags":"preserve","record_terminator":"ER"},
    "provenance":"Synthetic tagged records; no vendor corpus copied."
},["ris-policy","zotero-translators"],["repeated tags","CRLF/LF","unknown-tag preservation","independent pinned Zotero translator cross-check"],"synthetic-local","Synthetic tagged records; no external RIS sample corpus copied. Expected semantics are independently cross-checked against pinned Zotero translator expectations.")

fixture("ics",["ICS event builder","ICS viewer"],{
    "schema_version":1,
    "vectors":[
        {"kind":"DATE","value":"19970714","semantic":"1997-07-14"},
        {"kind":"DATE-TIME","value":"19980119T070000Z","semantic":"1998-01-19T07:00:00Z"},
        {"kind":"folding","physical":"DESCRIPTION:This is a lo\r\n ng description\r\n","unfolded":"DESCRIPTION:This is a long description\r\n"}
    ],
    "invalid":[
        {"value":"1997-07-14","context":"DATE","reason":"basic DATE form has no separators"},
        {"value":"19980119T070000+0100","context":"DATE-TIME","reason":"numeric UTC offset form is forbidden by RFC 5545 DATE-TIME"}
    ]
},["rfc5545"],["DATE","UTC DATE-TIME","folding","invalid offset form"],"spec-vector")

fixture("html-entities",["HTML entity encode/decode"],{
    "schema_version":1,
    "vectors":[
        {"input":"&amp;","decoded":"&"},
        {"input":"&lt;","decoded":"<"},
        {"input":"&#x1F600;","decoded":"😀"},
        {"input":"A & B","encoded_text":"A &amp; B"}
    ],
    "security":"Entity decoding is not sanitization. Decoded text must not be inserted into an unsafe HTML sink."
},["whatwg-html","owasp-xss"],["named reference","numeric reference","encoding ampersand","sanitization boundary"],"hand-worked")

fixture("url-security",["Open Graph preview","Redirect-chain inspector","Canonical URL helper"],{
    "schema_version":1,
    "vectors":[
        {"url":"https://example.com/path","allowed_scheme":True},
        {"url":"javascript:alert(1)","allowed_scheme":False},
        {"url":"data:text/html,<script>alert(1)</script>","allowed_scheme":False},
        {"url":"https://user:pass@example.com/","warning":"credentials-in-url"},
        {"url":"https://exa%23mple.org","expected":"parse-or-validation-error"}
    ],
    "policy":"Preview tools do not execute active content. Network tools require explicit action and an SSRF-safe destination policy."
},["whatwg-url","owasp-xss"],["dangerous schemes","credentials","invalid host percent encoding","non-execution"],"project-policy")

fixture("qr-contract",["QR generator","QR reader"],{
    "schema_version":1,
    "vectors":[
        {"payload":"hello","expected_decode":"hello"},
        {"payload":"https://example.com/?a=1&b=2","expected_decode":"https://example.com/?a=1&b=2"},
        {"payload":"こんにちは","expected_decode":"こんにちは"}
    ],
    "oracle":"Generated symbols must be decoded by an independent decoder; byte equality is authoritative for this fixture.",
    "rights":"No ISO sample symbol bytes are copied."
},["iso-qr-18004","strumentini-lane05"],["ASCII","URL","Unicode","independent decoder"],"project-policy")

fixture("file-hash",["File hash","Batch checksum manifest","Checksum verifier"],{
    "schema_version":1,
    "artifact_utf8":"abc",
    "sha256":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "chunk_sizes":[1,2,3,65536],
    "property":"All chunk sizes must produce the same digest."
},["nist-fips180-4","openssl-cli"],["known bytes","known digest","chunk independence"],"spec-vector")

fixture("json-csv-conversion",["CSV to JSON","JSON to CSV"],{
    "schema_version":1,
    "vectors":[
        {"json":[{"a":"1","b":"x"},{"a":"2","b":"y"}],"csv":"a,b\r\n1,x\r\n2,y\r\n"},
        {"csv":"a,b\r\n1,\"x,y\"\r\n","json":[{"a":"1","b":"x,y"}]}
    ],
    "policy":{"header_order":"preserve source order","missing_keys":"empty field","extra_keys":"require explicit schema-expansion mode"}
},["rfc4180","rfc8259","fixture-policy"],["quoted comma","header order","semantic round trip"],"hand-worked")

fixture("zip-signatures",["ZIP contents inspector","ZIP creator","Clean ZIP creator"],{
    "schema_version":1,
    "vectors":[
        {"hex":"504b0304","meaning":"local file header"},
        {"hex":"504b0506","meaning":"end of central directory"},
        {"hex":"504b0708","meaning":"split/spanned signature context"}
    ],
    "security":["reject path traversal entries in any extraction-like flow","enforce decompressed size and entry-count limits","never trust extension"]
},["pkware-appnote","fixture-policy"],["signatures","zip-slip boundary","resource limits"],"hand-worked")

fixture("pdf-signature",["PDF page-count verifier","PDF metadata inspector","PDF merge/split family"],{
    "schema_version":1,
    "vectors":[
        {"ascii":"%PDF-2.0\n","expected":"pdf-signature-present"},
        {"ascii":"NOTPDF","expected":"not-pdf-by-signature"}
    ],
    "note":"Signature preflight is not PDF conformance. A licensed/maintained PDF parser must supply deeper Gold checks."
},["iso-pdf2"],["signature positive/negative","preflight/conformance distinction"],"hand-worked")

fixture("percentage-math",["VAT/general percentage helper","Discount impact calculator"],{
    "schema_version":1,
    "vectors":[
        {"base":"200","percent":"20","result":"40"},
        {"from":"80","to":"100","change_percent":"25"},
        {"part":"25","whole":"200","percent":"12.5"}
    ],
    "invalid":[{"whole":"0","expected":"typed-undefined-error"}]
},["fixture-policy"],["percentage of base","percent change","part/whole","zero denominator"])

fixture("hmac-rfc2104",["HMAC generator"],{
    "schema_version":1,
    "vectors":[
        {"algorithm":"HMAC-SHA256","key_utf8":"key","message_utf8":"The quick brown fox jumps over the lazy dog","digest_hex":"f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"}
    ],
    "property":"Changing key or message changes the authentication tag except for cryptographic collision chance; this smoke property is secondary to known answers."
},["rfc2104","nist-fips180-4","openssl-cli"],["known answer","key/message separation"],"hand-worked")

fixture("jwt-structure",["JWT inspector"],{
    "schema_version":1,
    "vectors":[
        {"token":"eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjMifQ.","header":{"alg":"none","typ":"JWT"},"payload":{"sub":"123"},"security":"inspection-only-unsecured-token"},
        {"token":"not.a.valid.token","expected":"typed-parse-error"}
    ],
    "security":"Inspector does not imply signature verification. Unsecured or unsupported-algorithm tokens are visibly labeled."
},["rfc7519","rfc4648"],["three-part parsing","unsecured token warning","malformed token"],"hand-worked")

fixture("http-status",["HTTP status reference"],{
    "schema_version":1,
    "vectors":[
        {"status":200,"class":"successful","reason_hint":"OK"},
        {"status":301,"class":"redirection","reason_hint":"Moved Permanently"},
        {"status":404,"class":"client-error","reason_hint":"Not Found"},
        {"status":500,"class":"server-error","reason_hint":"Internal Server Error"}
    ],
    "policy":"Reason phrases are display hints, not protocol-required semantics."
},["rfc9110"],["status classes","common codes","display-vs-protocol distinction"],"hand-worked")

fixture("robots",["Robots directive helper"],{
    "schema_version":1,
    "vectors":[
        {"input":"User-agent: *\nDisallow: /private\n","groups":[{"user_agents":["*"],"rules":[["disallow","/private"]]}]},
        {"input":"User-agent: ExampleBot\nAllow: /\n","groups":[{"user_agents":["ExampleBot"],"rules":[["allow","/"]]}]}
    ],
    "security":"Helper parses/constructs directives only; it does not claim enforcement by crawlers."
},["rfc9309"],["user-agent group","allow/disallow","non-enforcement caveat"],"hand-worked")

dump(FIXTURES / "index.json", {"schema_version":1,"generated_at":"2026-09-23","family_count":len(FAMILY_ROWS),"families":FAMILY_ROWS})
(FIXTURES / "README.md").write_text(
    "# Gold fixtures\n\n"
    "Expected values are independent of future production implementations. They come from small normative specification vectors, hand-worked literals, or synthetic local files.\n\n"
    "Rules:\n"
    "- never generate an expected value by calling the implementation under test;\n"
    "- do not copy third-party sample corpora without explicit redistribution rights;\n"
    "- locally generated binary/image fixtures contain no third-party content;\n"
    "- malformed and XSS fixture payloads are inert test data and must never be executed;\n"
    "- a file signature is evidence of format, never proof that content is safe;\n"
    "- where no universal standard exists, a fixture states the Strumentini.it product policy explicitly.\n",
    encoding="utf-8",
)

catalog = (ROOT / "research" / "tool-catalog-200-candidate-map-2026-09-23.md").read_text(encoding="utf-8")
catalog = catalog.split("## Catalog observations", 1)[0]
CANDIDATES = []
for raw in catalog.splitlines():
    match = re.match(r"^(\d+)\.\s+(.+)$", raw.strip())
    if match and 1 <= int(match.group(1)) <= 200:
        CANDIDATES.append((int(match.group(1)), match.group(2)))
if len(CANDIDATES) != 200:
    raise RuntimeError(f"Expected 200 candidate rows, got {len(CANDIDATES)}")


def family_for(n: int, name: str) -> str:
    low = name.lower()
    if n <= 20:
        return "text-list-engine"
    if 21 <= n <= 40 or "csv" in low or "table" in low:
        return "csv-table-engine"
    if any(x in low for x in ["json","yaml","toml"]):
        return "structured-data-engine"
    if any(x in low for x in ["url","utm","query-string","domain","redirect","canonical","robots","open graph"]):
        return "url-web-engine"
    if 81 <= n <= 100 or any(x in low for x in ["timezone","timestamp","calendar","ics","epoch"]):
        return "date-time-engine"
    if 101 <= n <= 120 or any(x in low for x in ["margin","markup","profit","roas","cpa","cpc","cpm","percentage","rate","capacity","fee"]):
        return "business-math-engine"
    if 121 <= n <= 140 or "pdf" in low:
        return "pdf-engine"
    if 141 <= n <= 160 or any(x in low for x in ["image","color","palette","favicon","screenshot"]):
        return "image-engine"
    if 161 <= n <= 180 or any(x in low for x in ["file","folder","zip","archive","checksum","filename","metadata"]):
        return "file-engine"
    if 181 <= n <= 200 or any(x in low for x in ["doi","isbn","bibtex","ris","citation","reference"]):
        return "research-citation-engine"
    if any(x in low for x in ["base64","hash","hmac","uuid","jwt","regex","cron","mime","http status"]):
        return "developer-primitive-engine"
    return "text-list-engine"


def maintenance_for(n: int, name: str) -> str:
    low = name.lower()
    heavy_terms = [
        "pdf merge", "pdf split", "pdf page reorder", "pdf rotate", "pdf page delete",
        "images to pdf", "pdf to images", "pdf text extraction", "pdf flatten", "pdf image extractor",
        "pdf compare", "pdf compression", "image resize", "image crop", "image format conversion",
        "image compression", "palette extractor", "dominant-color extractor", "contact-sheet",
        "app-icon", "perceptual duplicate", "folder inventory", "folder size", "duplicate-file",
        "zip contents", "zip creator", "clean zip", "archive checksum", "folder compare",
    ]
    if any(term in low for term in heavy_terms):
        return "H"
    if any(x in low for x in ["public-holiday","http status reference","mime type lookup","social character-limit","platform-size presets"]):
        return "D"
    if any(x in low for x in ["vat","late-payment interest"]):
        return "R"
    return "E"


def truth_sources(n: int, name: str) -> list[str]:
    low = name.lower()
    src = ["strumentini-quality","fixture-policy"]
    if n <= 20:
        src += ["unicode-uax29"]
        if any(x in low for x in ["unicode","whitespace","invisible","case","smart-quote","slug"]):
            src += ["unicode-uax15"]
        if "markdown" in low:
            src += ["commonmark","owasp-xss"]
        if "csv" in low:
            src += ["rfc4180"]
    elif n <= 40:
        src += ["rfc4180","whatwg-encoding"]
        if "json" in low:
            src += ["rfc8259"]
    elif n <= 60:
        if "json" in low:
            src += ["rfc8259"]
        if "yaml" in low:
            src += ["yaml12"]
        if "toml" in low:
            src += ["toml10"]
        if "url" in low or "query" in low:
            src += ["whatwg-url"]
        if "html entity" in low:
            src += ["whatwg-html","owasp-xss"]
        if "base64" in low:
            src += ["rfc4648"]
        if "jwt" in low:
            src += ["rfc7519"]
        if "uuid" in low:
            src += ["rfc9562"]
        if "hash" in low:
            src += ["nist-fips180-4"]
        if "hmac" in low:
            src += ["rfc2104","nist-fips180-4"]
        if "regex" in low:
            src += ["ecma262"]
        if "cron" in low:
            src += ["posix-crontab"]
        if "unix timestamp" in low:
            src += ["rfc3339"]
        if "http status" in low:
            src += ["rfc9110"]
        if "mime" in low:
            src += ["iana-media-types"]
        if "user-agent" in low:
            src += ["rfc9110"]
    elif n <= 80:
        src += ["whatwg-url"]
        if "qr" in low:
            src += ["iso-qr-18004"]
        if "robots" in low:
            src += ["rfc9309"]
        if "redirect" in low:
            src += ["rfc9110"]
        if "email-domain" in low:
            src += ["rfc5322"]
    elif n <= 100:
        src += ["rfc3339","iana-tzdb"]
        if "ics" in low:
            src += ["rfc5545"]
    elif n <= 120:
        src += ["strumentini-lane05"]
    elif n <= 140:
        src += ["iso-pdf2"]
    elif n <= 160:
        src += ["w3c-png3","google-webp"]
        if "metadata" in low or "exif" in low:
            src += ["cipa-exif"]
        if "contrast" in low:
            src += ["w3c-wcag22"]
    elif n <= 180:
        if "hash" in low or "checksum" in low:
            src += ["nist-fips180-4"]
        if "signature" in low or "type detector" in low:
            src += ["iana-media-types","w3c-png3","google-webp","pkware-appnote"]
        if "zip" in low or "archive" in low:
            src += ["pkware-appnote"]
    else:
        if "doi" in low:
            src += ["doi-handbook","whatwg-url"]
        if "isbn" in low:
            src += ["isbn-manual"]
        if "bibtex" in low:
            src += ["bibtex-ctan"]
        if "ris" in low:
            src += ["ris-policy"]
            if n == 187:
                src += ["zotero-translators"]
        if "date" in low or "timeline" in low:
            src += ["rfc3339"]
        if "url" in low:
            src += ["whatwg-url"]
    return list(dict.fromkeys(src))


def invariants(name: str) -> list[str]:
    low = name.lower()
    if any(x in low for x in ["normalizer","cleaner","deduplicator"]):
        return ["idempotent where the declared semantics allow","does not mutate caller input","same input and policy yield deterministic output"]
    if "sort" in low:
        return ["stable deterministic order under declared comparator","input multiset is preserved","input is not mutated"]
    if "hash" in low or "checksum" in low:
        return ["same bytes produce same digest","chunk size does not change digest","encoded display is separate from digest bytes"]
    if any(x in low for x in ["converter","encode/decode","to json","json to"]):
        return ["lossless conversions round-trip semantically","invalid input yields a typed error","declared lossy conversions surface a warning"]
    if any(x in low for x in ["builder","generator"]):
        return ["output validates under the target format","deterministic fields are stable","independent parser/decoder round-trip is used where available"]
    if any(x in low for x in ["calculator","rate","margin","markup","profit","roas","cpa","cpc","cpm","percentage"]):
        return ["hand-worked known answers match","units remain dimensionally consistent","zero denominators fail explicitly","no hidden intermediate rounding"]
    if any(x in low for x in ["viewer","inspector","profiler"]):
        return ["inspection does not mutate payload","reported structure agrees with an independent parser/signature","malformed input fails without execution"]
    return ["deterministic input produces deterministic output","empty and invalid input behavior is explicit","input remains unchanged"]


def adversarial(n: int, name: str) -> list[str]:
    low = name.lower()
    out = ["empty input","very large but supported input"]
    if n <= 20 or any(x in low for x in ["text","line","slug","markdown"]):
        out += ["composed/decomposed Unicode","emoji and combining marks","CRLF/LF"]
    if 21 <= n <= 40 or "csv" in low:
        out += ["quoted delimiter/newline","escaped quote","BOM or encoding mismatch","ragged rows","duplicate headers","oversized cell"]
    if any(x in low for x in ["json","yaml","toml"]):
        out += ["deep nesting","duplicate keys","malformed escapes","resource exhaustion boundary"]
    if any(x in low for x in ["url","query","utm","domain","redirect","canonical"]):
        out += ["repeated parameters","invalid percent escapes","credentials","Unicode confusables","dangerous schemes"]
    if 81 <= n <= 100 or any(x in low for x in ["timezone","timestamp","calendar","ics","epoch","timeline"]):
        out += ["leap day","DST forward gap","DST backward overlap","year boundary","ambiguous local time"]
    if 101 <= n <= 120:
        out += ["zero denominator","negative values","high precision decimal","rounding boundary"]
    if 121 <= n <= 180:
        out += ["corrupt or truncated file","mismatched extension/signature","resource bomb or oversized dimensions","path traversal filename"]
    if n >= 181:
        out += ["malformed identifier","Unicode punctuation","duplicate record","unknown fields or tags"]
    return list(dict.fromkeys(out))


def strategy(n: int, name: str) -> str:
    low = name.lower()
    if "base64" in low:
        return "Compare exact bytes/text against RFC 4648 section 10 literals, then use a second decoder for additional binary cases."
    if "hash" in low or "checksum" in low:
        return "Use published-standard known answers first; cross-check additional bytes with OpenSSL or Python hashlib, never production helpers."
    if "uuid" in low:
        return "Assert RFC 9562 shape, version and variant bits; randomness/collision smoke tests are explicitly non-authoritative."
    if "url" in low or "query" in low or "utm" in low:
        return "Use literal WHATWG/spec examples plus parse-serialize idempotence and ordered repeated-key fixtures; cross-check with browser URL APIs/WPT."
    if 21 <= n <= 40 or "csv" in low:
        return "Compare semantic cell matrices against hand-worked RFC-shaped fixtures and a second parser; project cleaning policy is asserted separately."
    if "json" in low:
        return "Use RFC 8259 valid/invalid literals and an independent parser; formatting preferences are policy fixtures rather than grammar claims."
    if "yaml" in low or "toml" in low:
        return "Use specification/conformance examples plus an independent parser; do not promote parser-specific behavior to a standard."
    if "markdown" in low:
        return "Use CommonMark structure cases and a separate OWASP-backed inert XSS corpus; browser acceptance proves no payload executes."
    if "qr" in low:
        return "Generate then decode with an independent QR implementation and compare payload bytes exactly; self-decode is not a sufficient oracle."
    if 81 <= n <= 100:
        return "Use fixed UTC instants and hand-worked calendar literals; cross-check zone behavior against IANA tzdb through an independent implementation."
    if 101 <= n <= 120:
        return "Use manually worked decimal literals with formula semantics stated in fixtures; verify with independent decimal arithmetic, not production code."
    if 121 <= n <= 160:
        return "Validate output with an independent parser/decoder and exact dimensions/signatures/metadata invariants using locally generated synthetic media."
    if 161 <= n <= 180:
        return "Use known bytes/signatures and synthetic local file trees; compare manifests independently and enforce traversal/resource limits."
    if n >= 181:
        return "Use synthetic bibliographic/identifier records grounded in format-owner documentation; preserve unknown fields and cross-check with an independent parser when available."
    return "Use manually authored literal fixtures plus algebraic/idempotence properties; expected values are kept separate from future production code."


def security(n: int, name: str) -> list[str]:
    low = name.lower()
    out = ["LOCAL by default; fixture payload is never telemetry","no implicit persistence of tool input"]
    if any(x in low for x in ["markdown","html","url","redirect","open graph"]):
        out += ["never execute untrusted active content","block unsafe URL schemes or sinks","do not leak credentials/tokens in previews"]
    if 21 <= n <= 60:
        out += ["bound parser depth and input size","malformed input returns a recoverable typed error"]
    if 121 <= n <= 180:
        out += ["treat files as untrusted bytes","bound memory/decompression work","never infer safety from extension","constrain output paths"]
    if "secret" in low:
        out += ["scanner results can contain secrets and must be redacted in logs/previews","never upload scanned payload by default"]
    if n >= 181:
        out += ["do not resolve or fetch identifiers unless requested","never leak private notes/citations to a network service"]
    return list(dict.fromkeys(out))


def portability(n: int, name: str) -> list[str]:
    low = name.lower()
    out = ["UTF-8 behavior is explicit","deterministic core must match across supported desktop/mobile browsers"]
    if 121 <= n <= 180 or any(x in low for x in ["file","image","pdf","zip","folder"]):
        out += ["preflight File API/worker/codec capability","mobile memory limits require fail-fast size guidance"]
    if 81 <= n <= 100 or any(x in low for x in ["date","timezone","timestamp","calendar","epoch","timeline"]):
        out += ["Intl/tzdb version drift is recorded when it can change output"]
    if "regex" in low:
        out += ["Tier-1 browser ECMAScript RegExp parity is required"]
    return list(dict.fromkeys(out))


def cross_check(n: int, name: str) -> dict:
    low = name.lower()
    if "base64" in low:
        return {"usable":True,"implementation":"Python base64 or browser byte-safe Base64 API","role":"secondary only"}
    if "hash" in low or "checksum" in low or "hmac" in low:
        return {"usable":True,"implementation":"OpenSSL CLI and Python hashlib/hmac","role":"secondary independent implementation"}
    if "url" in low or "query" in low or "utm" in low:
        return {"usable":True,"implementation":"browser URL/URLSearchParams plus web-platform-tests","role":"spec-conformance cross-check"}
    if 21 <= n <= 40 or "csv" in low:
        return {"usable":True,"implementation":"Python csv module","role":"secondary parser with explicit policy normalization"}
    if "json" in low:
        return {"usable":True,"implementation":"Python json plus browser JSON","role":"secondary parse semantics"}
    if 81 <= n <= 100:
        return {"usable":True,"implementation":"Python datetime/zoneinfo with recorded tzdb","role":"secondary conversion"}
    if "qr" in low:
        return {"usable":True,"implementation":"independent QR decoder selected by integration lane","role":"required for Gold"}
    if 121 <= n <= 160:
        return {"usable":True,"implementation":"independent browser/system image or PDF parser","role":"required for Gold where format permits"}
    if n == 187:
        return {"usable":True,"implementation":"Pinned Zotero RIS.js/BibTeX.js translator expectations plus a test-only RIS parser; see quality/fixtures/research-ris-bibtex-conversion/oracle-cross-check.json","role":"required independent cross-check for the declared conversion subset"}
    if "bibtex" in low or "ris" in low:
        return {"usable":True,"implementation":"independent bibliography parser in test tooling","role":"recommended"}
    return {"usable":True,"implementation":"independent standard-library/tooling implementation where available","role":"secondary; literal/spec oracle remains primary"}


REGISTRY = []
for n, name in CANDIDATES:
    src = truth_sources(n, name)
    official = [s for s in src if s not in {"strumentini-quality","strumentini-lane05","fixture-policy"}]
    gaps = []
    confidence = "high"
    low = name.lower()
    if any(x in low for x in ["reading-time","smart-quote","lorem","language-aware","campaign-name","social character-limit","meta title","open graph","platform-size","public-holiday","currency"]):
        confidence = "medium"
        gaps.append("Product/data/platform policy can drift; bind an exact source/version before Gold.")
    if "qr" in low:
        gaps.append("ISO normative text is paywalled; do not fabricate unavailable vectors. Independent decode remains mandatory.")
    if 121 <= n <= 140:
        confidence = "medium"
        gaps.append("Full ISO PDF normative text is not bundled; deeper conformance corpus/parser requires separate license/dependency review.")
    if "ris" in low and n != 187:
        confidence = "medium"
        gaps.append("No single freely accessible normative RIS authority is treated as canonical; preserve unknown tags and require parser cross-check.")
    if not gaps:
        gaps = ["No unresolved gap for the currently declared deterministic semantics; re-open if the tool manifest expands its claims."]
    REGISTRY.append({
        "id":f"cand-{n:03d}",
        "candidate":name,
        "tool_family":family_for(n, name),
        "maintenance_class":maintenance_for(n, name),
        "truth_sources":src,
        "standard_or_official_example":", ".join(official) if official else "Hand-worked Strumentini.it literals/project policy; no universal normative standard is claimed.",
        "invariants":invariants(name),
        "adversarial_cases":adversarial(n, name),
        "expected_output_strategy":strategy(n, name),
        "security_privacy_edges":security(n, name),
        "portability_browser_edges":portability(n, name),
        "cross_check":cross_check(n, name),
        "confidence":confidence,
        "unresolved_gaps":gaps,
    })

dump(ORACLES / "registry.json", {
    "schema_version":1,
    "generated_at":"2026-09-23",
    "entry_count":len(REGISTRY),
    "entries":REGISTRY,
})

print(f"generated sources={len(SOURCES)} registry={len(REGISTRY)} fixtures={len(FAMILY_ROWS)}")
