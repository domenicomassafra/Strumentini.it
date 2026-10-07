import { useState } from "preact/hooks";
import { CODE128B_MAX_CHARACTERS } from "../../engines/barcode";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { ToolRunResult } from "../../runtime/types";
import { barcodePngBlob, downloadBlob, safeFilename, svgBlob } from "./marketing-media/localFiles";
import {
  CONTROL,
  InlineError,
  it,
  ToolActions,
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "./shared";

interface BarcodeResult {
  readonly format: "ean13" | "code128b";
  readonly value: string;
  readonly valid: boolean;
  readonly checksum: number;
  readonly expectedChecksum: number;
  readonly moduleBits: string;
  readonly quietZoneModules: number;
  readonly barHeightModules: number;
  readonly humanReadable: boolean;
  readonly svg: string | null;
  readonly supportedCharacters: string;
  readonly policySummary: string;
  readonly codewords?: readonly number[];
}

const ERRORS: Readonly<Record<string, string>> = {
  BARCODE_INPUT_REQUIRED: "Inserisci un valore da codificare.",
  BARCODE_FORMAT_UNSUPPORTED: "Il formato richiesto non è supportato.",
  BARCODE_HUMAN_READABLE_INVALID: "L'opzione del testo leggibile non è valida.",
  EAN13_GENERATE_REQUIRES_12_DIGITS: "Per generare EAN-13 inserisci esattamente 12 cifre: la tredicesima viene calcolata.",
  EAN13_VALIDATE_REQUIRES_13_DIGITS: "Per verificare EAN-13 inserisci esattamente 13 cifre, compresa la cifra di controllo.",
  EAN13_MODE_UNSUPPORTED: "La modalità EAN-13 richiesta non è supportata.",
  CODE128B_INPUT_REQUIRED: "Inserisci almeno un carattere ASCII stampabile.",
  CODE128B_INPUT_TOO_LONG: `Questa implementazione limita Code 128 B a ${CODE128B_MAX_CHARACTERS} caratteri per mantenere il simbolo gestibile.`,
  CODE128B_UNSUPPORTED_CHARACTER: "Code 128 B in questo strumento accetta solo ASCII stampabile da spazio (32) a tilde (126). Unicode, caratteri di controllo, FNC e switching A/C non sono supportati.",
  CODE128B_VALIDATE_UNSUPPORTED: "La modalità di verifica di una sequenza Code 128 grezza non è esposta: questo strumento genera soltanto Code Set B dal testo supportato.",
  BARCODE_PNG_EXPORT_UNAVAILABLE: "Questo browser non riesce a esportare il PNG. Puoi scaricare lo stesso simbolo in SVG.",
};

function errorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata. Nessun risultato è stato prodotto.";
  const key = result.message.split(":")[0] ?? result.message;
  return ERRORS[key] ?? "Non riesco a generare il barcode con questi dati. Controlla formato e contenuto.";
}

export function BarcodeGeneratorTool() {
  const [format, setFormat] = useState<"ean13" | "code128b">("ean13");
  const [eanMode, setEanMode] = useState<"generate" | "validate">("generate");
  const [value, setValue] = useState("");
  const [humanReadable, setHumanReadable] = useState(true);
  const [downloadError, setDownloadError] = useState("");
  const operation = useToolOperation<BarcodeResult>(
    async (signal) => toolRuntime.run("barcode-generator", {
      format,
      value,
      mode: format === "ean13" ? eanMode : "generate",
      humanReadable,
    }, {}, signal),
    { formatError: errorIt },
  );
  const result = operation.result;

  function reset() {
    operation.reset();
    setFormat("ean13");
    setEanMode("generate");
    setValue("");
    setHumanReadable(true);
    setDownloadError("");
  }

  const inputLabel = format === "ean13"
    ? eanMode === "generate" ? "Prime 12 cifre EAN-13" : "EAN-13 completo, 13 cifre"
    : "Testo Code 128 B";

  return <ToolOperation busy={operation.isRunning}>
    <form onSubmit={(event) => { event.preventDefault(); setDownloadError(""); void operation.run(); }} noValidate>
      <ToolFormCard>
        <label class="field"><span>Formato barcode</span><select value={format} onChange={(event) => { setFormat(event.currentTarget.value as "ean13" | "code128b"); operation.reset(); setValue(""); }}><option value="ean13">EAN-13</option><option value="code128b">Code 128 B · subset ASCII stampabile</option></select></label>
        {format === "ean13" && <label class="field"><span>Modalità EAN-13</span><select value={eanMode} onChange={(event) => { setEanMode(event.currentTarget.value as "generate" | "validate"); operation.reset(); setValue(""); }}><option value="generate">Genera cifra di controllo</option><option value="validate">Verifica cifra di controllo</option></select></label>}
        <label class="field"><span>{inputLabel}</span><input aria-label={inputLabel} type="text" inputMode={format === "ean13" ? "numeric" : "text"} autoComplete="off" value={value} maxLength={format === "ean13" ? (eanMode === "generate" ? 12 : 13) : CODE128B_MAX_CHARACTERS + 1} placeholder={format === "ean13" ? (eanMode === "generate" ? "978047138429" : "9780471384298") : "ABC-123 / sample"} onInput={(event) => setValue(event.currentTarget.value)} /></label>
        <label class="choice-line"><input type="checkbox" checked={humanReadable} onChange={(event) => setHumanReadable(event.currentTarget.checked)} /> Mostra il valore leggibile sotto le barre</label>
        {format === "code128b" && <p class="file-note">Subset dichiarato: Code Set B, solo ASCII stampabile U+0020–U+007E. Non sono supportati FNC1–FNC4, Code A, Code C, cambi di set, GS1‑128, caratteri di controllo o Unicode.</p>}
      </ToolFormCard>
      <InlineError message={operation.error || downloadError} />
      <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{format === "ean13" && eanMode === "validate" ? "Verifica EAN-13" : "Genera barcode"}</ToolSubmitButton><ToolResetButton onClick={reset} /></ToolActions>
    </form>
    <ToolResultPanel eyebrow="Barcode" placeholder="Il simbolo, il checksum e i download locali appariranno qui." busy={operation.isRunning} state={operation.status === "success" ? "success" : operation.status === "error" ? "error" : "idle"}>
      {result !== null && <>
        <dl class="assumptions">
          <div><dt>Formato</dt><dd>{result.format === "ean13" ? "EAN-13" : "Code 128 B"}</dd></div>
          <div><dt>Valore</dt><dd>{result.value}</dd></div>
          <div><dt>Checksum</dt><dd>{result.format === "ean13" ? `atteso ${result.expectedChecksum} · presente ${result.checksum}` : `${result.checksum} (mod 103)`}</dd></div>
          <div><dt>Esito</dt><dd>{result.valid ? "valido" : "non valido"}</dd></div>
          <div><dt>Testo leggibile</dt><dd>{result.humanReadable ? "sì" : "no"}</dd></div>
        </dl>
        {result.valid && result.svg !== null ? <>
          <img src={`data:image/svg+xml,${encodeURIComponent(result.svg)}`} alt={`${result.format === "ean13" ? "EAN-13" : "Code 128 B"} ${result.value}`} style={{ width: "100%", "max-width": "720px", height: "auto", background: "#ffffff" }} />
          <p class="file-note">{result.policySummary} Generazione e download restano locali; nessun dato viene inviato in rete.</p>
          <ToolActions>
            <button class="button primary" type="button" onClick={() => downloadBlob(svgBlob(result.svg!), safeFilename(result.value, "barcode", "svg"))}>{it(CONTROL.download)} SVG</button>
            <button class="button" type="button" onClick={() => {
              setDownloadError("");
              void barcodePngBlob(result.moduleBits, result.quietZoneModules, result.humanReadable ? result.value : undefined, 3, result.barHeightModules)
                .then((blob) => downloadBlob(blob, safeFilename(result.value, "barcode", "png")))
                .catch(() => setDownloadError(ERRORS.BARCODE_PNG_EXPORT_UNAVAILABLE!));
            }}>{it(CONTROL.download)} PNG</button>
          </ToolActions>
        </> : <p role="status">EAN-13 non valido: la cifra finale è {result.checksum}, ma per le prime 12 cifre la cifra di controllo corretta è {result.expectedChecksum}. Nessun barcode viene prodotto.</p>}
        {result.format === "code128b" && <details><summary>Subset supportato</summary><p>{result.supportedCharacters}</p>{result.codewords !== undefined && <p>Codeword: {result.codewords.join(", ")}</p>}</details>}
      </>}
    </ToolResultPanel>
  </ToolOperation>;
}
