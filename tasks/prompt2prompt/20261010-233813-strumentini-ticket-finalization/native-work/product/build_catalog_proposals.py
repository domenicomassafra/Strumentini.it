"""Reproduce planning-only catalog coverage; never modify product or official tickets."""

import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
TOOLS = ROOT / "src/tools"
AUDIT = ROOT / "docs/audit-2026-10-10/catalog-review.csv"
ISSUES = ROOT / ".scratch/strumentini-expansion-20261005/issues"
DASHBOARD = ROOT / ".scratch/strumentini-expansion-20261005/CURRENT-TICKET-DASHBOARD.json"

# Catalog category -> existing original parent(s). These are pointers, not proof of shipment.
FAMILY = {
    "documents": [32, 33, 52, 53, 58, 65, 98, 289],
    "files-assets": [28, 29, 47, 49, 50, 64, 292],
    "image-visual": [29, 50, 213, 292],
    "files": [30, 39, 64, 96, 290],
    "data": [23, 26, 60, 95, 286],
    "media": [35, 36, 37, 38, 229],
    "developer": [25, 27, 61, 91, 288],
    "business-math": [20, 21, 62, 88, 284],
    "client-work-math": [21, 62, 285],
    "date-time": [43, 62, 89, 287],
    "text": [39, 41, 61, 92, 295],
    "research": [39, 41, 64, 93, 294],
    "web-operations": [27, 63, 99, 296],
    "marketing": [42, 44, 63, 90, 293],
}

ADVANCED = {
    "documents": ("editor_pdf_per_pagine|editing_testo_immagini_moduli|history|esportazione_verificata", "product-A04..A11"),
    "files-assets": ("layers|maschere|regolazioni_non_distruttive|history|progetto_esportabile", "product-A12..A18"),
    "image-visual": ("workspace_immagine|selezioni|layer|history|export_progetto", "product-A12..A18"),
    "data": ("schema|join|confronto|ricette|fidelity_xlsx|batch", "product-A19..A23"),
    "media": ("codec_professionali|timeline|controlli_misurati_mobile", "product-A29"),
    "files": ("batch_con_report|privacy_attestata|handoff_compatibile", "product-A01"),
}

BASE_CONTRACT = {
    "documents": "documento_locale_input→operazione_dichiarata→preview_pagine_dove_rilevante→PDF_o_file_scaricabile",
    "files-assets": "immagine_locale→trasformazione_supportata→preview_dimensioni/formato/byte→download",
    "image-visual": "anteprima_visuale→operazione_con_parametri→verifica_output→download",
    "data": "import_righe/celle→operazione_esplicita→tabella_errori/anteprima→esportazione_tipi/zeri",
    "media": "file_locale→preflight_codec/size→operazione_cancellabile→download_o_rifiuto",
    "files": "file_locali→validazione_firma/limiti→operazione_dichiarata→file/reports",
    "developer": "input_locale→validazione_errori_puntuali→output_copiabile/scaricabile",
    "business-math": "input→formula/assunzioni→risultato_unità→dettaglio_copiabile",
    "client-work-math": "input→scenario_calcolo→dettaglio_formula→risultato_esportabile",
    "date-time": "input_date/timezone→regola_dichiarata→risultato_spiegato",
    "text": "testo→operazione_deterministica→output_copiabile/scaricabile",
    "research": "input→trasformazione_riferimenti→output_con_provenienza",
    "web-operations": "URL/campi→controlli→risultato_diagnostico/copiabile",
    "marketing": "input→trasformazione/campagna→output_copiabile/scaricabile",
}

def matched(field, text):
    m = re.search(r"\b" + re.escape(field) + r"\s*:\s*\"([^\"]+)\"", text)
    return m.group(1) if m else ""

def list_field(field, text):
    m = re.search(r"\b" + re.escape(field) + r"\s*:\s*\[(.*?)\]", text, re.S)
    return re.findall(r'"([^\"]+)"', m.group(1)) if m else []

def issue_id(path):
    return int(path.name.partition("-")[0])

def ticket_status(text):
    m = re.search(r"\*\*Status:\*\*\s*([^\n]+)", text)
    return m.group(1).strip() if m else "missing_status"

def factory_manifest(path, wrapper):
    match = re.search(r'import\s*\{\s*(\w+)\s*\}\s*from\s*"([^"]+)"',wrapper)
    if not match:
        return None, "", None
    symbol, source = match.groups()
    target = (path.parent / (source + ".ts")).resolve()
    if not target.is_file():
        return None, "", None
    body = target.read_text(errors="replace")
    marker = re.search(r'export const\s+'+re.escape(symbol)+r'\s*=\s*make\s*\(\s*\[', body)
    if not marker:
        return None, str(target.relative_to(ROOT)), None
    start=marker.end()-1
    level=0
    in_string=False
    escape=False
    for i in range(start,len(body)):
        char=body[i]
        if in_string:
            if escape:escape=False
            elif char=="\\":escape=True
            elif char=='"':in_string=False
        elif char=='"':in_string=True
        elif char=='[':level+=1
        elif char==']':
            level-=1
            if level==0:
                try:return json.loads(body[start:i+1]),str(target.relative_to(ROOT)),hashlib.sha256(body.encode()).hexdigest()
                except json.JSONDecodeError:return None,str(target.relative_to(ROOT)),None
    return None,str(target.relative_to(ROOT)),None

# Freeze traceability against the 327 originals assigned to this worker. The
# coordinator writes new IDs concurrently, which must never change this ledger.
issue_files = {issue_id(p):p for p in ISSUES.glob("*.md") if issue_id(p) <= 327}
issue_text = {num:p.read_text(errors="replace") for num,p in issue_files.items()}
issues = {num:{"id":num,"file":str(p.relative_to(ROOT)),
    "sha256":hashlib.sha256(issue_text[num].encode()).hexdigest(),
    "status":ticket_status(issue_text[num]),
    "title":issue_text[num].splitlines()[0].lstrip("# ").strip()}
    for num,p in issue_files.items()}

rows = list(csv.DictReader(AUDIT.open(newline="")))
catalog = {p.parent.name:p for p in TOOLS.glob("*/manifest.ts")}
assert len(rows) == len(catalog) == 269
assert {x["id"] for x in rows} == set(catalog)
assert set(issue_files) == set(range(1, 328))

fiscal = {
    "partita-iva-validator": [10, 123, 124],
    "italian-iban-validator": [9],
    "fatturapa-reader": [40, 119, 148],
    "fatturapa-batch-export": [40, 119, 148, 149],
    "inps-gestione-separata": [118, 132],
    "inps-artigiani-commercianti": [118, 131],
    "ponti-ferie-optimizer": [116, 151],
    "italian-holiday-calendar": [116],
    "codice-fiscale-generator": [8, 115, 121, 122],
    "italian-cap-lookup": [115, 120, 157],
}
SPECIAL = {
    "image-compression": [28, 47, 48, 207, 208, 209],
    "image-format-conversion": [28, 49, 212, 312, 313],
    "image-resize": [277, 278, 279, 314],
    "pdf-redaction": [32, 237],
    "pdf-to-images": [58, 236],
    "images-to-pdf": [58, 235],
    "image-ocr": [31, 246],
    "pdf-ocr": [31, 247],
    "office-to-pdf": [24, 56, 257, 258, 259],
    **fiscal,
}

result = []
for x in rows:
    key = x["id"]
    txt = catalog[key].read_text(errors="replace")
    factory, definition_path, definition_sha = factory_manifest(catalog[key], txt)
    category = x["category_internal"]
    advanced, proposal = ADVANCED.get(category, ("non_applicabile_automaticamente_alla_utility_puntuale", "product-A01"))
    if category == "documents" and "pdf" not in key:
        advanced = "non_applicabile_editor_pdf_automaticamente;possibile_fidelity_Office_o_handoff_documenti"
        proposal = "product-A23"
    if category in {"business-math", "client-work-math"}:
        advanced = "scenari|comparazione|export_se_richiesti_dal_job;altrimenti_non_applicabile"
        proposal = "product-A24..A28" if any(z in key for z in ["iva", "irpef", "tax", "stipendio", "fiscal", "inps", "tfr", "forfett"]) else "product-A01"
    elif category == "developer":
        advanced = "non_applicabile_salvo_large_data/performance/security_specifiche"
    route = matched("route", txt) or ("/tools/"+factory[0] if factory else "")
    tool_id = matched("id", txt) or (factory[0] if factory else "")
    if not route and tool_id == key and re.search(r'\b(?:define|make)\w*Manifest\s*\(',txt):
        route = "/tools/" + tool_id
    # A manifest that only re-exports a factory is still a real catalog entry.
    # The factory is read and decoded; do not silently infer unknown metadata.
    assert tool_id == key and route == "/tools/" + key, (key,route,tool_id)
    direct = [num for num,body in issue_text.items() if re.search(r"(?<![\w-])"+re.escape(key)+r"(?![\w-])", body)]
    original = sorted(set(FAMILY[category] + SPECIAL.get(key, []) + direct))
    declared_output = []
    em = re.search(r"\bemits\s*:\s*\[(.*?)\]",txt,re.S)
    if em:
        declared_output = re.findall(r'\bformat\s*:\s*"([^\"]+)"',em.group(1))
        if not declared_output:
            declared_output = re.findall(r'\btype\s*:\s*"([^\"]+)"',em.group(1))
    audit_proof = x["proof_in_this_audit"]
    gaps = ["nessuna_verifica_per_manifest_in_questa_ricognizione"]
    if x["partial_flag"] == "True": gaps.append("audit_partial_flag")
    if x["risk_flag"] == "True": gaps.append("audit_risk_flag")
    if x["review_class"] in {"incompleto-accettazione", "pericoloso-da-promettere-in-assoluto"}: gaps.append(x["review_class"])
    if category in {"documents", "files-assets", "image-visual", "media", "data"}:gaps.append("mobile_fisico_non_certificato_audit_2026-10-10")
    if key == "image-resize":gaps.append("#277/#278_phys_NOT_RUN;#279_blocked")
    if x["runtime"] == "REFERENCE":gaps.append("fonte_e_network_consenso_da_controllare")
    network = matched("network",txt)
    if not network:
        imp = re.search(r'\bfrom\s*"([^\"]+)"',txt)
        if imp:
            upstream=(catalog[key].parent/(imp.group(1)+".ts")).resolve()
            if upstream.is_file():network=matched("network",upstream.read_text(errors="replace"))
    if re.fullmatch(r'product-A\d{2}\.\.A\d{2}',proposal):
        first,last=map(int,re.findall(r'A(\d{2})',proposal))
        proposal="|".join(f"product-A{i:02d}" for i in range(first,last+1))
    fiscal_key = any(z in key for z in ["partita-iva", "irpef", "inps", "tfr", "forfett", "stipendio", "fiscal", "fatturapa", "codice-fiscale"])
    result.append({
        "tool_id":key,"route":route,"manifest":str(catalog[key].relative_to(ROOT)),
        "manifest_sha256":hashlib.sha256(txt.encode()).hexdigest(),
        "manifest_definition_path":definition_path or str(catalog[key].relative_to(ROOT)),
        "manifest_definition_sha256":definition_sha or hashlib.sha256(txt.encode()).hexdigest(),
        "name":x["name"],"job_primary":(list_field("jobs", txt) or (factory[4] if factory else []) or [x["name"]])[0],
        "engine":x["engine"],"category":category,"input_types":"|".join(list_field("inputTypes",txt) or (factory[5] if factory else [])),
        "output_formats_declared":"|".join(declared_output) if declared_output else "NOT_EXTRACTED_from_manifest_or_factory",
        "output_kind_expected_not_proven":BASE_CONTRACT[category].split("→")[-1],
        "runtime":x["runtime"],"network_policy":network or "NOT_EXTRACTED_from_factory",
        "base_user_contract":BASE_CONTRACT[category],"base_proof_scope":audit_proof,
        "gold_manifest_oracle_id":matched("oracleEntryId",txt) or (factory[6] if factory else ""),
        "base_gaps":"|".join(gaps),
        "advanced_candidate":advanced,
        "advanced_status":"capability_proposal_not_shipped" if category in ADVANCED else "optional_or_not_applicable",
        "mobile": "target_parity_OWN-06;physical_audit_NOT_RUN", "privacy":x["runtime"],
        "existing_issue_ids":"|".join(f"#{n:03}" for n in original),
        "directly_mentioned_issue_ids":"|".join(f"#{n:03}" for n in direct),
        "proposed_ticket_keys":proposal,
        "owner_traces":"OWN-01|OWN-02|OWN-03|OWN-06" + ("|OWN-04|OWN-05" if category in ADVANCED else "") + ("|OWN-11" if fiscal_key else ""),
        "review_class":x["review_class"],"audit_risk":x["risk_flag"],"audit_partial":x["partial_flag"],
        "note":"scope audit 2026-10-10; manifest presence and archived ticket completion are not functional/Gold/live proof",
    })

dst = OUT/"PRODUCT-CATALOG-269.csv"
with dst.open("w",encoding="utf-8",newline="") as f:
    writer=csv.DictWriter(f,fieldnames=list(result[0]));writer.writeheader();writer.writerows(result)

data={"baseline":{"manifest_count":len(catalog),"audit_row_count":len(rows),"archive_original_count":len(issue_files),
     "category_counts":dict(Counter(x["category"] for x in result)),"runtime_counts":dict(Counter(x["runtime"] for x in result)),
     "audit_review_classes":dict(Counter(x["review_class"] for x in result)),
     "audit_risk_count":sum(x["audit_risk"]=="True" for x in result),
     "audit_partial_count":sum(x["audit_partial"]=="True" for x in result)},
     "sources":["src/tools/*/manifest.ts","docs/audit-2026-10-10/catalog-review.csv",
     ".scratch/strumentini-expansion-20261005/issues/*.md"],
     "issues":list(issues.values()),"catalog":result}
(OUT/"PRODUCT-CATALOG-269.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
refusal_paths = {
    150:("P7M full-CMS extraction and trust", "bounded inspection/safe extraction only, no trust-chain claim", "A03,A25"),
    207:("JPEG/WebP expert codecs", "native browser control modes and true lossless/effort require codec proof", "A03,A12"),
    208:("PNG lossy indexed palette/dither", "isolated lossless compression is not equivalent to palette quantization", "A03,A12"),
    209:("SVG advanced optimization", "verified safe subset/sanitization does not prove visual full fidelity", "A03,A12"),
    222:("Universal ZIP DEFLATE", "safe subset vs broad archive behavior with bombs/encoding", "A03"),
    223:("GZIP broad interoperability", "only explicitly bounded paths can count as supported", "A03"),
    224:("Safe extraction universal ZIP", "untrusted entry protections, ZIP64/encryption/symlinks require separate proof", "A03"),
    230:("Broad audio transcode and codecs", "codec/runtime/browser/device feasibility with opt-in resource limits", "A29"),
    242:("Full PDF encryption/unlock", "bounded PDF encryption modes separate from unsupported owner-password and legacy modes", "A03,A04"),
    244:("General damaged-PDF recovery", "tolerant parse/repair subset not guarantee arbitrary corrupt file recovery", "A04"),
    245:("Certified PDF/A conversion", "structure work is not conformance validation", "A04"),
    253:("Faithful PDF-to-DOCX reconstruction", "semantic extract cannot reconstruct arbitrary Word formatting", "A04,A06"),
    257:("Faithful DOCX-to-PDF rendering", "semantic or browser print fallback distinct from Word layout", "A03,A23"),
    258:("Faithful XLSX-to-PDF rendering", "sheet values / limited print layout distinct from Excel fidelity", "A03,A20"),
    259:("Faithful PPTX-to-PDF rendering", "slide objects/outline distinct from PowerPoint renderer", "A03,A23"),
    262:("Complete EML/MSG viewer", "bounded parsing subset; unsafe/complex headers/attachments unsupported", "A03"),
    263:("Complete EPUB reader", "bounded EPUB reading/exports distinct from full DRM/reflow/media interoperability", "A03"),
}
dashboard=json.loads(DASHBOARD.read_text())
assert set(dashboard["refusedClosures"]) == set(refusal_paths)
with (OUT/"PRODUCT-REFUSAL-17.csv").open("w",encoding="utf-8",newline="") as f:
    w=csv.DictWriter(f,fieldnames=["original_issue_id","original_issue_path","original_sha256","historical_capability_refused","bounded_scope_or_future_gap","linked_proposal_keys","disposition"])
    w.writeheader()
    for num in sorted(refusal_paths):
        claim,gap,refs=refusal_paths[num]
        w.writerow({"original_issue_id":num,"original_issue_path":issues[num]["file"],"original_sha256":issues[num]["sha256"],
            "historical_capability_refused":claim,"bounded_scope_or_future_gap":gap,"linked_proposal_keys":refs,
            "disposition":"preserve_original_completed_with_refusal; future capabilities require new proof/ticket"})
print(json.dumps({"output":str(dst),"row_count":len(result),"issues_read":len(issue_files),"mapped_issue_refs":sum(len(x["existing_issue_ids"].split("|")) for x in result),"direct_mentions":sum(bool(x["directly_mentioned_issue_ids"]) for x in result),"category":data["baseline"]["category_counts"]},ensure_ascii=False))
