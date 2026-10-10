"""Read-only checks of 2026-10-10 canonical planning package (not a product verifier)."""
from pathlib import Path
import csv
import json
import re
import hashlib

B = Path(__file__).parent
R = B.parent.parent
issues = {}
for p in (B / 'issues').glob('*.md'):
    match = re.match(r'^(\d+)-', p.name)
    if match:
        n = int(match.group(1))
        assert n not in issues, f'duplicate issue {n}'
        issues[n] = p
assert sorted(issues) == list(range(1, 425)), 'issue gaps or count drift'
dash = json.loads((B / 'CURRENT-TICKET-DASHBOARD.json').read_text())
assert dash['totals']['all'] == 424 and dash['totals']['completed'] == 284
assert dash['totals']['open'] == 140 and dash['totals']['completedWithRefusal'] == 17
assert dash['totals']['storedStatusMismatches'] == 0
with (B / 'TICKET-RECONCILIATION.csv').open(newline='') as f:
    rows = list(csv.DictReader(f))
assert [int(r['id']) for r in rows] == list(range(1, 328))
for row in rows:
    n = int(row['id'])
    assert row['sha256'] == hashlib.sha256(issues[n].read_bytes()).hexdigest(), f'stale SHA {n}'
assert sum(r['refusal'] == 'true' for r in rows) == 17
original_open = [i for i in dash['tickets'] if i['id'] <= 327 and i['executionCategory'] != 'completed']
assert len(original_open) == 43
for i in original_open:
    assert '## 2026-10-10 owner planning reconciliation' in issues[i['id']].read_text()
    assert next(r for r in rows if int(r['id']) == i['id'])['related_new_tickets'].startswith('#')
with (B / 'TOOL-CAPABILITY-COVERAGE.csv').open(newline='') as f:
    tools = list(csv.DictReader(f))
assert len(tools) == 269 and len({t['tool_id'] for t in tools}) == 269
assert len({t['route'] for t in tools}) == 269
assert all(len(t['manifest_sha256']) == 64 for t in tools)
text = (B / 'OWNER-DECISION-COVERAGE.md').read_text()
assert {int(n) for n in re.findall(r'OWN-(\d{2})', text)} == set(range(1, 21))
for n in range(328, 425):
    body = issues[n].read_text()
    assert re.search(r'^- \[ \] AC-'+str(n)+r'\.1:', body, re.M), f'missing AC-1 {n}'
    assert re.search(r'^- \[ \] AC-'+str(n)+r'\.2:', body, re.M), f'missing AC-2 {n}'
    assert re.search(r'^- \[ \] AC-'+str(n)+r'\.3:', body, re.M), f'missing AC-3 {n}'
    assert '**Blocked by:**' in body and ('**Rollback:**' in body or '**Rollback / migration:**' in body)
with (B / 'EXECUTION-PROMPT-ROUTING.csv').open(newline='') as f:
    routing = list(csv.DictReader(f))
assert len(routing) == 424
mapped = {int(r['id']) for r in routing if r['prompt_path']}
assert len(mapped) == 140
assert mapped == {x['id'] for x in dash['tickets'] if x['executionCategory'] != 'completed'}
assert all((B / 'execution-prompts' / (r['prompt_group']+'.prompt.md')).exists() for r in routing if r['prompt_path'])
for n in range(328, 425):
    prompt = next(r['prompt_path'] for r in routing if int(r['id']) == n)
    assert ('AC-'+str(n)+'.1') in (B/'execution-prompts'/(Path(prompt).name)).read_text()
print('PLANNING PASS: 424 unique issues; 327 reconciled hashes; 43 original open, 17 refused; 269 route/manifest; OWN 20; 97 new with AC; 140/140 open prompts')
