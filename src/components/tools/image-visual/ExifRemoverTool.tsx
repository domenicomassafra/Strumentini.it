import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ToolRunResult } from "../../../runtime/types";
import {
  CONTROL,
  InlineError,
  it,
  ToolActions,
  ToolCancelButton,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "../shared";
import type { MetadataInventory, MetadataSegment } from "../../../engines/image/metadata";
import { ImageResultV2, prepareImageResult, type PreparedImageResult } from "./ImageResultV2";

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
  const operation = useToolOperation<PreparedImageResult>(
    async (signal) => {
      const run = await toolRuntime.run("exif-remover", { file }, {}, signal);
      if (!run.ok) return run;
      return { ok: true as const, tool: run.tool, value: await prepareImageResult(run.value as StripResult), defaults: run.defaults };
    },
    { formatError: stripErrorIt },
  );
  const result = operation.result;

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
            Il file JPEG, PNG o WebP viene ricodificato localmente dai pixel in un nuovo PNG. Il risultato viene
            ispezionato fino alla fine, anche oltre 8 MiB: se contiene chunk aggiuntivi, metadati o dati finali,
            non viene consegnato. Le anteprime incorporate in Exif non vengono analizzate singolarmente: l'intero
            contenitore originale viene escluso. Non sono supportati PDF, SVG o documenti Office.
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
        state={gutterStateFor(operation.status)}
      >
        {result !== null && <ImageResultV2 toolId="exif-remover" result={result} sourceFiles={file === null ? [] : [file]} onReset={reset} onRetry={() => operation.run()} />}
      </ToolResultPanel>
    </ToolOperation>
  );
}
