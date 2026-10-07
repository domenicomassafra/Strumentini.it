import {
  convertBibtexToRis,
  convertRisToBibtex,
  formatBibtexDocument,
  generateCitationKey,
  parseBibtexDocument,
  type BibtexEntry,
  type BibtexToRisResult,
  type CitationRecord,
  type ConversionWarning,
  type RisToBibtexResult,
} from "../../engines/research-knowledge";

interface RisField {
  readonly tag: string;
  readonly value: string;
}

interface RisContext {
  readonly type: string;
  readonly fields: readonly RisField[];
}

function normalizeRisValue(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

/** Preserve source order across RIS aliases such as A1 and AU. */
function readRisContexts(text: string): RisContext[] {
  const records: RisContext[] = [];
  let type = "";
  let fields: RisField[] | undefined;
  const flush = (): void => {
    if (fields === undefined) return;
    records.push({ type, fields });
    type = "";
    fields = undefined;
  };
  for (const line of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const match = line.match(/^([A-Z0-9]{2})\s{2}-\s?(.*)$/u);
    if (match === null) continue;
    const tag = match[1] ?? "";
    const value = normalizeRisValue(match[2] ?? "");
    if (tag === "TY") {
      flush();
      type = value.toUpperCase();
      fields = [];
      continue;
    }
    if (fields === undefined) continue;
    if (tag === "ER") {
      flush();
      continue;
    }
    if (value !== "") fields.push({ tag, value });
  }
  flush();
  return records;
}

function valuesFor(context: RisContext | undefined, tags: readonly string[]): string[] {
  if (context === undefined) return [];
  return context.fields.filter(({ tag }) => tags.includes(tag)).map(({ value }) => value);
}

function firstFor(context: RisContext | undefined, tags: readonly string[]): string {
  for (const tag of tags) {
    const value = context?.fields.find((field) => field.tag === tag)?.value;
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function yearFrom(context: RisContext | undefined): string {
  // Zotero's maintained RIS translator treats Y1 as the deprecated old-RIS
  // date alias. DA therefore wins when present; PY is the year-only fallback.
  const value = firstFor(context, ["DA", "PY", "Y1"]);
  return value.match(/\d{4}/u)?.[0] ?? value;
}

function preciseRisDate(context: RisContext | undefined): string | undefined {
  for (const value of valuesFor(context, ["DA", "PY", "Y1"])) {
    const year = value.match(/\d{4}/u)?.[0];
    if (year !== undefined && value !== year) return value;
  }
  return undefined;
}

function contextualSecondaryTitle(context: RisContext | undefined): { readonly field: "series" | "booktitle"; readonly value: string } | undefined {
  const value = firstFor(context, ["T2"]);
  if (value === "") return undefined;
  if (context?.type === "BOOK" || context?.type === "EBOOK") return { field: "series", value };
  if (context?.type === "CHAP" || context?.type === "ECHAP" || context?.type === "CONF" || context?.type === "CPAPER") {
    return { field: "booktitle", value };
  }
  return undefined;
}

function correctedEntry(entry: BibtexEntry, context: RisContext | undefined, priorKeys: readonly string[]): BibtexEntry {
  const fields = { ...entry.fields };
  let identityChanged = false;
  const authors = valuesFor(context, ["A1", "AU"]);
  if (authors.length > 0) {
    const author = authors.join(" and ");
    identityChanged ||= fields.author !== author;
    fields.author = author;
  }
  const year = yearFrom(context);
  if (year !== "") {
    identityChanged ||= fields.year !== year;
    fields.year = year;
  }
  const secondary = contextualSecondaryTitle(context);
  if (secondary !== undefined) {
    fields[secondary.field] = secondary.value;
    if (fields.journal === secondary.value) delete fields.journal;
  }
  if (!identityChanged) return { ...entry, fields };
  const citation: CitationRecord = {
    ...(authors.length === 0 ? {} : { authors }),
    ...(fields.title === undefined ? {} : { title: fields.title }),
    ...(fields.year === undefined ? {} : { year: fields.year }),
  };
  return { ...entry, key: generateCitationKey(citation, priorKeys), fields };
}

export function convertRisToBibtexForTool(text: string): RisToBibtexResult {
  const base = convertRisToBibtex(text);
  const contexts = readRisContexts(text);
  const entries: BibtexEntry[] = [];
  for (const [index, entry] of base.entries.entries()) {
    entries.push(correctedEntry(entry, contexts[index], entries.map(({ key }) => key)));
  }
  const lossWarnings: ConversionWarning[] = [];
  contexts.forEach((context, index) => {
    const preciseDate = preciseRisDate(context);
    if (preciseDate === undefined || base.warnings.some(({ record, code }) => record === index + 1 && code === "RIS_DATE_PRECISION_LOSS")) return;
    lossWarnings.push({
      record: index + 1,
      code: "RIS_DATE_PRECISION_LOSS",
      message: `Il record RIS ${index + 1} contiene una data più precisa dell'anno (${preciseDate}): il mapping BibTeX dichiarato conserva solo l'anno.`,
    });
  });
  const formatted = formatBibtexDocument(entries);
  return {
    ...base,
    bibtex: formatted.bibtex,
    entries,
    warnings: [
      ...base.warnings.filter(({ code }) => code !== "BIBTEX_VALUE_QUOTED"),
      ...lossWarnings,
      ...formatted.warnings,
    ],
  };
}

export function convertBibtexToRisForTool(text: string): BibtexToRisResult {
  const original = parseBibtexDocument(text);
  const normalized = text.replace(/@inbook(?=\s*[({])/giu, "@incollection");
  const converted = convertBibtexToRis(normalized);
  return {
    ...converted,
    // Keep the parsed source entries truthful even though the normalized copy
    // is used only to select the corresponding RIS chapter type.
    entries: original.entries,
  };
}
