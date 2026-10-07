import { useEffect, useMemo, useState } from "preact/hooks";
import { createBoundedTablePreview, createBoundedTextPreview } from "../../../runtime/bounded-preview";
import { createOutputArtifactDescriptor, type OutputArtifactDescriptor } from "../../../runtime/output-artifact";
import { resolveResultActions } from "../../../runtime/result-actions";
import { textResultV2Declaration, type TextResultV2ToolId } from "../../../tools/text-writing/result-v2";
import {
  BoundedTableResultPreview,
  BoundedTextResultPreview,
  ResultActions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
} from "../shared";

interface ResultRow {
  readonly label: string;
  readonly value: string;
}

interface ResultTable {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface TextResultPresentation {
  readonly fullText: string;
  readonly filename: string;
  readonly mime: string;
  readonly headline: string;
  readonly interpretation: string;
  readonly interpretationState: "success" | "warning" | "info";
  readonly summaryRows: readonly ResultRow[];
  readonly table: ResultTable | null;
  readonly showTextPreview: boolean;
  readonly renderedMarkdownHtml: string | null;
  readonly reuseText: string | null;
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  return typeof record[key] === "string" ? record[key] as string : null;
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  return typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] as number : null;
}

function booleanField(record: Record<string, unknown>, key: string): boolean | null {
  return typeof record[key] === "boolean" ? record[key] as boolean : null;
}

function stringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function displayBoolean(value: boolean): string {
  return value ? "Sì" : "No";
}

function row(label: string, value: unknown): ResultRow | null {
  if (typeof value === "number" && Number.isFinite(value)) return { label, value: String(value) };
  if (typeof value === "string" && value !== "") return { label, value };
  if (typeof value === "boolean") return { label, value: displayBoolean(value) };
  return null;
}

function compactRows(rows: readonly (ResultRow | null)[]): readonly ResultRow[] {
  return rows.filter((item): item is ResultRow => item !== null);
}

function reportText(rows: readonly ResultRow[]): string {
  return rows.map(({ label, value }) => `${label}: ${value}`).join("\n");
}

function listSection(label: string, values: readonly string[]): string {
  return `${label} (${values.length})\n${values.join("\n")}`;
}

function transformedText(tool: TextResultV2ToolId, result: Record<string, unknown>): string | null {
  if (tool === "list-intersection") return stringArray(result, "intersection").join("\n");
  if (tool === "list-difference") return stringArray(result, "difference").join("\n");
  if (tool === "slug-generator") return stringField(result, "slug");
  for (const key of ["output", "csv", "list", "data", "cleanText", "html"]) {
    const value = stringField(result, key);
    if (value !== null) return value;
  }
  return null;
}

function safePreviewHtml(value: string): string | null {
  if (typeof DOMParser === "undefined") return null;
  const tags = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "strong", "em", "del", "code", "pre", "blockquote", "ul", "ol", "li", "hr", "a"]);
  const parsed = new DOMParser().parseFromString(`<body>${value}</body>`, "text/html");
  for (const element of [...parsed.body.querySelectorAll("*")]) {
    const tag = element.tagName.toLowerCase();
    if (!tags.has(tag)) {
      element.remove();
      continue;
    }
    for (const attribute of [...element.attributes]) {
      if (tag === "a" && (attribute.name === "href" || attribute.name === "rel")) continue;
      element.removeAttribute(attribute.name);
    }
    if (tag !== "a") continue;
    const href = element.getAttribute("href");
    if (href === null) continue;
    try {
      const protocol = new URL(href, "https://preview.invalid/").protocol;
      if (!new Set(["http:", "https:", "mailto:", "tel:"]).has(protocol)) element.removeAttribute("href");
    } catch {
      element.removeAttribute("href");
    }
  }
  return parsed.body.innerHTML;
}

function wordCountPresentation(result: Record<string, unknown>): { rows: readonly ResultRow[]; table: ResultTable } {
  const rows = compactRows([
    row("Parole", result.words),
    row("Caratteri", result.characters),
    row("Punti di codice", result.codePoints),
    row("Graphemi", result.graphemeClusters),
    row("Caratteri senza spazi", result.charactersWithoutSpaces),
    row("Righe", result.lines),
    row("Paragrafi", result.paragraphs),
    row("Byte UTF-8", result.bytes),
  ]);
  return { rows, table: { headers: ["Metrica", "Valore"], rows: rows.map(({ label, value }) => [label, value]) } };
}

function readingPresentation(result: Record<string, unknown>): { rows: readonly ResultRow[]; table: ResultTable } {
  const rows = compactRows([
    row("Parole", result.words),
    row("Parole al minuto", result.wordsPerMinute),
    row("Minuti arrotondati", result.minutes),
    row("Secondi stimati", result.seconds),
  ]);
  return { rows, table: { headers: ["Metrica", "Valore"], rows: rows.map(({ label, value }) => [label, value]) } };
}

function languagePresentation(result: Record<string, unknown>): { rows: readonly ResultRow[]; table: ResultTable } {
  const rows = compactRows([
    row("Lingua stimata", result.detectedLanguage ?? result.language),
    row("Alfabeto dominante", result.dominantScript),
    row("Affidabilità", result.confidence),
    row("Parole", result.words),
    row("Caratteri", result.characters),
    row("Frasi", result.sentences),
  ]);
  const scripts = Array.isArray(result.scripts) ? result.scripts : [];
  const tableRows = [...rows.map(({ label, value }) => [label, value] as const)];
  for (const item of scripts) {
    const script = recordOf(item);
    const name = stringField(script, "script");
    const count = numberField(script, "codePoints");
    const percentage = numberField(script, "percentage");
    if (name !== null && count !== null) {
      tableRows.push([`Alfabeto · ${name}`, percentage === null ? String(count) : `${count} · ${(percentage * 100).toFixed(1)}%`]);
    }
  }
  return { rows, table: { headers: ["Metrica", "Valore"], rows: tableRows } };
}

function markdownTablePresentation(result: Record<string, unknown>): ResultTable {
  const table = recordOf(result.table);
  const headers = Array.isArray(table.headers) && table.headers.every((item) => typeof item === "string") ? table.headers : [];
  const rows = Array.isArray(table.rows)
    ? table.rows.filter((item): item is string[] => Array.isArray(item) && item.every((cell) => typeof cell === "string"))
    : [];
  return headers.length === 0
    ? { headers: ["Esito"], rows: [["Nessuna tabella Markdown riconosciuta"]] }
    : { headers, rows };
}

function csvTablePresentation(result: Record<string, unknown>): ResultTable {
  const headers = stringArray(result, "headers");
  const rows = Array.isArray(result.rows)
    ? result.rows.filter((item): item is string[] => Array.isArray(item) && item.every((cell) => typeof cell === "string"))
    : [];
  return { headers: headers.length === 0 ? ["Valore"] : headers, rows };
}

function listComparePresentation(result: Record<string, unknown>): { fullText: string; rows: readonly ResultRow[]; table: ResultTable } {
  const groups = [
    ["In entrambe", stringArray(result, "intersection")],
    ["Solo in A", stringArray(result, "onlyLeft")],
    ["Solo in B", stringArray(result, "onlyRight")],
    ["A senza duplicati", stringArray(result, "leftDeduped")],
    ["B senza duplicati", stringArray(result, "rightDeduped")],
  ] as const;
  const rows = groups.map(([label, values]) => ({ label, value: String(values.length) }));
  const tableRows = groups.flatMap(([label, values]) => values.length === 0
    ? [[label, "(nessuno)"]]
    : values.map((value) => [label, value]));
  return {
    fullText: groups.map(([label, values]) => listSection(label, values)).join("\n\n"),
    rows,
    table: { headers: ["Gruppo", "Valore"], rows: tableRows },
  };
}

function textDiffPresentation(result: Record<string, unknown>): { fullText: string; rows: readonly ResultRow[]; table: ResultTable } {
  const operations = Array.isArray(result.operations) ? result.operations : [];
  const tableRows: string[][] = [];
  const report: string[] = [];
  for (const entry of operations) {
    const operation = recordOf(entry);
    const kind = stringField(operation, "kind");
    const text = stringField(operation, "text") ?? "";
    const label = kind === "remove" ? "Rimossa" : kind === "add" ? "Aggiunta" : "Invariata";
    const prefix = kind === "remove" ? "-" : kind === "add" ? "+" : "=";
    tableRows.push([label, text.replace(/\n$/u, "") || "(riga vuota)"]);
    report.push(`${prefix} ${text.replace(/\n$/u, "")}`);
  }
  const rows = compactRows([
    row("Aggiunte", result.additions),
    row("Rimosse", result.removals),
    row("Invariate", result.unchanged),
  ]);
  return { fullText: report.join("\n"), rows, table: { headers: ["Stato", "Testo"], rows: tableRows } };
}

export function buildTextResultPresentation(tool: TextResultV2ToolId, value: unknown): TextResultPresentation {
  const result = recordOf(value);
  const declaration = textResultV2Declaration(tool);
  let fullText = transformedText(tool, result) ?? "";
  let headline = "Risultato pronto";
  let interpretation = "Il risultato completo resta nel browser ed è disponibile nelle azioni qui sotto.";
  let interpretationState: TextResultPresentation["interpretationState"] = "success";
  let summaryRows: readonly ResultRow[] = [];
  let table: ResultTable | null = null;
  let showTextPreview = declaration.class === "text-code";
  let renderedMarkdownHtml: string | null = null;
  let filename = `${tool}-risultato.txt`;
  let mime = "text/plain";

  if (tool === "word-character-line-counter") {
    const presentation = wordCountPresentation(result);
    summaryRows = presentation.rows;
    table = presentation.table;
    fullText = reportText(summaryRows);
    headline = `${numberField(result, "words") ?? 0} parole`;
  } else if (tool === "reading-time-estimator") {
    const presentation = readingPresentation(result);
    summaryRows = presentation.rows;
    table = presentation.table;
    fullText = reportText(summaryRows);
    headline = stringField(result, "display") ?? `${numberField(result, "minutes") ?? 0} min`;
  } else if (tool === "language-aware-text-statistics") {
    const presentation = languagePresentation(result);
    summaryRows = presentation.rows;
    table = presentation.table;
    fullText = reportText(summaryRows);
    headline = `Lingua stimata: ${stringField(result, "detectedLanguage") ?? stringField(result, "language") ?? "und"}`;
    interpretation = "La lingua è un segnale euristico; conteggi e alfabeti sono calcolati localmente sul testo fornito.";
    interpretationState = "info";
  } else if (tool === "markdown-table-formatter") {
    table = markdownTablePresentation(result);
    showTextPreview = true;
    filename = "tabella-formattata.md";
    mime = "text/markdown";
    const warnings = Array.isArray(result.warnings) ? result.warnings.length : 0;
    summaryRows = compactRows([
      row("Colonne", table.headers.length),
      row("Righe", table.rows.length),
      warnings > 0 ? row("Avvisi", warnings) : null,
    ]);
    headline = table.headers.length > 1 || table.rows.length > 0 ? "Tabella formattata" : "Nessuna tabella trovata";
    interpretationState = warnings > 0 ? "warning" : "success";
  } else if (tool === "text-to-csv-rows") {
    table = csvTablePresentation(result);
    showTextPreview = true;
    filename = "righe.csv";
    mime = "text/csv";
    summaryRows = compactRows([row("Righe", result.rowCount), row("Colonne", result.columnCount)]);
    headline = `${numberField(result, "rowCount") ?? 0} righe CSV`;
  } else if (tool === "list-compare") {
    const presentation = listComparePresentation(result);
    fullText = presentation.fullText;
    summaryRows = presentation.rows;
    table = presentation.table;
    headline = `${stringArray(result, "intersection").length} elementi in comune`;
  } else if (tool === "text-diff") {
    const presentation = textDiffPresentation(result);
    fullText = presentation.fullText;
    summaryRows = presentation.rows;
    table = presentation.table;
    headline = `${(numberField(result, "additions") ?? 0) + (numberField(result, "removals") ?? 0)} modifiche`;
  } else if (tool === "invisible-character-detector") {
    const characters = Array.isArray(result.characters) ? result.characters : [];
    const findingRows = characters.map((entry) => {
      const finding = recordOf(entry);
      return [
        stringField(finding, "codePoint") ?? "—",
        stringField(finding, "name") ?? "—",
        String(numberField(finding, "offset") ?? 0),
      ];
    });
    const count = numberField(result, "count") ?? findingRows.length;
    table = { headers: ["Codice", "Nome", "Offset"], rows: findingRows };
    summaryRows = [{ label: "Caratteri invisibili", value: String(count) }];
    headline = count === 0 ? "Nessun carattere invisibile" : `${count} caratteri invisibili`;
    interpretation = count === 0
      ? "Il controllo locale non ha trovato caratteri di formato invisibili noti."
      : "Sono presenti caratteri invisibili: verifica gli offset prima di riutilizzare il testo ripulito.";
    interpretationState = count === 0 ? "success" : "warning";
    showTextPreview = true;
  } else if (tool === "semantic-text-chunker") {
    const chunks = Array.isArray(result.chunks) ? result.chunks : [];
    table = {
      headers: ["#", "Intervallo UTF-16", "Confine", "Contesto overlap", "Testo"],
      rows: chunks.map((entry) => {
        const chunk = recordOf(entry);
        const overlap = recordOf(chunk.overlapBefore);
        return [
          String(numberField(chunk, "number") ?? 0),
          `${numberField(chunk, "start") ?? 0}–${numberField(chunk, "end") ?? 0}`,
          stringField(chunk, "boundary") ?? "—",
          stringField(overlap, "text") ?? "—",
          stringField(chunk, "text") ?? "",
        ];
      }),
    };
    fullText = JSON.stringify(chunks, null, 2);
    filename = "chunk-semantici.json";
    mime = "application/json";
    summaryRows = compactRows([row("Chunk", result.chunkCount), row("Round-trip esatto", result.exactRoundTrip), row("Dimensione obiettivo", result.targetCharacters), row("Overlap", result.overlapCharacters)]);
    headline = `${numberField(result, "chunkCount") ?? 0} chunk · round-trip ${booleanField(result, "exactRoundTrip") ? "esatto" : "non valido"}`;
    interpretation = `${stringField(result, "joinPolicy") ?? ""} ${stringField(result, "newlinePolicy") ?? ""}`.trim();
    interpretationState = booleanField(result, "exactRoundTrip") === true ? "success" : "warning";
  } else if (tool === "fact-sensitive-text-diff") {
    const priority = recordOf(result.priorityChanges);
    const removed = Array.isArray(priority.removed) ? priority.removed : [];
    const added = Array.isArray(priority.added) ? priority.added : [];
    table = {
      headers: ["Stato", "Tipo", "Valore", "Offset"],
      rows: [
        ...removed.map((entry) => { const item = recordOf(entry); return ["Rimosso", stringField(item, "kind") ?? "—", stringField(item, "value") ?? "", String(numberField(item, "start") ?? 0)]; }),
        ...added.map((entry) => { const item = recordOf(entry); return ["Aggiunto", stringField(item, "kind") ?? "—", stringField(item, "value") ?? "", String(numberField(item, "start") ?? 0)]; }),
      ],
    };
    summaryRows = compactRows([row("Marker sensibili cambiati", result.sensitiveChangeCount), row("Solo formattazione", result.formattingOnly)]);
    headline = `${numberField(result, "sensitiveChangeCount") ?? 0} marker lessicali cambiati`;
    interpretation = stringField(result, "limitation") ?? "Il confronto evidenzia segnali lessicali e non verifica i fatti.";
    interpretationState = (numberField(result, "sensitiveChangeCount") ?? 0) > 0 ? "warning" : "info";
    fullText = [...removed.map((entry) => `- ${stringField(recordOf(entry), "kind") ?? "marker"}: ${stringField(recordOf(entry), "value") ?? ""}`), ...added.map((entry) => `+ ${stringField(recordOf(entry), "kind") ?? "marker"}: ${stringField(recordOf(entry), "value") ?? ""}`)].join("\n");
  } else if (tool === "stable-placeholder-anonymizer") {
    const mapping = Array.isArray(result.mapping) ? result.mapping : [];
    table = {
      headers: ["Segnaposto", "Valore", "Occorrenze"],
      rows: mapping.map((entry) => { const item = recordOf(entry); return [stringField(item, "placeholder") ?? "—", stringField(item, "value") ?? "", String(numberField(item, "count") ?? 0)]; }),
    };
    showTextPreview = true;
    summaryRows = compactRows([row("Modalità", result.mode), row("Sostituzioni", result.replacementCount ?? result.restoredPlaceholderCount), row("Validazione esatta", result.exactValidation)]);
    headline = stringField(result, "mode") === "restore" ? "Segnaposto ripristinati" : "Testo anonimizzato";
    interpretation = stringField(result, "persistence") ?? "La mappatura resta locale all'operazione.";
    interpretationState = "info";
  } else if (tool === "italian-gulpease-readability") {
    const contributors = Array.isArray(result.difficultSentenceContributors) ? result.difficultSentenceContributors : [];
    table = {
      headers: ["Frase", "Gulpease", "Parole", "Lettere", "Testo"],
      rows: contributors.map((entry) => { const item = recordOf(entry); return [String(numberField(item, "number") ?? 0), String(numberField(item, "score") ?? "—"), String(numberField(item, "words") ?? 0), String(numberField(item, "letters") ?? 0), stringField(item, "text") ?? ""]; }),
    };
    summaryRows = compactRows([row("Indice Gulpease", result.score), row("Lettere", result.letters), row("Parole", result.words), row("Frasi", result.sentences), row("Formula", result.formula)]);
    headline = `Gulpease ${numberField(result, "score") ?? "—"}`;
    interpretation = `${stringField(result, "interpretation") ?? ""}. ${stringField(result, "limitation") ?? ""}`;
    interpretationState = "info";
    fullText = reportText(summaryRows);
  } else if (tool === "mojibake-repair" || tool === "pdf-copy-text-reflow") {
    const original = stringField(result, "original") ?? "";
    const output = stringField(result, "output") ?? original;
    table = {
      headers: ["Versione", "Testo"],
      rows: [["Prima", original], ["Dopo", output]],
    };
    showTextPreview = true;
    summaryRows = compactRows([
      row("Modificato", result.changed),
      row("Modifiche", result.changeCount),
      row("Riparazione accettata", result.accepted),
      row("A capo ricomposti", result.joinedLineBreaks),
      row("Soft hyphen rimossi", result.softHyphenRepairs),
      row("Ambiguità di sillabazione", Array.isArray(result.hyphenationAmbiguities) ? result.hyphenationAmbiguities.length : undefined),
    ]);
    headline = tool === "mojibake-repair"
      ? (booleanField(result, "accepted") === true ? "Riparazione applicata" : "Testo lasciato invariato")
      : `${numberField(result, "joinedLineBreaks") ?? 0} a capo ricomposti`;
    const warnings = stringArray(result, "warnings");
    const transforms = stringArray(result, "transforms");
    interpretation = [...transforms, ...warnings].join(" ") || (tool === "pdf-copy-text-reflow" ? "Confronta sempre prima e dopo: i trattini visibili ambigui vengono conservati." : "Nessuna trasformazione ambigua viene applicata automaticamente.");
    interpretationState = warnings.length > 0 ? "warning" : "info";
  } else if (tool === "phone-link-hashtag-mention-extractor") {
    const matches = Array.isArray(result.matches) ? result.matches : [];
    table = {
      headers: ["Tipo", "Originale", "Normalizzato", "UTF-16", "Code point"],
      rows: matches.map((entry) => { const item = recordOf(entry); return [stringField(item, "kind") ?? "—", stringField(item, "original") ?? "", stringField(item, "normalized") ?? "", `${numberField(item, "start") ?? 0}–${numberField(item, "end") ?? 0}`, `${numberField(item, "codePointStart") ?? 0}–${numberField(item, "codePointEnd") ?? 0}`]; }),
    };
    summaryRows = compactRows([row("Corrispondenze", result.count)]);
    headline = `${numberField(result, "count") ?? 0} elementi estratti`;
    interpretation = "Le corrispondenze sono lessicali e locali; numeri, URL e account non vengono verificati in rete.";
    interpretationState = "info";
    fullText = stringField(result, "csv") ?? "";
    filename = "riferimenti-estratti.csv";
    mime = "text/csv";
  } else {
    summaryRows = compactRows([
      row("Modificato", booleanField(result, "changed")),
      row("Righe", result.lineCount),
      row("Duplicati rimossi", result.removedCount),
      row("Corrispondenze", result.matchCount),
      row("Virgolette convertite", result.convertedCount),
      row("Elementi", result.count),
      row("Righe dati", result.rowCount),
      row("Colonna", result.column),
      row("Forma", result.form),
      row("Direzione", result.direction),
      row("Seme", result.seed),
      row("Tipo", result.type),
      row("Modifiche", result.changeCount),
      row("Riparazione accettata", result.accepted),
      row("A capo ricomposti", result.joinedLineBreaks),
      row("Ambiguità di sillabazione", Array.isArray(result.hyphenationAmbiguities) ? result.hyphenationAmbiguities.length : undefined),
    ]);
    if (tool === "markdown-preview") {
      filename = "anteprima-markdown.html";
      mime = "text/html";
      renderedMarkdownHtml = safePreviewHtml(fullText);
      const warnings = Array.isArray(result.warnings) ? result.warnings.length : 0;
      if (warnings > 0) {
        summaryRows = [...summaryRows, { label: "Avvisi", value: String(warnings) }];
        interpretation = "L'HTML generato è mostrato con il sottoinsieme sicuro del renderer; eventuale HTML grezzo è stato neutralizzato.";
        interpretationState = "warning";
      }
    } else if (tool === "csv-column-to-list") {
      headline = `${numberField(result, "rowCount") ?? 0} valori estratti`;
    } else if (tool === "line-deduplicator") {
      headline = `${numberField(result, "keptCount") ?? 0} righe uniche`;
    } else if (tool === "list-intersection" || tool === "list-difference") {
      headline = `${numberField(result, "count") ?? 0} elementi`;
    } else if (tool === "find-replace-preview") {
      headline = `${numberField(result, "matchCount") ?? 0} sostituzioni`;
    } else if (tool === "slug-generator") {
      headline = fullText === "" ? "Slug vuoto" : "Slug pronto";
    }
  }

  const canReuse = declaration.capabilities.includes("reuse");
  return {
    fullText,
    filename,
    mime,
    headline,
    interpretation,
    interpretationState,
    summaryRows,
    table,
    showTextPreview,
    renderedMarkdownHtml,
    reuseText: canReuse ? fullText : null,
  };
}

export function createTextResultArtifact(presentation: TextResultPresentation): OutputArtifactDescriptor {
  return createOutputArtifactDescriptor({
    kind: "text",
    name: presentation.filename,
    mime: presentation.mime,
    bytes: new TextEncoder().encode(presentation.fullText),
    verification: {
      state: "verified",
      verifiedMime: presentation.mime,
      method: "UTF-8 serialization of the completed deterministic local result",
    },
    fidelity: "lossless",
    fidelityNote: "Copy and download use the complete UTF-8 result, not the bounded preview.",
  });
}

function downloadArtifact(artifact: OutputArtifactDescriptor): void {
  if (!artifact.download.ready) return;
  const blob = new Blob([artifact.bytes.slice().buffer], { type: artifact.mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.download.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface TextFamilyResultV2Props {
  readonly tool: TextResultV2ToolId;
  readonly value: unknown;
  readonly onReuse?: (text: string) => void;
  readonly onRetry?: () => void;
  readonly onReset: () => void;
}

export function TextFamilyResultV2({ tool, value, onReuse, onRetry, onReset }: TextFamilyResultV2Props) {
  const [actionStatus, setActionStatus] = useState("");
  const declaration = textResultV2Declaration(tool);
  const presentation = useMemo(() => buildTextResultPresentation(tool, value), [tool, value]);
  const artifact = useMemo(() => createTextResultArtifact(presentation), [presentation]);
  const textPreview = useMemo(
    () => presentation.showTextPreview ? createBoundedTextPreview(artifact, 80, presentation.mime === "text/html" ? "code" : "text") : null,
    [artifact, presentation.mime, presentation.showTextPreview],
  );
  const tablePreview = useMemo(
    () => presentation.table === null ? null : createBoundedTablePreview(artifact, presentation.table.headers, presentation.table.rows, 80),
    [artifact, presentation.table],
  );
  const actions = useMemo(() => resolveResultActions({
    declaration,
    primary: "copy",
    hasCopyPayload: true,
    artifact,
    reuseReady: presentation.reuseText !== null && onReuse !== undefined,
    retryReady: declaration.class === "validator" && onRetry !== undefined,
    resetReady: true,
  }), [artifact, declaration, onRetry, onReuse, presentation.reuseText]);

  useEffect(() => setActionStatus(""), [value]);

  async function copyResult(): Promise<void> {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona l'anteprima e copia manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(presentation.fullText);
      setActionStatus("Risultato completo copiato.");
    } catch {
      setActionStatus("L'accesso agli appunti è stato bloccato; seleziona l'anteprima e copia manualmente.");
    }
  }

  function reuseResult(): void {
    if (presentation.reuseText === null || onReuse === undefined) return;
    onReuse(presentation.reuseText);
    setActionStatus("Risultato riutilizzato come input.");
  }

  return (
    <>
      <ResultExplanation
        primary={<ResultPrimaryAnswer label={declaration.class === "validator" ? "Esito" : "Risultato"}>{presentation.headline}</ResultPrimaryAnswer>}
        interpretation={<ResultInterpretation state={presentation.interpretationState}>{presentation.interpretation}</ResultInterpretation>}
        breakdown={presentation.summaryRows.length === 0 ? undefined : <ResultBreakdown rows={presentation.summaryRows} />}
        provenance={<ResultProvenance>Elaborazione locale deterministica; copy e download usano il risultato completo.</ResultProvenance>}
      />
      {presentation.renderedMarkdownHtml !== null && (
        <section aria-label="Anteprima Markdown">
          <div class="markdown-output" dangerouslySetInnerHTML={{ __html: presentation.renderedMarkdownHtml }} />
        </section>
      )}
      {tablePreview !== null && <BoundedTableResultPreview preview={tablePreview} />}
      {textPreview !== null && <BoundedTextResultPreview preview={textPreview} />}
      <ResultActions
        actions={actions}
        onAction={{
          copy: copyResult,
          download: () => downloadArtifact(artifact),
          reuse: reuseResult,
          ...(onRetry === undefined ? {} : { retry: onRetry }),
          reset: onReset,
        }}
      />
      {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
    </>
  );
}
