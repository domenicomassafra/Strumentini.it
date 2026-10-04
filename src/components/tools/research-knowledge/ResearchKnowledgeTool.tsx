import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { friendlyToolErrorIt } from "../../../i18n/it/errors";
import { InlineError, ToolActions, ToolResetButton, ToolResultPanel, ToolSubmitButton } from "../shared";
import { CONTROL, it } from "../shared/controlLabels";

export interface ResearchToolField {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "select";
  placeholder?: string;
  rows?: number;
  defaultValue?: string;
  options?: readonly string[];
}

export interface ResearchKnowledgeToolConfig {
  toolId: string;
  title: string;
  description: string;
  submitLabel: string;
  resultLabel: string;
  fields: readonly ResearchToolField[];
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const OUTPUT_KEYS = ["output", "bibtex", "ris", "csv", "citation"] as const;

function primaryText(value: unknown): string | null {
  const record = recordOf(value);
  if (record === null) return typeof value === "string" ? value : null;
  for (const key of OUTPUT_KEYS) {
    const candidate = record[key];
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

/** Conversion and formatting losses are surfaced, never silently dropped. */
function warningLines(value: unknown): string[] {
  const record = recordOf(value);
  const warnings = record?.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((entry) => {
    if (typeof entry === "string") return entry === "" ? [] : [entry];
    const message = recordOf(entry)?.message;
    return typeof message === "string" && message !== "" ? [message] : [];
  });
}

function countField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * A compact Italian summary of what the run did. A deduplicator that only shows
 * the surviving BibTeX would otherwise hide how many references it removed.
 */
function summaryText(value: unknown): string | null {
  const record = recordOf(value);
  if (record === null) return null;
  const parts: string[] = [];
  const input = countField(record, "inputCount");
  const output = countField(record, "outputCount");
  const removed = countField(record, "removed");
  const rows = countField(record, "rowCount");
  const emptyRows = countField(record, "emptyRowCount");
  const keys = countField(record, "keyCount");
  const collisions = countField(record, "collisions");
  const total = countField(record, "total");
  const unique = countField(record, "unique");
  const invalid = countField(record, "invalidCount");
  const rules = record.rules;
  const count = (value: number, one: string, many: string): string => `${value} ${value === 1 ? one : many}`;
  if (input !== undefined && output !== undefined) parts.push(`${count(input, "voce in ingresso", "voci in ingresso")}, ${count(output, "unico", "univoci")}`);
  if (rows !== undefined) parts.push(count(rows, "riga", "righe"));
  if (keys !== undefined) parts.push(count(keys, "chiave generata", "chiavi generate"));
  if (total !== undefined && unique !== undefined) parts.push(`${count(total, "occorrenza", "occorrenze")}, ${count(unique, "dominio", "domini")}`);
  if (removed !== undefined && removed > 0) parts.push(count(removed, "duplicato rimosso", "duplicati rimossi"));
  if (collisions !== undefined && collisions > 0) parts.push(count(collisions, "chiave con suffisso", "chiavi con suffisso"));
  if (emptyRows !== undefined && emptyRows > 0) parts.push(count(emptyRows, "riga vuota", "righe vuote"));
  if (invalid !== undefined && invalid > 0) parts.push(count(invalid, "valore non valido", "valori non validi"));
  if (Array.isArray(rules) && rules.length > 0) parts.push(`regole: ${rules.filter((rule): rule is string => typeof rule === "string").join(", ")}`);
  const truncated = record.truncated;
  if (truncated === true) parts.push("documento troncato");
  const directives = countField(record, "directiveCount");
  if (directives !== undefined && directives > 0) parts.push(count(directives, "direttiva", "direttive"));
  return parts.length === 0 ? null : parts.join(" · ");
}

function outputText(value: unknown): string {
  const primary = primaryText(value);
  if (primary !== null) return primary;
  const record = recordOf(value);
  const keys: Readonly<Record<string, string>> = {
    valid: "valido",
    normalized: "normalizzato",
    kind: "tipo",
    input: "ingresso",
    records: "record",
    original: "ordine_originale",
    duplicates: "duplicati",
    groups: "gruppi",
    rule: "regola",
    rules: "regole",
    indexes: "indici",
    removed: "rimossi",
    kept: "mantenuti",
    movedCount: "spostati",
    unchanged: "invariato",
    comparator: "confronto",
    comparison: "confronto",
    warnings: "avvisi",
    warning: "avviso",
    message: "messaggio",
    count: "quantità",
    keyCount: "chiavi_generate",
    collisions: "collisioni",
    total: "totale",
    domain: "dominio",
    domains: "domini",
    unique: "unici",
    uniqueUrls: "url_univoci",
    invalid: "non_validi",
    invalidCount: "non_validi_count",
    frequency: "frequenza",
    frequencies: "frequenze",
    terms: "termini",
    term: "termine",
    dates: "date",
    precision: "precisione",
    source: "formato",
    dayFirst: "giorno_primo",
    ambiguous: "ambigua",
    alternativeIso: "data_alternativa",
    checksum: "checksum",
    checksumAlgorithm: "algoritmo_checksum",
    canonicalPayload: "payload_canonico",
    version: "versione",
    tools: "strumenti",
    name: "nome",
    key: "chiave",
    keys: "chiavi",
    entries: "voci",
    entryCount: "voci_count",
    directiveCount: "direttive",
    truncated: "troncato",
    emptyRowCount: "righe_vuote",
    emptyRowIndexes: "righe_vuote_indici",
    headers: "intestazioni",
    pageLabel: "etichetta_pagine",
    pageCount: "pagine",
    stopwordProfile: "percorso_parole_chiave",
    ignoredStopwords: "parole_chiave_ignorate",
    ignoredShortTerms: "termini_corti_ignorati",
    minLength: "lunghezza_minima",
    limit: "limite",
    unknownTags: "tag_sconosciuti",
    unknownFields: "campi_sconosciuti",
    fields: "campi",
    tags: "tag",
  };
  const localize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(localize);
    if (entry === null || typeof entry !== "object") return entry;
    return Object.fromEntries(Object.entries(entry as Record<string, unknown>).map(([key, item]) => [keys[key] ?? key, localize(item)]));
  };
  if (record === null) return String(value ?? "");
  return JSON.stringify(localize(record), null, 2) ?? "";
}

const OPTION_LABEL_IT: Readonly<Record<string, string>> = {
  identifier: "Identificatore",
  "title-author-year": "Titolo, autore e anno",
  exact: "Corrispondenza esatta",
  "ris-to-bibtex": "Da RIS a BibTeX",
  "bibtex-to-ris": "Da BibTeX a RIS",
  author: "Autore",
  year: "Anno",
  title: "Titolo",
  apa: "APA",
  mla: "MLA",
  chicago: "Chicago",
  ascending: "Crescente",
  descending: "Decrescente",
  false: "No",
  true: "Sì",
};

export function ResearchKnowledgeTool({ config }: { config: ResearchKnowledgeToolConfig }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(config.fields.map((field) => [field.name, field.defaultValue ?? ""])));
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: Event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    const run = await toolRuntime.run(config.toolId, values);
    setBusy(false);
    if (!run.ok) {
      setError(friendlyToolErrorIt(run.message || run.code));
      return;
    }
    setResult(run.value);
  }

  function reset() {
    setValues(Object.fromEntries(config.fields.map((field) => [field.name, field.defaultValue ?? ""])));
    setResult(null);
    setError("");
  }

  return (
    <div class="tool-operation" data-tool-id={config.toolId}>
      <form onSubmit={submit}>
        {config.fields.map((field) => {
          const value = values[field.name] ?? "";
          const id = `${config.toolId}-${field.name}`;
          if (field.kind === "select") {
            return (
              <label class="field" for={id} key={field.name}>
                <span>{field.label}</span>
                <select id={id} value={value} onChange={(event) => update(field.name, event.currentTarget.value)}>
                  {(field.options ?? []).map((option) => <option value={option} key={option}>{OPTION_LABEL_IT[option] ?? option}</option>)}
                </select>
              </label>
            );
          }
          if (field.kind === "textarea") {
            return (
              <label class="field" for={id} key={field.name}>
                <span>{field.label}</span>
                <textarea id={id} rows={field.rows ?? 8} value={value} placeholder={field.placeholder} onInput={(event) => update(field.name, event.currentTarget.value)} />
              </label>
            );
          }
          return (
            <label class="field" for={id} key={field.name}>
              <span>{field.label}</span>
              <input id={id} type="text" value={value} placeholder={field.placeholder} onInput={(event) => update(field.name, event.currentTarget.value)} />
            </label>
          );
        })}
        <InlineError message={error} />
        <ToolActions>
          <ToolSubmitButton busy={busy} busyLabel={it(CONTROL.working)}>{config.submitLabel}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={busy} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={config.resultLabel} placeholder="Il risultato deterministico apparirà qui." className="research-result" busy={busy}>
        {result !== null && (
          <>
            {warningLines(result).map((message) => <p class="warning" role="status" key={message}>{message}</p>)}
            {summaryText(result) !== null && <p class="research-method">{summaryText(result)}</p>}
            <pre class="research-output">{outputText(result)}</pre>
          </>
        )}
      </ToolResultPanel>
      <p class="research-method">{config.description}</p>
    </div>
  );
}
