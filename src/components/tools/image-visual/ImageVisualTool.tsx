import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ImageVisualToolId } from "../../../engines/image/visual";
import {
  gutterStateFor,
  InlineError,
  ToolActions,
  ToolCancelButton,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "../shared";
import { CONTROL, it } from "../shared/controlLabels";
import { ImageResultV2, prepareImageResult, type PreparedImageResult } from "./ImageResultV2";

interface ImageVisualToolProps {
  readonly toolId: ImageVisualToolId;
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
  const [colorMode, setColorMode] = useState("convert");
  const operation = useToolOperation<PreparedImageResult>(async (signal) => {
    const input = buildInput(toolId, file, secondFile, files, value, secondValue, numberValue, secondNumberValue, mime, quality, colorMode);
    const run = await toolRuntime.run(toolId, input, {}, signal);
    if (!run.ok) return run;
    return { ok: true, tool: run.tool, value: await prepareImageResult(run.value), defaults: run.defaults };
  }, { formatThrownError: () => "L'operazione sull'immagine non è riuscita. Controlla file e parametri." });
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
    setColorMode("convert");
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

  const sourceFiles = [file, secondFile, ...files].filter((item): item is File => item !== null);
  const colorVisionMode = colorMode === "deuteranopia" || colorMode === "tritanopia" ? colorMode : "protanopia";

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        {needsFile(toolId) && (
          <label class="field">
            <span>{needsMultipleFiles(toolId) ? "Immagini" : "Immagine"}</span>
            <input type="file" accept={toolId === "image-format-conversion" ? "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.gif" : "image/jpeg,image/png,image/webp"} multiple={needsMultipleFiles(toolId)} onChange={needsMultipleFiles(toolId) ? chooseFiles : chooseFile} disabled={operation.isRunning} />
            <small>File elaborati in locale, senza caricamenti né elaborazione remota alternativa.</small>
          </label>
        )}
        {toolId === "image-compare-slider" && (
          <><label class="field"><span>Seconda immagine</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const selected = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.files?.[0] ?? null : null; setSecondFile(selected); operation.reset(); }} disabled={operation.isRunning} /></label></>
        )}
        {toolId === "contact-sheet-generator" && (
          <label class="field"><span>Ordine immagini</span><select value={value || "selection"} onChange={(event) => { setValue(event.currentTarget.value); operation.reset(); }} disabled={operation.isRunning}><option value="selection">Ordine di selezione</option><option value="filename-asc">Nome file A→Z</option></select><small>L'ordine scelto determina posizione e riepilogo della contact sheet.</small></label>
        )}
        {needsNumber(toolId) && (
          <div class="field-grid">
            <label class="field"><span>{numberLabel(toolId, false)}</span><input type="number" min="1" step="1" value={numberValue} onInput={(event) => setNumberValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>
            {needsSecondNumber(toolId) && <label class="field"><span>{numberLabel(toolId, true)}</span><input type="number" min="1" step="1" value={secondNumberValue} onInput={(event) => setSecondNumberValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
          </div>
        )}
        {needsColor(toolId) && (
          <div class="field-grid">
            {toolId === "color-converter" && <label class="field"><span>Modalità colore</span><select value={colorMode} onChange={(event) => { setColorMode(event.currentTarget.value); operation.reset(); }} disabled={operation.isRunning}><option value="convert">Converti colore</option><option value="named-color">Nome CSS → colore</option><option value="harmonies">Armonie HSL</option><option value="tints-shades">Tinte e ombre sRGB</option></select></label>}
            {toolId === "color-converter" && colorMode === "named-color"
              ? <label class="field"><span>Nome colore CSS</span><input type="text" value={value || "rebeccapurple"} onInput={(event) => setValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>
              : <label class="field"><span>{toolId === "contrast-checker" ? "Primo piano" : "Colore"}</span><input type="color" value={/^#[0-9a-f]{6}$/iu.test(value) ? value : "#336699"} onInput={(event) => setValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
            {toolId === "contrast-checker" && <label class="field"><span>Sfondo</span><input type="color" value={secondValue || "#ffffff"} onInput={(event) => setSecondValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
          </div>
        )}
        {toolId === "color-blindness-image-simulation" && (
          <label class="field">
            <span>Modalità di simulazione</span>
            <select value={colorVisionMode} onChange={(event) => { setColorMode(event.currentTarget.value); operation.reset(); }} disabled={operation.isRunning}>
              <option value="protanopia">Protanopia</option>
              <option value="deuteranopia">Deuteranopia</option>
              <option value="tritanopia">Tritanopia</option>
            </select>
            <small>Simulazione basata sul modello Machado et al. (2009). Non è una diagnosi medica e non rappresenta in modo universale la percezione di ogni persona.</small>
          </label>
        )}
        {needsText(toolId) && <label class="field"><span>Valore</span><input value={value} onInput={(event) => setValue(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
        {needsOutputFormat(toolId) && <label class="field"><span>Formato di uscita</span><select value={mime} onChange={(event) => setMime(event.currentTarget.value)} disabled={operation.isRunning}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>}
        {toolId === "image-format-conversion" && mime === "image/jpeg" && <label class="field"><span>Sfondo per trasparenza → JPEG</span><input type="color" value={/^#[0-9a-f]{6}$/iu.test(value) ? value : "#ffffff"} onInput={(event) => setValue(event.currentTarget.value)} disabled={operation.isRunning} /><small>Obbligatorio quando l'immagine contiene alpha. Il JPEG non supporta trasparenza: i pixel trasparenti vengono compositati su questo colore.</small></label>}
        {needsQuality(toolId) && <label class="field"><span>Qualità, se supportata</span><input type="number" min="0.1" max="1" step="0.01" value={quality} onInput={(event) => setQuality(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
        {toolId === "image-format-conversion" && <p class="file-note">Input: JPG/JPEG, PNG, WebP, AVIF, HEIC/HEIF e GIF. HEIC/HEIF usa un decoder locale lazy; AVIF usa il decoder locale del browser; per GIF viene convertito esplicitamente solo il primo frame. Output: PNG, JPEG o WebP. PNG non aggiunge perdita ai pixel RGBA decodificati; JPEG/WebP sono ricodifiche lossy alla qualità scelta. I metadati container non vengono conservati.</p>}
        <InlineError message={operation.error === "" ? "" : "L'operazione non è riuscita. Controlla i file e i parametri inseriti."} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Esegui in locale</ToolSubmitButton>
          {operation.isRunning ? <ToolCancelButton onCancel={operation.cancel} /> : <ToolResetButton onClick={reset} />}
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder="Il risultato locale apparirà qui." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && <ImageResultV2 toolId={toolId} result={result} sourceFiles={sourceFiles} onReset={reset} onRetry={() => operation.run()} />}
      </ToolResultPanel>
    </ToolOperation>
  );
}

function buildInput(toolId: ImageVisualToolId, file: File | null, secondFile: File | null, files: File[], value: string, secondValue: string, numberValue: string, secondNumberValue: string, mime: string, quality: string, colorMode: string): unknown {
  const qualityNumber = Number(quality);
  const primary = file ?? files[0];
  switch (toolId) {
    case "color-blindness-image-simulation": return { file: primary, mode: colorMode === "deuteranopia" || colorMode === "tritanopia" ? colorMode : "protanopia" };
    case "image-crop": return { file: primary, x: 0, y: 0, width: Number(numberValue), height: Number(secondNumberValue), mime, quality: qualityNumber };
    case "image-format-conversion": return { file: primary, mime, quality: qualityNumber, ...(mime === "image/jpeg" ? { background: value || "#ffffff" } : {}) };
    case "image-compression": return { file: primary, mime, quality: qualityNumber };
    case "aspect-ratio-calculator": return { width: Number(numberValue), height: Number(secondNumberValue) };
    case "platform-size-presets": return { presetId: value || "instagram-square", width: Number(numberValue), height: Number(secondNumberValue) };
    case "image-metadata-viewer": return primary ?? null;
    case "exif-remover": return { file: primary };
    case "color-picker": return { hex: value || "#336699" };
    case "color-converter": return { color: value || (colorMode === "named-color" ? "rebeccapurple" : "#336699"), mode: colorMode };
    case "contrast-checker": return { foreground: value || "#000000", background: secondValue || "#ffffff" };
    case "palette-extractor": return { file: primary, count: Number(numberValue) };
    case "dominant-color-extractor": return primary ?? null;
    case "image-dimensions-batch-inspector": return files;
    case "image-rename-batch-preview": return { files, prefix: value, suffix: secondValue, start: Number(numberValue) };
    case "contact-sheet-generator": return { files, columns: Number(numberValue), cellWidth: 240, cellHeight: 180, ordering: value || "selection" };
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
  if (toolId === "image-crop") return second ? "Altezza" : "Larghezza";
  if (toolId === "aspect-ratio-calculator" || toolId === "platform-size-presets") return second ? "Altezza" : "Larghezza";
  if (toolId === "palette-extractor") return "Colori";
  if (toolId === "contact-sheet-generator") return "Colonne";
  return second ? "Spaziatura" : "Bordo";
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
