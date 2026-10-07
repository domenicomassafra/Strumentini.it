import { useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import type { ToolRunResult } from "../../../runtime/types";
import {
  InlineError,
  ResultBreakdown,
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
import { ImageResultV2, prepareImageResult, type PreparedImageResult } from "./ImageResultV2";

interface IconBatchRaw extends Record<string, unknown> {
  readonly source: { readonly width: number; readonly height: number; readonly name: string };
  readonly ordering: "size-ascending";
  readonly zipBlob: Blob;
  readonly zipFilename: string;
  readonly zipCompression: "store";
  readonly zipEntries: readonly string[];
  readonly zipVerified: true;
  readonly items: readonly { readonly size: number; readonly filename: string; readonly outputMime: "image/png"; readonly width: number; readonly height: number }[];
}

function errorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata.";
  return "Non riesco a generare e verificare tutte le varianti. Controlla file e dimensioni.";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseSizes(value: string): number[] {
  return value.split(/[,\s]+/u).map((part) => Number(part)).filter((part) => Number.isFinite(part));
}

export function FaviconAppIconSizeGeneratorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [sizes, setSizes] = useState("16, 32, 48, 64, 128, 180, 192, 512");
  const operation = useToolOperation<PreparedImageResult>(
    async (signal) => {
      const run = await toolRuntime.run("favicon-app-icon-size-generator", { file, sizes: parseSizes(sizes) }, {}, signal);
      if (!run.ok) return run;
      return { ok: true as const, tool: run.tool, value: await prepareImageResult(run.value), defaults: run.defaults };
    },
    { formatError: errorIt },
  );
  const result = operation.result;
  const raw = result?.raw as IconBatchRaw | undefined;

  function reset() {
    setFile(null);
    setSizes("16, 32, 48, 64, 128, 180, 192, 512");
    operation.reset();
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}>
        <label class="field"><span>Immagine sorgente</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.currentTarget.files?.item(0) ?? null); operation.reset(); }} /></label>
        <label class="field"><span>Dimensioni quadrate · px</span><input value={sizes} onInput={(event) => setSizes(event.currentTarget.value)} /><small>Separate da virgola o spazio. Duplicati rimossi; output ordinati sempre per dimensione crescente.</small></label>
        <InlineError message={operation.error} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Genera icone verificate</ToolSubmitButton><ToolResetButton onClick={reset} /></ToolActions>
      </form>
      <ToolResultPanel eyebrow="Icone e ZIP" placeholder="La lista esatta dei PNG e il relativo ZIP STORE appariranno qui." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && raw !== undefined && (
          <>
            <ResultBreakdown label="Sorgente e batch" rows={[
              { label: "Sorgente", value: `${raw.source.name} · ${raw.source.width}×${raw.source.height} px` },
              { label: "Ordine", value: "dimensione crescente" },
              { label: "ZIP", value: `${raw.zipCompression.toUpperCase()} · central directory reinspezionato` },
              { label: "Varianti", value: String(raw.items.length) },
            ]} />
            <div class="table-output" role="region" aria-label="Varianti incluse nel ZIP" tabIndex={0}>
              <table><thead><tr><th scope="col">#</th><th scope="col">File</th><th scope="col">Dimensioni</th><th scope="col">Tipo</th></tr></thead><tbody>{raw.items.map((item, index) => <tr key={item.filename}><td>{index + 1}</td><td>{item.filename}</td><td>{item.width}×{item.height}</td><td>{item.outputMime}</td></tr>)}</tbody></table>
            </div>
            <ResultProvenance>La preview list e il central directory del ZIP devono coincidere esattamente e nello stesso ordine; ogni PNG è stato riaperto dopo encoding e verificato per firma, tipo e dimensioni.</ResultProvenance>
            <ToolActions><button type="button" onClick={() => downloadBlob(raw.zipBlob, raw.zipFilename)}>Scarica ZIP con {raw.zipEntries.length} varianti</button></ToolActions>
            <ImageResultV2 toolId="favicon-app-icon-size-generator" result={result} sourceFiles={file === null ? [] : [file]} onReset={reset} onRetry={() => operation.run()} />
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
