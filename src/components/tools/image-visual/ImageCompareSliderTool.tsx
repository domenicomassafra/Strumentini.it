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
import { CONTROL, it } from "../shared/controlLabels";

interface CompareResult {
  readonly first: { readonly width: number; readonly height: number; readonly size: number };
  readonly second: { readonly width: number; readonly height: number; readonly size: number };
  readonly sameDimensions: boolean;
  readonly alignmentPolicy: "top-left-overlap-no-stretch";
  readonly comparedWidth: number;
  readonly comparedHeight: number;
  readonly unmatchedPixels: number;
  readonly threshold: number;
  readonly algorithm: string;
  readonly maxSampledPixels: number;
  readonly sampledPixels: number;
  readonly differentPixels: number;
  readonly differenceRatio: number;
  readonly meanAbsoluteChannelDifference: number;
  readonly diffBlob: Blob;
}

type CompareMode = "slider" | "overlay" | "diff";

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

function formatBytes(value: number): string {
  return value < 1024 ? `${value} B` : value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function ImageCompareSliderTool() {
  const [first, setFirst] = useState<File | null>(null);
  const [second, setSecond] = useState<File | null>(null);
  const [threshold, setThreshold] = useState("0");
  const [mode, setMode] = useState<CompareMode>("slider");
  const [position, setPosition] = useState(50);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const operation = useToolOperation<CompareResult>(
    (signal) => toolRuntime.run("image-compare-slider", {
      first,
      second,
      threshold: Number(threshold),
      alignmentPolicy: "top-left-overlap-no-stretch",
    }, {}, signal),
  );
  const result = operation.result;
  const firstUrl = useBlobUrl(first);
  const secondUrl = useBlobUrl(second);
  const diffUrl = useBlobUrl(result?.diffBlob ?? null);

  function reset() {
    setFirst(null);
    setSecond(null);
    setThreshold("0");
    setMode("slider");
    setPosition(50);
    setOverlayOpacity(50);
    operation.reset();
  }

  const maxWidth = result === null ? 1 : Math.max(result.first.width, result.second.width);
  const maxHeight = result === null ? 1 : Math.max(result.first.height, result.second.height);
  const firstStyle = result === null ? {} : { width: `${(result.first.width / maxWidth) * 100}%`, height: `${(result.first.height / maxHeight) * 100}%` };
  const secondStyle = result === null ? {} : { width: `${(result.second.width / maxWidth) * 100}%`, height: `${(result.second.height / maxHeight) * 100}%` };

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}>
        <div class="field-grid">
          <label class="field"><span>Immagine A</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFirst(event.currentTarget.files?.item(0) ?? null); operation.reset(); }} /></label>
          <label class="field"><span>Immagine B</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setSecond(event.currentTarget.files?.item(0) ?? null); operation.reset(); }} /></label>
          <label class="field"><span>Soglia diff RGBA · 0–255</span><input aria-label="Soglia diff RGBA" type="number" min="0" max="255" step="1" value={threshold} onInput={(event) => setThreshold(event.currentTarget.value)} /><small>Un pixel campionato differisce quando almeno un canale RGBA supera questa soglia.</small></label>
        </div>
        <p class="file-note">Allineamento metrico: angolo in alto a sinistra, sola area sovrapposta, nessuno stretch. Le aree fuori sovrapposizione sono conteggiate separatamente.</p>
        <InlineError message={operation.error} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Confronta immagini</ToolSubmitButton><ToolResetButton onClick={reset} /></ToolActions>
      </form>
      <ToolResultPanel eyebrow="Confronto" placeholder="Slider, overlay, diff e metriche appariranno qui." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && (
          <div data-result-class="validator">
            <ResultPrimaryAnswer label="Pixel diversi campionati">{result.differentPixels} / {result.sampledPixels} · {(result.differenceRatio * 100).toFixed(2)}%</ResultPrimaryAnswer>
            <ResultInterpretation state={result.differentPixels === 0 && result.unmatchedPixels === 0 ? "success" : "warning"}>{result.sameDimensions ? "Le due immagini hanno le stesse dimensioni." : `Dimensioni diverse: il diff usa solo ${result.comparedWidth}×${result.comparedHeight} px sovrapposti e non ridimensiona nessuna immagine.`}</ResultInterpretation>
            <ToolActions>
              <button type="button" aria-pressed={mode === "slider"} onClick={() => setMode("slider")}>Slider</button>
              <button type="button" aria-pressed={mode === "overlay"} onClick={() => setMode("overlay")}>Overlay</button>
              <button type="button" aria-pressed={mode === "diff"} onClick={() => setMode("diff")}>Diff</button>
            </ToolActions>
            {mode !== "diff" && (
              <div>
                <label class="field"><span>{mode === "slider" ? "Posizione slider" : "Opacità immagine B"}</span><input aria-label={mode === "slider" ? "Posizione slider confronto" : "Opacità overlay immagine B"} type="range" min="0" max="100" value={mode === "slider" ? position : overlayOpacity} onInput={(event) => mode === "slider" ? setPosition(Number(event.currentTarget.value)) : setOverlayOpacity(Number(event.currentTarget.value))} /></label>
                {mode === "slider" && <ToolActions><button type="button" onClick={() => setPosition(0)}>Mostra A</button><button type="button" onClick={() => setPosition(50)}>Metà</button><button type="button" onClick={() => setPosition(100)}>Mostra B</button></ToolActions>}
                <div aria-label="Confronto visivo allineato senza stretch" style={{ position: "relative", width: "100%", aspectRatio: `${maxWidth}/${maxHeight}`, overflow: "hidden", background: "var(--surface-subtle)" }}>
                  {firstUrl !== "" && <img src={firstUrl} alt="Immagine A" style={{ position: "absolute", left: 0, top: 0, ...firstStyle }} />}
                  {secondUrl !== "" && <div style={{ position: "absolute", inset: 0, overflow: "hidden", clipPath: mode === "slider" ? `inset(0 ${100 - position}% 0 0)` : undefined, opacity: mode === "overlay" ? overlayOpacity / 100 : 1 }}><img src={secondUrl} alt="Immagine B" style={{ position: "absolute", left: 0, top: 0, ...secondStyle }} /></div>}
                </div>
              </div>
            )}
            {mode === "diff" && (diffUrl === "" ? <p role="status">Preparazione diff locale…</p> : <figure><img src={diffUrl} alt="Differenza assoluta RGB nell'area sovrapposta" /><figcaption>Diff assoluto RGB · area sovrapposta {result.comparedWidth}×{result.comparedHeight}</figcaption></figure>)}
            <ResultBreakdown label="Metriche" rows={[
              { label: "A", value: `${result.first.width}×${result.first.height} · ${formatBytes(result.first.size)}` },
              { label: "B", value: `${result.second.width}×${result.second.height} · ${formatBytes(result.second.size)}` },
              { label: "Area confrontata", value: `${result.comparedWidth}×${result.comparedHeight} px · top-left overlap` },
              { label: "Pixel fuori sovrapposizione", value: String(result.unmatchedPixels) },
              { label: "Soglia", value: `${result.threshold} per canale RGBA` },
              { label: "Differenza media assoluta", value: result.meanAbsoluteChannelDifference.toFixed(3) },
            ]} />
            <ResultProvenance>{result.algorithm}</ResultProvenance>
            <ResultProvenance>Slider e overlay sono controllabili anche da tastiera tramite i range e i pulsanti A/Metà/B. Le metriche usano i pixel nativi, non la scala di visualizzazione.</ResultProvenance>
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
