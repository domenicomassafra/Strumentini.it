"""Derive a truthful execution dashboard from the ticket files, not stale status labels.

Usage: python3 ticket_dashboard.py [--check | --write]

Dependency-ready is not proof of implementation feasibility. The explicitly
documented non-DAG gates below remain BLOCKED even when all numeric parents
are completed. Remove a gate only after adding corresponding evidence.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

from validate_backlog import DAG, ISSUES, ROOT, lifecycle_status, load_tickets, render_dag, validate

OUT_JSON = ROOT / "CURRENT-TICKET-DASHBOARD.json"
OUT_MD = ROOT / "CURRENT-TICKET-DASHBOARD.md"
PROJECT_STATUS = ROOT.parents[1] / "PROJECT-STATUS.md"
STATUS_START = "<!-- tickets:live-status:start -->"
STATUS_END = "<!-- tickets:live-status:end -->"

# These reasons are supported by the named issue file and its evidence; they
# cannot be resolved just by closing a numeric predecessor.
EXTERNAL_SOURCE = {
    115: "Official historical municipality/foreign-state code coverage incomplete",
    117: "No complete official annual IVA/IRPEF/forfettario source set for one tax year",
}
EXTERNAL_DEVICE = {
    229: "Real physical microphone capture/permission proof missing",
    277: "Physical Android Chrome target and evidence missing",
    278: "Physical iOS Safari Web Inspector/picker acceptance missing",
    280: "Physical Android heavy-tool acceptance evidence missing",
    281: "Physical iOS Safari heavy-tool acceptance evidence missing",
}
CAPABILITY_GATES = {
    320: "Ticket 242 closed REFUSED; no approved password-supplied PDF decrypt engine",
    53: "Ticket 320 closed REFUSED; PDF password-supplied decrypt acceptance remains unfulfilled",
}


def category(number: int, tickets: dict, frontier: set[int]) -> str:
    ticket = tickets[number]
    if lifecycle_status(ticket.status) == "completed":
        return "completed"
    if number not in frontier:
        return "dependency-blocked"
    if number in EXTERNAL_SOURCE:
        return "external-source-blocked"
    if number in EXTERNAL_DEVICE:
        return "external-device-blocked"
    if number in CAPABILITY_GATES:
        return "capability-blocked"
    return "ready-for-agent"


def issue_paths(number: int) -> list[Path]:
    paths = set()
    for prefix in {str(number), f"{number:02d}", f"{number:03d}"}:
        paths.update(ISSUES.glob(f"{prefix}-*.md"))
    return sorted(paths)


def refused_closure(number: int) -> bool:
    paths = issue_paths(number)
    if len(paths) != 1:
        raise ValueError(f"expected exactly one issue file for #{number}: {paths}")
    body = paths[0].read_text(encoding="utf-8")
    return bool(re.search(r"\*\*REFUSED for production (?:implementation|promotion|extraction):\*\*", body))


def desired_status(number: int, tickets: dict, frontier: set[int]) -> str:
    current = lifecycle_status(tickets[number].status)
    kind = category(number, tickets, frontier)
    if kind == "completed":
        return "completed"
    if kind == "ready-for-agent":
        return "ready-for-agent"
    return "blocked"


def render(tickets: dict, frontier: list[int]) -> tuple[str, str]:
    ready = set(frontier)
    groups: dict[str, list[int]] = {
        key: [] for key in (
            "completed", "ready-for-agent", "dependency-blocked",
            "external-source-blocked", "external-device-blocked", "capability-blocked"
        )
    }
    refused = []
    mismatched = []
    entries = []
    for number, ticket in sorted(tickets.items()):
        kind = category(number, tickets, ready)
        groups[kind].append(number)
        if kind == "completed" and refused_closure(number):
            refused.append(number)
        unresolved = [dep for dep in ticket.blockers if lifecycle_status(tickets[dep].status) != "completed"]
        wanted = desired_status(number, tickets, ready)
        actual = lifecycle_status(ticket.status)
        if wanted != actual:
            mismatched.append(number)
        entries.append({
            "id": number, "title": ticket.title, "storedStatus": ticket.status,
            "expectedLifecycle": wanted, "executionCategory": kind,
            "unresolvedDependencies": unresolved,
            "gateReason": (EXTERNAL_SOURCE | EXTERNAL_DEVICE | CAPABILITY_GATES).get(number),
            "closedWithRefusal": number in refused,
        })
    payload = {
        "schemaVersion": 1,
        "definitions": {
            "readyDAG": "Open tickets with all numeric dependencies completed; not proof of feasibility",
            "readyForAgent": "Assignable to investigate or implement; NOT a demonstrated passing capability",
            "externalSourceBlocked": "Missing official or complete primary-source evidence",
            "externalDeviceBlocked": "Missing real physical-device acceptance",
            "capabilityBlocked": "A prerequisite was closed with refusal; no validated engine exists",
            "closedWithRefusal": "Completed administratively after explicit refusal; not a shipped capability",
        },
        "totals": {
            "all": len(tickets), "completed": len(groups["completed"]),
            "completedWithRefusal": len(refused),
            "completedWithoutExplicitRefusal": len(groups["completed"]) - len(refused),
            "open": len(tickets) - len(groups["completed"]),
            "readyDAG": len(frontier),
            **{kind: len(ids) for kind, ids in groups.items() if kind != "completed"},
            "storedStatusMismatches": len(mismatched),
        },
        "groups": groups,
        "refusedClosures": refused,
        "storedStatusMismatches": mismatched,
        "tickets": entries,
    }
    titles = {
        "ready-for-agent": "Ready for assignment (feasibility still to prove)",
        "dependency-blocked": "Waiting on other tickets",
        "external-source-blocked": "Waiting on official sources",
        "external-device-blocked": "Waiting on physical evidence",
        "capability-blocked": "Blocked by unapproved capability",
    }
    lines = [
        "# Strumentini.it — execution dashboard (generated)", "",
        "Machine source: ticket issue files + `ticket_dashboard.py`. Rebuild with `python3 .scratch/strumentini-expansion-20261005/ticket_dashboard.py --write`; validate with `--check`.",
        "This is a backlog/triage dashboard, **not** a release readiness or Gold certificate.", "",
        "| Metric | Count |", "|---|---:|",
        f"| All / completed / open | {len(tickets)} / {len(groups['completed'])} / {len(tickets) - len(groups['completed'])} |",
        f"| Closed with explicit refusal (NOT shipped) | {len(refused)} |",
        f"| DAG-ready (all numeric dependencies closed) | {len(frontier)} |",
        *[f"| {name} | {len(groups[kind])} |" for kind, name in titles.items()],
        f"| Stored status mismatches | {len(mismatched)} |", "",
        "`ready-for-agent` means a worker may begin exploration/implementation, **not** that technical acceptance is already proven. External gates are never silently waived. An implemented feature may still be open for unproven acceptance.", "",
        "## Closed with explicit REFUSAL", "",
        ", ".join(f"#{n:03d}" for n in refused) or "None", "",
    ]
    for kind, label in titles.items():
        lines.extend([f"## {label} ({len(groups[kind])})", ""])
        for number in groups[kind]:
            ticket = tickets[number]
            description = f" — {ticket.title}"
            if kind == "dependency-blocked":
                unresolved = [dep for dep in ticket.blockers if lifecycle_status(tickets[dep].status) != "completed"]
                description += " (awaiting " + ", ".join(f"#{dep:03d}" for dep in unresolved) + ")"
            else:
                gate = (EXTERNAL_SOURCE | EXTERNAL_DEVICE | CAPABILITY_GATES).get(number)
                if gate:
                    description += f" — {gate}"
            lines.append(f"- #{number:03d}{description}")
        lines.append("")
    lines.extend([
        "## Integrity and release boundary", "",
        "- The scheduler reads numeric dependencies, while this dashboard also preserves evidenced non-numeric constraints.",
        "- To clear a source/device/capability gate, add verifiable evidence to the corresponding issue and deliberately update this gate registry.",
        "- Run targeted tests per lane; one integrated test/check/build for merged batches; update release validation independently.",
        "- No automation here changes Gold receipts, source hashes, physical evidence, release state or production.", "",
    ])
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n", "\n".join(lines)


def render_project_status(body: str, totals: dict) -> str:
    """Keep the root status summary derived from the same ticket authority.

    Only the marked panel is generated; historical prose remains untouched.
    Fail closed when an anchor is missing or duplicated so a document edit
    cannot silently disable the drift check.
    """
    if body.count(STATUS_START) != 1 or body.count(STATUS_END) != 1:
        raise ValueError("PROJECT-STATUS.md must contain one live-status start/end marker pair")
    start = body.index(STATUS_START) + len(STATUS_START)
    end = body.index(STATUS_END)
    if end < start:
        raise ValueError("PROJECT-STATUS.md live-status markers are reversed")
    lines = [
        "", "## Live ticket execution (generated)", "",
        "Source of truth: `.scratch/strumentini-expansion-20261005/issues/` and the generated "
        "[`CURRENT-TICKET-DASHBOARD.md`](.scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.md). "
        "`npm run tickets:sync` refreshes this panel; `npm run tickets:check` fails on drift.", "",
        "| Metric | Current count |", "|---|---:|",
        f"| All tickets | {totals['all']} |",
        f"| Administratively completed | {totals['completed']} |",
        f"| Closed with explicit refusal (not shipped) | {totals['completedWithRefusal']} |",
        f"| Still open | {totals['open']} |",
        f"| Ready for assignment (acceptance not yet proven) | {totals['ready-for-agent']} |",
        f"| Dependency-blocked | {totals['dependency-blocked']} |",
        f"| Official-source-blocked | {totals['external-source-blocked']} |",
        f"| Physical-device-blocked | {totals['external-device-blocked']} |",
        f"| Capability-blocked | {totals['capability-blocked']} |",
        f"| DAG-ready (numeric dependencies only) | {totals['readyDAG']} |",
        f"| Stored status mismatches | {totals['storedStatusMismatches']} |", "",
        "Ticket completion, certification, reviewed merge, deployment and physical-device acceptance are separate gates.",
    ]
    return body[:start] + "\n".join(lines) + "\n" + body[end:]


def sync_statuses(tickets: dict, frontier: list[int]) -> None:
    ready = set(frontier)
    for number, ticket in sorted(tickets.items()):
        if lifecycle_status(ticket.status) == "completed":
            continue
        wanted = desired_status(number, tickets, ready)
        if lifecycle_status(ticket.status) == wanted:
            continue
        paths = issue_paths(number)
        if len(paths) != 1:
            raise ValueError(f"no unique ticket file for #{number}")
        path = paths[0]
        body = path.read_text(encoding="utf-8")
        updated, count = re.subn(r"(?m)^(\*\*Status:\*\*\s*)([^\n]+)$", lambda m: m.group(1) + wanted, body, count=1)
        if count != 1:
            raise ValueError(f"cannot synchronize status for ticket {number}")
        path.write_text(updated, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument("--write", action="store_true", help="Synchronize actionable statuses and regenerate dashboard/DAG")
    actions.add_argument("--check", action="store_true", help="Fail on stale ticket statuses/dashboard/DAG")
    args = parser.parse_args()
    tickets = load_tickets()
    frontier = validate(tickets)
    if args.write:
        sync_statuses(tickets, frontier)
        tickets = load_tickets()
        frontier = validate(tickets)
    json_text, md_text = render(tickets, frontier)
    dag_text = render_dag(tickets, frontier)
    totals = json.loads(json_text)["totals"]
    status_text = render_project_status(PROJECT_STATUS.read_text(encoding="utf-8"), totals)
    expected_files = {OUT_JSON: json_text, OUT_MD: md_text, DAG: dag_text, PROJECT_STATUS: status_text}
    if args.write:
        for path, content in expected_files.items():
            path.write_text(content, encoding="utf-8")
    if args.check:
        mismatched = json.loads(json_text)["totals"]["storedStatusMismatches"]
        stale = [str(path) for path, content in expected_files.items() if not path.exists() or path.read_text(encoding="utf-8") != content]
        if mismatched or stale:
            raise SystemExit(f"FAIL stored-status-mismatches={mismatched} stale={stale}")
    print("PASS ticket dashboard", json.dumps(totals, sort_keys=True))
    try:
        head = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
        print("Git HEAD", head, "(not a release/deploy claim)")
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass


if __name__ == "__main__":
    main()
