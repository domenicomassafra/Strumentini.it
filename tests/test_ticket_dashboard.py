"""Scheduling regression: a completed dependency is not necessarily a usable engine."""

import json
import sys
import unittest
from dataclasses import replace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1] / ".scratch/strumentini-expansion-20261005"
sys.path.insert(0, str(ROOT))

from ticket_dashboard import (  # noqa: E402
    category,
    desired_status,
    refused_closure,
    render,
)
from validate_backlog import load_tickets, validate  # noqa: E402


class TicketDashboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tickets = load_tickets()
        cls.frontier = validate(cls.tickets)

    def test_executable_frontier_is_not_dag_frontier(self):
        frontier = set(self.frontier)
        self.assertEqual(len(frontier), 28)
        self.assertEqual(category(232, self.tickets, frontier), "ready-for-agent")
        self.assertEqual(category(218, self.tickets, frontier), "ready-for-agent")
        self.assertEqual(category(236, self.tickets, frontier), "ready-for-agent")
        self.assertEqual(category(117, self.tickets, frontier), "external-source-blocked")
        self.assertEqual(category(115, self.tickets, frontier), "external-source-blocked")
        self.assertEqual(category(229, self.tickets, frontier), "external-device-blocked")
        self.assertEqual(category(278, self.tickets, frontier), "external-device-blocked")
        self.assertEqual(category(320, self.tickets, frontier), "completed")
        self.assertEqual(category(53, self.tickets, frontier), "capability-blocked")
        self.assertEqual(category(127, self.tickets, frontier), "dependency-blocked")
        self.assertEqual(desired_status(320, self.tickets, frontier), "completed")
        self.assertEqual(desired_status(232, self.tickets, frontier), "ready-for-agent")

    def test_refused_is_completed_without_becoming_available(self):
        self.assertTrue(refused_closure(242))
        self.assertTrue(refused_closure(320))
        self.assertTrue(refused_closure(222))
        self.assertFalse(refused_closure(319))
        self.assertEqual(category(242, self.tickets, set(self.frontier)), "completed")
        payload = json.loads(render(self.tickets, self.frontier)[0])
        self.assertEqual(payload["totals"]["completedWithRefusal"], 18)
        self.assertIn(242, payload["refusedClosures"])
        self.assertIn(320, payload["refusedClosures"])

    def test_dashboard_counts_and_no_stale_stored_labels(self):
        payload = json.loads(render(self.tickets, self.frontier)[0])
        self.assertEqual(payload["totals"]["all"], 327)
        self.assertEqual(payload["totals"]["completed"], 246)
        self.assertEqual(payload["totals"]["open"], 81)
        self.assertEqual(payload["totals"]["readyDAG"], 28)
        self.assertEqual(payload["totals"]["ready-for-agent"], 20)
        self.assertEqual(payload["totals"]["external-source-blocked"], 2)
        self.assertEqual(payload["totals"]["external-device-blocked"], 5)
        self.assertEqual(payload["totals"]["capability-blocked"], 1)
        self.assertEqual(payload["totals"]["dependency-blocked"], 53)
        self.assertEqual(payload["totals"]["storedStatusMismatches"], 0)

    def test_old_blocked_label_is_detected_as_mismatch(self):
        mutated = dict(self.tickets)
        mutated[232] = replace(mutated[232], status="blocked")
        payload = json.loads(render(mutated, self.frontier)[0])
        self.assertIn(232, payload["storedStatusMismatches"])
        self.assertEqual(payload["totals"]["storedStatusMismatches"], 1)


if __name__ == "__main__":
    unittest.main()
