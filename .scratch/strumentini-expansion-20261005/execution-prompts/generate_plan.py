from pathlib import Path
import json
import csv
import re

root = Path(__file__).parent
groups = {
    "01-live-base": [328,329,330,331,332,346,347,350,404,405,407,408,415,46],
    "02-file-first-local": list(range(333,346)) + [365,413],
    "03-design-owner-gate": [351,352,353],
    "04-end-to-end-redesign": list(range(354,362)) + [364],
    "05-donor-licensing": list(range(366,372)) + list(range(392,396)) + [414,24,28,47,49,56,58,212,246,247],
    "06-professional-pdf-security": list(range(372,381)) + [406,31,32,235,237],
    "07-image-editor": list(range(381,387)),
    "08-data-and-workbooks": list(range(387,392)) + [410],
    "09-official-italian-tax": list(range(396,403)) + [409,8,11,12,13,14,15,18,40,62,115,117,121,122,126,127,128,130,133,134,135,152,158],
    "10-mobile-server-media": [348,349,362,363,403,411,412,424,35,229,277,278,279,280,281],
    "11-refused-recovery": list(range(416,424)),
}
(root / "groups.json").write_text(json.dumps(groups, indent=2))
base = root.parent
items = json.loads((base / "CURRENT-TICKET-DASHBOARD.json").read_text())["tickets"]
issue_files = {}
for p in (base / "issues").glob("*.md"):
    match = re.match(r"^(\d+)-", p.name)
    if match:
        issue_files[int(match.group(1))] = p
assigned = {}
for group, ids in groups.items():
    for number in ids:
        if number in assigned:
            raise ValueError(f"duplicate issue {number}")
        assigned[number] = group
current_open = {item["id"] for item in items if item["executionCategory"] != "completed"}
if current_open != set(assigned):
    raise ValueError(f"unmapped open={sorted(current_open-set(assigned))}; extra={sorted(set(assigned)-current_open)}")
rows = []
for item in sorted(items, key=lambda item: item["id"]):
    n = item["id"]
    group = assigned.get(n, "HISTORICAL-CLOSED")
    rows.append({"id":n,"lifecycle":item["storedStatus"],"execution_category":item["executionCategory"],"prompt_group":group,"prompt_path":str(root/(group+".prompt.md")) if n in assigned else "","issue_file":str(issue_files[n]),"planning_not_shipped":True})
with (base/"EXECUTION-PROMPT-ROUTING.csv").open("w",newline="") as handle:
    writer = csv.DictWriter(handle,fieldnames=rows[0].keys(),lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
print("routing rows",len(rows),"open",len(assigned),"groups",len(groups))

shared = """# Future execution packet — planning only

This is an executable instruction draft, NOT a presently authorized development assignment or release approval. When the owner opens an implementation session, read the latest source revision, the exact canonical ticket source and its original acceptance, the OWN handoff, PRODUCT-SPEC-2026-10-10-EXPANSION.md, ROADMAP.md, SKILL-ROUTING.md, donor matrix and four native worker proposals. Do not repeat grilling questions already decided.

Use the smallest pre-approved scope and existing engine/test seams, compare installed/native options before a donor, and do not implicitly install dependencies or buy a commercial license. Implement/test only after genuine numeric, security, legal, device and visual gates. A historic refusal or original checked AC on a partial subset does not mean capability shipped. If the gate is unmet, produce bounded evidence/NO-GO and no public-facing claim. A UI mock cannot prove output correctness. Do not deploy, push or purchase without a separately authorized owner release decision.

Verification on a later code change: attach exact source/Worker/asset fingerprints, fixture hashes, reproducible test command and independent real output reopen; failures for invalid/malformed/large/unsupported/cancel/denied storage, resource bounds, privacy and rollback. Physical mobile iOS Safari/Android Chrome are real physical evidence only, not viewport simulation. Annual legal rates are dated primary-source snapshots, never guessed. Report passed/not-run/stale/failed criteria individually and a reversible rollback plan.

"""
descriptions = {
"01-live-base":"Fix observed production-seam regressions and scope-aware truth, independently of the future visual palette.",
"02-file-first-local":"Make selected files and tool discovery converge on accurate local results, optional local history and transparent consent.",
"03-design-owner-gate":"Produce three comparable but truly different IA/UX directions; only the owner may select and record the final direction. Do not treat prototypes as product.",
"04-end-to-end-redesign":"After dated owner design choice, migrate all shared layouts/input/result/account/resources and sensory states, keeping 269 existing routes, keyboard and rollback.",
"05-donor-licensing":"Compare exact existing PDF/image/Office/OCR/data engines and maintained pinned donors, licensing assets and true mobile resource budgets before adopting.",
"06-professional-pdf-security":"Build only verified semantic PDF editor capabilities, with original #237 security hold and independent output forensic safety.",
"07-image-editor":"Advanced image canvas with layers, masks, history, project versions and phone performance; parity to Photoshop is NOT a shipped promise.",
"08-data-and-workbooks":"Preserve CSV/XLSX row precision, formula/locale boundaries and no-macro execution while adding transforms and repeatable pipelines.",
"09-official-italian-tax":"Complete two source-backed Italian tax journeys by exact rule-year and effective date; refuse uncovered official-source windows.",
"10-mobile-server-media":"Require physical devices and explicit user consent/zero extra cost for any server processing, memory-bounded media and project storage.",
"11-refused-recovery":"Historical 17 completed refusal decisions remain completed-and-unshipped. Study new limited recovery tickets without pretending they are accepted.",
}
for group, ids in groups.items():
    lines = [shared, "## Tranche: "+group, "", descriptions[group], "", "## Exact canonical issues and acceptance contracts", ""]
    for n in sorted(ids):
        body = issue_files[n].read_text()
        title = body.splitlines()[0]
        deps = re.search(r"(?m)^\*\*Blocked by:\*\*\s*(.*)$",body)
        acceptance = re.findall(r"(?m)^\s*- \[[xX ]\] .*",body)
        proof = re.search(r"(?m)^\*\*Verification:\*\*\s*(.*)$",body)
        lines += ["### "+title, "", "Authority: "+str(issue_files[n]), "Prerequisites: "+(deps.group(1) if deps else "Read full historical ticket graph."), ""]
        lines += acceptance[:7] or ["Review original AC and latest appended evidence; do not mark complete without executable verification."]
        lines += ["", "Specific verification: "+(proof.group(1) if proof else "Use original ticket evidence and independent supported output/official source."), ""]
    lines += ["## Execution sequence (only when separately assigned)", "", "1. Select a dependency-ready slice; name the exact issue and existing source code owner. STOP if owner choice/license/security/official source/device gate is unresolved; research-only may continue.", "2. Define the minimum verifiable vertical behavior and fail-closed unsupported behavior. Derive benchmarks from actual fixtures, no invented performance ceilings.", "3. Implement only the selected issue with focused tests; compare true downloaded/reopened output, cross-browser/accessibility and iOS/Android physical where the issue requires it.", "4. Run targeted regression and evidence identity checks; before an actual promotion, run separate full release + preview + rollback checklist. Never write synthetic Gold or physical receipts.", "5. Report per-AC PASS/FAIL/NOT_RUN with paths/digests, changes, independent proof, rollback, unresolved dependencies; request separate owner permission for purchase, design selection or deploy.", ""]
    (root/(group+".prompt.md")).write_text("\n".join(lines))
print("full prompt packets",len(groups),"each includes individual AC and verification")
