import { useEffect, useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import {
  InlineError,
  ResultBreakdown,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "../shared";
import { DownloadLink } from "../marketing-media/DownloadLink";
import { ImageVisualTool } from "./ImageVisualTool";
import { ImageTextShapes384Tool } from "./ImageTextShapes384Tool";

type Mode = "border" | "watermark" | "stitch" | "text-shapes";
type Direction = "vertical" | "horizontal";

interface WatermarkResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly sourceBytes: number;
  readonly outputBytes: number;
  readonly overlayOrder: readonly ("image" | "text")[];
  readonly placement: { readonly xPercent: number; readonly yPercent: number; readonly opacity: number; readonly scale: number; readonly rotationDegrees: number };
  readonly alphaPolicy: string;
  readonly colorSpacePolicy: string;
  readonly privacyClaim: "visual-overlay-not-redaction";
  readonly previewExportIdentity: "same-rendered-png-blob";
}

interface SuggestionResult {
  readonly suggestedOverlap: number;
  readonly confidence: number;
  readonly secondBestConfidence: number;
  readonly confidenceMargin: number;
  readonly ambiguous: boolean;
  readonly policy: string;
  readonly previewBlob: Blob;
}

interface StitchResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly direction: Direction;
  readonly overlap: number;
  readonly crossOffset: number;
  readonly order: readonly [string, string];
  readonly cropPolicy: string;
}

function useBlobUrl(blob: Blob | null): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (blob === null) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

export function ScreenshotBorderBackgroundHelperTool() {
  const [mode, setMode] = useState<Mode>("border");
  const [file, setFile] = useState<File | null>(null);
  const [overlayFile, setOverlayFile] = useState<File | null>(null);
  const [text, setText] = useState("© Strumentini");
  const [opacity, setOpacity] = useState("0.70");
  const [scale, setScale] = useState("0.25");
  const [rotation, setRotation] = useState("0");
  const [xPercent, setXPercent] = useState("85");
  const [yPercent, setYPercent] = useState("90");
  const [fontSize, setFontSize] = useState("32");
  const [textColor, setTextColor] = useState("#ffffff");
  const [first, setFirst] = useState<File | null>(null);
  const [second, setSecond] = useState<File | null>(null);
  const [direction, setDirection] = useState<Direction>("vertical");
  const [overlap, setOverlap] = useState("0");
  const [crossOffset, setCrossOffset] = useState("0");

  const watermark = useToolOperation<WatermarkResult>((signal) => toolRuntime.run("screenshot-border-background-helper", {
    mode: "watermark",
    file,
    ...(overlayFile === null ? {} : { overlayFile }),
    text,
    opacity: Number(opacity),
    scale: Number(scale),
    rotationDegrees: Number(rotation),
    xPercent: Number(xPercent),
    yPercent: Number(yPercent),
    fontSize: Number(fontSize),
    textColor,
  }, {}, signal));
  const suggestion = useToolOperation<SuggestionResult>((signal) => toolRuntime.run("screenshot-border-background-helper", {
    mode: "stitch-suggest", first, second, direction,
  }, {}, signal));
  const stitch = useToolOperation<StitchResult>((signal) => toolRuntime.run("screenshot-border-background-helper", {
    mode: "stitch", first, second, direction, overlap: Number(overlap), crossOffset: Number(crossOffset),
  }, {}, signal));

  const watermarkUrl = useBlobUrl(watermark.result?.blob ?? null);
  const suggestionUrl = useBlobUrl(suggestion.result?.previewBlob ?? null);
  const stitchUrl = useBlobUrl(stitch.result?.blob ?? null);

  function resetAdvanced() {
    setFile(null);
    setOverlayFile(null);
    setFirst(null);
    setSecond(null);
    setOverlap("0");
    setCrossOffset("0");
    watermark.reset();
    suggestion.reset();
    stitch.reset();
  }

  return (
    <>
      <label class="field"><span>Modalità workspace</span><select aria-label="Modalità workspace screenshot" value={mode} onChange={(event) => { setMode(event.currentTarget.value as Mode); resetAdvanced(); }}><option value="border">Bordo / sfondo</option><option value="watermark">Watermark / overlay</option><option value="stitch">Stitch screenshot</option><option value="text-shapes">Testo e forme</option></select></label>
      {mode === "border" && <ImageVisualTool toolId="screenshot-border-background-helper" />}
      {mode === "text-shapes" && <ImageTextShapes384Tool />}

      {mode === "watermark" && (
        <ToolOperation busy={watermark.isRunning}>
          <form onSubmit={(event) => { event.preventDefault(); void watermark.run(); }}>
            <div class="field-grid">
              <label class="field"><span>Immagine base</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.currentTarget.files?.item(0) ?? null); watermark.reset(); }} /></label>
              <label class="field"><span>Overlay immagine · facoltativo</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setOverlayFile(event.currentTarget.files?.item(0) ?? null); watermark.reset(); }} /></label>
              <label class="field"><span>Testo watermark · facoltativo</span><input value={text} onInput={(event) => { setText(event.currentTarget.value); watermark.reset(); }} /></label>
              <label class="field"><span>Colore testo</span><input type="color" value={textColor} onInput={(event) => { setTextColor(event.currentTarget.value); watermark.reset(); }} /></label>
              <label class="field"><span>Opacità · {Math.round(Number(opacity) * 100)}%</span><input aria-label="Opacità overlay" type="range" min="0.01" max="1" step="0.01" value={opacity} onInput={(event) => { setOpacity(event.currentTarget.value); watermark.reset(); }} /></label>
              <label class="field"><span>Scala overlay · {Number(scale).toFixed(2)}×</span><input aria-label="Scala overlay" type="range" min="0.02" max="2" step="0.01" value={scale} onInput={(event) => { setScale(event.currentTarget.value); watermark.reset(); }} /></label>
              <label class="field"><span>Posizione X · {xPercent}%</span><input aria-label="Posizione X overlay" type="range" min="0" max="100" step="1" value={xPercent} onInput={(event) => { setXPercent(event.currentTarget.value); watermark.reset(); }} /></label>
              <label class="field"><span>Posizione Y · {yPercent}%</span><input aria-label="Posizione Y overlay" type="range" min="0" max="100" step="1" value={yPercent} onInput={(event) => { setYPercent(event.currentTarget.value); watermark.reset(); }} /></label>
              <label class="field"><span>Rotazione · gradi</span><input type="number" min="-180" max="180" value={rotation} onInput={(event) => { setRotation(event.currentTarget.value); watermark.reset(); }} /></label>
              <label class="field"><span>Dimensione testo · px</span><input type="number" min="8" max="512" value={fontSize} onInput={(event) => { setFontSize(event.currentTarget.value); watermark.reset(); }} /></label>
            </div>
            <p class="file-note">Watermark e overlay sono composizioni visive reversibili nel progetto, non redazione privacy. L'anteprima risultante e il download usano lo stesso identico Blob PNG renderizzato.</p>
            <InlineError message={watermark.error} />
            <ToolActions><ToolSubmitButton busy={watermark.isRunning}>Aggiorna anteprima / prepara export</ToolSubmitButton><ToolResetButton onClick={resetAdvanced} /></ToolActions>
          </form>
          <ToolResultPanel eyebrow="Overlay" placeholder="L'anteprima esatta dell'export apparirà qui." busy={watermark.isRunning} state={gutterStateFor(watermark.status)}>
            {watermark.result !== null && <div data-result-class="image"><ResultPrimaryAnswer label="Composizione pronta">{watermark.result.width}×{watermark.result.height} px</ResultPrimaryAnswer><ResultInterpretation state="info">Overlay visivo, non redazione privacy.</ResultInterpretation>{watermarkUrl !== "" && <img src={watermarkUrl} alt="Anteprima esatta watermark e overlay" data-watermark-preview="true" />}<ResultBreakdown rows={[{ label: "Dimensione file", value: `${watermark.result.sourceBytes} B → ${watermark.result.outputBytes} B` }, { label: "Ordine overlay", value: watermark.result.overlayOrder.join(" → ") || "nessuno" }, { label: "Posizione", value: `${watermark.result.placement.xPercent}%, ${watermark.result.placement.yPercent}%` }, { label: "Opacità", value: String(watermark.result.placement.opacity) }, { label: "Rotazione", value: `${watermark.result.placement.rotationDegrees}°` }]} /><ResultProvenance>{watermark.result.alphaPolicy}</ResultProvenance><ResultProvenance>{watermark.result.colorSpacePolicy}</ResultProvenance><ResultProvenance>Preview/export identity: {watermark.result.previewExportIdentity}.</ResultProvenance><ToolActions><DownloadLink blob={watermark.result.blob} filename={watermark.result.filename}>Scarica lo stesso PNG mostrato</DownloadLink></ToolActions></div>}
          </ToolResultPanel>
        </ToolOperation>
      )}

      {mode === "stitch" && (
        <ToolOperation busy={suggestion.isRunning || stitch.isRunning}>
          <div class="field-grid">
            <label class="field"><span>Screenshot 1 · resta intero</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFirst(event.currentTarget.files?.item(0) ?? null); setOverlap("0"); setCrossOffset("0"); suggestion.reset(); stitch.reset(); }} /></label>
            <label class="field"><span>Screenshot 2 · può perdere solo l'overlap scelto</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setSecond(event.currentTarget.files?.item(0) ?? null); setOverlap("0"); setCrossOffset("0"); suggestion.reset(); stitch.reset(); }} /></label>
            <label class="field"><span>Direzione</span><select aria-label="Direzione stitch" value={direction} onChange={(event) => { setDirection(event.currentTarget.value as Direction); setOverlap("0"); setCrossOffset("0"); suggestion.reset(); stitch.reset(); }}><option value="vertical">Verticale</option><option value="horizontal">Orizzontale</option></select></label>
            <label class="field"><span>Overlap manuale · px</span><input aria-label="Overlap manuale" type="number" min="0" value={overlap} onInput={(event) => { setOverlap(event.currentTarget.value); stitch.reset(); }} /></label>
            <label class="field"><span>Offset asse trasversale · px</span><input aria-label="Offset trasversale" type="number" value={crossOffset} onInput={(event) => { setCrossOffset(event.currentTarget.value); stitch.reset(); }} /></label>
          </div>
          <p class="file-note">Il suggerimento non scarta mai pixel automaticamente. Analizza, mostra confidence + preview e poi sei tu a copiare l'overlap nel campo manuale; 0 px resta sempre il fallback “non ritagliare”.</p>
          <InlineError message={suggestion.error || stitch.error} />
          <ToolActions><button type="button" onClick={() => void suggestion.run()} disabled={suggestion.isRunning}>Analizza overlap</button><button type="button" onClick={() => void stitch.run()} disabled={stitch.isRunning}>Esporta con correzione manuale</button><ToolResetButton onClick={resetAdvanced} /></ToolActions>
          {suggestion.result !== null && <section aria-label="Suggerimento overlap"><ResultPrimaryAnswer label="Overlap suggerito">{suggestion.result.suggestedOverlap} px · confidence {(suggestion.result.confidence * 100).toFixed(1)}%</ResultPrimaryAnswer><ResultInterpretation state={suggestion.result.ambiguous ? "warning" : "success"}>{suggestion.result.ambiguous ? "Suggerimento ambiguo: non applicato automaticamente. Correggi manualmente o scegli 0 px." : "Suggerimento ad alta confidence, comunque non applicato finché non lo confermi."}</ResultInterpretation>{suggestionUrl !== "" && <img src={suggestionUrl} alt="Anteprima overlay della zona di overlap suggerita" data-overlap-preview="true" />}<ResultProvenance>{suggestion.result.policy}</ResultProvenance><ToolActions><button type="button" onClick={() => setOverlap(String(suggestion.result?.suggestedOverlap ?? 0))}>Usa questo overlap nel campo manuale</button><button type="button" onClick={() => setOverlap("0")}>Fallback: nessun overlap</button></ToolActions></section>}
          <ToolResultPanel eyebrow="Stitch verificato" placeholder="L'export apparirà solo dopo la tua correzione manuale." busy={stitch.isRunning} state={gutterStateFor(stitch.status)}>{stitch.result !== null && <div data-result-class="image"><ResultPrimaryAnswer label="Screenshot unito">{stitch.result.width}×{stitch.result.height} px</ResultPrimaryAnswer>{stitchUrl !== "" && <img src={stitchUrl} alt="Screenshot stitched con overlap manuale" />}<ResultBreakdown rows={[{ label: "Ordine", value: stitch.result.order.join(" → ") }, { label: "Overlap applicato", value: `${stitch.result.overlap}px` }, { label: "Offset trasversale", value: `${stitch.result.crossOffset}px` }]} /><ResultProvenance>{stitch.result.cropPolicy}</ResultProvenance><ToolActions><DownloadLink blob={stitch.result.blob} filename={stitch.result.filename}>Scarica PNG stitched</DownloadLink></ToolActions></div>}</ToolResultPanel>
        </ToolOperation>
      )}
    </>
  );
}
