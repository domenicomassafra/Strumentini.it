import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ToolRunResult } from "../../../runtime/types";
import {
  CONTROL,
  InlineError,
  it,
  StatusMark,
  statusMarkLabel,
  ToolActions,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "../shared";
import { PLATFORM_PRESETS, type CropBox, type PixelBox, type PlatformFit, type PlatformPreset } from "../../../engines/image/presets";

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
  const operation = useToolOperation<PresetsResult>(
    async (signal) => toolRuntime.run("platform-size-presets", { presetId, width: Number(width), height: Number(height) }, {}, signal),
    { formatError: presetsErrorIt },
  );
  const result: PresetsResult | null = operation.result;
  const fit = result === null ? null : FIT_IT[result.fit];

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
                disabled={operation.isRunning}
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
                disabled={operation.isRunning}
              />
            </label>
          </div>
          <p class="file-note">In pixel. Lo strumento non legge né carica file: lavora sulle sole dimensioni.</p>
        </ToolFormCard>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Calcola le dimensioni</ToolSubmitButton>
          <ToolResetButton onClick={() => {
            operation.reset();
            setWidth("1600");
            setHeight("900");
          }} />
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow="Risultato"
        placeholder="Il riquadro della piattaforma, il ritaglio necessario e il rapporto appariranno qui."
        busy={operation.isRunning}
        state={operation.status === "success" ? "success" : operation.status === "error" ? "error" : "idle"}
      >
        {result !== null && fit !== null && (
          <>
            <ul class="status-list">
              <li>
                <StatusMark kind={fit.mark} label={statusMarkLabel(fit.mark)} />{" "}
                {fit.title}. {fit.body}
              </li>
              <li>
                <StatusMark kind={result.meetsResolution ? "ok" : "warn"} label={statusMarkLabel(result.meetsResolution ? "ok" : "warn")} />{" "}
                {result.meetsResolution
                  ? "L'immagine di partenza è già almeno grande quanto il riquadro: non serve ingrandire."
                  : `L'immagine di partenza è più piccola del riquadro: per riempirlo serve un ingrandimento di ${String(result.upscaleFactor).replace(".", ",")}×.`}
              </li>
              <li>
                <StatusMark kind="info" label={statusMarkLabel("info")} />{" "}
                Differenza di rapporto: {String(result.ratioDifferencePercent).replace(".", ",")}% rispetto a {result.presetRatio}.
              </li>
            </ul>

            <dl class="assumptions">
              <div><dt>Riquadro della piattaforma</dt><dd>{result.cover.width}×{result.cover.height} px ({result.presetRatio})</dd></div>
              <div><dt>Uso consigliato</dt><dd>{result.preset.scopeIt}</dd></div>
              <div>
                <dt>Contenuto senza ritaglio</dt>
                <dd>{result.contain.width}×{result.contain.height} px, al rapporto {result.sourceRatio}</dd>
              </div>
              <div>
                <dt>Ritaglio al centro</dt>
                <dd>
                  {result.coverCrop.width}×{result.coverCrop.height} px, origine ({result.coverCrop.x}, {result.coverCrop.y})
                </dd>
              </div>
              <div><dt>Parti dell'immagine ritagliate</dt><dd>{(result.croppedFraction * 100).toFixed(1).replace(".", ",")}% dell'area</dd></div>
              <div><dt>Riduzione per il ritaglio</dt><dd>{String(result.coverScale).replace(".", ",")} pixel di partenza per ogni pixel del riquadro</dd></div>
              <div><dt>Fonte del riquadro</dt><dd>{result.preset.source} · verificato il {result.preset.verifiedOn}</dd></div>
            </dl>

            <p class="file-note">
              Il ritaglio è calcolato al centro perché è l'unico che uno strumento può produrre onestamente: se il
              soggetto non è centrato, sposta tu il rettangolo di ritaglio. I valori sono le dimensioni consigliate
              pubblicate dalla piattaforma e cambiano nel tempo; la data dice da quanto sono controllati.
            </p>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}