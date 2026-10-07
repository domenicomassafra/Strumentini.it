import { diffText, type DiffOperation } from "../text-list";

const ENGINE_VERSION = "text-writing-v1";
const MAX_TEXT_INPUT = 2 * 1024 * 1024;
const WORD = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;

function objectInput(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_INPUT");
  return value as Record<string, unknown>;
}

function textField(input: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") {
      if (value.length > MAX_TEXT_INPUT) throw new Error("INPUT_TOO_LARGE");
      return value;
    }
  }
  throw new Error("INVALID_INPUT");
}

function optionalPositiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) throw new Error("INVALID_INPUT");
  return parsed;
}

function safeSliceEnd(text: string, start: number, requestedEnd: number): number {
  let end = Math.min(text.length, Math.max(start + 1, requestedEnd));
  if (end < text.length) {
    const previous = text.charCodeAt(end - 1);
    const next = text.charCodeAt(end);
    if (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end -= 1;
  }
  return Math.max(start + 1, end);
}

function chooseSemanticEnd(text: string, start: number, targetCharacters: number): { end: number; boundary: string } {
  const target = safeSliceEnd(text, start, start + targetCharacters);
  if (target >= text.length) return { end: text.length, boundary: "end" };
  const minimum = start + Math.max(1, Math.floor(targetCharacters * 0.55));
  const window = text.slice(start, target);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph >= 0 && start + paragraph + 2 >= minimum) return { end: start + paragraph + 2, boundary: "paragraph" };

  let sentenceEnd = -1;
  for (const match of window.matchAll(/[.!?…](?:[”’"')\]]*)\s+/gu)) {
    const index = match.index ?? -1;
    const candidate = start + index + match[0].length;
    if (candidate >= minimum) sentenceEnd = candidate;
  }
  if (sentenceEnd >= minimum) return { end: sentenceEnd, boundary: "sentence" };

  let whitespaceEnd = -1;
  for (const match of window.matchAll(/\s+/gu)) {
    const index = match.index ?? -1;
    const candidate = start + index + match[0].length;
    if (candidate >= minimum) whitespaceEnd = candidate;
  }
  if (whitespaceEnd >= minimum) return { end: whitespaceEnd, boundary: "whitespace" };
  return { end: target, boundary: "code-point-limit" };
}

export interface SemanticTextChunk {
  readonly number: number;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly boundary: string;
  readonly overlapBefore: { readonly start: number; readonly end: number; readonly text: string } | null;
}

export function restoreSemanticChunks(chunks: readonly SemanticTextChunk[]): string {
  let expectedStart = 0;
  let output = "";
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (chunk === undefined || chunk.number !== index + 1 || chunk.start !== expectedStart || chunk.end !== chunk.start + chunk.text.length) {
      throw new Error("INVALID_CHUNK_SEQUENCE");
    }
    output += chunk.text;
    expectedStart = chunk.end;
  }
  return output;
}

export function chunkSemanticText(value: unknown) {
  const input = objectInput(value);
  const text = textField(input, "text");
  const targetCharacters = optionalPositiveInteger(input.targetCharacters ?? input.chunkSize, 800, 100_000);
  const overlapCharacters = optionalPositiveInteger(input.overlapCharacters ?? input.overlap, 0, 20_000);
  if (targetCharacters < 32 || overlapCharacters >= targetCharacters) throw new Error("INVALID_CHUNK_SIZE");
  const chunks: SemanticTextChunk[] = [];
  let start = 0;
  while (start < text.length) {
    const selected = chooseSemanticEnd(text, start, targetCharacters);
    if (selected.end <= start) throw new Error("INVALID_CHUNK_SEQUENCE");
    const overlapStart = Math.max(0, start - overlapCharacters);
    chunks.push({
      number: chunks.length + 1,
      start,
      end: selected.end,
      text: text.slice(start, selected.end),
      boundary: selected.boundary,
      overlapBefore: overlapCharacters === 0 || start === 0 ? null : {
        start: overlapStart,
        end: start,
        text: text.slice(overlapStart, start),
      },
    });
    start = selected.end;
  }
  const restored = restoreSemanticChunks(chunks);
  return {
    chunks,
    chunkCount: chunks.length,
    targetCharacters,
    overlapCharacters,
    restored,
    exactRoundTrip: restored === text,
    joinPolicy: "Concatenate only each chunk.text in numeric order; overlapBefore is context metadata and is never joined.",
    newlinePolicy: "Source newline code units are preserved exactly; no CR/LF normalization is performed.",
    spanUnit: "UTF-16 code units",
    engineVersion: ENGINE_VERSION,
  };
}

type SensitiveKind = "url" | "date" | "number" | "id";
interface SensitiveMarker {
  readonly kind: SensitiveKind;
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

const SENSITIVE_PATTERNS: readonly [SensitiveKind, RegExp, number][] = [
  ["url", /\bhttps?:\/\/[^\s<>"']+/giu, 4],
  ["date", /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4})\b/gu, 3],
  ["number", /(?<![\p{L}\p{N}_])[-+]?\d+(?:[.,]\d+)*(?:%|‰)?(?![\p{L}\p{N}_])/gu, 2],
  ["id", /\b[\p{L}\p{N}]+(?:[-_:/][\p{L}\p{N}]+)+\b/gu, 1],
] as const;

function sensitiveMarkers(text: string): SensitiveMarker[] {
  const candidates: Array<SensitiveMarker & { priority: number }> = [];
  for (const [kind, pattern, priority] of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const raw = match[0];
      if (kind === "id" && !/\d/u.test(raw)) continue;
      let value = raw;
      if (kind === "url") value = value.replace(/[),.;:!?]+$/u, "");
      if (value === "") continue;
      candidates.push({ kind, value, start, end: start + value.length, priority });
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.priority - a.priority || (b.end - b.start) - (a.end - a.start));
  const accepted: SensitiveMarker[] = [];
  for (const candidate of candidates) {
    if (accepted.some((existing) => candidate.start < existing.end && candidate.end > existing.start)) continue;
    accepted.push({ kind: candidate.kind, value: candidate.value, start: candidate.start, end: candidate.end });
  }
  return accepted.sort((a, b) => a.start - b.start);
}

function markerKey(marker: SensitiveMarker): string {
  return `${marker.kind}\u0000${marker.value}`;
}

function markerDelta(before: readonly SensitiveMarker[], after: readonly SensitiveMarker[]) {
  const rightCounts = new Map<string, number>();
  for (const marker of after) rightCounts.set(markerKey(marker), (rightCounts.get(markerKey(marker)) ?? 0) + 1);
  const removed: SensitiveMarker[] = [];
  for (const marker of before) {
    const key = markerKey(marker);
    const count = rightCounts.get(key) ?? 0;
    if (count > 0) rightCounts.set(key, count - 1);
    else removed.push(marker);
  }
  const leftCounts = new Map<string, number>();
  for (const marker of before) leftCounts.set(markerKey(marker), (leftCounts.get(markerKey(marker)) ?? 0) + 1);
  const added: SensitiveMarker[] = [];
  for (const marker of after) {
    const key = markerKey(marker);
    const count = leftCounts.get(key) ?? 0;
    if (count > 0) leftCounts.set(key, count - 1);
    else added.push(marker);
  }
  return { removed, added };
}

function formattingProjection(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function factSensitiveTextDiff(value: unknown) {
  const input = objectInput(value);
  const before = textField(input, "before", "text", "left");
  const after = textField(input, "after", "secondary", "right");
  const beforeMarkers = sensitiveMarkers(before);
  const afterMarkers = sensitiveMarkers(after);
  const priorityChanges = markerDelta(beforeMarkers, afterMarkers);
  const operations: DiffOperation[] = diffText(before, after);
  const formattingOnly = before !== after && formattingProjection(before) === formattingProjection(after);
  return {
    beforeMarkers,
    afterMarkers,
    priorityChanges,
    sensitiveChangeCount: priorityChanges.removed.length + priorityChanges.added.length,
    formattingOnly,
    operations,
    markerPolicy: "Lexical markers only: HTTP(S) URLs, numeric/date literals and digit-bearing structured IDs. Marker equality is exact after tokenization.",
    formattingPolicy: "Formatting-only means NFC-normalized text differs only by collapsed whitespace.",
    limitation: "This comparison does not verify factual truth. Unchanged markers may still be wrong, incomplete or misleading.",
    engineVersion: ENGINE_VERSION,
  };
}

function fnv64(bytes: Uint8Array, offset: bigint): bigint {
  let hash = offset;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash;
}

function stablePlaceholder(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const left = fnv64(bytes, 0xcbf29ce484222325n).toString(16).padStart(16, "0");
  const right = fnv64(bytes, 0x84222325cbf29ce4n).toString(16).padStart(16, "0");
  return `[[ANON_${left}${right}]]`;
}

function literalReplaceAll(source: string, needle: string, replacement: string): { output: string; count: number } {
  if (needle === "") return { output: source, count: 0 };
  let output = "";
  let cursor = 0;
  let count = 0;
  while (cursor <= source.length) {
    const index = source.indexOf(needle, cursor);
    if (index < 0) break;
    output += source.slice(cursor, index) + replacement;
    cursor = index + needle.length;
    count += 1;
  }
  output += source.slice(cursor);
  return { output, count };
}

export interface PlaceholderMappingEntry {
  readonly placeholder: string;
  readonly value: string;
  readonly count: number;
}

function selectedEntities(input: Record<string, unknown>): string[] {
  const raw = input.entities ?? input.selection;
  const values = typeof raw === "string" ? raw.split(/\r?\n/gu) : Array.isArray(raw) ? raw : null;
  if (values === null || values.some((item) => typeof item !== "string")) throw new Error("INVALID_ENTITY_SELECTION");
  const entities = [...new Set((values as string[]).map((item) => item.trim()).filter(Boolean))];
  if (entities.length === 0 || entities.length > 500) throw new Error("INVALID_ENTITY_SELECTION");
  return entities.sort((a, b) => a.localeCompare(b, "und"));
}

function mappingInput(input: Record<string, unknown>): PlaceholderMappingEntry[] {
  let raw: unknown = input.mapping;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw) as unknown; } catch { throw new Error("INVALID_PLACEHOLDER_MAPPING"); }
  }
  if (!Array.isArray(raw)) throw new Error("INVALID_PLACEHOLDER_MAPPING");
  const entries: PlaceholderMappingEntry[] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) throw new Error("INVALID_PLACEHOLDER_MAPPING");
    const record = candidate as Record<string, unknown>;
    if (typeof record.placeholder !== "string" || typeof record.value !== "string" || typeof record.count !== "number" || !Number.isInteger(record.count) || record.count < 1) throw new Error("INVALID_PLACEHOLDER_MAPPING");
    if (!/^\[\[ANON_[0-9a-f]{32}\]\]$/u.test(record.placeholder) || seen.has(record.placeholder)) throw new Error("INVALID_PLACEHOLDER_MAPPING");
    seen.add(record.placeholder);
    entries.push({ placeholder: record.placeholder, value: record.value, count: record.count });
  }
  if (entries.length === 0) throw new Error("INVALID_PLACEHOLDER_MAPPING");
  return entries;
}

export function stablePlaceholderTransform(value: unknown) {
  const input = objectInput(value);
  const text = textField(input, "text");
  const mode = input.mode ?? "anonymize";
  if (mode !== "anonymize" && mode !== "restore") throw new Error("INVALID_MODE");
  if (mode === "anonymize") {
    const entities = selectedEntities(input);
    const mapping = entities.map((entity) => ({ placeholder: stablePlaceholder(entity), value: entity, count: 0 }));
    if (new Set(mapping.map(({ placeholder }) => placeholder)).size !== mapping.length) throw new Error("PLACEHOLDER_HASH_COLLISION");
    for (const { placeholder } of mapping) if (text.includes(placeholder)) throw new Error("PLACEHOLDER_SOURCE_COLLISION");
    let output = text;
    for (const entry of [...mapping].sort((a, b) => b.value.length - a.value.length || a.value.localeCompare(b.value, "und"))) {
      const replaced = literalReplaceAll(output, entry.value, entry.placeholder);
      entry.count = replaced.count;
      output = replaced.output;
    }
    const usedMapping = mapping.filter(({ count }) => count > 0);
    return {
      mode,
      output,
      mapping: usedMapping,
      mappingJson: JSON.stringify(usedMapping, null, 2),
      selectedEntityCount: entities.length,
      replacedEntityCount: usedMapping.length,
      replacementCount: usedMapping.reduce((sum, entry) => sum + entry.count, 0),
      selectionPolicy: "Entities are supplied explicitly by the user; no model or inferred entity recognition is used.",
      persistence: "Mapping exists only in the local operation result unless the user copies or downloads it.",
      engineVersion: ENGINE_VERSION,
    };
  }

  const mapping = mappingInput(input);
  const known = new Set(mapping.map(({ placeholder }) => placeholder));
  const placeholdersInText = text.match(/\[\[ANON_[^\]]*\]\]/gu) ?? [];
  if (placeholdersInText.some((placeholder) => !known.has(placeholder))) throw new Error("PLACEHOLDER_MUTATED_OR_UNKNOWN");
  let output = text;
  for (const entry of mapping) {
    const count = placeholdersInText.filter((placeholder) => placeholder === entry.placeholder).length;
    if (count !== entry.count) throw new Error("PLACEHOLDER_COUNT_MISMATCH");
    output = literalReplaceAll(output, entry.placeholder, entry.value).output;
  }
  if (/\[\[ANON_/u.test(output)) throw new Error("PLACEHOLDER_RESTORE_INCOMPLETE");
  return {
    mode,
    output,
    mapping,
    restoredPlaceholderCount: mapping.reduce((sum, entry) => sum + entry.count, 0),
    exactValidation: true,
    persistence: "Mapping is consumed locally and is not persisted by the engine.",
    engineVersion: ENGINE_VERSION,
  };
}

const ITALIAN_ABBREVIATIONS = new Set(["art.", "dott.", "dott.ssa.", "ecc.", "ing.", "n.", "pag.", "prof.", "sig.", "sig.ra.", "sig.na.", "sig.re."]);

function italianSentences(text: string): string[] {
  const normalized = text.replace(/\r\n|\r/gu, "\n").trim();
  if (normalized === "") return [];
  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index] ?? "";
    if (character !== "." && character !== "!" && character !== "?" && character !== "…") continue;
    if (character === ".") {
      const prefix = normalized.slice(0, index + 1);
      const token = /([\p{L}.]+\.)$/u.exec(prefix)?.[1]?.toLocaleLowerCase("it") ?? "";
      if (ITALIAN_ABBREVIATIONS.has(token)) continue;
      if (/\d\.\d$/u.test(normalized.slice(Math.max(0, index - 1), index + 2))) continue;
    }
    let end = index + 1;
    while (end < normalized.length && /[.!?…”’"')\]]/u.test(normalized[end] ?? "")) end += 1;
    if (end < normalized.length && !/\s/u.test(normalized[end] ?? "")) continue;
    const sentence = normalized.slice(start, end).trim();
    if (sentence !== "") sentences.push(sentence);
    while (end < normalized.length && /\s/u.test(normalized[end] ?? "")) end += 1;
    start = end;
    index = end - 1;
  }
  const tail = normalized.slice(start).trim();
  if (tail !== "") sentences.push(tail);
  return sentences;
}

function gulpeaseCounts(text: string) {
  const letters = Array.from(text.matchAll(/\p{L}/gu)).length;
  const words = Array.from(text.matchAll(WORD)).length;
  const sentences = italianSentences(text);
  return { letters, words, sentences };
}

function gulpeaseScore(letters: number, words: number, sentences: number): number | null {
  if (words === 0) return null;
  return Math.round((89 + (300 * sentences - 10 * letters) / words) * 10) / 10;
}

export function italianGulpeaseReadability(value: unknown) {
  const input = objectInput(value);
  const text = textField(input, "text");
  const counts = gulpeaseCounts(text);
  if (counts.words === 0) throw new Error("NO_WORDS");
  const score = gulpeaseScore(counts.letters, counts.words, counts.sentences.length)!;
  const contributors = counts.sentences.map((sentence, index) => {
    const item = gulpeaseCounts(sentence);
    return {
      number: index + 1,
      text: sentence,
      letters: item.letters,
      words: item.words,
      score: gulpeaseScore(item.letters, item.words, item.words > 0 ? 1 : 0),
    };
  }).sort((a, b) => (a.score ?? 999) - (b.score ?? 999) || a.number - b.number);
  const interpretation = score >= 80 ? "molto leggibile secondo l'indice" : score >= 60 ? "leggibilità media secondo l'indice" : "testo più impegnativo secondo l'indice";
  return {
    score,
    letters: counts.letters,
    words: counts.words,
    sentences: counts.sentences.length,
    formula: "89 + (300 × frasi − 10 × lettere) ÷ parole",
    interpretation,
    difficultSentenceContributors: contributors.slice(0, 8),
    publishedWorkedExamples: [
      { score: 60, interpretation: "molto difficile con licenza elementare; difficile con licenza media; facile con diploma superiore", source: "Corrige.it, L'indice Gulpease (Lucisano-Piemontese 1988)" },
      { score: 72, interpretation: "difficile con licenza elementare; facile con licenza media; molto facile con diploma superiore", source: "Daniele Fortis, Il linguaggio amministrativo italiano" },
    ],
    tokenPolicy: "Parole: sequenze Unicode di lettere, numeri e segni combinanti, con apostrofo interno; lettere: Unicode Letter.",
    sentencePolicy: `Terminatori . ! ? …; un punto nelle abbreviazioni italiane esplicite (${[...ITALIAN_ABBREVIATIONS].join(" ")}) non chiude la frase.`,
    limitation: `Gulpease misura caratteristiche superficiali di leggibilità; non è un giudizio assoluto su qualità, accuratezza o adeguatezza del testo.${counts.words < 100 ? " Le fonti metodologiche raccomandano campioni di circa 100 parole o più: questo testo è più corto." : ""}`,
    engineVersion: ENGINE_VERSION,
  };
}

const CP1252_SPECIAL = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91],
  [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98],
  [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function cp1252Bytes(text: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const character of text) {
    const code = character.codePointAt(0)!;
    if (code <= 0xff) bytes.push(code);
    else {
      const mapped = CP1252_SPECIAL.get(code);
      if (mapped === undefined) return null;
      bytes.push(mapped);
    }
  }
  return Uint8Array.from(bytes);
}

function mojibakeSignals(text: string): number {
  return Array.from(text.matchAll(/(?:Ã.|Â.|â..|ð.)/gu)).length + Array.from(text.matchAll(/\uFFFD/gu)).length * 2;
}

function changedCodePoints(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const maximum = Math.max(a.length, b.length);
  let changes = 0;
  for (let index = 0; index < maximum; index += 1) if (a[index] !== b[index]) changes += 1;
  return changes;
}

export function repairMojibake(value: unknown) {
  const input = objectInput(value);
  const original = textField(input, "text");
  const beforeSignals = mojibakeSignals(original);
  if (beforeSignals === 0) return {
    original, output: original, changed: false, accepted: false, changeCount: 0,
    transforms: [], warnings: ["Nessun pattern comune UTF-8→Windows-1252 riconosciuto; il testo è lasciato invariato."],
    engineVersion: ENGINE_VERSION,
  };
  const bytes = cp1252Bytes(original);
  if (bytes === null) return {
    original, output: original, changed: false, accepted: false, changeCount: 0,
    transforms: [], warnings: ["Conversione ambigua: alcuni caratteri non sono rappresentabili come Windows-1252. Nessuna modifica applicata."],
    engineVersion: ENGINE_VERSION,
  };
  let decoded: string;
  try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch {
    return {
      original, output: original, changed: false, accepted: false, changeCount: 0,
      transforms: [], warnings: ["Conversione ambigua: i byte Windows-1252 risultanti non formano UTF-8 valido. Nessuna modifica applicata."],
      engineVersion: ENGINE_VERSION,
    };
  }
  const afterSignals = mojibakeSignals(decoded);
  if (decoded === original || afterSignals >= beforeSignals) return {
    original, output: original, changed: false, accepted: false, changeCount: 0,
    transforms: [], warnings: ["La conversione non riduce in modo univoco i segnali di mojibake; nessuna modifica applicata."],
    engineVersion: ENGINE_VERSION,
  };
  return {
    original,
    output: decoded,
    changed: true,
    accepted: true,
    changeCount: changedCodePoints(original, decoded),
    beforeSignals,
    afterSignals,
    transforms: ["Interpreta ogni carattere rappresentabile come byte Windows-1252, poi decodifica l'intera sequenza come UTF-8 rigoroso."],
    warnings: [],
    engineVersion: ENGINE_VERSION,
  };
}

function looksLikeStructuralLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === "" || /^(?:[-*•]\s+|\d+[.)]\s+|#{1,6}\s+|\|)/u.test(trimmed) || /\s{2,}\S/u.test(line);
}

export function reflowPdfCopyText(value: unknown) {
  const input = objectInput(value);
  const original = textField(input, "text");
  const normalized = original.replace(/\r\n|\r/gu, "\n");
  const lines = normalized.split("\n");
  let output = "";
  let joinedLineBreaks = 0;
  let softHyphenRepairs = 0;
  const hyphenationAmbiguities: Array<{ line: number; fragment: string }> = [];
  const warnings = new Set<string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const next = lines[index + 1];
    output += line;
    if (next === undefined) continue;
    if (line === "" || next === "") {
      output += "\n";
      continue;
    }
    if (looksLikeStructuralLine(line) || looksLikeStructuralLine(next)) {
      output += "\n";
      if (/\s{2,}\S/u.test(line) || /\s{2,}\S/u.test(next)) warnings.add("Possibile testo a colonne: i relativi a capo sono stati conservati.");
      continue;
    }
    if (line.endsWith("\u00ad")) {
      output = output.slice(0, -1);
      joinedLineBreaks += 1;
      softHyphenRepairs += 1;
      continue;
    }
    if (/[-‐‑]$/u.test(line) && /^\p{Ll}/u.test(next.trimStart())) {
      joinedLineBreaks += 1;
      hyphenationAmbiguities.push({ line: index + 1, fragment: `${line.slice(-24)}${next.slice(0, 24)}` });
      continue;
    }
    if (/[.!?…:;][”’"')\]]?$/u.test(line.trimEnd()) || /^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ\s\d]{3,}$/u.test(line.trim())) {
      output += "\n";
      continue;
    }
    output += " ";
    joinedLineBreaks += 1;
  }
  return {
    original,
    output,
    changed: output !== original,
    changeCount: joinedLineBreaks + (original === normalized ? 0 : 1),
    joinedLineBreaks,
    softHyphenRepairs,
    hyphenationAmbiguities,
    warnings: [...warnings],
    rules: [
      "Conserva righe vuote, liste, titoli evidenti e righe con separazioni da possibile colonna.",
      "Rimuove solo il soft hyphen U+00AD prima di un a capo; un trattino visibile viene conservato e l'ambiguità viene segnalata.",
      "Gli altri a capo interni al paragrafo diventano un singolo spazio, salvo punteggiatura terminale esplicita.",
    ],
    engineVersion: ENGINE_VERSION,
  };
}

type ExtractedKind = "url" | "phone" | "hashtag" | "mention";
interface ExtractedMatch {
  readonly kind: ExtractedKind;
  readonly original: string;
  readonly normalized: string;
  readonly start: number;
  readonly end: number;
  readonly codePointStart: number;
  readonly codePointEnd: number;
}

const EXTRACT_PATTERNS: readonly [ExtractedKind, RegExp, number][] = [
  ["url", /\bhttps?:\/\/[^\s<>"']+/giu, 4],
  ["phone", /(?:\+\d{1,3}[\s().-]*)?(?:\d[\s().-]*){6,14}\d/gu, 3],
  ["hashtag", /#[\p{L}\p{N}_][\p{L}\p{N}\p{M}_]*/gu, 2],
  ["mention", /@[\p{L}\p{N}_][\p{L}\p{N}\p{M}._-]*/gu, 1],
] as const;

function normalizeExtracted(kind: ExtractedKind, original: string): string {
  if (kind === "phone") {
    const plus = original.trimStart().startsWith("+") ? "+" : "";
    return plus + original.replace(/\D/gu, "");
  }
  return original.normalize("NFC");
}

function codePointOffset(text: string, utf16Offset: number): number {
  return Array.from(text.slice(0, utf16Offset)).length;
}

function csvCell(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

export function extractPhoneLinkHashtagMention(value: unknown) {
  const input = objectInput(value);
  const text = textField(input, "text");
  const candidates: Array<{ kind: ExtractedKind; original: string; start: number; end: number; priority: number }> = [];
  for (const [kind, pattern, priority] of EXTRACT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      let original = match[0];
      const start = match.index ?? 0;
      if (kind === "url") original = original.replace(/[),.;:!?]+$/u, "");
      if (kind === "phone") {
        const digits = original.replace(/\D/gu, "");
        if (digits.length < 7 || digits.length > 15) continue;
        if (!original.startsWith("+") && !/[\s().-]/u.test(original)) continue;
      }
      if (kind === "mention" && start > 0 && /[\p{L}\p{N}._%+-]/u.test(text[start - 1] ?? "")) continue;
      candidates.push({ kind, original, start, end: start + original.length, priority });
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.priority - a.priority || (b.end - b.start) - (a.end - a.start));
  const matches: ExtractedMatch[] = [];
  for (const candidate of candidates) {
    if (matches.some((existing) => candidate.start < existing.end && candidate.end > existing.start)) continue;
    matches.push({
      kind: candidate.kind,
      original: candidate.original,
      normalized: normalizeExtracted(candidate.kind, candidate.original),
      start: candidate.start,
      end: candidate.end,
      codePointStart: codePointOffset(text, candidate.start),
      codePointEnd: codePointOffset(text, candidate.end),
    });
  }
  matches.sort((a, b) => a.start - b.start);
  const grouped = Object.fromEntries((["phone", "url", "hashtag", "mention"] as const).map((kind) => [kind, matches.filter((match) => match.kind === kind)]));
  const csv = ["type,original,normalized,start_utf16,end_utf16,start_codepoint,end_codepoint", ...matches.map((match) => [
    match.kind, match.original, match.normalized, String(match.start), String(match.end), String(match.codePointStart), String(match.codePointEnd),
  ].map(csvCell).join(","))].join("\n");
  return {
    matches,
    grouped,
    csv,
    count: matches.length,
    overlapPolicy: "Earliest source start wins; at the same start URL > phone > hashtag > mention, then the longest candidate wins.",
    spanPolicy: "start/end are UTF-16 code-unit offsets; codePointStart/codePointEnd are also provided for Unicode-safe display.",
    normalizationPolicy: "Phone normalization keeps an explicit leading + and decimal digits only; other matches use Unicode NFC without changing visible punctuation.",
    limitations: ["Phone matching is locale-neutral and intentionally conservative; a syntactic match is not proof that a number exists.", "URLs, hashtags and mentions are lexical matches and are not fetched or verified."],
    engineVersion: ENGINE_VERSION,
  };
}
