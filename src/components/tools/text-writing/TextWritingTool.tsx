import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import {
  InlineError,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "../shared";
import { CONTROL, it } from "../shared/controlLabels";
import { gutterStateFor } from "../shared/ToolGutter";

export type TextWritingToolId =
  | "word-character-line-counter"
  | "reading-time-estimator"
  | "case-converter"
  | "whitespace-normalizer"
  | "invisible-character-detector"
  | "unicode-normalizer"
  | "smart-quote-normalizer"
  | "line-sorter"
  | "line-deduplicator"
  | "list-intersection"
  | "list-difference"
  | "find-replace-preview"
  | "markdown-preview"
  | "markdown-table-formatter"
  | "slug-generator"
  | "text-to-csv-rows"
  | "csv-column-to-list"
  | "lorem-sample-data-generator"
  | "language-aware-text-statistics";

interface TextWritingToolProps {
  tool: TextWritingToolId;
}

type Equality = "exact" | "trim" | "nfc" | "trim-nfc";
type CaseMode = "lower" | "upper" | "title" | "sentence" | "camel" | "pascal" | "kebab" | "snake" | "constant";
type SampleType = "lorem" | "words" | "sentences" | "paragraphs" | "names" | "emails" | "numbers" | "rows";

const TOOL_LABELS: Record<TextWritingToolId, string> = {
  "word-character-line-counter": "Conta testo",
  "reading-time-estimator": "Stima tempo di lettura",
  "case-converter": "Converti stile del testo",
  "whitespace-normalizer": "Normalizza spazi",
  "invisible-character-detector": "Analizza caratteri invisibili",
  "unicode-normalizer": "Normalizza Unicode",
  "smart-quote-normalizer": "Normalizza virgolette",
  "line-sorter": "Ordina righe",
  "line-deduplicator": "Rimuovi righe duplicate",
  "list-intersection": "Trova elementi comuni",
  "list-difference": "Trova differenze",
  "find-replace-preview": "Mostra anteprima sostituzione",
  "markdown-preview": "Mostra anteprima Markdown",
  "markdown-table-formatter": "Formatta tabella Markdown",
  "slug-generator": "Genera slug",
  "text-to-csv-rows": "Converti in CSV",
  "csv-column-to-list": "Estrai colonna",
  "lorem-sample-data-generator": "Genera dati di esempio",
  "language-aware-text-statistics": "Analizza il testo",
};

const CASE_LABELS: Readonly<Record<CaseMode, string>> = {
  lower: "minuscolo",
  upper: "MAIUSCOLO",
  title: "Stile titolo",
  sentence: "Stile frase",
  camel: "camelCase",
  pascal: "PascalCase",
  kebab: "kebab-case",
  snake: "snake_case",
  constant: "CONSTANT_CASE",
};

const EQUALITY_LABELS: Readonly<Record<Equality, string>> = {
  exact: "Corrispondenza esatta",
  trim: "Ignora spazi ai bordi",
  nfc: "Normalizza Unicode NFC",
  "trim-nfc": "Spazi ai bordi + Unicode NFC",
};

const SAMPLE_TYPE_LABELS: Readonly<Record<SampleType, string>> = {
  lorem: "Testo Lorem ipsum",
  words: "Parole",
  sentences: "Frasi",
  paragraphs: "Paragrafi",
  names: "Nomi",
  emails: "Indirizzi email",
  numbers: "Numeri",
  rows: "Righe",
};

function isTextTool(tool: TextWritingToolId): boolean {
  return tool !== "csv-column-to-list" && tool !== "lorem-sample-data-generator";
}

function isListPair(tool: TextWritingToolId): boolean {
  return tool === "list-intersection" || tool === "list-difference";
}

function inputFor(tool: TextWritingToolId, values: {
  text: string;
  secondary: string;
  find: string;
  replace: string;
  mode: string;
  equality: Equality;
  form: string;
  direction: string;
  descending: boolean;
  caseSensitive: boolean;
  regex: boolean;
  delimiter: string;
  column: string;
  count: string;
  seed: string;
  sampleType: SampleType;
  preserveBlankLines: boolean;
  hasHeader: boolean;
  separator: "-" | "_";
  lowercase: boolean;
  maxLength: string;
}): Record<string, unknown> {
  if (tool === "csv-column-to-list") {
    const input: Record<string, unknown> = { csv: values.text, hasHeader: values.hasHeader };
    if (values.delimiter !== "") input.delimiter = values.delimiter;
    if (values.column !== "") input.column = /^\d+$/u.test(values.column) ? Number(values.column) : values.column;
    return input;
  }
  if (tool === "lorem-sample-data-generator") {
    const input: Record<string, unknown> = { type: values.sampleType, count: values.count, seed: values.seed };
    return input;
  }
  if (isListPair(tool)) return { left: values.text, right: values.secondary, equality: values.equality };
  if (tool === "find-replace-preview") return { text: values.text, find: values.find, replace: values.replace, regex: values.regex, caseSensitive: values.caseSensitive, all: true };
  if (tool === "case-converter") return { text: values.text, mode: values.mode };
  if (tool === "unicode-normalizer") return { text: values.text, form: values.form };
  if (tool === "smart-quote-normalizer") return { text: values.text, direction: values.direction };
  if (tool === "line-sorter") return { text: values.text, descending: values.descending, caseSensitive: values.caseSensitive };
  if (tool === "line-deduplicator") return { text: values.text, equality: values.equality };
  if (tool === "whitespace-normalizer") return { text: values.text, preserveBlankLines: values.preserveBlankLines };
  if (tool === "slug-generator") {
    const input: Record<string, unknown> = { text: values.text, separator: values.separator, lowercase: values.lowercase };
    if (values.maxLength !== "") input.maxLength = Number(values.maxLength);
    return input;
  }
  if (tool === "text-to-csv-rows") {
    const input: Record<string, unknown> = { text: values.text, includeHeaders: true };
    if (values.delimiter !== "") input.delimiter = values.delimiter;
    return input;
  }
  return { text: values.text };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function outputValue(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["output", "csv", "list", "data", "cleanText", "html"]) {
    const candidate = record[key];
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

const MARKDOWN_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "strong", "em", "del", "code", "pre", "blockquote", "ul", "ol", "li", "hr", "a"]);

function safePreviewHtml(value: string): string | null {
  if (typeof DOMParser === "undefined") return null;
  const parsed = new DOMParser().parseFromString(`<body>${value}</body>`, "text/html");
  for (const element of [...parsed.body.querySelectorAll("*")]) {
    const tag = element.tagName.toLowerCase();
    if (!MARKDOWN_TAGS.has(tag)) {
      element.remove();
      continue;
    }
    for (const attribute of [...element.attributes]) {
      if (tag === "a" && attribute.name === "href") continue;
      if (tag === "a" && attribute.name === "rel") continue;
      element.removeAttribute(attribute.name);
    }
    if (tag === "a") {
      const href = element.getAttribute("href");
      if (href === null) continue;
      try {
        const protocol = new URL(href, "https://preview.invalid/").protocol;
        if (protocol !== "http:" && protocol !== "https:" && protocol !== "mailto:" && protocol !== "tel:") element.removeAttribute("href");
      } catch {
        element.removeAttribute("href");
      }
    }
  }
  return parsed.body.innerHTML;
}

function ResultOutput({ tool, value }: { tool: TextWritingToolId; value: unknown }) {
  if (tool === "markdown-preview" && typeof value === "object" && value !== null) {
    const html = stringValue((value as Record<string, unknown>).html);
    if (html !== null) {
      const safeHtml = safePreviewHtml(html);
      if (safeHtml !== null) return <div class="markdown-output" dangerouslySetInnerHTML={{ __html: safeHtml }} />;
      return <pre class="text-result">{html}</pre>;
    }
  }
  const text = outputValue(value);
  if (text !== null) return <pre class="text-result">{text === "" ? "(risultato vuoto)" : text}</pre>;
  const keys: Readonly<Record<string, string>> = {
    words: "parole",
    characters: "caratteri",
    codePoints: "punti_codice",
    charactersNoWhitespace: "caratteri_senza_spazi",
    lines: "righe",
    paragraphs: "paragrafi",
    readingMinutes: "minuti_lettura",
    sentences: "frasi",
    counts: "conteggi",
    frequencies: "frequenze",
    language: "lingua",
    languageHeuristic: "stima_lingua",
    scripts: "alfabeti",
    duplicatesRemoved: "duplicati_rimossi",
    matches: "corrispondenze",
    warnings: "avvisi",
    warning: "avviso",
    form: "forma",
    changed: "modificato",
    delimiter: "delimitatore",
    headers: "intestazioni",
    rows: "righe",
    seed: "seme",
    count: "quantità",
    type: "tipo",
  };
  const localize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(localize);
    if (entry === null || typeof entry !== "object") return entry;
    return Object.fromEntries(Object.entries(entry as Record<string, unknown>).map(([key, item]) => [keys[key] ?? key, localize(item)]));
  };
  return <pre class="text-result">{JSON.stringify(localize(value), null, 2)}</pre>;
}

export function TextWritingTool({ tool }: TextWritingToolProps) {
  const [text, setText] = useState("");
  const [secondary, setSecondary] = useState("");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [mode, setMode] = useState<CaseMode>("lower");
  const [equality, setEquality] = useState<Equality>("exact");
  const [form, setForm] = useState("NFC");
  const [direction, setDirection] = useState("straight-to-curly");
  const [descending, setDescending] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [regex, setRegex] = useState(false);
  const [delimiter, setDelimiter] = useState(",");
  const [column, setColumn] = useState("");
  const [count, setCount] = useState("3");
  const [seed, setSeed] = useState("1");
  const [sampleType, setSampleType] = useState<SampleType>("paragraphs");
  const [preserveBlankLines, setPreserveBlankLines] = useState(true);
  const [hasHeader, setHasHeader] = useState(true);
  const [separator, setSeparator] = useState<"-" | "_">("-");
  const [lowercase, setLowercase] = useState(true);
  const [maxLength, setMaxLength] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const operation = useToolOperation<unknown>(
    (signal) => toolRuntime.run(tool, inputFor(tool, {
      text, secondary, find, replace, mode, equality, form, direction, descending, caseSensitive, regex, delimiter, column, count, seed, sampleType, preserveBlankLines, hasHeader, separator, lowercase, maxLength,
    }), {}, signal),
  );

  function submit(event: Event) {
    event.preventDefault();
    setCopyStatus("");
    void operation.run();
  }

  function reset() {
    setText("");
    setSecondary("");
    setFind("");
    setReplace("");
    setMode("lower");
    setEquality("exact");
    setForm("NFC");
    setDirection("straight-to-curly");
    setDescending(false);
    setCaseSensitive(true);
    setRegex(false);
    setDelimiter(",");
    setColumn("");
    setCount("3");
    setSeed("1");
    setSampleType("paragraphs");
    setPreserveBlankLines(true);
    setHasHeader(true);
    setSeparator("-");
    setLowercase(true);
    setMaxLength("");
    setCopyStatus("");
    operation.reset();
  }

  async function copyOutput() {
    const output = outputValue(operation.result);
    if (output === null || navigator.clipboard === undefined) {
      setCopyStatus("Gli appunti non sono disponibili; seleziona e copia il risultato manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      setCopyStatus("Risultato copiato.");
    } catch {
      setCopyStatus("L'accesso agli appunti è stato bloccato; seleziona e copia il risultato manualmente.");
    }
  }

  const primaryLabel = tool === "csv-column-to-list" ? "CSV di ingresso" : tool === "lorem-sample-data-generator" ? "Nota sorgente · facoltativa" : tool === "find-replace-preview" ? "Testo da modificare" : "Testo";
  const publicError = operation.error;
  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit}>
        {tool !== "lorem-sample-data-generator" && <label class="field"><span>{primaryLabel}</span><textarea rows={tool === "markdown-preview" ? 12 : 9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={isTextTool(tool) ? "Incolla o scrivi il testo" : "nome,email\nAda,ada@esempio.test"} /></label>}
        {isListPair(tool) && <label class="field"><span>Lista B</span><textarea rows={9} value={secondary} onInput={(event) => setSecondary(event.currentTarget.value)} placeholder="beta\ngamma" /></label>}
        {tool === "find-replace-preview" && <div class="field-grid"><label class="field"><span>Trova</span><input required value={find} onInput={(event) => setFind(event.currentTarget.value)} /></label><label class="field"><span>Sostituisci con</span><input value={replace} onInput={(event) => setReplace(event.currentTarget.value)} /></label></div>}
        {tool === "case-converter" && <label class="field"><span>Stile</span><select value={mode} onChange={(event) => setMode(event.currentTarget.value as CaseMode)}>{(["lower", "upper", "title", "sentence", "camel", "pascal", "kebab", "snake", "constant"] as CaseMode[]).map((option) => <option value={option} key={option}>{CASE_LABELS[option]}</option>)}</select></label>}
        {(tool === "unicode-normalizer") && <label class="field"><span>Forma Unicode</span><select value={form} onChange={(event) => setForm(event.currentTarget.value)}>{["NFC", "NFD", "NFKC", "NFKD"].map((option) => <option value={option} key={option}>{option}</option>)}</select></label>}
        {tool === "smart-quote-normalizer" && <label class="field"><span>Direzione</span><select value={direction} onChange={(event) => setDirection(event.currentTarget.value)}><option value="straight-to-curly">Da dritte a tipografiche</option><option value="curly-to-straight">Da tipografiche a dritte</option></select></label>}
        {(tool === "line-deduplicator" || tool === "list-intersection" || tool === "list-difference") && <label class="field"><span>Regola di confronto</span><select value={equality} onChange={(event) => setEquality(event.currentTarget.value as Equality)}>{(["exact", "trim", "nfc", "trim-nfc"] as Equality[]).map((option) => <option value={option} key={option}>{EQUALITY_LABELS[option]}</option>)}</select></label>}
        {tool === "line-sorter" && <div class="field-grid"><label class="checkbox-field"><input type="checkbox" checked={descending} onChange={(event) => setDescending(event.currentTarget.checked)} /> Ordine decrescente</label><label class="checkbox-field"><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.currentTarget.checked)} /> Distingui maiuscole e minuscole</label></div>}
        {tool === "find-replace-preview" && <div class="field-grid"><label class="checkbox-field"><input type="checkbox" checked={regex} onChange={(event) => setRegex(event.currentTarget.checked)} /> Espressione regolare</label><label class="checkbox-field"><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.currentTarget.checked)} /> Distingui maiuscole e minuscole</label></div>}
        {tool === "whitespace-normalizer" && <label class="checkbox-field"><input type="checkbox" checked={preserveBlankLines} onChange={(event) => setPreserveBlankLines(event.currentTarget.checked)} /> Mantieni le righe vuote</label>}
        {tool === "slug-generator" && <div class="field-grid"><label class="field"><span>Separatore</span><select value={separator} onChange={(event) => setSeparator(event.currentTarget.value as "-" | "_")}><option value="-">Trattino</option><option value="_">Trattino basso</option></select></label><label class="field"><span>Lunghezza massima</span><input inputMode="numeric" value={maxLength} onInput={(event) => setMaxLength(event.currentTarget.value)} placeholder="Nessun limite" /></label></div>}
        {tool === "slug-generator" && <label class="checkbox-field"><input type="checkbox" checked={lowercase} onChange={(event) => setLowercase(event.currentTarget.checked)} /> Risultato in minuscolo</label>}
        {tool === "text-to-csv-rows" && <label class="field"><span>Delimitatore</span><input maxLength={1} value={delimiter} onInput={(event) => setDelimiter(event.currentTarget.value)} aria-label="Delimitatore CSV" /></label>}
        {tool === "csv-column-to-list" && <div class="field-grid"><label class="field"><span>Nome colonna o posizione a partire da zero</span><input value={column} onInput={(event) => setColumn(event.currentTarget.value)} placeholder="nome oppure 0" /></label><label class="field"><span>Delimitatore</span><input maxLength={1} value={delimiter} onInput={(event) => setDelimiter(event.currentTarget.value)} aria-label="Delimitatore CSV" /></label></div>}
        {tool === "csv-column-to-list" && <label class="checkbox-field"><input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.currentTarget.checked)} /> La prima riga contiene le intestazioni</label>}
        {tool === "lorem-sample-data-generator" && <div class="field-grid"><label class="field"><span>Tipo di dati</span><select value={sampleType} onChange={(event) => setSampleType(event.currentTarget.value as SampleType)}>{(["lorem", "words", "sentences", "paragraphs", "names", "emails", "numbers", "rows"] as SampleType[]).map((option) => <option value={option} key={option}>{SAMPLE_TYPE_LABELS[option]}</option>)}</select></label><label class="field"><span>Quantità</span><input inputMode="numeric" value={count} onInput={(event) => setCount(event.currentTarget.value)} /></label><label class="field"><span>Seme</span><input inputMode="numeric" value={seed} onInput={(event) => setSeed(event.currentTarget.value)} /></label></div>}
        <InlineError message={publicError} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{TOOL_LABELS[tool]}</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning}>{it(CONTROL.reset)}</ToolResetButton></ToolActions>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder={it(CONTROL.gutterIdle)} busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {operation.result !== null && <><ResultOutput tool={tool} value={operation.result} />{tool !== "markdown-preview" && <div class="actions"><button type="button" onClick={() => void copyOutput()}>{it(CONTROL.copy)}</button></div>}{copyStatus !== "" && <p class="success" role="status" aria-live="polite">{copyStatus}</p>}</>}
      </ToolResultPanel>
    </ToolOperation>
  );
}
