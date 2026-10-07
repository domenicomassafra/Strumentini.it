import { useEffect, useState } from "preact/hooks";
import { resolveResultActions } from "../../../runtime/result-actions";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ToolRunResult } from "../../../runtime/types";
import { platform_size_presetsManifest } from "../../../tools/platform-size-presets/manifest";
import {
  CONTROL,
  InlineError,
  it,
  ResultActions,
  ResultAssumptions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
  ToolActions,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "../shared";
import { PLATFORM_PRESETS, type CropBox, type PixelBox, type PlatformFit, type PlatformPreset } from "../../../engines/image/presets";
import { DownloadLink } from "../marketing-media/DownloadLink";

interface PresetsResult {
  readonly preset: PlatformPreset;
  readonly source: PixelBox;
  readonly contain: PixelBox;
  readonly cover: PixelBox;
  readonly coverCrop: CropBox;
  readonly coverScale: number;
  readonly croppedFraction: number;
  readonly fit: PlatformFit;
  readonly meetsResolution: boolean;
  readonly upscaleFactor: number;
  readonly sourceRatio: string;
  readonly presetRatio: string;
  readonly ratioDifferencePercent: number;
}

interface PlatformExportResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly inputMime: string;
  readonly outputMime: "image/png";
  readonly width: number;
  readonly height: number;
  readonly preset: PlatformPreset;
  readonly source: PixelBox;
  readonly coverCrop: CropBox;
  readonly ordering: "single-selected-preset";
  readonly verification: { readonly signature: true; readonly decoded: true; readonly dimensions: true };
}

function isPlatformExport(value: PresetsResult | PlatformExportResult): value is PlatformExportResult {
  return "blob" in value && value.blob instanceof Blob;
}

function useBlobPreview(blob: Blob | undefined): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (blob === undefined) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

const PRESETS_ERRORS: Readonly<Record<string, string>> = {
  INVALID_INPUT: "Scegli una piattaforma e inserisci le dimensioni dell'immagine di partenza.",
};

const FIT_IT: Readonly<Record<PlatformFit, { readonly title: string; readonly body: string; readonly mark: "ok" | "warn" }>> = {
  "same-ratio": {
    title: "Rapporto identico",
    body: "L'immagine entra nel riquadro senza ritagli né bande: basta ridimensionarla.",
    mark: "ok",
  },
  "crop-needed": {
    title: "Serve un ritaglio",
    body: "L'immagine è più larga del riquadro: viene ritagliata al centro per riempirlo.",
    mark: "warn",
  },
  "pad-needed": {
    title: "Servono bande",
    body: "L'immagine è più alta del riquadro: per riempirlo serve una sfondo laterale.",
    mark: "warn",
  },
};

function presetsErrorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata. Nessun risultato è stato prodotto.";
  const key = result.message.split(":")[0] ?? result.message;
  return PRESETS_ERRORS[key] ?? "Non riesco a calcolare le dimensioni con questi valori.";
}

export function PlatformSizePresetsTool() {
  const [presetId, setPresetId] = useState<string>(PLATFORM_PRESETS[0]?.id ?? "instagram-square");
  const [width, setWidth] = useState("1600");
  const [height, setHeight] = useState("900");
  const [file, setFile] = useState<File | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const operation = useToolOperation<PresetsResult | PlatformExportResult>(
    async (signal) => toolRuntime.run("platform-size-presets", file === null
      ? { presetId, width: Number(width), height: Number(height) }
      : { presetId, file }, {}, signal),
    { formatError: presetsErrorIt },
  );
  const result = operation.result;
  const exportResult = result !== null && isPlatformExport(result) ? result : null;
  const sizingResult = result !== null && !isPlatformExport(result) ? result : null;
  const fit = sizingResult === null ? null : FIT_IT[sizingResult.fit];
  const previewUrl = useBlobPreview(exportResult?.blob);
  const copyPayload = sizingResult === null ? "" : [
    `${sizingResult.preset.labelIt}: ${sizingResult.cover.width}×${sizingResult.cover.height} px`,
    `Contenuto senza ritaglio: ${sizingResult.contain.width}×${sizingResult.contain.height} px`,
    `Ritaglio centrale: ${sizingResult.coverCrop.width}×${sizingResult.coverCrop.height} px @ ${sizingResult.coverCrop.x},${sizingResult.coverCrop.y}`,
    `Fonte: ${sizingResult.preset.source} · verificato il ${sizingResult.preset.verifiedOn}`,
  ].join("\n");
  const resultActions = sizingResult === null ? [] : resolveResultActions({
    declaration: platform_size_presetsManifest.result,
    primary: "copy",
    hasCopyPayload: true,
    resetReady: true,
  });

  function reset() {
    operation.reset();
    setWidth("1600");
    setHeight("900");
    setFile(null);
    setActionStatus("");
  }

  async function copyResult() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    await navigator.clipboard.writeText(copyPayload);
    setActionStatus("Dimensioni copiate.");
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void operation.run();
        }}
        noValidate
      >
        <ToolFormCard>
          <label class="field">
            <span>Piattaforma</span>
            <select
              aria-label="Piattaforma"
              value={presetId}
              onChange={(event) => setPresetId(event.currentTarget.value)}
              disabled={operation.isRunning}
            >
              {PLATFORM_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.labelIt} · {preset.width}×{preset.height}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span>Immagine da esportare · facoltativa</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.currentTarget.files?.item(0) ?? null); operation.reset(); }} disabled={operation.isRunning} />
            <small>{file === null ? "Senza file calcolo soltanto ritaglio e dimensioni. Con un file genero un PNG reale del preset scelto." : `${file.name} · verrà applicato un ritaglio centrale, mai stretch.`}</small>
          </label>
          <div class="field-grid">
            <label class="field">
              <span>Larghezza di partenza</span>
              <input
                aria-label="Larghezza di partenza"
                type="number"
                min="1"
                step="1"
                value={width}
                onInput={(event) => setWidth(event.currentTarget.value)}
                disabled={operation.isRunning || file !== null}
              />
            </label>
            <label class="field">
              <span>Altezza di partenza</span>
              <input
                aria-label="Altezza di partenza"
                type="number"
                min="1"
                step="1"
                value={height}
                onInput={(event) => setHeight(event.currentTarget.value)}
                disabled={operation.isRunning || file !== null}
              />
            </label>
          </div>
          <p class="file-note">Se scegli un file, resta locale nel browser e l'output PNG viene verificato per firma, decode e dimensioni esatte del preset. Il ritaglio è sempre centrato e dichiarato.</p>
        </ToolFormCard>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Calcola le dimensioni</ToolSubmitButton>
          <ToolResetButton onClick={reset} />
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow="Risultato"
        placeholder="Il riquadro della piattaforma, il ritaglio necessario e il rapporto appariranno qui."
        busy={operation.isRunning}
        state={gutterStateFor(operation.status)}
      >
        {sizingResult !== null && fit !== null && (
          <div data-result-class="calculator">
            <ResultExplanation
              primary={<div data-result-slot="primary"><ResultPrimaryAnswer label="Riquadro della piattaforma">{sizingResult.cover.width}×{sizingResult.cover.height} px</ResultPrimaryAnswer></div>}
              interpretation={<div data-result-slot="interpretation"><ResultInterpretation state={fit.mark === "ok" ? "success" : "warning"}>{fit.title}. {fit.body} {sizingResult.meetsResolution ? "Non serve ingrandire la sorgente." : `Serve un ingrandimento di ${String(sizingResult.upscaleFactor).replace(".", ",")}×.`}</ResultInterpretation></div>}
              breakdown={<div data-result-slot="breakdown"><ResultBreakdown rows={[
                { label: "Contenuto senza ritaglio", value: `${sizingResult.contain.width}×${sizingResult.contain.height} px · ${sizingResult.sourceRatio}` },
                { label: "Ritaglio centrale", value: `${sizingResult.coverCrop.width}×${sizingResult.coverCrop.height} px · origine ${sizingResult.coverCrop.x}, ${sizingResult.coverCrop.y}` },
                { label: "Area ritagliata", value: `${(sizingResult.croppedFraction * 100).toFixed(1).replace(".", ",")}%` },
                { label: "Differenza di rapporto", value: `${String(sizingResult.ratioDifferencePercent).replace(".", ",")}% rispetto a ${sizingResult.presetRatio}` },
              ]} /></div>}
              assumptions={<div data-result-slot="assumptions"><ResultAssumptions items={[
                { label: "Uso consigliato", value: sizingResult.preset.scopeIt },
                { label: "Politica di ritaglio", value: "Ritaglio centrato; il soggetto non viene rilevato automaticamente." },
              ]} /></div>}
              provenance={<div data-result-slot="provenance"><ResultProvenance>{sizingResult.preset.source} · verificato il {sizingResult.preset.verifiedOn}</ResultProvenance></div>}
            />
            <ResultActions actions={resultActions} onAction={{ copy: copyResult, reset }} />
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
        {exportResult !== null && (
          <div data-result-class="image">
            <ResultPrimaryAnswer label="PNG esportato">{exportResult.width}×{exportResult.height} px · {exportResult.preset.labelIt}</ResultPrimaryAnswer>
            <ResultInterpretation state="success">Il file usa il ritaglio centrale dichiarato, senza stretch, ed è stato riaperto dopo encoding per verificare tipo e dimensioni.</ResultInterpretation>
            {previewUrl !== "" && <figure><img src={previewUrl} alt={`Anteprima ${exportResult.preset.labelIt}`} /><figcaption>{exportResult.filename}</figcaption></figure>}
            <ResultBreakdown rows={[
              { label: "Sorgente", value: `${exportResult.source.width}×${exportResult.source.height} px · ${exportResult.inputMime}` },
              { label: "Ritaglio sorgente", value: `${exportResult.coverCrop.width}×${exportResult.coverCrop.height} @ ${exportResult.coverCrop.x},${exportResult.coverCrop.y}` },
              { label: "Output verificato", value: `${exportResult.width}×${exportResult.height} · ${exportResult.outputMime}` },
              { label: "Ordine/nome", value: `singolo preset selezionato · ${exportResult.filename}` },
            ]} />
            <ResultProvenance>{exportResult.preset.source} · verificato il {exportResult.preset.verifiedOn}</ResultProvenance>
            <ToolActions><DownloadLink blob={exportResult.blob} filename={exportResult.filename}>Scarica PNG verificato</DownloadLink><ToolResetButton onClick={reset} /></ToolActions>
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
