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
  "word-character-line-counter": "Count text",
  "reading-time-estimator": "Estimate reading time",
  "case-converter": "Convert case",
  "whitespace-normalizer": "Normalize whitespace",
  "invisible-character-detector": "Inspect invisible characters",
  "unicode-normalizer": "Normalize Unicode",
  "smart-quote-normalizer": "Normalize quotes",
  "line-sorter": "Sort lines",
  "line-deduplicator": "Deduplicate lines",
  "list-intersection": "Find intersection",
  "list-difference": "Find difference",
  "find-replace-preview": "Preview replacement",
  "markdown-preview": "Preview Markdown",
  "markdown-table-formatter": "Format Markdown table",
  "slug-generator": "Generate slug",
  "text-to-csv-rows": "Convert to CSV",
  "csv-column-to-list": "Extract column",
  "lorem-sample-data-generator": "Generate sample data",
  "language-aware-text-statistics": "Analyze language",
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
  if (text !== null) return <pre class="text-result">{text === "" ? "(empty output)" : text}</pre>;
  return <pre class="text-result">{JSON.stringify(value, null, 2)}</pre>;
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
      setCopyStatus("Clipboard access is unavailable; select the output manually.");
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      setCopyStatus("Output copied.");
    } catch {
      setCopyStatus("Clipboard access was blocked; select the output manually.");
    }
  }

  const primaryLabel = tool === "csv-column-to-list" ? "CSV input" : tool === "lorem-sample-data-generator" ? "Optional source note" : tool === "find-replace-preview" ? "Text to update" : "Text input";
  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit}>
        {tool !== "lorem-sample-data-generator" && <label class="field"><span>{primaryLabel}</span><textarea rows={tool === "markdown-preview" ? 12 : 9} value={text} onInput={(event) => setText(event.currentTarget.value)} placeholder={isTextTool(tool) ? "Paste or type text" : "name,email\nAda,ada@example.test"} /></label>}
        {isListPair(tool) && <label class="field"><span>List B</span><textarea rows={9} value={secondary} onInput={(event) => setSecondary(event.currentTarget.value)} placeholder="beta\ngamma" /></label>}
        {tool === "find-replace-preview" && <div class="field-grid"><label class="field"><span>Find</span><input required value={find} onInput={(event) => setFind(event.currentTarget.value)} /></label><label class="field"><span>Replace with</span><input value={replace} onInput={(event) => setReplace(event.currentTarget.value)} /></label></div>}
        {tool === "case-converter" && <label class="field"><span>Case</span><select value={mode} onChange={(event) => setMode(event.currentTarget.value as CaseMode)}>{["lower", "upper", "title", "sentence", "camel", "pascal", "kebab", "snake", "constant"].map((option) => <option value={option} key={option}>{option}</option>)}</select></label>}
        {(tool === "unicode-normalizer") && <label class="field"><span>Unicode form</span><select value={form} onChange={(event) => setForm(event.currentTarget.value)}>{["NFC", "NFD", "NFKC", "NFKD"].map((option) => <option value={option} key={option}>{option}</option>)}</select></label>}
        {tool === "smart-quote-normalizer" && <label class="field"><span>Direction</span><select value={direction} onChange={(event) => setDirection(event.currentTarget.value)}><option value="straight-to-curly">Straight to curly</option><option value="curly-to-straight">Curly to straight</option></select></label>}
        {(tool === "line-deduplicator" || tool === "list-intersection" || tool === "list-difference") && <label class="field"><span>Equality rule</span><select value={equality} onChange={(event) => setEquality(event.currentTarget.value as Equality)}>{["exact", "trim", "nfc", "trim-nfc"].map((option) => <option value={option} key={option}>{option}</option>)}</select></label>}
        {tool === "line-sorter" && <div class="field-grid"><label class="checkbox-field"><input type="checkbox" checked={descending} onChange={(event) => setDescending(event.currentTarget.checked)} /> Descending</label><label class="checkbox-field"><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.currentTarget.checked)} /> Case sensitive</label></div>}
        {tool === "find-replace-preview" && <div class="field-grid"><label class="checkbox-field"><input type="checkbox" checked={regex} onChange={(event) => setRegex(event.currentTarget.checked)} /> Regular expression</label><label class="checkbox-field"><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.currentTarget.checked)} /> Case sensitive</label></div>}
        {tool === "whitespace-normalizer" && <label class="checkbox-field"><input type="checkbox" checked={preserveBlankLines} onChange={(event) => setPreserveBlankLines(event.currentTarget.checked)} /> Preserve blank lines</label>}
        {tool === "slug-generator" && <div class="field-grid"><label class="field"><span>Separator</span><select value={separator} onChange={(event) => setSeparator(event.currentTarget.value as "-" | "_")}><option value="-">Hyphen</option><option value="_">Underscore</option></select></label><label class="field"><span>Maximum length</span><input inputMode="numeric" value={maxLength} onInput={(event) => setMaxLength(event.currentTarget.value)} placeholder="No limit" /></label></div>}
        {tool === "slug-generator" && <label class="checkbox-field"><input type="checkbox" checked={lowercase} onChange={(event) => setLowercase(event.currentTarget.checked)} /> Lowercase output</label>}
        {tool === "text-to-csv-rows" && <label class="field"><span>Delimiter</span><input maxLength={1} value={delimiter} onInput={(event) => setDelimiter(event.currentTarget.value)} aria-label="CSV delimiter" /></label>}
        {tool === "csv-column-to-list" && <div class="field-grid"><label class="field"><span>Column name or zero-based number</span><input value={column} onInput={(event) => setColumn(event.currentTarget.value)} placeholder="name or 0" /></label><label class="field"><span>Delimiter</span><input maxLength={1} value={delimiter} onInput={(event) => setDelimiter(event.currentTarget.value)} aria-label="CSV delimiter" /></label></div>}
        {tool === "csv-column-to-list" && <label class="checkbox-field"><input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.currentTarget.checked)} /> First row is a header</label>}
        {tool === "lorem-sample-data-generator" && <div class="field-grid"><label class="field"><span>Data type</span><select value={sampleType} onChange={(event) => setSampleType(event.currentTarget.value as SampleType)}>{["lorem", "words", "sentences", "paragraphs", "names", "emails", "numbers", "rows"].map((option) => <option value={option} key={option}>{option}</option>)}</select></label><label class="field"><span>Count</span><input inputMode="numeric" value={count} onInput={(event) => setCount(event.currentTarget.value)} /></label><label class="field"><span>Seed</span><input inputMode="numeric" value={seed} onInput={(event) => setSeed(event.currentTarget.value)} /></label></div>}
        <InlineError message={operation.error} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel="Working…">{TOOL_LABELS[tool]}</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
      </form>
      <ToolResultPanel eyebrow="Result" placeholder="The local result appears here." busy={operation.isRunning}>
        {operation.result !== null && <><ResultOutput tool={tool} value={operation.result} />{tool !== "markdown-preview" && <div class="actions"><button type="button" onClick={() => void copyOutput()}>Copy output</button></div>}{copyStatus !== "" && <p class="success" role="status">{copyStatus}</p>}</>}
      </ToolResultPanel>
    </ToolOperation>
  );
}
