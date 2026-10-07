#!/usr/bin/env python3
"""Fail-closed validator for Strumentini.it Gold oracle and fixture metadata."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ORACLES = ROOT / "quality" / "oracles"
FIXTURES = ROOT / "quality" / "fixtures"

REGISTRY_REQUIRED = {
    "id",
    "candidate",
    "tool_family",
    "maintenance_class",
    "truth_sources",
    "standard_or_official_example",
    "invariants",
    "adversarial_cases",
    "expected_output_strategy",
    "security_privacy_edges",
    "portability_browser_edges",
    "cross_check",
    "confidence",
    "unresolved_gaps",
}

FIXTURE_REQUIRED = {
    "id",
    "candidate_families",
    "path",
    "format",
    "provenance",
    "truth_sources",
    "coverage",
}


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def fail(message: str) -> None:
    raise AssertionError(message)


def nonempty(value) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, dict)):
        return bool(value)
    return value is not None


def validate_sources(sources_doc: dict) -> set[str]:
    if sources_doc.get("schema_version") != 1:
        fail("sources.json schema_version must be 1")
    sources = sources_doc.get("sources")
    if not isinstance(sources, list) or not sources:
        fail("sources.json must contain a non-empty sources array")
    ids: set[str] = set()
    for row in sources:
        sid = row.get("id")
        if not sid or sid in ids:
            fail(f"invalid or duplicate source id: {sid!r}")
        for field in ("authority", "locator", "supports"):
            if not nonempty(row.get(field)):
                fail(f"{sid}: source is missing {field}")
        if row.get("source_class") not in {"official-primary", "project-policy", "independent-implementation"}:
            fail(f"{sid}: unsupported source_class")
        if row.get("source_class") == "official-primary" and not str(row.get("url", "")).startswith("https://"):
            fail(f"{sid}: official-primary source requires https URL")
        if row.get("source_class") == "project-policy":
            locator = Path(str(row["locator"]).split("#", 1)[0])
            if locator.is_absolute() or ".." in locator.parts:
                fail(f"{sid}: project-policy locator must stay repo-relative")
            if not (ROOT / locator).is_file():
                fail(f"{sid}: project-policy locator does not exist: {locator}")
        ids.add(sid)
    return ids


def validate_registry(registry_doc: dict, source_ids: set[str]) -> None:
    if registry_doc.get("schema_version") != 1:
        fail("registry.json schema_version must be 1")
    rows = registry_doc.get("entries")
    if not isinstance(rows, list) or len(rows) < 80:
        fail(f"oracle registry must contain >=80 entries; found {0 if not isinstance(rows, list) else len(rows)}")
    if registry_doc.get("entry_count") != len(rows):
        fail("registry entry_count does not match entries length")
    ids: set[str] = set()
    for row in rows:
        missing = sorted(k for k in REGISTRY_REQUIRED if k not in row or not nonempty(row[k]))
        if missing:
            fail(f"registry entry {row.get('id')!r} missing/non-empty fields: {', '.join(missing)}")
        rid = row["id"]
        if rid in ids:
            fail(f"duplicate registry id: {rid}")
        ids.add(rid)
        if row["maintenance_class"] not in {"E", "D", "R", "H", "S"}:
            fail(f"{rid}: invalid maintenance_class")
        if row["confidence"] not in {"high", "medium", "low"}:
            fail(f"{rid}: invalid confidence")
        unknown_sources = set(row["truth_sources"]) - source_ids
        if unknown_sources:
            fail(f"{rid}: unknown truth source ids: {sorted(unknown_sources)}")


def validate_fixture_payload(path: Path, fmt: str) -> None:
    if not path.is_file():
        fail(f"missing fixture payload: {path.relative_to(ROOT)}")
    if fmt == "json":
        payload = load_json(path)
        if isinstance(payload, dict):
            for artifact in payload.get("artifacts", []):
                if not isinstance(artifact, dict) or not artifact.get("path"):
                    fail(f"{path.relative_to(ROOT)}: invalid artifact record")
                artifact_path = Path(artifact["path"])
                if artifact_path.is_absolute() or ".." in artifact_path.parts:
                    fail(f"{path.relative_to(ROOT)}: artifact path escapes repo")
                if not (ROOT / artifact_path).is_file():
                    fail(f"{path.relative_to(ROOT)}: missing artifact {artifact_path}")
    elif fmt == "jsonl":
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if line.strip():
                try:
                    json.loads(line)
                except json.JSONDecodeError as exc:
                    fail(f"{path.relative_to(ROOT)}:{number}: invalid JSONL: {exc}")
    elif fmt in {"text", "csv", "binary", "image"}:
        if path.stat().st_size == 0:
            fail(f"fixture payload is empty: {path.relative_to(ROOT)}")
    else:
        fail(f"unsupported fixture format {fmt!r} for {path.relative_to(ROOT)}")


def validate_fixtures(index_doc: dict, source_ids: set[str]) -> None:
    if index_doc.get("schema_version") != 1:
        fail("fixture index schema_version must be 1")
    families = index_doc.get("families")
    if not isinstance(families, list) or len(families) < 25:
        fail(f"fixture index must contain >=25 families; found {0 if not isinstance(families, list) else len(families)}")
    if index_doc.get("family_count") != len(families):
        fail("fixture family_count does not match families length")
    ids: set[str] = set()
    for row in families:
        missing = sorted(k for k in FIXTURE_REQUIRED if k not in row or not nonempty(row[k]))
        if missing:
            fail(f"fixture family {row.get('id')!r} missing/non-empty fields: {', '.join(missing)}")
        fid = row["id"]
        if fid in ids:
            fail(f"duplicate fixture family id: {fid}")
        ids.add(fid)
        provenance = row["provenance"]
        if provenance.get("kind") not in {"spec-vector", "hand-worked", "synthetic-local", "project-policy"}:
            fail(f"{fid}: unsupported provenance kind")
        if not provenance.get("license_or_rights"):
            fail(f"{fid}: provenance must state license_or_rights")
        unknown_sources = set(row["truth_sources"]) - source_ids
        if unknown_sources:
            fail(f"{fid}: unknown truth source ids: {sorted(unknown_sources)}")
        rel = Path(row["path"])
        if rel.is_absolute() or ".." in rel.parts:
            fail(f"{fid}: fixture path must be repo-relative and confined")
        validate_fixture_payload(ROOT / rel, row["format"])


def main() -> int:
    try:
        sources = load_json(ORACLES / "sources.json")
        source_ids = validate_sources(sources)
        validate_registry(load_json(ORACLES / "registry.json"), source_ids)
        validate_fixtures(load_json(FIXTURES / "index.json"), source_ids)
    except (AssertionError, FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print("PASS: Gold oracle registry and fixture index are internally valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
