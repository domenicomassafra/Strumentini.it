import { useEffect, useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ImageVisualToolId } from "../../../engines/image/visual";
import {
  InlineError,
  ToolActions,
  ToolCancelButton,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "../shared";

interface ImageVisualToolProps {
  readonly toolId: ImageVisualToolId;
}

type ResultValue = Record<string, unknown>;

function asResult(value: unknown): ResultValue | null {
  return typeof value === "object" && value !== null ? value as ResultValue : null;
}

function formatValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return "";
}

export function ImageVisualTool({ toolId }: ImageVisualToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [value, setValue] = useState("");
  const [secondValue, setSecondValue] = useState("");
  const [numberValue, setNumberValue] = useState("1");
  const [secondNumberValue, setSecondNumberValue] = useState("1");
  const [mime, setMime] = useState("image/png");
  const [quality, setQuality] = useState("0.85");
  const operation = useToolOperation<ResultValue>(async (signal) => {
    const input = buildInput(toolId, file, secondFile, files, value, secondValue, numberValue, secondNumberValue, mime, quality);
    const run = await toolRuntime.run(toolId, input, {}, signal);
    if (!run.ok) return run;
    return { ok: true, tool: run.tool, value: asResult(run.value) ?? (Array.isArray(run.value) ? { items: run.value } : { value: run.value }), defaults: run.defaults };
  }, { formatThrownError: (error) => error instanceof Error ? error.message : "Image operation failed." });
  const result = operation.result;

  function clearResult() {
    operation.reset();
  }

  async function submit(event: Event) {
    event.preventDefault();
    clearResult();
    await operation.run();
  }

  function reset() {
    operation.reset();
    setFile(null);
    setSecondFile(null);
    setFiles([]);
    setValue("");
    setSecondValue("");
    setNumberValue("1");
    setSecondNumberValue("1");
    setMime("image/png");
    setQuality("0.85");
    clearResult();
  }

  function chooseFile(event: Event) {
    const selected = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.files?.[0] ?? null : null;
    setFile(selected);
    operation.reset();
  }

  function chooseFiles(event: Event) {
    const selected = event.currentTarget instanceof HTMLInputElement ? Array.from(event.currentTarget.files ?? []) : [];
    setFiles(selected);
    operation.reset();
  }

  const resultEntries = result === null ? [] : Object.entries(result).filter(([key]) => key !== "blob" && key !== "palette" && key !== "items" && key !== "dominant");

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        {needsFile(toolId) && (
          <label class="field">
            <span>{needsMultipleFiles(toolId) ? "Images" : "Image"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple={needsMultipleFiles(toolId)} onChange={needsMultipleFiles(toolId) ? chooseFiles : chooseFile} disabled={operation.isRunning} />
            <small>Local file input; no upload or remote fallback.</small>
          </label>
        )}
        {toolId === "image-compare-slider" && (
          <><label class="field"><span>Second image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const selected = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.files?.[0] ?? null : null; setSecondFile(selected); operation.reset(); }} disabled={operation.isRunning} /></label></>
        )}
        {needsNumber(toolId) && (
          <div class="field-grid">
            <label class="field"><span>{numberLabel(toolId, false)}</span><input type="number" min="1" step="1" value={numberValue} onInput={(event) => setNumberValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>
            {needsSecondNumber(toolId) && <label class="field"><span>{numberLabel(toolId, true)}</span><input type="number" min="1" step="1" value={secondNumberValue} onInput={(event) => setSecondNumberValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
          </div>
        )}
        {needsColor(toolId) && (
          <div class="field-grid">
            <label class="field"><span>{toolId === "contrast-checker" ? "Foreground" : "Color"}</span><input type="color" value={value || "#336699"} onInput={(event) => setValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>
            {toolId === "contrast-checker" && <label class="field"><span>Background</span><input type="color" value={secondValue || "#ffffff"} onInput={(event) => setSecondValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
          </div>
        )}
        {needsText(toolId) && <label class="field"><span>Value</span><input value={value} onInput={(event) => setValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
        {needsOutputFormat(toolId) && <label class="field"><span>Output format</span><select value={mime} onChange={(event) => setMime(event.currentTarget.value)} disabled={operation.isRunning}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>}
        {needsQuality(toolId) && <label class="field"><span>Quality (when supported)</span><input type="number" min="0.1" max="1" step="0.01" value={quality} onInput={(event) => setQuality(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel="Working locally…">Run locally</ToolSubmitButton>
          {operation.isRunning ? <ToolCancelButton onCancel={operation.cancel} /> : <ToolResetButton onClick={reset} />}
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Result" placeholder="The bounded local result appears here." busy={operation.isRunning}>
        {result !== null && (
          <>
            {resultEntries.length > 0 && <dl class="assumptions">{resultEntries.map(([key, item]) => <div key={key}><dt>{key}</dt><dd>{formatValue(item)}</dd></div>)}</dl>}
            {typeof result.blob === "object" && result.blob instanceof Blob && <DownloadButton result={result} />}
            {Array.isArray(result.items) && <ul>{result.items.map((item, index) => <li key={index}><ItemDownload item={item} />{!isBlobRecord(item) && formatValue(item)}</li>)}</ul>}
            {Array.isArray(result.palette) && <ul class="palette-list">{result.palette.map((item) => <li key={JSON.stringify(item)}><span class="color-swatch" style={{ background: String((item as { hex?: string }).hex ?? "") }} />{formatValue(item)}</li>)}</ul>}
            {typeof result.dominant === "object" && result.dominant !== null && <p>Dominant: {formatValue(result.dominant)}</p>}
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}

function DownloadButton({ result }: { readonly result: ResultValue }) {
  const [url, setUrl] = useState("");
  const blob = result.blob;
  useEffect(() => {
    if (!(blob instanceof Blob)) return;
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);
  if (!(blob instanceof Blob)) return null;
  return url === "" ? <p role="status">Preparing local download…</p> : <p><a class="button primary" href={url} download={String(result.filename ?? "image-output")}>Download output</a></p>;
}

function isBlobRecord(value: unknown): value is { readonly blob: Blob; readonly filename?: unknown } {
  return typeof value === "object" && value !== null && "blob" in value && (value as { blob?: unknown }).blob instanceof Blob;
}

function ItemDownload({ item }: { readonly item: unknown }) {
  const record = isBlobRecord(item) ? item : null;
  const blob = record?.blob;
  const filename = typeof record?.filename === "string" ? record.filename : "image-output";
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!(blob instanceof Blob)) return;
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);
  if (blob === undefined) return null;
  return url === "" ? <span role="status">Preparing local download…</span> : <a class="button primary" href={url} download={filename}>Download {filename}</a>;
}

function buildInput(toolId: ImageVisualToolId, file: File | null, secondFile: File | null, files: File[], value: string, secondValue: string, numberValue: string, secondNumberValue: string, mime: string, quality: string): unknown {
  const qualityNumber = Number(quality);
  const primary = file ?? files[0];
  switch (toolId) {
    case "image-crop": return { file: primary, x: 0, y: 0, width: Number(numberValue), height: Number(secondNumberValue), mime, quality: qualityNumber };
    case "image-format-conversion": return { file: primary, mime, quality: qualityNumber };
    case "image-compression": return { file: primary, mime, quality: qualityNumber };
    case "aspect-ratio-calculator": return { width: Number(numberValue), height: Number(secondNumberValue) };
    case "platform-size-presets": return { presetId: value || "instagram-square", width: Number(numberValue), height: Number(secondNumberValue) };
    case "image-metadata-viewer": return primary ?? null;
    case "exif-remover": return { file: primary };
    case "color-picker": return { hex: value || "#336699" };
    case "color-converter": return { hex: value || "#336699" };
    case "contrast-checker": return { foreground: value || "#000000", background: secondValue || "#ffffff" };
    case "palette-extractor": return { file: primary, count: Number(numberValue) };
    case "dominant-color-extractor": return primary ?? null;
    case "image-dimensions-batch-inspector": return files;
    case "image-rename-batch-preview": return { files, prefix: value, suffix: secondValue, start: Number(numberValue) };
    case "contact-sheet-generator": return { files, columns: Number(numberValue), cellWidth: 240, cellHeight: 180 };
    case "favicon-app-icon-size-generator": return { file: primary, sizes: [16, 32, 48, 64, 128, 180, 192, 512] };
    case "screenshot-border-background-helper": return { file: primary, border: Number(numberValue), padding: Number(secondNumberValue), background: value || "#ffffff" };
    case "image-compare-slider": return primary === null || secondFile === null ? null : { first: primary, second: secondFile };
    case "perceptual-duplicate-finder": return { files };
  }
}

function needsFile(toolId: ImageVisualToolId): boolean {
  return !["aspect-ratio-calculator", "color-picker", "color-converter", "contrast-checker", "platform-size-presets"].includes(toolId);
}

function needsMultipleFiles(toolId: ImageVisualToolId): boolean {
  return ["image-dimensions-batch-inspector", "image-rename-batch-preview", "contact-sheet-generator", "perceptual-duplicate-finder"].includes(toolId);
}

function needsNumber(toolId: ImageVisualToolId): boolean {
  return ["image-crop", "aspect-ratio-calculator", "platform-size-presets", "palette-extractor", "contact-sheet-generator", "screenshot-border-background-helper"].includes(toolId);
}

function needsSecondNumber(toolId: ImageVisualToolId): boolean {
  return ["image-crop", "aspect-ratio-calculator", "platform-size-presets", "screenshot-border-background-helper"].includes(toolId);
}

function numberLabel(toolId: ImageVisualToolId, second: boolean): string {
  if (toolId === "image-crop") return second ? "Height" : "Width";
  if (toolId === "aspect-ratio-calculator" || toolId === "platform-size-presets") return second ? "Height" : "Width";
  if (toolId === "palette-extractor") return "Colors";
  if (toolId === "contact-sheet-generator") return "Columns";
  return second ? "Padding" : "Border";
}

function needsColor(toolId: ImageVisualToolId): boolean {
  return ["color-picker", "color-converter", "contrast-checker", "screenshot-border-background-helper"].includes(toolId);
}

function needsText(toolId: ImageVisualToolId): boolean {
  return toolId === "platform-size-presets" || toolId === "image-rename-batch-preview";
}

function needsOutputFormat(toolId: ImageVisualToolId): boolean {
  return ["image-crop", "image-format-conversion", "image-compression"].includes(toolId);
}

function needsQuality(toolId: ImageVisualToolId): boolean {
  return ["image-crop", "image-format-conversion", "image-compression"].includes(toolId);
}
