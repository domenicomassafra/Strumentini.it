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
  ToolCancelButton,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "../shared";
import { DownloadLink } from "../marketing-media/DownloadLink";
import type { MetadataInventory, MetadataSegment } from "../../../engines/image/metadata";

interface StripResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly inputMime: string;
  readonly outputMime: string;
  readonly width: number;
  readonly height: number;
  readonly dimensionsPreserved: boolean;
  readonly inputInventory: MetadataInventory;
  readonly outputInventory: MetadataInventory;
  readonly removed: readonly MetadataSegment[];
  readonly privacySegmentCount: number;
  readonly privacyBytes: number;
  readonly inputSizeLabel: string;
  readonly outputSizeLabel: string;
  readonly metadataFree: boolean;
  readonly policyIt: string;
}

const EXIF_ERRORS: Readonly<Record<string, string>> = {
  OUTPUT_VALIDATION_FAILED: "Il file prodotto contiene ancora metadati identificativi, quindi non viene consegnato. L'originale non è stato modificato.",
  INVALID_INPUT: "Scegli un file immagine da elaborare.",
  INVALID_IMAGE: "Il file selezionato non è un'immagine supportata dal browser (JPEG, PNG o WebP).",
  CORRUPT_IMAGE: "L'immagine sembra danneggiata o troncata. Prova un altro file.",
  PIXEL_LIMIT: "L'immagine supera il limite di pixel elaborabile in locale. Riducila e riprova.",
  FILE_TOO_LARGE: "Il file supera il limite locale previsto. Riducila e riprova.",
  UNSUPPORTED_BROWSER: "Questo browser non permette di elaborare immagini in locale. L'originale non è stato modificato.",
};

function stripErrorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata. Nessun risultato è stato prodotto.";
  const key = result.message.split(":")[0] ?? result.message;
  return EXIF_ERRORS[key] ?? "Non riesco a produrre una copia senza metadati. Controlla il file e riprova.";
}

export function ExifRemoverTool() {
  const [file, setFile] = useState<File | null>(null);
  const operation = useToolOperation<StripResult>(
    async (signal) => {
      const run = await toolRuntime.run("exif-remover", { file }, {}, signal);
      if (!run.ok) return run;
      return { ok: true as const, tool: run.tool, value: run.value as StripResult, defaults: run.defaults };
    },
    { formatError: stripErrorIt },
  );
  const result: StripResult | null = operation.result;

  function reset() {
    operation.reset();
    setFile(null);
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
            <span>Immagine da ripulire</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={operation.isRunning}
              onChange={(event) => setFile(event.currentTarget.files?.item(0) ?? null)}
            />
            <small>
              {file === null
                ? "JPEG, PNG o WebP. L'originale non viene mai modificato: il risultato è un file nuovo."
                : `${file.name} · elaborazione locale`}
            </small>
          </label>
          <p class="file-note">
            Il file viene ricodificato dai pixel già decodificati e quindi riscritto come PNG, che non contiene
            metadati. Il file prodotto viene poi analizzato byte per byte: se conservasse Exif, XMP, IPTC o commenti,
            lo strumento fallisce invece di dichiarare un risultato che non può dimostrare.
          </p>
        </ToolFormCard>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Rimuovi i metadati</ToolSubmitButton>
          {operation.isRunning ? <ToolCancelButton onCancel={operation.cancel} /> : <ToolResetButton onClick={reset} />}
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow="Risultato"
        placeholder="L'inventario dei metadati trovati e il file ripulito appariranno qui."
        busy={operation.isRunning}
        state={operation.status === "success" ? "success" : operation.status === "error" ? "error" : "idle"}
      >
        {result !== null && (
          <>
            <ul class="status-list">
              <li>
                <StatusMark kind={result.metadataFree ? "ok" : "error"} label={statusMarkLabel(result.metadataFree ? "ok" : "error")} />{" "}
                {result.metadataFree
                  ? "Verificato sul file prodotto: nessun segmento Exif, XMP, IPTC o commento."
                  : "Verifica non superata."}
              </li>
              <li>
                <StatusMark kind="info" label={statusMarkLabel("info")} />{" "}
                {result.inputInventory.format === "unknown"
                  ? "Formato del file non riconosciuto dall'analisi byte per byte."
                  : `Formato di ingresso: ${result.inputInventory.format.toUpperCase()}. Formato prodotto: PNG.`}
              </li>
              <li>
                <StatusMark kind="ok" label={statusMarkLabel("ok")} />{" "}
                Dimensioni preservate: {result.width}×{result.height} pixel.
              </li>
              <li>
                <StatusMark kind="info" label={statusMarkLabel("info")} />{" "}
                Dimensione: da {result.inputSizeLabel} a {result.outputSizeLabel}.
              </li>
            </ul>

            <dl class="assumptions">
              <div>
                <dt>Segmenti trovati nell'originale</dt>
                <dd>{result.removed.length === 0 ? "nessuno" : `${result.removed.length}, per ${result.inputInventory.bytesTotal} byte`}</dd>
              </div>
              <div>
                <dt>Di cui potenzialmente identificativi</dt>
                <dd>{result.privacySegmentCount === 0 ? "nessuno" : `${result.privacySegmentCount}, per ${result.privacyBytes} byte`}</dd>
              </div>
              <div>
                <dt>Segmenti trovati nel file prodotto</dt>
                <dd>{result.outputInventory.segments.length === 0 ? "nessuno" : result.outputInventory.segments.length}</dd>
              </div>
              <div><dt>Nome del file prodotto</dt><dd>{result.filename}</dd></div>
            </dl>

            {result.removed.length > 0 && (
              <>
                <p class="eyebrow">Dettaglio dei segmenti rimossi</p>
                <ul class="status-list">
                  {result.removed.map((entry, index) => (
                    <li key={`${entry.segment}-${index}`}>
                      <StatusMark kind="missing" label={statusMarkLabel("missing")} />{" "}
                      <strong>{entry.segment}</strong> · {entry.labelIt} · {entry.bytes} byte
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p class="file-note">{result.policyIt}</p>
            <ToolActions>
              <DownloadLink blob={result.blob} filename={result.filename}>
                {it(CONTROL.download)} {result.filename}
              </DownloadLink>
            </ToolActions>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}