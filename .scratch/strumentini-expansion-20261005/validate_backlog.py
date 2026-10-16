from __future__ import annotations

import argparse
import collections
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ISSUES = ROOT / "issues"
DAG = ROOT / "TICKET-DAG.md"
MIGRATION_URL = "https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue"
MIGRATION_NOTICE = (
    f"MIGRATO su GitHub Issues il 17/10/2026: {MIGRATION_URL}. "
    "Non aggiornare più questo file."
)
ALLOWED_STATUSES = frozenset({"blocked", "completed", "ready-for-agent"})


def lifecycle_status(raw: str) -> str | None:
    normalized = raw.strip().lower()
    for status in ("ready-for-agent", "completed", "blocked"):
        if normalized == status or normalized.startswith(f"{status} "):
            return status
    return None


@dataclass(frozen=True)
class Ticket:
    number: int
    title: str
    status: str
    blockers: tuple[int, ...]
    blocked_raw: str


def parse_ticket(path: Path) -> Ticket:
    source = path.read_text(encoding="utf-8")
    number = int(re.match(r"(\d+)-", path.name).group(1))
    title = re.search(r"^#\s+\d+\s+—\s+(.+)$", source, re.M)
    status = re.search(r"^\*\*Status:\*\*\s*(.+)$", source, re.M)
    blocked = re.search(r"^\*\*Blocked by:\*\*\s*(.+)$", source, re.M)
    if not title or not status or not blocked:
        raise ValueError(f"ticket {path.name} is missing title/status/blocker metadata")
    blocked_raw = blocked.group(1).strip()
    blockers: tuple[int, ...]
    if blocked_raw.lower().startswith("none"):
        blockers = ()
    else:
        blockers = tuple(
            int(value)
            for value in re.findall(r"(?:^|[,;])\s*(\d{1,3})\b", blocked_raw)
        )
    return Ticket(number, title.group(1).strip(), status.group(1).strip(), blockers, blocked_raw)


def load_tickets() -> dict[int, Ticket]:
    tickets: dict[int, Ticket] = {}
    for path in sorted(ISSUES.glob("*.md")):
        match = re.match(r"(\d+)-", path.name)
        if not match:
            continue
        ticket = parse_ticket(path)
        if ticket.number in tickets:
            raise ValueError(f"duplicate ticket id {ticket.number}")
        tickets[ticket.number] = ticket
    return tickets


def validate(tickets: dict[int, Ticket]) -> list[int]:
    if not tickets:
        raise ValueError("no tickets found")
    expected = set(range(1, max(tickets) + 1))
    missing = sorted(expected - set(tickets))
    if missing:
        raise ValueError(f"missing ticket ids: {missing}")

    for ticket in tickets.values():
        unknown = [dep for dep in ticket.blockers if dep not in tickets]
        if unknown:
            raise ValueError(f"ticket {ticket.number} has unknown blockers {unknown}")
        lifecycle = lifecycle_status(ticket.status)
        if lifecycle not in ALLOWED_STATUSES:
            raise ValueError(
                f"ticket {ticket.number} has unsupported status {ticket.status!r}; "
                f"expected one of {sorted(ALLOWED_STATUSES)}"
            )
        unresolved = [dep for dep in ticket.blockers if lifecycle_status(tickets[dep].status) != "completed"]
        if lifecycle == "ready-for-agent" and unresolved:
            raise ValueError(
                f"ticket {ticket.number} is ready-for-agent but still has incomplete blockers {unresolved}"
            )

    indegree = {number: 0 for number in tickets}
    outgoing: dict[int, list[int]] = {number: [] for number in tickets}
    for ticket in tickets.values():
        for blocker in ticket.blockers:
            indegree[ticket.number] += 1
            outgoing[blocker].append(ticket.number)

    queue = collections.deque(sorted(number for number, degree in indegree.items() if degree == 0))
    visited: list[int] = []
    while queue:
        number = queue.popleft()
        visited.append(number)
        for dependent in outgoing[number]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                queue.append(dependent)

    cyclic = sorted(number for number, degree in indegree.items() if degree)
    if cyclic:
        raise ValueError(f"dependency cycle detected around tickets: {cyclic}")

    return sorted(
        ticket.number
        for ticket in tickets.values()
        if lifecycle_status(ticket.status) != "completed"
        and all(lifecycle_status(tickets[dep].status) == "completed" for dep in ticket.blockers)
    )


def render_dag(tickets: dict[int, Ticket], frontier: list[int]) -> str:
    lines = [
        MIGRATION_NOTICE,
        "",
        "# Strumentini.it future expansion — ticket DAG",
        "",
        "Status: **archivio legacy congelato il 17/10/2026**",
        "Origin: `docs/10-tool-expansion-result-system-v2.md` + `docs/11-format-operation-matrix.md`",
        "Archivio storico dei file ticket: aggiornamenti e nuove richieste esclusivamente su GitHub Issues.",
        f"Coverage: **{len(tickets)} tickets, IDs 01–{max(tickets):03d}, continuous, acyclic**",
        "",
        "Le dipendenze qui sotto sono uno snapshot storico. L'unico tracker aggiornato è GitHub Issues. Skill routing legacy in `SKILL-ROUTING.md`.",
        "",
        "## Current dependency frontier",
        "",
    ]
    lines.extend(f"- **{number:03d} — {tickets[number].title}**" for number in frontier)
    lines.extend([
        "",
        f"Exactly **{len(frontier)}** incomplete tickets currently have every declared numeric blocker completed. This is **not** evidence that the feature is feasible: see `CURRENT-TICKET-DASHBOARD.md` for execution-ready, source/device-gated and capability-refused groups.",
        "",
        "## Key decomposition rules",
        "",
        "- **01–06:** Result System v2 is split into contracts/primitives/evidence (70–87) and renderer migrations (88–99).",
        "- **07–18:** Italy/CalcolaTutto consumes versioned primary-source packs before fiscal/annual calculators.",
        "- **19–44:** broad families are closure gates over focused calculator, developer, text, design, date, Italy and productivity children.",
        "- **34:** heavy feasibility is split by dependency class (267–275); `REFUSE` is a valid outcome for an unsupported format.",
        "- **47–69:** compression/conversion/upgrade families integrate concrete image/PDF/archive/Office/file-analysis slices.",
        "- **110 + 284–297:** functional completeness of the original 200 tools is measured separately from Result v2 presentation migration.",
        "- **276–279:** RIS/BibTeX oracle was closed; physical Android/iOS image-resize evidence remains outstanding.",
        "- **282–283:** custom-domain migration is reversible ops work; ticket 282 is planning-only and does not authorize DNS mutation.",
        "",
        "## Full DAG",
        "",
        "| # | Status | Ticket | Blocked by |",
        "|---:|---|---|---|",
    ])
    for number in sorted(tickets):
        ticket = tickets[number]
        deps = "—" if not ticket.blockers else ", ".join(f"{dep:03d}" for dep in ticket.blockers)
        title = ticket.title.replace("|", "/")
        lines.append(f"| {number:03d} | {ticket.status} | {title} | {deps} |")
    lines.extend([
        "",
        "## Validation contract",
        "",
        "- IDs stay continuous and unique.",
        "- Every blocker resolves to an existing ticket.",
        "- The dependency graph stays acyclic.",
        "- `completed`, `blocked` and `ready-for-agent` are the only lifecycle states.",
        "- The numeric dependency frontier is derived from incomplete tickets whose declared blockers are all `completed`; external evidence and refused capabilities are independently classified in `CURRENT-TICKET-DASHBOARD.md`.",
        "- `ready-for-agent` is invalid while any declared blocker remains incomplete.",
        "- Closing an umbrella never substitutes for acceptance/verification evidence from its children.",
        "- Final release integration consumes fresh current-fingerprint browser, accessibility, privacy, performance and physical-device evidence where required.",
        "",
    ])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-dag", action="store_true")
    args = parser.parse_args()
    tickets = load_tickets()
    frontier = validate(tickets)
    if args.write_dag:
        DAG.write_text(render_dag(tickets, frontier), encoding="utf-8")
    print(f"PASS tickets={len(tickets)} range=1-{max(tickets)} frontier={','.join(map(str, frontier))}")


if __name__ == "__main__":
    main()
