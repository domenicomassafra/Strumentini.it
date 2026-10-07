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
import { TextFamilyResultV2 } from "./TextFamilyResultV2";

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
  | "language-aware-text-statistics"
  | "semantic-text-chunker"
  | "fact-sensitive-text-diff"
  | "stable-placeholder-anonymizer"
  | "italian-gulpease-readability"
  | "mojibake-repair"
  | "pdf-copy-text-reflow"
  | "phone-link-hashtag-mention-extractor";

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
  "semantic-text-chunker": "Dividi il testo",
  "fact-sensitive-text-diff": "Confronta testi e marker",
  "stable-placeholder-anonymizer": "Elabora segnaposto",
  "italian-gulpease-readability": "Calcola Gulpease",
  "mojibake-repair": "Controlla codifica testo",
  "pdf-copy-text-reflow": "Ricompone testo da PDF",
  "phone-link-hashtag-mention-extractor": "Estrai contatti e riferimenti",
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

function needsSecondary(tool: TextWritingToolId): boolean {
  return isListPair(tool) || tool === "fact-sensitive-text-diff" || tool === "stable-placeholder-anonymizer";
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
  wordsPerMinute: string;
  expansionMode: "anonymize" | "restore";
  targetCharacters: string;
  overlapCharacters: string;
}): Record<string, unknown> {
  if (tool === "semantic-text-chunker") return { text: values.text, targetCharacters: values.targetCharacters, overlapCharacters: values.overlapCharacters };
  if (tool === "fact-sensitive-text-diff") return { before: values.text, after: values.secondary };
  if (tool === "stable-placeholder-anonymizer") return values.expansionMode === "anonymize"
    ? { text: values.text, mode: "anonymize", entities: values.secondary }
    : { text: values.text, mode: "restore", mapping: values.secondary };
  if (tool === "reading-time-estimator") {
    const input: Record<string, unknown> = { text: values.text };
    if (values.wordsPerMinute.trim() !== "") input.wordsPerMinute = values.wordsPerMinute;
    return input;
  }
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
  const [wordsPerMinute, setWordsPerMinute] = useState("200");
  const [expansionMode, setExpansionMode] = useState<"anonymize" | "restore">("anonymize");
  const [targetCharacters, setTargetCharacters] = useState("800");
  const [overlapCharacters, setOverlapCharacters] = useState("0");
  const operation = useToolOperation<unknown>(
    (signal) => toolRuntime.run(tool, inputFor(tool, {
      text, secondary, find, replace, mode, equality, form, direction, descending, caseSensitive, regex, delimiter, column, count, seed, sampleType, preserveBlankLines, hasHeader, separator, lowercase, maxLength, wordsPerMinute, expansionMode, targetCharacters, overlapCharacters,
    }), {}, signal),
  );

  function submit(event: Event) {
    event.preventDefault();
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
    setWordsPerMinute("200");
    setExpansionMode("anonymize");
    setTargetCharacters("800");
    setOverlapCharacters("0");
    operation.reset();
  }

  function reuseResult(output: string) {
    setText(output);
    operation.reset();
  }

  const primaryLabel = tool === "csv-column-to-list" ? "CSV di ingresso" : tool === "lorem-sample-data-generator" ? "Nota sorgente · facoltativa" : tool === "find-replace-preview" ? "Testo da modificare" : tool === "fact-sensitive-text-diff" ? "Testo originale" : "Testo";
  const publicError = operation.error;
  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit}>
        {tool !== "lorem-sample-data-generator" && <label class="field"><span>{primaryLabel}</span><textarea rows={tool === "markdown-preview" ? 12 : 9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={isTextTool(tool) ? "Incolla o scrivi il testo" : "nome,email\nAda,ada@esempio.test"} /></label>}
        {needsSecondary(tool) && <label class="field"><span>{tool === "fact-sensitive-text-diff" ? "Testo da confrontare" : tool === "stable-placeholder-anonymizer" ? (expansionMode === "anonymize" ? "Entità da sostituire · una per riga" : "Mappatura JSON creata in anonimizzazione") : "Lista B"}</span><textarea rows={9} value={secondary} onInput={(event) => setSecondary(event.currentTarget.value)} placeholder={tool === "stable-placeholder-anonymizer" ? (expansionMode === "anonymize" ? "Mario Rossi\nmario@example.it" : '[{"placeholder":"[[ANON_…]]","value":"Mario Rossi","count":1}]') : "beta\ngamma"} /></label>}
        {tool === "semantic-text-chunker" && <div class="field-grid"><label class="field"><span>Dimensione obiettivo · caratteri</span><input inputMode="numeric" value={targetCharacters} onInput={(event) => setTargetCharacters(event.currentTarget.value)} /></label><label class="field"><span>Contesto sovrapposto · caratteri</span><input inputMode="numeric" value={overlapCharacters} onInput={(event) => setOverlapCharacters(event.currentTarget.value)} /></label></div>}
        {tool === "stable-placeholder-anonymizer" && <label class="field"><span>Operazione</span><select value={expansionMode} onChange={(event) => setExpansionMode(event.currentTarget.value as "anonymize" | "restore")}><option value="anonymize">Anonimizza</option><option value="restore">Ripristina</option></select><small>Le entità e la mappatura restano nel browser. Il ripristino richiede la mappatura esatta prodotta dall'anonimizzazione.</small></label>}
        {tool === "find-replace-preview" && <div class="field-grid"><label class="field"><span>Trova</span><input required value={find} onInput={(event) => setFind(event.currentTarget.value)} /></label><label class="field"><span>Sostituisci con</span><input value={replace} onInput={(event) => setReplace(event.currentTarget.value)} /></label></div>}
        {tool === "case-converter" && <label class="field"><span>Stile</span><select value={mode} onChange={(event) => setMode(event.currentTarget.value as CaseMode)}>{(["lower", "upper", "title", "sentence", "camel", "pascal", "kebab", "snake", "constant"] as CaseMode[]).map((option) => <option value={option} key={option}>{CASE_LABELS[option]}</option>)}</select></label>}
        {(tool === "unicode-normalizer") && <label class="field"><span>Forma Unicode</span><select value={form} onChange={(event) => setForm(event.currentTarget.value)}>{["NFC", "NFD", "NFKC", "NFKD"].map((option) => <option value={option} key={option}>{option}</option>)}</select></label>}
        {tool === "smart-quote-normalizer" && <label class="field"><span>Direzione</span><select value={direction} onChange={(event) => setDirection(event.currentTarget.value)}><option value="straight-to-curly">Da dritte a tipografiche</option><option value="curly-to-straight">Da tipografiche a dritte</option></select></label>}
        {tool === "reading-time-estimator" && <label class="field"><span>Parole al minuto</span><input inputMode="numeric" value={wordsPerMinute} onInput={(event) => setWordsPerMinute(event.currentTarget.value)} placeholder="200" /><small>Lascia vuoto per usare 200 parole al minuto. Valori ammessi: da 1 a 2000.</small></label>}
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
        {operation.result !== null && (
          <TextFamilyResultV2
            tool={tool}
            value={operation.result}
            onReuse={reuseResult}
            onRetry={operation.retry}
            onReset={reset}
          />
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
