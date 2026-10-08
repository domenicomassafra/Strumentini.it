import {
  arrayOrNull,
  dictionaryOrNull,
  nameValue,
  numberValue,
  pdfReference,
  resolveReference,
  valueToText,
  type PdfDocumentModel,
  type PdfValue,
} from "./parser";

export interface PdfAnnotationProvenance {
  readonly page: number;
  readonly objectId: number | null;
  readonly subtype: string;
  readonly flags: number | null;
  readonly hidden: boolean;
  readonly appearanceStream: boolean;
  readonly rect: readonly number[] | null;
}

export interface PdfFieldProvenance {
  readonly name: string;
  readonly objectId: number | null;
  readonly fieldType: string;
  readonly pages: readonly number[];
  readonly widgetObjectIds: readonly number[];
}

export interface PdfFormAnnotationAudit {
  readonly fields: readonly PdfFieldProvenance[];
  readonly annotations: readonly PdfAnnotationProvenance[];
  readonly fieldCount: number;
  readonly annotationCount: number;
  readonly widgetCount: number;
  readonly visibleAnnotationCount: number;
  readonly hiddenAnnotationCount: number;
  readonly appearanceStreamCount: number;
  readonly unsafeAppearance: boolean;
  readonly blockers: readonly string[];
}

function objectId(value: PdfValue): number | null {
  return value.kind === "ref" ? value.id : null;
}

/** Safe subset: /Hidden flag means the annotation cannot contribute to page appearance. */
export function auditPdfFormAnnotations(document: PdfDocumentModel): PdfFormAnnotationAudit {
  const annotations: PdfAnnotationProvenance[] = [];
  const byId = new Map<number, number[]>();
  const annotationLimit = 1_000;
  for (const [index, page] of document.pages.entries()) {
    const dictionary = page.object.value.kind === "dict" ? page.object.value : null;
    const refs = arrayOrNull(document, dictionary?.entries.get("Annots"));
    if (dictionary?.entries.has("Annots") && refs === null) {
      throw new Error("MALFORMED_PDF: Page Annots must be an array");
    }
    for (const ref of refs?.items ?? []) {
      if (annotations.length >= annotationLimit) throw new Error("PDF_LIMIT: Too many page annotations");
      const info = dictionaryOrNull(document, ref);
      if (info === null) throw new Error("MALFORMED_PDF: Invalid annotation dictionary");
      const id = objectId(ref);
      if (id !== null) byId.set(id, [...(byId.get(id) ?? []), index + 1]);
      const flags = numberValue(info.entries.get("F"));
      const subtype = nameValue(info.entries.get("Subtype")) ?? "unknown";
      const rect = arrayOrNull(document, info.entries.get("Rect"));
      const numbers = rect?.items.map(numberValue) ?? null;
      const validRect = numbers !== null && numbers.length === 4 && numbers.every((number) => number !== null);
      annotations.push({
        page: index + 1, objectId: id, subtype, flags,
        hidden: flags !== null && (flags & 2) !== 0,
        appearanceStream: info.entries.has("AP"),
        rect: validRect ? numbers as number[] : null,
      });
    }
  }

  const root = document.root === null ? null : dictionaryOrNull(document, pdfReference(document.root.id, document.root.generation));
  const acro = dictionaryOrNull(document, root?.entries.get("AcroForm"));
  const rawFields = arrayOrNull(document, acro?.entries.get("Fields"));
  const blockers: string[] = [];
  if (acro?.entries.has("XFA")) blockers.push("AcroForm XFA dinamico non supportato");
  if (acro?.entries.has("NeedAppearances")) {
    const appearanceFlag = resolveReference(document, acro.entries.get("NeedAppearances"));
    if (appearanceFlag?.kind === "literal" && appearanceFlag.value === "true") {
      blockers.push("Aspetto dei campi generato dinamicamente dal visualizzatore");
    }
  }
  if (acro?.entries.has("Fields") && rawFields === null) blockers.push("Albero dei campi AcroForm non verificabile");
  const fields: PdfFieldProvenance[] = [];
  const seen = new Set<number>();
  const visit = (value: PdfValue, prefix: string, depth: number, inheritedType: string): void => {
    if (depth > 32 || fields.length > annotationLimit) throw new Error("PDF_LIMIT: Form field hierarchy too large");
    const id = objectId(value);
    if (id !== null && seen.has(id)) throw new Error("MALFORMED_PDF: Repeated/cyclic AcroForm field");
    if (id !== null) seen.add(id);
    const dictionary = dictionaryOrNull(document, value);
    if (dictionary === null) throw new Error("MALFORMED_PDF: Invalid AcroForm field");
    const partial = valueToText(resolveReference(document, dictionary.entries.get("T")));
    const name = [prefix, partial].filter((part) => typeof part === "string" && part.length > 0).join(".");
    const type = nameValue(dictionary.entries.get("FT")) ?? inheritedType;
    const kids = arrayOrNull(document, dictionary.entries.get("Kids"));
    if (dictionary.entries.has("Kids") && kids === null) throw new Error("MALFORMED_PDF: Invalid field children");
    const widgetObjectIds: number[] = [];
    const pages: number[] = [];
    const includeWidget = (child: PdfValue): void => {
      const widgetId = objectId(child);
      const widget = dictionaryOrNull(document, child);
      if (widget?.entries.get("Subtype") && nameValue(widget.entries.get("Subtype")) !== "Widget") return;
      if (widgetId !== null) {
        widgetObjectIds.push(widgetId);
        pages.push(...byId.get(widgetId) ?? []);
      }
    };
    if (nameValue(dictionary.entries.get("Subtype")) === "Widget") includeWidget(value);
    if (kids !== null) {
      for (const kid of kids.items) {
        const child = dictionaryOrNull(document, kid);
        if (child !== null && nameValue(child.entries.get("Subtype")) === "Widget") {
          includeWidget(kid);
        } else {
          visit(kid, name, depth + 1, type);
        }
      }
    }
    // A terminal field may have a separate widget annotation on the page.
    if (kids === null || widgetObjectIds.length > 0) {
      fields.push({
        name: name || "(unnamed)", objectId: id, fieldType: type,
        pages: [...new Set(pages)].toSorted((a, b) => a - b),
        widgetObjectIds: [...new Set(widgetObjectIds)],
      });
    }
  };
  for (const field of rawFields?.items ?? []) visit(field, "", 0, "unknown");
  const visible = annotations.filter((item) => !item.hidden);
  if (visible.length > 0) blockers.push(`${visible.length} annotazioni visibili prive di flatten della grafica/appearance stream`);
  // Orphaned widgets and form appearances are not safely paintable either.
  if (fields.some((field) => field.widgetObjectIds.some((id) => !byId.has(id)))) {
    blockers.push("Widget AcroForm non collegati alle pagine: aspetto non verificabile");
  }
  return {
    fields, annotations, fieldCount: fields.length, annotationCount: annotations.length,
    widgetCount: annotations.filter((item) => item.subtype === "Widget").length,
    visibleAnnotationCount: visible.length, hiddenAnnotationCount: annotations.length - visible.length,
    appearanceStreamCount: annotations.filter((item) => item.appearanceStream).length,
    unsafeAppearance: blockers.length > 0, blockers,
  };
}
