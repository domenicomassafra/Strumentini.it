"""Scheduling regression: a completed dependency is not necessarily a usable engine."""

import json
import sys
import unittest
from dataclasses import replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / ".scratch/strumentini-expansion-20261005"
sys.path.insert(0, str(ROOT))

from ticket_dashboard import (  # noqa: E402
    OUT_JSON,
    PROJECT_STATUS,
    STATUS_END,
    STATUS_START,
    category,
    desired_status,
    refused_closure,
    render,
    render_project_status,
)
from validate_backlog import lifecycle_status, load_tickets, validate  # noqa: E402


class TicketDashboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tickets = load_tickets()
        cls.frontier = validate(cls.tickets)

    def test_executable_frontier_is_not_dag_frontier(self):
        frontier = set(self.frontier)
        self.assertGreater(len(frontier), 0)
        self.assertEqual(category(117, self.tickets, frontier), "external-source-blocked")
        self.assertEqual(category(115, self.tickets, frontier), "external-source-blocked")
        self.assertEqual(category(229, self.tickets, frontier), "external-device-blocked")
        self.assertEqual(category(278, self.tickets, frontier), "external-device-blocked")
        self.assertEqual(category(320, self.tickets, frontier), "completed")
        self.assertEqual(desired_status(320, self.tickets, frontier), "completed")
        payload = json.loads(render(self.tickets, self.frontier)[0])
        ready_for_agent = payload["groups"]["ready-for-agent"]
        self.assertTrue(ready_for_agent)
        self.assertTrue(set(ready_for_agent).issubset(frontier))
        for number in ready_for_agent:
            self.assertEqual(desired_status(number, self.tickets, frontier), "ready-for-agent")
        self.assertGreater(len(frontier), len(ready_for_agent))

    def test_refused_is_completed_without_becoming_available(self):
        self.assertTrue(refused_closure(242))
        self.assertTrue(refused_closure(222))
        self.assertFalse(refused_closure(319))
        self.assertEqual(category(242, self.tickets, set(self.frontier)), "completed")
        payload = json.loads(render(self.tickets, self.frontier)[0])
        self.assertEqual(payload["totals"]["completedWithRefusal"], len(payload["refusedClosures"]))
        self.assertIn(242, payload["refusedClosures"])
        for number in payload["refusedClosures"]:
            self.assertEqual(category(number, self.tickets, set(self.frontier)), "completed")

    def test_dashboard_counts_and_no_stale_stored_labels(self):
        payload = json.loads(render(self.tickets, self.frontier)[0])
        totals = payload["totals"]
        self.assertEqual(totals["all"], len(self.tickets))
        self.assertEqual(totals["completed"], sum(lifecycle_status(t.status) == "completed" for t in self.tickets.values()))
        self.assertEqual(totals["open"], totals["all"] - totals["completed"])
        self.assertEqual(totals["readyDAG"], len(self.frontier))
        self.assertEqual(totals["open"], sum(len(ids) for name, ids in payload["groups"].items() if name != "completed"))
        self.assertEqual(payload["totals"]["storedStatusMismatches"], 0)
        self.assertEqual(json.loads(OUT_JSON.read_text(encoding="utf-8"))["totals"], totals)

    def test_old_blocked_label_is_detected_as_mismatch(self):
        mutated = dict(self.tickets)
        number = json.loads(render(self.tickets, self.frontier)[0])["groups"]["ready-for-agent"][0]
        mutated[number] = replace(mutated[number], status="blocked")
        payload = json.loads(render(mutated, self.frontier)[0])
        self.assertIn(number, payload["storedStatusMismatches"])
        self.assertEqual(payload["totals"]["storedStatusMismatches"], 1)

    def test_project_status_panel_rebuilds_stale_counts_and_refuses_missing_markers(self):
        totals = json.loads(render(self.tickets, self.frontier)[0])["totals"]
        current = PROJECT_STATUS.read_text(encoding="utf-8")
        self.assertEqual(render_project_status(current, totals), current)
        fresh = render_project_status(f"Intro\n{STATUS_START}\nwrong counts\n{STATUS_END}\nHistory\n", totals)
        self.assertIn(f"| Still open | {totals['open']} |", fresh)
        stale = fresh.replace(f"| Still open | {totals['open']} |", f"| Still open | {totals['open'] + 1} |")
        self.assertNotEqual(render_project_status(stale, totals), stale)
        self.assertEqual(render_project_status(stale, totals), fresh)
        self.assertTrue(fresh.endswith("History\n"))
        for malformed in ("missing markers", f"{STATUS_START}{STATUS_START}{STATUS_END}", f"{STATUS_END}{STATUS_START}"):
            with self.subTest(malformed=malformed), self.assertRaises(ValueError):
                render_project_status(malformed, totals)


if __name__ == "__main__":
    unittest.main()
