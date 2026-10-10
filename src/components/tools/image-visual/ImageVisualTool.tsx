import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ImageVisualToolId } from "../../../engines/image/visual";
import { isSvgInput } from "../../../engines/image/svg-export";
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
  const [svgWidth, setSvgWidth] = useState("160");
  const [svgHeight, setSvgHeight] = useState("120");
  const [svgScale, setSvgScale] = useState("1");
  const [svgBackground, setSvgBackground] = useState("#ffffff");
  const [svgTransparent, setSvgTransparent] = useState(true);
  const [quality, setQuality] = useState("0.85");
  const [targetKiB, setTargetKiB] = useState("");
  const [targetUnit, setTargetUnit] = useState<"KiB" | "MiB">("KiB");
  const [minimumQuality, setMinimumQuality] = useState("0.45");
  const [allowResize, setAllowResize] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [pngLossless, setPngLossless] = useState(false);
  const [pngPalette, setPngPalette] = useState<"off" | "exact" | "lossy">("off");
  const [colorMode, setColorMode] = useState("convert");
  const operation = useToolOperation<PreparedImageResult>(async (signal) => {
    const input = buildInput(toolId, file, secondFile, files, value, secondValue, numberValue, secondNumberValue, mime, quality, colorMode, targetKiB, minimumQuality, allowResize, batchMode, targetUnit, svgWidth, svgHeight, svgScale, svgBackground, svgTransparent, pngLossless, pngPalette);
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
    setSvgWidth("160");
    setSvgHeight("120");
    setSvgScale("1");
    setSvgBackground("#ffffff");
    setSvgTransparent(true);
    setQuality("0.85");
    setTargetKiB("");
    setTargetUnit("KiB");
    setMinimumQuality("0.45");
    setAllowResize(false);
    setBatchMode(false);
    setPngLossless(false);
    setPngPalette("off");
    setColorMode("convert");
    clearResult();
  }

  function chooseFile(event: Event) {
    const selected = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.files?.[0] ?? null : null;
    setFile(selected);
    if (!isSvgInput(selected) && mime === "application/pdf") setMime("image/png");
    operation.reset();
  }

  function chooseFiles(event: Event) {
    const selected = event.currentTarget instanceof HTMLInputElement ? Array.from(event.currentTarget.files ?? []) : [];
    setFiles(selected);
    operation.reset();
  }

  const sourceFiles = [file, secondFile, ...files].filter((item): item is File => item !== null);
  const svgSelected = toolId === "image-format-conversion" && isSvgInput(file);
  const colorVisionMode = colorMode === "deuteranopia" || colorMode === "tritanopia" ? colorMode : "protanopia";

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        {toolId === "image-compression" && (
          <label class="field">
            <input type="checkbox" checked={batchMode} onChange={(event) => {
              setBatchMode(event.currentTarget.checked);
              setPngLossless(false);
              setPngPalette("off");
              setFile(null);
              setFiles([]);
              operation.reset();
            }} disabled={operation.isRunning} />
            <span>Comprimi più immagini in coda (massimo 8, JPEG/PNG/WebP)</span>
          </label>
        )}
        {needsFile(toolId) && (
          <label class="field">
            <span>{needsMultipleFiles(toolId) ? "Immagini" : "Immagine"}</span>
            <input type="file" accept={toolId === "image-format-conversion" ? "image/svg+xml,image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/gif,.svg,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.gif" : toolId === "image-compression" && (pngLossless || pngPalette !== "off") ? "image/png,.png" : "image/jpeg,image/png,image/webp"} multiple={batchMode || needsMultipleFiles(toolId)} onChange={batchMode || needsMultipleFiles(toolId) ? chooseFiles : chooseFile} disabled={operation.isRunning} />
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
        {needsOutputFormat(toolId) && !(toolId === "image-compression" && (batchMode || pngLossless || pngPalette !== "off")) && <label class="field"><span>Formato di uscita</span><select value={mime} onChange={(event) => { setMime(event.currentTarget.value); clearResult(); }} disabled={operation.isRunning}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option>{svgSelected && <option value="application/pdf">PDF raster (non vettoriale)</option>}</select></label>}
        {svgSelected && (
          <fieldset class="field" data-svg-export-options>
            <legend>SVG → immagine o PDF raster (modalità sperimentale, non Gold)</legend>
            <div class="field-grid">
              <label class="field"><span>Larghezza viewport SVG (px)</span><input type="number" min="1" max="8192" step="1" value={svgWidth} onInput={(event) => { setSvgWidth(event.currentTarget.value); clearResult(); }} disabled={operation.isRunning} /></label>
              <label class="field"><span>Altezza viewport SVG (px)</span><input type="number" min="1" max="8192" step="1" value={svgHeight} onInput={(event) => { setSvgHeight(event.currentTarget.value); clearResult(); }} disabled={operation.isRunning} /></label>
              <label class="field"><span>Scala raster (0,1–4)</span><input type="number" min="0.1" max="4" step="0.1" value={svgScale} onInput={(event) => { setSvgScale(event.currentTarget.value); clearResult(); }} disabled={operation.isRunning} /></label>
            </div>
            {(mime === "image/png" || mime === "image/webp") && (
              <label class="field"><input type="checkbox" checked={svgTransparent} onChange={(event) => { setSvgTransparent(event.currentTarget.checked); clearResult(); }} disabled={operation.isRunning} /> <span>Conserva lo sfondo trasparente</span></label>
            )}
            {(!svgTransparent || mime === "image/jpeg" || mime === "application/pdf") && (
              <label class="field"><span>Colore di sfondo esplicito per rasterizzazione</span><input type="color" value={svgBackground} onInput={(event) => { setSvgBackground(event.currentTarget.value); clearResult(); }} disabled={operation.isRunning} /></label>
            )}
            <small>Solo elementi SVG statici semplici: niente script, stili CSS, entità, font esterni, riferimenti URL, animazioni o foreignObject. Qualsiasi SVG non riconosciuto viene rifiutato. Il PDF incorpora una fotografia raster JPEG dei pixel: NON conserva i tracciati vettoriali e NON vettorializza immagini.</small>
          </fieldset>
        )}
        {toolId === "image-compression" && batchMode && <p class="file-note">Ogni immagine conserva il proprio formato riconosciuto dalla firma del file. Un errore non blocca le altre immagini; i risultati validi si scaricano anche insieme in ZIP. Elaborazione una per volta, massimo 80 MiB complessivi.</p>}
        {toolId === "image-compression" && !batchMode && <label class="field" data-png-lossless-47>
          <input type="checkbox" checked={pngLossless} disabled={operation.isRunning}
            onChange={(event) => {
              setPngLossless(event.currentTarget.checked);
              if (event.currentTarget.checked) { setPngPalette("off"); setMime("image/png"); setTargetKiB(""); setAllowResize(false); }
              clearResult();
            }} />
          <span>PNG senza perdita: comprimi IDAT senza cambiare pixel o metadati (sperimentale)</span>
          <small>Solo PNG non interlacciati (RGB/RGBA 8 bit, grigi o indicizzati 1–8 bit), massimo 4 MiB e un milione di pixel. APNG, PNG a 16 bit e varianti non verificate vengono rifiutati. Se non conviene comprimere, conserva l'originale. Nessuna conversione, target o riduzione di pixel.</small>
        </label>}
        {toolId === "image-compression" && !batchMode && <label class="field" data-png-palette-47>
          <span>Palette PNG (modalità distinta dalla ricompressione esatta IDAT)</span>
          <select value={pngPalette} disabled={operation.isRunning} onChange={(event) => {
            const selected = event.currentTarget.value;
            setPngPalette(selected === "exact" || selected === "lossy" ? selected : "off");
            if (selected === "exact" || selected === "lossy") { setPngLossless(false); setMime("image/png"); setTargetKiB(""); setAllowResize(false); }
            clearResult();
          }}>
            <option value="off">Disattivata</option>
            <option value="exact">Palette esatta (solo ≤256 colori, pixel identici)</option>
            <option value="lossy">Palette approssimata (RGB può cambiare; alpha identico)</option>
          </select>
          {pngPalette !== "off" && <small>Solo PNG RGB/RGBA 8 bit senza metadati colore non verificati, massimo 4 MiB e 1 milione di pixel. L'approssimazione è esplicita e può variare i canali colore fino a 32 livelli; alpha invariato. File originali conservati se il risultato non riduce i byte. Nessun target di peso o ridimensionamento.</small>}
        </label>}
        {toolId === "image-format-conversion" && !svgSelected && mime === "image/jpeg" && <label class="field"><span>Sfondo per trasparenza → JPEG</span><input type="color" value={/^#[0-9a-f]{6}$/iu.test(value) ? value : "#ffffff"} onInput={(event) => setValue(event.currentTarget.value)} disabled={operation.isRunning} /><small>Obbligatorio quando l'immagine contiene alpha. Il JPEG non supporta trasparenza: i pixel trasparenti vengono compositati su questo colore.</small></label>}
        {needsQuality(toolId) && !(toolId === "image-compression" && (pngLossless || pngPalette !== "off")) && <label class="field"><span>Qualità, se supportata</span><input type="number" min="0.1" max="1" step="0.01" value={quality} onInput={(event) => setQuality(event.currentTarget.value)} disabled={operation.isRunning} /></label>}
        {toolId === "image-compression" && !pngLossless && pngPalette === "off" && (
          <fieldset class="field" data-target-image-compression>
            <legend>Dimensione obiettivo (facoltativa)</legend>
            <label class="field">
              <span>Dimensione massima, in {targetUnit}</span>
              <input type="number" min={targetUnit === "KiB" ? "1" : "0.01"} max={targetUnit === "KiB" ? "40960" : "40"} step={targetUnit === "KiB" ? "1" : "0.01"} value={targetKiB} onInput={(event) => { setTargetKiB(event.currentTarget.value); operation.reset(); }} placeholder={targetUnit === "KiB" ? "Ad es. 200" : "Ad es. 1,5"} disabled={operation.isRunning} />
            </label>
            <label class="field"><span>Unità obiettivo</span>
              <select value={targetUnit} onChange={(event) => { setTargetUnit(event.currentTarget.value === "MiB" ? "MiB" : "KiB"); setTargetKiB(""); operation.reset(); }} disabled={operation.isRunning}>
                <option value="KiB">KiB (1024 byte)</option>
                <option value="MiB">MiB (1024 KiB)</option>
              </select>
            </label>
            {targetKiB.trim() !== "" && (
              <>
                <label class="field">
                  <span>Qualità minima JPEG/WebP</span>
                  <input type="number" min="0.1" max="0.92" step="0.01" value={minimumQuality} onInput={(event) => { setMinimumQuality(event.currentTarget.value); operation.reset(); }} disabled={operation.isRunning || (!batchMode && mime === "image/png")} />
                </label>
                <label class="field">
                  <input type="checkbox" checked={allowResize} onChange={(event) => { setAllowResize(event.currentTarget.checked); operation.reset(); }} disabled={operation.isRunning} />
                  <span>Consenti anche la riduzione delle dimensioni in pixel (scelta separata)</span>
                </label>
                <small>Si misurano i byte dei file effettivamente codificati, con tentativi limitati e annullabili. Se il limite è impossibile, il risultato indica che non è stato raggiunto. La qualità del PNG non è regolabile con il codec browser; WebP è usato solo se il browser produce davvero WebP.</small>
              </>
            )}
          </fieldset>
        )}
        {toolId === "image-format-conversion" && <p class="file-note">Input: SVG statico con policy restrittiva, JPG/JPEG, PNG, WebP, AVIF, HEIC/HEIF e GIF. SVG produce PNG/JPEG/WebP o PDF raster-backed, NON un PDF vettoriale. HEIC/HEIF usa un decoder locale lazy; per GIF viene convertito solo il primo frame. I metadati container non vengono conservati. La modalità SVG è in validazione (Partial), non certificata Gold.</p>}
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

function buildInput(toolId: ImageVisualToolId, file: File | null, secondFile: File | null, files: File[], value: string, secondValue: string, numberValue: string, secondNumberValue: string, mime: string, quality: string, colorMode: string, targetKiB: string, minimumQuality: string, allowResize: boolean, batchMode: boolean, targetUnit: "KiB" | "MiB", svgWidth: string, svgHeight: string, svgScale: string, svgBackground: string, svgTransparent: boolean, pngLossless: boolean, pngPalette: "off" | "exact" | "lossy"): unknown {
  const qualityNumber = Number(quality);
  const primary = file ?? files[0];
  switch (toolId) {
    case "color-blindness-image-simulation": return { file: primary, mode: colorMode === "deuteranopia" || colorMode === "tritanopia" ? colorMode : "protanopia" };
    case "image-crop": return { file: primary, x: 0, y: 0, width: Number(numberValue), height: Number(secondNumberValue), mime, quality: qualityNumber };
    case "image-format-conversion": return isSvgInput(primary)
      ? { file: primary, mime, quality: qualityNumber, width: Number(svgWidth), height: Number(svgHeight), scale: Number(svgScale), background: svgTransparent && mime !== "image/jpeg" && mime !== "application/pdf" ? "transparent" : svgBackground }
      : { file: primary, mime, quality: qualityNumber, ...(mime === "image/jpeg" ? { background: value || "#ffffff" } : {}) };
    case "image-compression": return {
      ...(batchMode ? { files } : { file: primary, mime }),
      ...(pngLossless && !batchMode ? { pngLossless: true } : {}),
      ...(pngPalette !== "off" && !batchMode ? { pngPalette } : {}),
      quality: qualityNumber,
      ...(targetKiB.trim() === "" ? {} : { targetKiB: Number(targetKiB) * (targetUnit === "MiB" ? 1024 : 1), minQuality: Number(minimumQuality), allowResize }),
    };
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
