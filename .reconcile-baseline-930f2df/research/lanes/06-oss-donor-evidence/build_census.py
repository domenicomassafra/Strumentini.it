import csv
import datetime as dt
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SNAP = ROOT / "06-oss-donor-evidence"
TODAY = dt.datetime(2026, 9, 23, tzinfo=dt.timezone.utc)


VERDICTS = {
    "papaparse": "SPIKE", "csv-parse": "SPIKE", "d3-dsv": "REFERENCE_ONLY",
    "arquero": "REFERENCE_ONLY", "xlsx": "AVOID", "yaml": "SPIKE",
    "js-yaml": "REFERENCE_ONLY", "@iarna/toml": "AVOID", "smol-toml": "SPIKE",
    "marked": "SPIKE", "markdown-it": "SPIKE", "unified": "REFERENCE_ONLY",
    "micromark": "REFERENCE_ONLY", "dompurify": "SPIKE", "diff": "ADOPT",
    "diff-match-patch": "REFERENCE_ONLY", "qs": "AVOID", "query-string": "REFERENCE_ONLY",
    "date-fns": "SPIKE", "dayjs": "REFERENCE_ONLY", "luxon": "REFERENCE_ONLY",
    "@js-temporal/polyfill": "SPIKE", "rrule": "SPIKE", "decimal.js": "ADOPT",
    "big.js": "SPIKE", "currency.js": "REFERENCE_ONLY", "@dinero.js/core": "AVOID",
    "@noble/hashes": "SPIKE", "hash-wasm": "SPIKE", "qrcode": "SPIKE",
    "bwip-js": "REFERENCE_ONLY", "@zxing/browser": "SPIKE", "jsqr": "REFERENCE_ONLY",
    "browser-image-compression": "REFERENCE_ONLY", "pica": "SPIKE",
    "compressorjs": "SPIKE", "exifr": "SPIKE", "exifreader": "SPIKE",
    "pdf-lib": "SPIKE", "pdfjs-dist": "SPIKE", "jspdf": "REFERENCE_ONLY",
    "fflate": "SPIKE", "jszip": "REFERENCE_ONLY", "pako": "REFERENCE_ONLY",
    "@zip.js/zip.js": "SPIKE", "file-type": "SPIKE", "mrmime": "REFERENCE_ONLY",
    "@citation-js/core": "SPIKE", "@citation-js/plugin-bibtex": "SPIKE",
    "citeproc": "AVOID", "fuse.js": "SPIKE", "minisearch": "SPIKE",
    "flexsearch": "REFERENCE_ONLY", "idb": "ADOPT", "dexie": "REFERENCE_ONLY",
}


FAMILY_MAP = {
    "CSV/tabular": "CSV viewer/cleaner/dedupe/filter/sort/CSV↔JSON",
    "JSON/YAML/TOML": "structured-data parse/format/convert",
    "Markdown/sanitization": "Markdown preview/render + XSS boundary",
    "diff/list/text": "text diff/list comparison",
    "URL/query/UTM": "URL encode/query editor/UTM builder-parser/cleaner",
    "date/time": "date math/timezone/recurrence",
    "business math": "rates/margin/markup/profitability/invoice math",
    "hashing/encoding": "hash/checksum/HMAC/encoding",
    "QR/barcode": "QR generation/reading; later barcode",
    "image": "resize/convert/compress/EXIF metadata",
    "PDF": "PDF render/extract/mutate/metadata",
    "ZIP/archive": "ZIP inspect/create/clean archive",
    "MIME/signature": "file signature/type detection",
    "citation": "BibTeX/RIS/DOI/ISBN/citation operations",
    "local search": "catalog/notes fuzzy or full-text search",
    "IndexedDB/OPFS": "local persistence helpers",
}


RATIONALE = {
    "papaparse": "Browser-first CSV parser with local-file, streaming and worker support; benchmark adversarial CSV and historical ReDoS cases.",
    "csv-parse": "Actively maintained zero-direct-dependency parser; compare browser ESM path and streaming ergonomics against Papa Parse.",
    "d3-dsv": "Small focused DSV parser but no large-file streaming/worker story; good oracle/reference for simple tables.",
    "arquero": "Powerful columnar transforms but much broader and heavier than Wave A needs.",
    "xlsx": "npm package is old, large and broader than the approved CSV tracer; spreadsheet support should be a separate capability decision.",
    "yaml": "Current stable 2.x, zero direct deps, browser mapping and bundled types; spike alias/recursion limits and hostile fixtures.",
    "js-yaml": "Mature alternative with a larger historical advisory surface; keep as comparison candidate.",
    "@iarna/toml": "Old release and no modern ESM/TS signals; too stale for a new core dependency.",
    "smol-toml": "Fresh ESM/TS package with zero direct deps; repo provenance still needs direct verification before adoption.",
    "marked": "Fast Markdown parser but output is not sanitized; use only with a patched sanitizer and XSS corpus.",
    "markdown-it": "Mature parser alternative; still requires sanitizer for untrusted HTML.",
    "unified": "Excellent plugin architecture, but more dependency graph than a simple preview requires.",
    "micromark": "Strong CommonMark primitive but a larger dependency graph than needed for a basic preview.",
    "dompurify": "Purpose-built browser sanitizer; security-sensitive and requires rapid patch SLA plus strict configuration tests.",
    "diff": "Current zero-dependency jsdiff with tests/CI; strong fit for text/list diff primitives.",
    "diff-match-patch": "Proven algorithm but stale package ergonomics; study/reference rather than default product dependency.",
    "qs": "Native URL and URLSearchParams cover Wave A query editing while avoiding extra dependency/security surface.",
    "query-string": "Clean ESM package, but native URLSearchParams should remain the default unless semantics require more.",
    "date-fns": "Actively maintained and modular; spike only for operations not cleanly covered by Temporal/Intl.",
    "dayjs": "Small API but plugin semantics add maintenance choices; native Temporal/Intl plus targeted helpers preferred.",
    "luxon": "Useful timezone reference built on Intl, but heavier than targeted native-first helpers.",
    "@js-temporal/polyfill": "Standards-aligned bridge only if supported-browser testing shows Temporal gaps.",
    "rrule": "Focused recurrence engine; useful for Wave B recurring-date work, not basic date arithmetic.",
    "decimal.js": "Mature zero-dependency exact decimal arithmetic; good shared business-math primitive.",
    "big.js": "Smaller exact-decimal alternative; compare against decimal.js if feature needs stay narrow.",
    "currency.js": "Tiny money helper but less general than decimal.js and package cadence is slower.",
    "@dinero.js/core": "Published subpackage remains alpha; do not anchor v1 arithmetic on it.",
    "@noble/hashes": "Modern TS/ESM zero-dependency hashes; strong candidate for incremental hashing beyond Web Crypto digest.",
    "hash-wasm": "WASM hashing may win on large files; lazy-load and benchmark startup/memory against noble/Web Crypto.",
    "qrcode": "Focused MIT QR generation with browser support; spike determinism, ECC coverage and bundle cost.",
    "bwip-js": "Excellent barcode breadth but oversized for QR-first Wave A.",
    "@zxing/browser": "Current browser scanner package; use only for QR/barcode reading after decode/camera acceptance tests.",
    "jsqr": "Small QR-only decoder with older npm release; useful reference/fallback against ZXing.",
    "browser-image-compression": "Convenient wrapper, but native Canvas/ImageBitmap plus focused codecs should remain baseline.",
    "pica": "Current quality-focused browser resize engine; strong candidate for downscale/resize.",
    "compressorjs": "Current browser compressor; compare against native canvas pipeline and pica before adding.",
    "exifr": "Zero-dependency EXIF parser; viable if metadata corpus passes despite slower release cadence.",
    "exifreader": "Current typed metadata parser with broad coverage; MPL-2.0 compliance must be recorded.",
    "pdf-lib": "Browser-capable PDF mutation API, but old release and large package require a bounded mutation-only spike.",
    "pdfjs-dist": "Current Mozilla PDF.js is the browser render/extract baseline; heavy and must stay lazy/worker-isolated.",
    "jspdf": "Good PDF generation reference, but generation is not the primary UtilityOS PDF need and package is large.",
    "fflate": "Current zero-dependency archive/compression primitive; strong ZIP candidate after zip-bomb and cancellation tests.",
    "jszip": "Mature and current but with more dependency/streaming overhead than fflate/zip.js; retain as comparator.",
    "pako": "Strong deflate primitive, but not a full ZIP container solution.",
    "@zip.js/zip.js": "Browser-focused ZIP toolkit with streams/workers; spike for Wave C despite larger package footprint.",
    "file-type": "Current magic-byte detector; spike browser entry and supported-signature corpus rather than trusting extensions.",
    "mrmime": "Tiny extension mapper, not signature detection; reference only for non-security MIME lookup.",
    "@citation-js/core": "Current modular citation pipeline; strong base if plugins remain lazy and round-trip tests pass.",
    "@citation-js/plugin-bibtex": "Current BibTeX plugin; spike malformed-entry behavior and fidelity.",
    "citeproc": "CPAL/AGPL licensing plus older package makes it unsuitable without explicit legal review.",
    "fuse.js": "Current zero-dependency fuzzy matcher; good candidate when exact/native search is insufficient.",
    "minisearch": "Zero-dependency local full-text index; spike if ranked token search is needed.",
    "flexsearch": "Capable but larger search surface; benchmark/reference unless simpler options fail.",
    "idb": "Tiny typed wrapper over native IndexedDB; appropriate only when raw IndexedDB becomes repetitive.",
    "dexie": "Powerful abstraction but much broader/heavier than current persistence needs.",
}


BROWSER = {
    "papaparse": "YES — browser files + Web Worker documented",
    "csv-parse": "YES — browser ESM distribution; verify bundler entry",
    "yaml": "YES — npm browser mapping", "marked": "YES — npm browser mapping",
    "dompurify": "YES — browser DOM sanitizer", "diff": "YES — npm browser mapping",
    "date-fns": "YES — browser mapping", "@js-temporal/polyfill": "YES — polyfill package",
    "@noble/hashes": "YES — browser-capable ESM", "hash-wasm": "YES — browser/WASM",
    "qrcode": "YES — browser mapping", "@zxing/browser": "YES — browser package",
    "pica": "YES — browser image resize", "compressorjs": "YES — browser mapping",
    "pdf-lib": "YES — browser supported", "pdfjs-dist": "YES — browser/worker distribution",
    "fflate": "YES — browser mapping", "@zip.js/zip.js": "YES — browser/worker oriented",
    "@citation-js/core": "YES — ESM/browser-capable", "@citation-js/plugin-bibtex": "YES — Citation.js runtime",
    "fuse.js": "YES — browser/local", "minisearch": "YES — browser/local",
    "idb": "YES — browser IndexedDB only", "dexie": "YES — browser IndexedDB only",
}


WORKER = {
    "papaparse": "YES — documented worker mode",
    "dompurify": "NO DIRECT — requires DOM; sanitize at client DOM boundary",
    "hash-wasm": "YES — isolate large-file hashing in worker",
    "pdfjs-dist": "YES — canonical worker architecture",
    "@zip.js/zip.js": "YES — worker-capable",
    "idb": "YES/CONDITIONAL — IndexedDB exists in workers; test browser floor",
    "dexie": "CONDITIONAL — depends on selected Dexie features/plugins",
    "pica": "CONDITIONAL — test OffscreenCanvas/worker path",
    "@zxing/browser": "CONDITIONAL — decode can move to worker; camera/DOM stays main thread",
}


def repo_url(row, deep):
    gh = (deep.get("github") or {}).get("html_url")
    if gh:
        return gh
    raw = row.get("repository") or row.get("homepage") or ""
    return raw.replace("git+", "").replace(".git", "")


def maintenance(deep):
    pushed = (deep.get("github") or {}).get("pushed_at")
    if pushed:
        stamp = dt.datetime.fromisoformat(pushed.replace("Z", "+00:00"))
        age = (TODAY - stamp).days
        label = "ACTIVE" if age <= 90 else "MAINTAINED" if age <= 365 else "QUIET"
        return f"{label} — pushed {pushed[:10]}"
    if deep.get("published_at"):
        return f"PACKAGE ACTIVE — released {deep['published_at'][:10]}; repo activity unresolved"
    return "not deep-verified"


def advisory_summary(deep):
    adv = deep.get("advisories")
    if adv is None:
        return "not deep-verified"
    if not adv:
        return "No GitHub Advisory Database hits returned for npm package query"
    active = [x for x in adv if not x.get("withdrawn_at")]
    withdrawn = [x for x in adv if x.get("withdrawn_at")]
    ids = ",".join(x.get("ghsa_id", "?") for x in active[:5])
    suffix = f" +{len(active)-5} more" if len(active) > 5 else ""
    return f"{len(active)} non-withdrawn GHSA hits ({ids}{suffix}); {len(withdrawn)} withdrawn; latest-version applicability not assumed"


def test_quality(deep):
    sig = deep.get("repo_signals") or {}
    if sig.get("has_tests") and sig.get("has_ci"):
        return "GOOD — tests + CI present"
    if sig.get("has_tests"):
        return "TESTS present; CI not detected"
    if sig.get("has_ci"):
        return "CI present; test paths not detected"
    return "UNKNOWN/WEAK — tests/CI not detected in tree snapshot"


def ts_quality(row, deep):
    sig = deep.get("repo_signals") or {}
    if row.get("types") and sig.get("has_typescript"):
        return "STRONG — bundled types + TS source"
    if row.get("types"):
        return "GOOD — bundled type declarations"
    if sig.get("has_typescript"):
        return "TS source; package type declarations not exposed"
    return "JS/UNKNOWN — no bundled TS metadata observed"


def ssr_static(family, pkg):
    if pkg == "dompurify":
        return "CLIENT DOM boundary; static build okay, runtime DOM required"
    if family == "IndexedDB/OPFS":
        return "Static build okay; runtime browser-only"
    if pkg == "pdfjs-dist":
        return "Static build okay when lazy/client imported; worker assets required"
    return "Static-build compatible in principle; feature-detect browser-only APIs"


def worker_compat(family, pkg):
    if pkg in WORKER:
        return WORKER[pkg]
    if family in {"business math", "diff/list/text", "date/time", "local search", "JSON/YAML/TOML", "hashing/encoding", "citation", "URL/query/UTM"}:
        return "LIKELY — pure computation path; verify in worker acceptance"
    if family in {"Markdown/sanitization", "image", "QR/barcode", "PDF"}:
        return "CONDITIONAL — DOM/canvas/asset path must be integration-tested"
    return "LIKELY/CONDITIONAL — verify at package seam"


def wasm_native(pkg):
    if pkg == "hash-wasm":
        return "WASM required"
    if pkg == "pdfjs-dist":
        return "JS worker plus packaged/optional WASM assets in modern builds"
    return "No native/WASM requirement observed in npm metadata"


npm_rows = json.loads((SNAP / "npm-latest-metadata.json").read_text())["rows"]
deep_rows = {x["package"]: x for x in json.loads((SNAP / "deep-primary-metadata.json").read_text())["rows"]}
rows = []

for row in npm_rows:
    if not row.get("ok"):
        continue
    pkg = row["package"]
    deep = deep_rows.get(pkg)
    is_deep = deep is not None
    deps = int(row.get("dep_count") or 0)
    size = row.get("unpacked_size")
    footprint = f"{size / 1024:.1f} KiB npm unpacked (not min+gzip)" if isinstance(size, (int, float)) else "not exposed"
    if deps == 0:
        burden = "LOW — 0 direct runtime deps; transitive package deps = 0"
    else:
        burden = f"{'MEDIUM' if deps <= 4 else 'HIGH'} — {deps} direct runtime deps; transitive closure not exhaustively expanded"
    esm = "ESM/module signal present" if row.get("module") or row.get("type") == "module" or isinstance(row.get("exports"), dict) else "No explicit ESM signal in npm latest metadata"
    browser = BROWSER.get(pkg)
    if not browser and is_deep:
        browser = "EXPLICIT npm browser field" if row.get("browser") else "Not explicit in npm metadata — verify docs/spike"
    rows.append({
        "family": row["family"], "candidate_kind": "npm-package", "candidate": pkg,
        "canonical_url": repo_url(row, deep or {}), "latest_version": row.get("version") or "",
        "latest_release_date": (deep or {}).get("published_at") or "", "license": row.get("license") or "UNKNOWN",
        "license_source": f"https://www.npmjs.com/package/{pkg}",
        "maintenance": maintenance(deep or {}) if is_deep else "not deep-verified",
        "browser_support": browser or "not deep-verified", "esm_tree_shaking": esm if is_deep else "",
        "approx_footprint": footprint if is_deep else "", "dependency_burden": burden if is_deep else f"{deps} direct runtime deps",
        "wasm_native": wasm_native(pkg) if is_deep else "", "security_advisories": advisory_summary(deep or {}) if is_deep else "not deep-verified",
        "test_quality": test_quality(deep or {}) if is_deep else "", "typescript_quality": ts_quality(row, deep or {}) if is_deep else "",
        "worker_compatibility": worker_compat(row["family"], pkg) if is_deep else "", "ssr_static_build": ssr_static(row["family"], pkg) if is_deep else "",
        "capability_coverage": row["family"], "utilityos_mapping": FAMILY_MAP.get(row["family"], ""),
        "adoption": VERDICTS.get(pkg, "REFERENCE_ONLY"),
        "rationale": RATIONALE.get(pkg, f"Census-only {row['family']} candidate; not selected for deep adoption without a proven capability gap."),
        "deep_assessed": "yes" if is_deep else "no",
        "evidence_note": "npm registry latest metadata" + (" + GitHub repo/tree metadata + GitHub Advisory Database query" if is_deep else ""),
    })


STUDY = [
    ("gchq/CyberChef", "Apache-2.0", "2026-09-23", "REFERENCE_ONLY", "Operation registry, local execution, recipe/pipeline composition and tool modularity."),
    ("CorentinTh/it-tools", "GPL-3.0", "2026-09-16", "REFERENCE_ONLY", "Utility discovery UX and client-side tool composition; study patterns, not source copying."),
    ("GoogleChromeLabs/squoosh", "Apache-2.0", "2026-09-23", "REFERENCE_ONLY", "Worker/WASM image codecs, local-first compression and before/after UX."),
    ("goodtab/bentopdf", "NOASSERTION; current repo LICENSE observed as Apache-2.0", "2025-10-16", "REFERENCE_ONLY", "Client-side PDF composition; BentoPDF fork/license lineage is inconsistent, so architecture only."),
    ("Stirling-Tools/Stirling-PDF", "Mixed/open-core; root MIT with separately licensed directories", "2026-09-23", "REFERENCE_ONLY", "PDF workflow breadth, tool decomposition and license-inventory patterns; path-level license diligence required."),
    ("DevToys-app/DevToys", "MIT", "2026-02-25", "REFERENCE_ONLY", "Utility taxonomy, search/command UX and modular tool boundaries; desktop stack is reference only."),
    ("microsoft/PowerToys", "MIT", "2026-09-23", "REFERENCE_ONLY", "Mature utility-suite governance, discovery and per-tool lifecycle patterns."),
    ("ArtifexSoftware/mupdf", "AGPL-3.0", "2026-09-23", "AVOID", "High-quality PDF engine reference; AGPL/commercial licensing plus native/WASM complexity make casual dependency use inappropriate."),
    ("qpdf/qpdf", "Apache-2.0", "2026-09-06", "REFERENCE_ONLY", "Robust PDF structural manipulation/validation algorithms; native C++ makes it an oracle/reference unless a deliberate WASM port is approved."),
    ("zotero/zotero", "NOASSERTION in GitHub API; verify path-specific license", "2026-09-22", "REFERENCE_ONLY", "Citation data model, CSL integration and dedupe workflows; application-scale reference only."),
]

for repo, license_name, pushed, adoption, reason in STUDY:
    url = "https://github.com/" + repo
    rows.append({
        "family": "mature-application/reference", "candidate_kind": "github-repo", "candidate": repo,
        "canonical_url": url, "latest_version": "", "latest_release_date": "", "license": license_name,
        "license_source": url + "/blob/HEAD/LICENSE", "maintenance": f"ACTIVE/RECENT — pushed {pushed}",
        "browser_support": "varies by application", "esm_tree_shaking": "not assessed as dependency",
        "approx_footprint": "application-scale", "dependency_burden": "application-scale", "wasm_native": "varies",
        "security_advisories": "study-only; package advisory query not applicable", "test_quality": "study-only",
        "typescript_quality": "study-only", "worker_compatibility": "architectural pattern only",
        "ssr_static_build": "architectural pattern only", "capability_coverage": "utility-suite/application architecture",
        "utilityos_mapping": "tool registry, UX, worker/WASM, licensing, workflow patterns", "adoption": adoption,
        "rationale": reason, "deep_assessed": "no", "evidence_note": "GitHub repository metadata + first-party repository/license pages",
    })


FIELDS = [
    "family", "candidate_kind", "candidate", "canonical_url", "latest_version", "latest_release_date",
    "license", "license_source", "maintenance", "browser_support", "esm_tree_shaking", "approx_footprint",
    "dependency_burden", "wasm_native", "security_advisories", "test_quality", "typescript_quality",
    "worker_compatibility", "ssr_static_build", "capability_coverage", "utilityos_mapping", "adoption",
    "rationale", "deep_assessed", "evidence_note",
]

with (ROOT / "06-oss-donor-matrix.csv").open("w", newline="") as fh:
    writer = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

summary = {
    "generated_at": "2026-09-23",
    "census_rows": len(rows),
    "npm_rows": sum(x["candidate_kind"] == "npm-package" for x in rows),
    "study_repo_rows": sum(x["candidate_kind"] == "github-repo" for x in rows),
    "deep_rows": sum(x["deep_assessed"] == "yes" for x in rows),
    "verdict_counts": {k: sum(x["adoption"] == k for x in rows) for k in ["ADOPT", "SPIKE", "REFERENCE_ONLY", "AVOID"]},
    "notes": [
        "Deep dependency burden uses direct-dependency count as a conservative proxy; transitive closure is exact only for zero-direct-dependency packages.",
        "Security records GitHub Advisory Database package-query hits and does not claim every advisory affects the latest release.",
    ],
}
(SNAP / "census-summary.json").write_text(json.dumps(summary, indent=2) + "\n")


def short_security(value: str) -> str:
    return value if len(value) <= 88 else value[:85] + "..."


deep_table = [
    "| Family | Candidate | Release | License | Maintenance | Footprint | Dependency burden | Security signal | Verdict |",
    "|---|---|---|---|---|---:|---|---|---|",
]
for item in rows:
    if item["deep_assessed"] != "yes":
        continue
    release = f"{item['latest_version']} / {item['latest_release_date'][:10]}"
    size = item["approx_footprint"].split(" npm")[0]
    burden = item["dependency_burden"].split(" — ")[0]
    deep_table.append(
        f"| {item['family']} | `{item['candidate']}` | {release} | {item['license']} | "
        f"{item['maintenance']} | {size} | {burden} | {short_security(item['security_advisories'])} | "
        f"**{item['adoption']}** |"
    )


spike_names = [
    "papaparse", "yaml", "marked", "markdown-it", "dompurify", "date-fns",
    "@js-temporal/polyfill", "big.js", "@noble/hashes", "hash-wasm", "qrcode",
    "pica", "exifr", "pdf-lib", "pdfjs-dist", "fflate", "file-type",
    "@citation-js/core", "fuse.js", "idb",
]
row_by_name = {x["candidate"]: x for x in rows}
shortlist_lines = []
for name in spike_names:
    item = row_by_name[name]
    shortlist_lines.append(
        f"- **`{name}` — {item['adoption']}.** {item['rationale']} "
        f"Primary: {item['canonical_url']} ; package: {item['license_source']}"
    )


study_lines = []
for item in rows:
    if item["candidate_kind"] == "github-repo":
        study_lines.append(
            f"- **{item['candidate']}** — {item['license']}; {item['rationale']} {item['canonical_url']}"
        )


primary_sources = [
    "https://www.papaparse.com/docs",
    "https://github.com/mholt/PapaParse",
    "https://github.com/adaltas/node-csv",
    "https://github.com/eemeli/yaml/releases",
    "https://github.com/nodeca/js-yaml",
    "https://marked.js.org/",
    "https://github.com/markdown-it/markdown-it",
    "https://github.com/cure53/DOMPurify",
    "https://github.com/cure53/DOMPurify/security/advisories",
    "https://github.com/kpdecker/jsdiff",
    "https://github.com/date-fns/date-fns",
    "https://github.com/js-temporal/temporal-polyfill",
    "https://github.com/MikeMcl/decimal.js",
    "https://github.com/paulmillr/noble-hashes",
    "https://github.com/Daninet/hash-wasm",
    "https://github.com/soldair/node-qrcode",
    "https://github.com/nodeca/pica",
    "https://github.com/MikeKovarik/exifr",
    "https://github.com/Hopding/pdf-lib",
    "https://github.com/mozilla/pdf.js",
    "https://github.com/101arrowz/fflate",
    "https://github.com/gildas-lormeau/zip.js",
    "https://github.com/sindresorhus/file-type",
    "https://github.com/citation-js/citation-js",
    "https://github.com/krisk/Fuse",
    "https://github.com/lucaong/minisearch",
    "https://github.com/jakearchibald/idb",
    "https://github.com/gchq/CyberChef",
    "https://github.com/CorentinTh/it-tools",
    "https://github.com/GoogleChromeLabs/squoosh",
    "https://github.com/goodtab/bentopdf",
    "https://github.com/Stirling-Tools/Stirling-PDF",
    "https://github.com/qpdf/qpdf",
    "https://github.com/zotero/zotero",
]


report = f"""# UtilityOS OSS / GitHub donor census

Date: 2026-09-23
Lane: `lane-01-oss-donor-census`
Status: decision research, not dependency installation

## Executive summary

UtilityOS should **not** reimplement every parser/codec from scratch, but it also should not become a dependency museum. This census found **{summary['census_rows']} distinct package/repository candidates**, including **{summary['deep_rows']} deep assessments** across every required capability family. The resulting posture is deliberately conservative: **3 `ADOPT`, 28 `SPIKE`, 86 `REFERENCE_ONLY`, 6 `AVOID`**.

The strongest near-term pattern is:

1. keep browser-native primitives for URL handling, UTF-8, UUIDs, basic hashing, locale/time formatting, basic image decode/encode and IndexedDB where raw APIs remain simple;
2. spike a small set of mature parsing/security/math/file libraries where edge cases are expensive to reproduce correctly;
3. isolate heavy PDF/image/archive runtimes behind lazy workers rather than letting them leak into the shell;
4. use mature utility applications as architecture/UX/oracle donors, not as code-copy sources;
5. treat sanitizer, PDF, archive and file-signature dependencies as continuously patched security surfaces, not “install once” components.

The full machine-readable matrix is `research/lanes/06-oss-donor-matrix.csv`. Raw npm/GitHub/advisory evidence is under `research/lanes/06-oss-donor-evidence/`.

## Method and evidence discipline

Primary evidence came from the npm registry, GitHub repository metadata/tree inspection, GitHub Advisory Database package queries, and first-party project documentation/release/license pages. The census intentionally records `unknown`, `not verified`, or conditional compatibility where a package does not expose a fact directly.

Important limits:

- npm `dist.unpackedSize` is used only as an **approximate package-footprint signal**; it is not minified+gzip bundle size.
- dependency burden is exact only for packages with zero direct dependencies; otherwise the matrix reports direct runtime dependencies as a conservative proxy and explicitly does **not** pretend the full transitive closure was measured.
- GitHub Advisory Database hits are recorded as evidence that advisories exist in the package history; the matrix does **not** assume each advisory affects the latest version without version-range evaluation.
- browser/worker/SSR compatibility is marked conditional whenever it depends on DOM, canvas, worker asset routing, WASM loading, or bundler entry selection.

## Native Web Platform first

Prefer no dependency for these UtilityOS primitives unless acceptance tests demonstrate a real gap:

| UtilityOS need | Prefer | Why |
|---|---|---|
| URL parse/build, UTM/query editing | `URL`, `URLSearchParams` | Native, standards-based, no dependency/security surface. |
| Base64 for byte/text helpers | `Uint8Array`, `TextEncoder`, `TextDecoder`, narrowly-scoped helpers | Avoid Buffer polyfills in browser-only tools. |
| UUID v4 | `crypto.randomUUID()` | Native secure generator. |
| Basic non-streaming SHA digests | Web Crypto `subtle.digest` | Native and trusted; dependency only for incremental/very-large-file hashing. |
| Timezone/locale formatting | `Intl` | Native timezone database exposure and locale formatting. |
| Modern date/time model | `Temporal` when supported | Standards path; polyfill only if browser floor requires it. |
| Simple image decode/resize/encode | `createImageBitmap`, Canvas/OffscreenCanvas where supported | Keep common transforms dependency-light; bring codecs only for measured quality/format gaps. |
| Small local persistence | IndexedDB directly | Add `idb` only when repeated transaction boilerplate is proven. |
| File reads/streaming | Blob/File/Streams APIs | Native and compatible with privacy-first local execution. |
| Simple list/set operations | JS `Set`, arrays, sort/map/filter | Tiny local code is clearer than utility-package imports. |

Native-first explicitly means **do not add `qs` just to edit query strings**, do not add Moment/Day.js just to format dates, and do not add a general-purpose image/PDF engine to tools that can be satisfied by browser APIs.

## Dependency shortlist worth a focused spike (20)

These are not blanket approvals. Each must pass the UtilityOS public-seam corpus, bundle delta, browser/mobile matrix, privacy checks and cancellation/worker requirements appropriate to its class.

{chr(10).join(shortlist_lines)}

Three candidates are already strong enough for an implementation default **once their normal UtilityOS acceptance tests pass**: `diff` for text diff, `decimal.js` for exact business arithmetic, and `idb` when a wrapper is actually justified. They still remain subject to lockfile/license/bundle gates.

## Mature applications/repos worth studying, not depending on

{chr(10).join(study_lines)}

The most reusable architectural lessons are:

- **CyberChef:** operation registry, composable transformation pipeline, clear local-execution model.
- **IT-Tools:** discoverability and consistent micro-tool UX; GPL-3.0 means pattern study rather than source reuse.
- **Squoosh:** worker/WASM lazy loading, progress phases, local-only image processing and before/after inspection.
- **BentoPDF/Stirling PDF:** PDF tool decomposition and UX breadth, but their current license/fork structures require path-level diligence; do not treat either repository as a permissive source bucket.
- **qpdf/MuPDF:** excellent behavioral/oracle references for PDF correctness; native/AGPL constraints make them poor casual browser dependencies.
- **Zotero:** citation model and dedupe/workflow reference rather than an embeddable UtilityOS module.

## DO NOT USE / avoid as current UtilityOS core dependencies

- **`xlsx` 0.18.5** — package published 2022-03-24, ~7.3 MiB unpacked, seven direct deps and multiple advisory-database hits. Spreadsheet support is outside the Wave A CSV tracer; do not pull this in “just in case.”
- **`@iarna/toml` 2.2.5** — npm release from 2020 with stale modern-package signals. Prefer a current TOML candidate only when TOML enters an approved wave.
- **`qs`** — capable and current, but UtilityOS Wave A query editing is covered by native `URLSearchParams`; avoid unnecessary historical security and dependency surface.
- **`@dinero.js/core` 2.0.0-alpha.1** — alpha subpackage is not an appropriate v1 arithmetic foundation. If a domain money model becomes necessary, reassess the stable top-level package separately.
- **`citeproc`** — package license reports `CPAL-1.0 OR AGPL-1.0`; do not make it a proprietary-product dependency without explicit legal review.
- **MuPDF (`ArtifexSoftware/mupdf`)** — AGPL-3.0/commercial dual path plus native/WASM complexity. Use as PDF behavior/reference evidence unless a separately approved license/architecture decision is made.
- **Moment.js for new work** — census-only reference; UtilityOS should use Temporal/Intl plus focused helpers rather than adopting a legacy-style all-purpose date library.
- **Full utility-suite source copying** from IT-Tools/BentoPDF/Stirling/CyberChef — even where licenses permit reuse, the product should copy **patterns, test ideas and algorithms only when license-compatible and independently integrated**, not wholesale application structure.

## Family conclusions

### CSV / tabular

`papaparse` and `csv-parse` deserve a head-to-head adversarial corpus. Papa Parse is more browser-oriented and documents worker execution; `csv-parse` is actively maintained and zero-direct-dependency but needs browser-entry/bundle verification. `d3-dsv` is a useful small oracle for simple cases. Do not bring SheetJS into a CSV-only tracer.

Acceptance corpus must include quoted newlines, embedded delimiters, BOM, CRLF/LF, empty trailing cells, malformed quotes, unusual/duplicate headers, UTF-8 accents, large streaming files and cancellation.

### JSON / YAML / TOML

JSON formatting/validation should remain native JSON plus UtilityOS diagnostics. `yaml` 2.9.1 is the leading YAML spike. TOML is not a reason to add a stale parser now; `smol-toml` is promising but its repository provenance was not exposed by the npm metadata captured in this run, so it needs one more primary-source provenance check before adoption.

### Markdown / sanitization

Parsing and sanitization are separate trust boundaries. `marked` or `markdown-it` can parse; **DOMPurify must be treated as a patched security dependency**, not as a reason to enable arbitrary raw HTML. The GitHub advisory query returned many historical/non-withdrawn advisories for both Markdown/sanitizer packages, so version pinning plus an XSS regression corpus is mandatory.

### Diff / text

`diff` (jsdiff) is the cleanest direct adoption candidate: current, zero runtime deps, ESM signals, tests/CI. Small list/set transforms remain local code. `diff-match-patch` is better as an algorithm/reference than a fresh dependency.

### URL / query / UTM

Use native `URL`/`URLSearchParams`. `query-string` is a reference for edge semantics only. This is a clear case where the Web Platform beats a dependency.

### Date / time / business days

Use `Temporal`/`Intl` wherever the browser floor allows. Spike `@js-temporal/polyfill` only as a compatibility bridge and `date-fns` only for reusable arithmetic that remains awkward after Temporal. `rrule` is Wave B recurrence scope, not a Wave A requirement.

### Business math

Use explicit exact-decimal arithmetic for money/rates rather than binary floating-point shortcuts. `decimal.js` is the primary choice; `big.js` is the smaller comparison candidate. Keep domain formulas in UtilityOS code with independent oracle fixtures rather than hiding business logic in a finance framework.

### Hashing / checksum / encoding

Web Crypto handles normal one-shot cryptographic digest jobs. `@noble/hashes` and `hash-wasm` are justified only for incremental/streaming or very-large-file hashing. Benchmark worker startup, peak memory and throughput before choosing JS vs WASM.

### QR / barcode

`qrcode` is the compact generator spike. `@zxing/browser` is the reader/camera spike. Do not pull `bwip-js` into QR-only Wave A: its broad barcode surface produces a much larger package footprint.

### Image / EXIF

Native image APIs remain the baseline. `pica` is the strongest resize-quality spike; `compressorjs` is a smaller compression comparator. `exifr` and `ExifReader` should be tested against a real metadata corpus, including malformed images and privacy-removal validation. Squoosh should inform worker/WASM architecture rather than become a copied app.

### PDF

There is no single universal PDF dependency. Split the capability:

- **render/extract:** `pdfjs-dist` / Mozilla PDF.js, lazy + worker isolated;
- **mutation:** `pdf-lib` only after malformed/large-file corpus despite its old release cadence;
- **structural/oracle reference:** qpdf;
- **AGPL/native reference:** MuPDF, not casual dependency;
- **generation:** jsPDF is reference-only unless generation becomes an approved primary need.

### ZIP / archive

`fflate` is the compact primitive candidate; `zip.js` is the browser-stream/worker candidate. Any archive adoption is gated by zip-bomb expansion bounds, entry-count/size limits, filename/path normalization, progress and cancellation.

### MIME / signature

Use signature detection, not extensions, for security-relevant file classification. `file-type` deserves a browser-corpus spike. `mrmime` is only extension-to-MIME mapping and must not be mistaken for a safety check.

### Citation / research

Citation.js (`@citation-js/core` plus targeted plugins) is the best modular spike for BibTeX/RIS-style work. `citeproc` is a licensing reject for direct use in the current product posture. DOI/ISBN normalization/validation should remain tiny local standards-based implementations where possible.

### Local search / IndexedDB / OPFS

`fuse.js` is appropriate for fuzzy matching; `minisearch` is the stronger full-text index candidate. Do not add both until the UX requires both semantics. `idb` is acceptable as a thin IndexedDB wrapper when raw IndexedDB becomes repetitive; Dexie is broader than v1 needs. OPFS should stay native/feature-detected rather than hidden behind a large abstraction until a real file-workspace use case appears.

## Deep candidate table ({summary['deep_rows']} rows)

This compact table shows release/license/maintenance/footprint/security signals. Browser, ESM, tests, TypeScript, worker, SSR/static, capability mapping and full rationale remain in the CSV.

{chr(10).join(deep_table)}

## Security and supply-chain conclusions

1. **Historical advisory count is not the same as “latest version vulnerable.”** Before pinning a dependency, CI must evaluate advisory affected ranges against the chosen version.
2. **DOMPurify is an active security component.** The first-party GitHub security page shows multiple 2026 advisories. If adopted, patch latency should be treated as a product security SLO.
3. **Archive/PDF/image inputs are hostile-input surfaces.** Size limits, decompression bounds, malformed corpus tests, cancellation and worker termination are mandatory.
4. **Zero direct dependencies is meaningful.** For `diff`, `decimal.js`, `@noble/hashes`, `fflate`, `idb` and several other candidates, transitive package burden is genuinely zero at the npm package layer.
5. **Mixed and copyleft application licenses matter even for “open source.”** Stirling PDF has separately licensed directories; IT-Tools is GPL-3.0; MuPDF is AGPL-3.0; BentoPDF currently has multiple repo/fork/license presentations. Study these repos, but do not import source without path-specific provenance.

## Primary / official source index

The following first-party sources were used or cross-checked in this lane (well above the required 20):

{chr(10).join(f'- {url}' for url in primary_sources)}

## Verification against lane contract

- Census rows: **{summary['census_rows']}** (required >=80) — PASS.
- Deep rows: **{summary['deep_rows']}** (required >=30) — PASS.
- Every deep row has license, maintenance, browser assessment, security field and adoption verdict in the CSV — validated by script/check below.
- Official/primary links: **>20** in this report, plus canonical URLs and npm license sources in the CSV — PASS.
- No invented metadata: unknown/proxy fields are labeled, and advisory applicability is not overclaimed.
- Native-platform preference is explicit by capability family.
- No dependency was installed and no source was copied from donor repositories.

## Integration recommendation

The next engineering step should not be “install the shortlist.” Create focused dependency spikes around the actual Wave A seams:

1. CSV: Papa Parse vs csv-parse adversarial/streaming benchmark.
2. YAML: `yaml` hostile-input and bundle check.
3. Markdown: parser choice + DOMPurify pinned-XSS corpus.
4. Diff: adopt `diff` behind the shared text engine and prove bundle delta.
5. Business math: adopt `decimal.js` behind explicit UtilityOS formulas/oracles.
6. Hashing: Web Crypto baseline vs noble/hash-wasm for incremental large files.
7. QR: `qrcode` generation corpus.
8. Image: native baseline vs pica/compressorjs.
9. PDF: separate `pdfjs-dist` render/extract spike from `pdf-lib` mutation spike.
10. Archive: fflate vs zip.js with hostile archive limits.
11. File type: `file-type` browser signature corpus.
12. Citation: Citation.js core + BibTeX/RIS plugin fidelity tests.
13. Search/persistence: Fuse/Minisearch only if UX needs them; `idb` only after persistence boilerplate proves itself.
"""

(ROOT / "06-oss-github-donor-census.md").write_text(report)

deep_required = [
    "license", "maintenance", "browser_support", "security_advisories", "adoption",
    "latest_version", "latest_release_date", "test_quality", "typescript_quality",
    "worker_compatibility", "ssr_static_build", "capability_coverage", "utilityos_mapping",
    "rationale",
]
missing_deep_fields = [
    (item["candidate"], field)
    for item in rows
    if item["deep_assessed"] == "yes"
    for field in deep_required
    if not str(item.get(field, "")).strip()
]
if missing_deep_fields:
    raise SystemExit(f"deep validation failed: {missing_deep_fields[:20]}")
if len(rows) < 80 or summary["deep_rows"] < 30:
    raise SystemExit("census/deep row thresholds not met")
print(f"validation: rows={len(rows)} deep={summary['deep_rows']} missing_deep_fields=0")
print(json.dumps(summary, indent=2))
