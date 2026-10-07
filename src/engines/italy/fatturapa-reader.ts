import { parseXmlDocument, type XmlElement, type XmlNode } from "../developer-web/structured-repair";
import { FATTURAPA_TECHNICAL_CURRENT, getItalyReferenceProvenance, type FatturaPaSchemaIdentity } from "../../reference-data/italy";

export const FATTURAPA_READER_VERSION = "1.0";

export type FatturaPaReaderErrorCode =
  | "FATTURAPA_NAMESPACE_UNSUPPORTED"
  | "FATTURAPA_ROOT_UNSUPPORTED"
  | "FATTURAPA_TRANSMISSION_FORMAT_UNSUPPORTED"
  | "FATTURAPA_VERSION_MISMATCH";

export class FatturaPaReaderError extends Error {
  readonly code: FatturaPaReaderErrorCode;

  constructor(code: FatturaPaReaderErrorCode, message: string) {
    super(message);
    this.name = "FatturaPaReaderError";
    this.code = code;
  }
}

export interface FatturaPaFieldError {
  readonly path: string;
  readonly code: "MISSING_REQUIRED_FIELD" | "INVALID_DATE" | "INVALID_DECIMAL";
  readonly message: string;
  readonly value?: string;
}

export interface FatturaPaParty {
  readonly name: string | null;
  readonly vatId: string | null;
  readonly taxCode: string | null;
}

export interface FatturaPaLine {
  readonly lineNumber: string;
  readonly description: string | null;
  readonly quantity: string | null;
  readonly unitPrice: string | null;
  readonly lineTotal: string | null;
  readonly vatRatePercent: string | null;
  readonly vatNature: string | null;
  readonly vatAmount: string | null;
}

export interface FatturaPaVatSummary {
  readonly taxableAmount: string | null;
  readonly taxAmount: string | null;
  readonly vatRatePercent: string | null;
  readonly vatNature: string | null;
}

export interface FatturaPaInvoiceBody {
  readonly documentType: string | null;
  readonly currency: string | null;
  readonly date: string | null;
  readonly number: string | null;
  readonly documentTotal: string | null;
  readonly lines: readonly FatturaPaLine[];
  readonly vatSummaries: readonly FatturaPaVatSummary[];
}

export interface FatturaPaReadResult {
  readonly family: "ordinary" | "simplified";
  readonly transmissionFormat: string;
  readonly namespace: string;
  readonly xsdVersion: string;
  readonly technicalSpecificationVersion: string;
  readonly externalEntityResolution: "disabled";
  readonly supplier: FatturaPaParty;
  readonly customer: FatturaPaParty;
  readonly bodies: readonly FatturaPaInvoiceBody[];
  readonly fieldErrors: readonly FatturaPaFieldError[];
  readonly provenance: ReturnType<typeof getItalyReferenceProvenance>;
}

function splitName(name: string): { prefix: string | null; local: string } {
  const colon = name.indexOf(":");
  return colon < 0 ? { prefix: null, local: name } : { prefix: name.slice(0, colon), local: name.slice(colon + 1) };
}

function localName(element: XmlElement): string {
  return splitName(element.name).local;
}

function invoiceElement(element: XmlElement, expected: string, rootPrefix: string | null): boolean {
  const name = splitName(element.name);
  return name.local === expected && (name.prefix === null || name.prefix === rootPrefix);
}

function elementChildren(element: XmlElement): readonly XmlElement[] {
  return element.children.filter((node): node is XmlElement => node.kind === "element");
}

function child(element: XmlElement | null, name: string, rootPrefix: string | null): XmlElement | null {
  if (element === null) return null;
  return elementChildren(element).find((candidate) => invoiceElement(candidate, name, rootPrefix)) ?? null;
}

function children(element: XmlElement | null, name: string, rootPrefix: string | null): readonly XmlElement[] {
  if (element === null) return [];
  return elementChildren(element).filter((candidate) => invoiceElement(candidate, name, rootPrefix));
}

function path(element: XmlElement | null, rootPrefix: string | null, ...names: readonly string[]): XmlElement | null {
  let current = element;
  for (const name of names) current = child(current, name, rootPrefix);
  return current;
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/giu, (match, entity: string) => {
    if (entity === "amp") return "&";
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "quot") return '"';
    if (entity === "apos") return "'";
    const codePoint = entity.startsWith("#x") || entity.startsWith("#X")
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    return String.fromCodePoint(codePoint);
  });
}

function nodeText(nodes: readonly XmlNode[]): string {
  return decodeXmlEntities(nodes
    .filter((node) => node.kind === "text" || node.kind === "cdata")
    .map((node) => node.value)
    .join(""))
    .trim();
}

function text(element: XmlElement | null): string | null {
  if (element === null) return null;
  const value = nodeText(element.children);
  return value === "" ? null : value;
}

function requiredText(
  element: XmlElement | null,
  fieldPath: string,
  errors: FatturaPaFieldError[],
): string | null {
  const value = text(element);
  if (value === null) {
    errors.push({ path: fieldPath, code: "MISSING_REQUIRED_FIELD", message: `Missing required FatturaPA field ${fieldPath}.` });
  }
  return value;
}

function decimal(
  element: XmlElement | null,
  fieldPath: string,
  errors: FatturaPaFieldError[],
  required = false,
): string | null {
  const value = required ? requiredText(element, fieldPath, errors) : text(element);
  if (value === null) return null;
  if (!/^-?\d+(?:\.\d+)?$/u.test(value)) {
    errors.push({ path: fieldPath, code: "INVALID_DECIMAL", message: `Invalid decimal value at ${fieldPath}.`, value });
    return null;
  }
  return value;
}

function isoDate(element: XmlElement | null, fieldPath: string, errors: FatturaPaFieldError[]): string | null {
  const value = requiredText(element, fieldPath, errors);
  if (value === null) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;
  if (parsed === null || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    errors.push({ path: fieldPath, code: "INVALID_DATE", message: `Invalid ISO calendar date at ${fieldPath}.`, value });
    return null;
  }
  return value;
}

function rootNamespace(root: XmlElement): string | null {
  const { prefix } = splitName(root.name);
  const namespaceAttribute = prefix === null ? "xmlns" : `xmlns:${prefix}`;
  return root.attributes.find(({ name }) => name === namespaceAttribute)?.value ?? null;
}

function rootVersion(root: XmlElement): string | null {
  return root.attributes.find(({ name }) => name === "versione")?.value ?? null;
}

function schemaFor(root: XmlElement, namespace: string, transmissionFormat: string): FatturaPaSchemaIdentity {
  const rootLocal = localName(root);
  const namespaceMatches = FATTURAPA_TECHNICAL_CURRENT.data.schemas.filter((schema) => schema.namespace === namespace);
  if (namespaceMatches.length === 0) {
    throw new FatturaPaReaderError("FATTURAPA_NAMESPACE_UNSUPPORTED", `Unsupported FatturaPA namespace: ${namespace}.`);
  }
  const rootMatches = namespaceMatches.filter((schema) => schema.rootElement === rootLocal);
  if (rootMatches.length === 0) {
    throw new FatturaPaReaderError("FATTURAPA_ROOT_UNSUPPORTED", `Unsupported FatturaPA root element ${rootLocal} for namespace ${namespace}.`);
  }
  const match = rootMatches.find((schema) => schema.transmissionFormats.includes(transmissionFormat));
  if (match === undefined) {
    throw new FatturaPaReaderError(
      "FATTURAPA_TRANSMISSION_FORMAT_UNSUPPORTED",
      `Transmission format ${transmissionFormat} is not supported for FatturaPA namespace ${namespace}.`,
    );
  }
  return match;
}

function partyName(party: XmlElement | null, rootPrefix: string | null, ordinary: boolean): string | null {
  const container = ordinary ? path(party, rootPrefix, "DatiAnagrafici", "Anagrafica") : party;
  const denomination = text(child(container, "Denominazione", rootPrefix));
  if (denomination !== null) return denomination;
  const first = text(child(container, "Nome", rootPrefix));
  const last = text(child(container, "Cognome", rootPrefix));
  const combined = [first, last].filter((value): value is string => value !== null).join(" ").trim();
  return combined === "" ? null : combined;
}

function partyVatId(party: XmlElement | null, rootPrefix: string | null, ordinary: boolean): string | null {
  const fiscal = ordinary ? path(party, rootPrefix, "DatiAnagrafici", "IdFiscaleIVA") : child(party, "IdFiscaleIVA", rootPrefix);
  const country = text(child(fiscal, "IdPaese", rootPrefix));
  const code = text(child(fiscal, "IdCodice", rootPrefix));
  return country !== null && code !== null ? `${country}${code}` : code;
}

function partyTaxCode(party: XmlElement | null, rootPrefix: string | null, ordinary: boolean): string | null {
  return text(ordinary ? path(party, rootPrefix, "DatiAnagrafici", "CodiceFiscale") : child(party, "CodiceFiscale", rootPrefix));
}

function mapParty(party: XmlElement | null, rootPrefix: string | null, ordinary: boolean): FatturaPaParty {
  return {
    name: partyName(party, rootPrefix, ordinary),
    vatId: partyVatId(party, rootPrefix, ordinary),
    taxCode: partyTaxCode(party, rootPrefix, ordinary),
  };
}

function ordinaryLine(
  line: XmlElement,
  bodyIndex: number,
  lineIndex: number,
  rootPrefix: string | null,
  errors: FatturaPaFieldError[],
): FatturaPaLine {
  const prefix = `/FatturaElettronicaBody[${bodyIndex}]/DatiBeniServizi/DettaglioLinee[${lineIndex}]`;
  return {
    lineNumber: requiredText(child(line, "NumeroLinea", rootPrefix), `${prefix}/NumeroLinea`, errors) ?? String(lineIndex),
    description: requiredText(child(line, "Descrizione", rootPrefix), `${prefix}/Descrizione`, errors),
    quantity: decimal(child(line, "Quantita", rootPrefix), `${prefix}/Quantita`, errors),
    unitPrice: decimal(child(line, "PrezzoUnitario", rootPrefix), `${prefix}/PrezzoUnitario`, errors, true),
    lineTotal: decimal(child(line, "PrezzoTotale", rootPrefix), `${prefix}/PrezzoTotale`, errors, true),
    vatRatePercent: decimal(child(line, "AliquotaIVA", rootPrefix), `${prefix}/AliquotaIVA`, errors, true),
    vatNature: text(child(line, "Natura", rootPrefix)),
    vatAmount: null,
  };
}

function ordinaryBody(
  body: XmlElement,
  index: number,
  rootPrefix: string | null,
  errors: FatturaPaFieldError[],
): FatturaPaInvoiceBody {
  const general = path(body, rootPrefix, "DatiGenerali", "DatiGeneraliDocumento");
  const goods = child(body, "DatiBeniServizi", rootPrefix);
  const base = `/FatturaElettronicaBody[${index}]`;
  return {
    documentType: requiredText(child(general, "TipoDocumento", rootPrefix), `${base}/DatiGenerali/DatiGeneraliDocumento/TipoDocumento`, errors),
    currency: requiredText(child(general, "Divisa", rootPrefix), `${base}/DatiGenerali/DatiGeneraliDocumento/Divisa`, errors),
    date: isoDate(child(general, "Data", rootPrefix), `${base}/DatiGenerali/DatiGeneraliDocumento/Data`, errors),
    number: requiredText(child(general, "Numero", rootPrefix), `${base}/DatiGenerali/DatiGeneraliDocumento/Numero`, errors),
    documentTotal: decimal(child(general, "ImportoTotaleDocumento", rootPrefix), `${base}/DatiGenerali/DatiGeneraliDocumento/ImportoTotaleDocumento`, errors),
    lines: children(goods, "DettaglioLinee", rootPrefix).map((line, lineIndex) => ordinaryLine(line, index, lineIndex + 1, rootPrefix, errors)),
    vatSummaries: children(goods, "DatiRiepilogo", rootPrefix).map((summary, summaryIndex) => {
      const prefix = `${base}/DatiBeniServizi/DatiRiepilogo[${summaryIndex + 1}]`;
      return {
        taxableAmount: decimal(child(summary, "ImponibileImporto", rootPrefix), `${prefix}/ImponibileImporto`, errors, true),
        taxAmount: decimal(child(summary, "Imposta", rootPrefix), `${prefix}/Imposta`, errors, true),
        vatRatePercent: decimal(child(summary, "AliquotaIVA", rootPrefix), `${prefix}/AliquotaIVA`, errors, true),
        vatNature: text(child(summary, "Natura", rootPrefix)),
      };
    }),
  };
}

function simplifiedBody(
  body: XmlElement,
  index: number,
  rootPrefix: string | null,
  errors: FatturaPaFieldError[],
): FatturaPaInvoiceBody {
  const general = path(body, rootPrefix, "DatiGenerali", "DatiGeneraliDocumento");
  const base = `/FatturaElettronicaBody[${index}]`;
  const goods = children(body, "DatiBeniServizi", rootPrefix);
  return {
    documentType: requiredText(child(general, "TipoDocumento", rootPrefix), `${base}/DatiGenerali/DatiGeneraliDocumento/TipoDocumento`, errors),
    currency: requiredText(child(general, "Divisa", rootPrefix), `${base}/DatiGenerali/DatiGeneraliDocumento/Divisa`, errors),
    date: isoDate(child(general, "Data", rootPrefix), `${base}/DatiGenerali/DatiGeneraliDocumento/Data`, errors),
    number: requiredText(child(general, "Numero", rootPrefix), `${base}/DatiGenerali/DatiGeneraliDocumento/Numero`, errors),
    documentTotal: null,
    lines: goods.map((item, itemIndex) => {
      const prefix = `${base}/DatiBeniServizi[${itemIndex + 1}]`;
      const vat = child(item, "DatiIVA", rootPrefix);
      return {
        lineNumber: String(itemIndex + 1),
        description: requiredText(child(item, "Descrizione", rootPrefix), `${prefix}/Descrizione`, errors),
        quantity: null,
        unitPrice: null,
        lineTotal: decimal(child(item, "Importo", rootPrefix), `${prefix}/Importo`, errors, true),
        vatRatePercent: decimal(child(vat, "Aliquota", rootPrefix), `${prefix}/DatiIVA/Aliquota`, errors),
        vatNature: text(child(item, "Natura", rootPrefix)),
        vatAmount: decimal(child(vat, "Imposta", rootPrefix), `${prefix}/DatiIVA/Imposta`, errors),
      };
    }),
    vatSummaries: [],
  };
}

export function readFatturaPaXml(input: string): FatturaPaReadResult {
  const document = parseXmlDocument(input);
  const root = document.root;
  const rootPrefix = splitName(root.name).prefix;
  const namespace = rootNamespace(root);
  if (namespace === null) {
    throw new FatturaPaReaderError("FATTURAPA_NAMESPACE_UNSUPPORTED", "FatturaPA root element has no resolvable namespace declaration.");
  }

  const header = child(root, "FatturaElettronicaHeader", rootPrefix);
  const transmission = path(header, rootPrefix, "DatiTrasmissione", "FormatoTrasmissione");
  const transmissionFormat = text(transmission);
  if (transmissionFormat === null) {
    throw new FatturaPaReaderError("FATTURAPA_TRANSMISSION_FORMAT_UNSUPPORTED", "FatturaPA document is missing FormatoTrasmissione.");
  }
  const schema = schemaFor(root, namespace, transmissionFormat);
  const declaredRootVersion = rootVersion(root);
  if (declaredRootVersion === null || declaredRootVersion !== transmissionFormat) {
    throw new FatturaPaReaderError(
      "FATTURAPA_VERSION_MISMATCH",
      `FatturaPA root versione (${declaredRootVersion ?? "missing"}) does not match FormatoTrasmissione (${transmissionFormat}).`,
    );
  }

  const errors: FatturaPaFieldError[] = [];
  const ordinary = schema.family === "ordinary";
  const supplier = child(header, "CedentePrestatore", rootPrefix);
  const customer = child(header, "CessionarioCommittente", rootPrefix);
  const bodyElements = children(root, "FatturaElettronicaBody", rootPrefix);
  if (bodyElements.length === 0) {
    errors.push({ path: `/${schema.rootElement}/FatturaElettronicaBody`, code: "MISSING_REQUIRED_FIELD", message: "FatturaPA document has no invoice body." });
  }

  return {
    family: schema.family,
    transmissionFormat,
    namespace,
    xsdVersion: schema.xsdVersion,
    technicalSpecificationVersion: FATTURAPA_TECHNICAL_CURRENT.data.technicalSpecificationVersion,
    externalEntityResolution: "disabled",
    supplier: mapParty(supplier, rootPrefix, ordinary),
    customer: mapParty(customer, rootPrefix, ordinary),
    bodies: bodyElements.map((body, index) => ordinary
      ? ordinaryBody(body, index + 1, rootPrefix, errors)
      : simplifiedBody(body, index + 1, rootPrefix, errors)),
    fieldErrors: errors,
    provenance: getItalyReferenceProvenance(FATTURAPA_TECHNICAL_CURRENT),
  };
}
