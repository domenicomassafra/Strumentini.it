import { useEffect, useState } from "preact/hooks";
import { toolRuntime } from "../../../runtime/tool-runtime";
import {
  InlineError,
  ResultBreakdown,
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

type WorkspaceMode = "contact" | "compose" | "slice";
type ComposeMode = "horizontal" | "vertical" | "grid";
type SliceDirection = "horizontal" | "vertical";

interface ComposeResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly outputBytes: number;
  readonly mode: ComposeMode;
  readonly gap: number;
  readonly background: string;
  readonly items: readonly { readonly index: number; readonly name: string; readonly sourceWidth: number; readonly sourceHeight: number; readonly sourceBytes: number; readonly x: number; readonly y: number }[];
}

interface SliceResult {
  readonly source: { readonly name: string; readonly width: number; readonly height: number; readonly bytes: number };
  readonly direction: SliceDirection;
  readonly count: number;
  readonly items: readonly { readonly index: number; readonly filename: string; readonly width: number; readonly height: number; readonly x: number; readonly y: number; readonly blob: Blob; readonly outputMime: "image/png"; readonly outputBytes: number }[];
  readonly ordering: "source-leading-edge-to-trailing-edge";
  readonly naming: string;
  readonly zipBlob: Blob;
  readonly zipFilename: string;
  readonly zipCompression: "store";
  readonly zipEntries: readonly string[];
  readonly zipVerified: true;
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

function move<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function ContactSheetGeneratorTool() {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("contact");
  const [files, setFiles] = useState<File[]>([]);
  const [composeMode, setComposeMode] = useState<ComposeMode>("grid");
  const [gap, setGap] = useState("0");
  const [background, setBackground] = useState("#ffffff");
  const [columns, setColumns] = useState("2");
  const [sliceFile, setSliceFile] = useState<File | null>(null);
  const [sliceCount, setSliceCount] = useState("3");
  const [sliceDirection, setSliceDirection] = useState<SliceDirection>("horizontal");

  const compose = useToolOperation<ComposeResult>((signal) => toolRuntime.run("contact-sheet-generator", {
    mode: composeMode,
    files,
    gap: Number(gap),
    background,
    columns: Number(columns),
  }, {}, signal));
  const slice = useToolOperation<SliceResult>((signal) => toolRuntime.run("contact-sheet-generator", {
    mode: "slice",
    file: sliceFile,
    count: Number(sliceCount),
    direction: sliceDirection,
  }, {}, signal));
  const composeUrl = useBlobUrl(compose.result?.blob ?? null);

  function resetAdvanced() {
    setFiles([]);
    setSliceFile(null);
    compose.reset();
    slice.reset();
  }

  function addFiles(event: Event) {
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    const selected = [...(event.currentTarget.files ?? [])];
    setFiles((current) => [...current, ...selected].slice(0, 24));
    compose.reset();
    event.currentTarget.value = "";
  }

  return (
    <>
      <label class="field"><span>Modalità composizione</span><select aria-label="Modalità composizione immagini" value={workspaceMode} onChange={(event) => { setWorkspaceMode(event.currentTarget.value as WorkspaceMode); resetAdvanced(); }}><option value="contact">Contact sheet</option><option value="compose">Stack / griglia</option><option value="slice">Slicing social / carousel</option></select></label>
      {workspaceMode === "contact" && <ImageVisualTool toolId="contact-sheet-generator" />}

      {workspaceMode === "compose" && (
        <ToolOperation busy={compose.isRunning}>
          <form onSubmit={(event) => { event.preventDefault(); void compose.run(); }}>
            <label class="field"><span>Aggiungi immagini</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={addFiles} /></label>
            <section aria-label="Ordine immagini prima dell'export">
              <p class="file-note">Ordine e rimozioni qui sotto sono la preview dell'ordine di export: nessun file viene riordinato di nascosto.</p>
              <ol>{files.map((file, index) => <li key={`${file.name}-${file.size}-${index}`}><strong>{index + 1}. {file.name}</strong> <button type="button" onClick={() => { setFiles(move(files, index, -1)); compose.reset(); }} disabled={index === 0}>Su</button> <button type="button" onClick={() => { setFiles(move(files, index, 1)); compose.reset(); }} disabled={index === files.length - 1}>Giù</button> <button type="button" onClick={() => { setFiles(files.filter((_file, itemIndex) => itemIndex !== index)); compose.reset(); }}>Rimuovi</button></li>)}</ol>
            </section>
            <div class="field-grid">
              <label class="field"><span>Layout</span><select value={composeMode} onChange={(event) => { setComposeMode(event.currentTarget.value as ComposeMode); compose.reset(); }}><option value="grid">Griglia</option><option value="horizontal">Stack orizzontale</option><option value="vertical">Stack verticale</option></select></label>
              {composeMode === "grid" && <label class="field"><span>Colonne</span><input type="number" min="1" max={Math.max(1, files.length)} value={columns} onInput={(event) => { setColumns(event.currentTarget.value); compose.reset(); }} /></label>}
              <label class="field"><span>Gap · px</span><input type="number" min="0" max="256" value={gap} onInput={(event) => { setGap(event.currentTarget.value); compose.reset(); }} /></label>
              <label class="field"><span>Sfondo</span><input type="color" value={background} onInput={(event) => { setBackground(event.currentTarget.value); compose.reset(); }} /></label>
            </div>
            <InlineError message={compose.error} />
            <ToolActions><ToolSubmitButton busy={compose.isRunning}>Genera composizione nell'ordine mostrato</ToolSubmitButton><ToolResetButton onClick={resetAdvanced} /></ToolActions>
          </form>
          <ToolResultPanel eyebrow="Composizione" placeholder="Il PNG verificato apparirà qui." busy={compose.isRunning} state={gutterStateFor(compose.status)}>{compose.result !== null && <div data-result-class="image"><ResultPrimaryAnswer label="Output">{compose.result.width}×{compose.result.height} px · {compose.result.outputBytes} B</ResultPrimaryAnswer>{composeUrl !== "" && <img src={composeUrl} alt="Preview esatta composizione immagini" />}<div class="table-output" role="region" aria-label="Ordine composizione effettivo" tabIndex={0}><table><thead><tr><th>#</th><th>File</th><th>Sorgente</th><th>Byte sorgente</th><th>Posizione</th></tr></thead><tbody>{compose.result.items.map((item) => <tr key={`${item.index}-${item.name}`}><td>{item.index}</td><td>{item.name}</td><td>{item.sourceWidth}×{item.sourceHeight}</td><td>{item.sourceBytes}</td><td>{item.x},{item.y}</td></tr>)}</tbody></table></div><ResultProvenance>Ordine effettivo = ordine mostrato prima dell'export. Layout {compose.result.mode}, gap {compose.result.gap}px, sfondo {compose.result.background}. Dimensioni e byte sono misurati sui file sorgente e sul PNG prodotto.</ResultProvenance><ToolActions><DownloadLink blob={compose.result.blob} filename={compose.result.filename}>Scarica PNG</DownloadLink></ToolActions></div>}</ToolResultPanel>
        </ToolOperation>
      )}

      {workspaceMode === "slice" && (
        <ToolOperation busy={slice.isRunning}>
          <form onSubmit={(event) => { event.preventDefault(); void slice.run(); }}>
            <label class="field"><span>Immagine da dividere</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setSliceFile(event.currentTarget.files?.item(0) ?? null); slice.reset(); }} /></label>
            <div class="field-grid">
              <label class="field"><span>Direzione</span><select aria-label="Direzione slicing" value={sliceDirection} onChange={(event) => { setSliceDirection(event.currentTarget.value as SliceDirection); slice.reset(); }}><option value="horizontal">Sinistra → destra</option><option value="vertical">Alto → basso</option></select></label>
              <label class="field"><span>Numero slice</span><input aria-label="Numero slice" type="number" min="2" max="20" value={sliceCount} onInput={(event) => { setSliceCount(event.currentTarget.value); slice.reset(); }} /></label>
            </div>
            <p class="file-note">La partizione copre esattamente tutti i pixel. Se la dimensione non è divisibile, i primi slice ricevono un pixel in più; i nomi includono indice, totale e dimensioni reali.</p>
            <InlineError message={slice.error} />
            <ToolActions><ToolSubmitButton busy={slice.isRunning}>Genera preview list e ZIP STORE</ToolSubmitButton><ToolResetButton onClick={resetAdvanced} /></ToolActions>
          </form>
          <ToolResultPanel eyebrow="Slice" placeholder="La lista esatta dei file e il relativo ZIP appariranno qui." busy={slice.isRunning} state={gutterStateFor(slice.status)}>{slice.result !== null && <div data-result-class="file"><ResultPrimaryAnswer label="Slice generate">{slice.result.count}</ResultPrimaryAnswer><ResultBreakdown rows={[{ label: "Sorgente", value: `${slice.result.source.name} · ${slice.result.source.width}×${slice.result.source.height} · ${slice.result.source.bytes} B` }, { label: "Ordine", value: slice.result.ordering }, { label: "ZIP", value: `${slice.result.zipCompression.toUpperCase()} · central directory verificato` }]} /><div class="table-output" role="region" aria-label="Preview slice incluse nel ZIP" tabIndex={0}><table><thead><tr><th>#</th><th>File</th><th>Dimensioni</th><th>Byte</th><th>Crop sorgente</th></tr></thead><tbody>{slice.result.items.map((item) => <tr key={item.filename}><td>{item.index}</td><td>{item.filename}</td><td>{item.width}×{item.height}</td><td>{item.outputBytes}</td><td>{item.x},{item.y}</td></tr>)}</tbody></table></div><ResultProvenance>Il central directory del ZIP STORE è reinspezionato: deve coincidere esattamente, nello stesso ordine, con questa preview list. DEFLATE non viene usato.</ResultProvenance><ToolActions><DownloadLink blob={slice.result.zipBlob} filename={slice.result.zipFilename}>Scarica ZIP con {slice.result.zipEntries.length} slice</DownloadLink></ToolActions></div>}</ToolResultPanel>
        </ToolOperation>
      )}
    </>
  );
}
