#!/usr/bin/env python3
"""Read-only source-bound inventory of the routes added after the original 200.

Outputs are GAP/NO_GO inventories, never Gold or browser acceptance receipts.
--write generates two tracked JSONL partitions; --check compares them byte-for-byte.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "quality" / "expansion-458"


def json_file(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_bytes(path):
    if not isinstance(path, str) or not path or path.startswith("/") or ".." in Path(path).parts:
        return None
    root = ROOT.resolve()
    resolved = (ROOT / path).resolve()
    if not resolved.is_relative_to(root) or not resolved.is_file():
        return None
    return resolved.read_bytes()


def source_digest(path):
    content = source_bytes(path)
    return sha(content) if content is not None else None


def current_catalog():
    source = (ROOT / "src/generated/catalog.ts").read_text(encoding="utf-8")
    prefix = "export const catalog = "
    if not source.startswith("// AUTO-GENERATED") or prefix not in source:
        raise ValueError("Generated catalog missing or not produced by the tool factory")
    decoded, _ = json.JSONDecoder().raw_decode(source[source.index(prefix) + len(prefix):])
    return decoded


def matrix():
    catalog = current_catalog()
    assignments = json_file("quality/functional-audit/original-200.assignments.json")["assignments"]
    original = [a["toolId"] for a in assignments]
    actual = [tool["id"] for tool in catalog]
    if len(original) != 200 or len(set(original)) != 200:
        raise ValueError("ORIGINAL_200_BASELINE_INVALID")
    if len(set(actual)) != len(actual) or not set(original).issubset(actual):
        raise ValueError("CURRENT_CATALOG_IDENTITY_DRIFT")
    routes = [t["route"] for t in catalog]
    if len(set(routes)) != len(routes):
        raise ValueError("DUPLICATE_CURRENT_ROUTES")
    original_set = set(original)
    legacy_items = json_file("quality/receipts/expanded-catalog-certification.json")["tools"]
    legacy = {row["id"]: row for row in legacy_items}
    fixtures = json_file("quality/fixtures/index.json")["families"]
    fixture_index = {row["id"]: row for row in fixtures}
    oracle_entries = json_file("quality/oracles/registry.json")["entries"]
    oracle_index = {row["id"]: row for row in oracle_entries}
    if len(legacy) != len(legacy_items) or len(fixture_index) != len(fixtures) or len(oracle_index) != len(oracle_entries):
        raise ValueError("DUPLICATE_SOURCE_INDEX")
    rows = []
    for tool in sorted(catalog, key=lambda row: row["id"]):
        if tool["id"] in original_set:
            continue
        tool_id = tool["id"]
        historic = legacy.get(tool_id, {})
        gold = tool["gold"]
        oracle_id = gold["oracleEntryId"]
        oracle = oracle_index.get(oracle_id)
        fixture_rows = [fixture_index.get(id_) for id_ in gold["fixtureFamilies"]]
        manifest = f"src/tools/{tool_id}/manifest.ts"
        module = f"src/tools/{tool_id}/module.ts"
        page = f"src/pages/tools/{tool_id}.astro"
        expected = historic.get("implementation", {})
        tests = [name for name in expected.get("testFiles", []) if source_bytes(name) is not None]
        fixture_identity = []
        for fixture_id, indexed in zip(gold["fixtureFamilies"], fixture_rows):
            content = source_bytes(indexed["path"]) if indexed else None
            try:
                valid = isinstance(json.loads(content), dict) and bool(json.loads(content)) if content else False
            except (ValueError, TypeError, UnicodeDecodeError):
                valid = False
            fixture_identity.append({
                "id": fixture_id,
                "path": indexed["path"] if indexed else None,
                "sha256": sha(content) if valid else None,
                "provenance": indexed.get("provenance") if indexed else None,
            })
        receipt = historic.get("certificationReceipt")
        receipt_bytes = source_bytes(receipt) if receipt else None
        compiled = source_bytes(f"dist/tools/{tool_id}/index.html")
        gaps = []
        if oracle is None:
            gaps.append("ORACLE_MISSING")
        elif oracle.get("maintenance_class") != gold["maintenanceClass"]:
            gaps.append("MAINTENANCE_MISMATCH")
        if not gold["fixtureFamilies"] or any(item["sha256"] is None for item in fixture_identity):
            gaps.append("FIXTURE_MISSING_OR_INVALID")
        if source_bytes(manifest) is None or source_bytes(module) is None or source_bytes(page) is None:
            gaps.append("SOURCE_MISSING")
        if not tests:
            gaps.append("TEST_FILE_UNMAPPED")
        if compiled is None:
            gaps.append("COMPILED_ROUTE_NOT_RUN")
        if receipt_bytes is None:
            gaps.append("RECEIPT_MISSING")
        # Browser observations are never inferred from checked-in scripts or
        # legacy GOLD statuses. Per-route positive/refusal/network remain NOT_RUN.
        gaps.append("CURRENT_BROWSER_POSITIVE_REFUSAL_NOT_RUN")
        rows.append({
            "id": tool_id,
            "route": tool["route"],
            "category": tool["category"],
            "engine": tool["engine"],
            "runtime": tool["runtime"],
            "maintenance": gold["maintenanceClass"],
            "oracle": {"id": oracle_id, "registered": oracle is not None,
                       "confidence": oracle.get("confidence") if oracle else None,
                       "unresolvedGaps": oracle.get("unresolved_gaps") if oracle else None},
            "fixtures": fixture_identity,
            "source": {"manifest": manifest, "sha256": source_digest(manifest),
                       "module": module, "moduleSha256": source_digest(module),
                       "page": page, "pageSha256": source_digest(page)},
            "donor": historic.get("provenance"),
            "historicalTestFiles": tests,
            "historicalReceipt": {"path": receipt, "sha256": sha(receipt_bytes) if receipt_bytes else None},
            "compiled": {"routeSha256": sha(compiled) if compiled else None},
            "browser": {"positive": "NOT_RUN", "refusal": "NOT_RUN", "network": "NOT_RUN",
                        "mobilePhysical": "NOT_RUN"},
            "status": "NO_GO",
            "gaps": gaps,
        })
    summary = {
        "schemaVersion": 1, "scope": "source-bound-inventory-no-gold-no-release",
        "base": "quality/functional-audit/original-200.assignments.json",
        "baseSha256": source_digest("quality/functional-audit/original-200.assignments.json"),
        "catalogSha256": source_digest("src/generated/catalog.ts"),
        "catalog": len(catalog), "baseCount": len(original), "delta": len(rows),
        "legacyIndex": len(legacy_items), "legacyExtraVsCurrent": len(set(legacy) - set(actual)),
        "categories": dict(sorted(collections.Counter(row["category"] for row in rows).items())),
        "engines": dict(sorted(collections.Counter(row["engine"] for row in rows).items())),
        "gapCounts": dict(sorted(collections.Counter(g for row in rows for g in row["gaps"]).items())),
        "gold": "NO_GO", "physical": "NOT_RUN", "release": "NO_GO",
    }
    return rows, summary


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--write", action="store_true")
    group.add_argument("--check", action="store_true")
    opts = parser.parse_args()
    rows, summary = matrix()
    # Keep each authored report part below the shared ~20 KiB file budget.
    parts = []
    current = ""
    for row in rows:
        line = json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n"
        if len(line.encode()) > 18000:
            raise ValueError(f"OVERSIZED_MATRIX_ROW_458: {row['id']}")
        if current and len((current + line).encode()) > 18000:
            parts.append(current)
            current = ""
        current += line
    if current:
        parts.append(current)
    outputs = {OUTPUT / f"routes-{i:02d}.jsonl": part for i, part in enumerate(parts, start=1)}
    outputs[OUTPUT / "summary.json"] = json.dumps(summary, ensure_ascii=False, indent=2) + "\n"
    if opts.write:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for path, data in outputs.items():
            path.write_text(data, encoding="utf-8")
    if opts.check:
        for path, data in outputs.items():
            if not path.is_file() or path.read_text(encoding="utf-8") != data:
                raise SystemExit(f"STALE_MATRIX_458: {path.relative_to(ROOT)}")
    print(json.dumps({**summary, "outputs": {str(p.relative_to(ROOT)): len(s.encode()) for p, s in outputs.items()}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
