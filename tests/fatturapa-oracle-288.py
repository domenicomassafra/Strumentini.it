"""Offline adapter for the pinned, independent fatturapa 0.2.0 wheel.

Input: XML bytes on stdin. Output: JSON of values parsed by the donor API.
Only formatting and code-label normalization happen here; XML is never parsed
by this adapter and the donor never participates in the browser runtime.
"""
import json
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from importlib.metadata import version

from fatturapa import MODALITA_PAGAMENTO, NATURA, parse


if version("fatturapa") != "0.2.0":
    raise RuntimeError("Oracle fatturapa version is not pinned to 0.2.0")


def amount(value):
    if not value:
        return None
    try:
        number = Decimal(value.replace(".", "").replace(",", "."))
        return format(number.normalize(), "f") if number.is_finite() else value
    except InvalidOperation:
        return value


def iso(value):
    return datetime.strptime(value, "%d/%m/%Y").date().isoformat() if value else None


def code(value, labels):
    return next((raw for raw, label in labels.items() if label == value), value) if value else None


def party(subject):
    return {
        "name": subject.denominazione or None,
        "vatId": subject.partita_iva or None,
        "taxCode": subject.codice_fiscale or None,
    }


def body(document):
    return {
        "documentType": document.tipo_documento_codice or None,
        "number": document.numero or None,
        "date": iso(document.data),
        "currency": document.divisa,
        "documentTotal": amount(document.importo_totale),
        "stampDutyAmount": amount(document.bollo),
        "lines": [
            {
                "lineNumber": line.numero,
                "description": line.descrizione or None,
                "quantity": amount(line.quantita),
                "unitPrice": amount(line.prezzo_unitario),
                "lineTotal": amount(line.prezzo_totale),
                "vatRatePercent": amount(line.aliquota_iva),
                "vatNature": code(line.natura, NATURA),
            }
            for line in document.linee
        ],
        "vatSummaries": [
            {
                "vatRatePercent": amount(item.aliquota_iva),
                "vatNature": code(item.natura, NATURA),
                "taxableAmount": amount(item.imponibile),
                "taxAmount": amount(item.imposta),
            }
            for item in document.riepiloghi
        ],
        "payments": [
            {
                "method": code(item.modalita, MODALITA_PAGAMENTO),
                "dueDate": iso(item.scadenza),
                "amount": amount(item.importo),
            }
            for item in document.pagamenti
        ],
    }


documents = parse(sys.stdin.buffer.read())
print(json.dumps({
    "supplier": party(documents[0].cedente),
    "customer": party(documents[0].cessionario),
    "bodies": [body(document) for document in documents],
}, ensure_ascii=False))
