import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { ToolRunResult } from "../../runtime/types";
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
} from "./shared";
import { imagePixelsFrom } from "./marketing-media/localFiles";
import { QR_RASTER_MAX_PIXELS } from "../../engines/qr";

interface QrReadResult {
  readonly payload: string;
  readonly version: number;
  readonly size: number;
  readonly mask: number;
  readonly errorCorrection: string;
  readonly byteLength: number;
  readonly source: string;
  readonly errorCorrectionVerified: boolean;
  readonly maskFromFormatInformation: boolean;
  readonly formatCopiesAgree: boolean;
  readonly formatRepairDistance: number;
}

const READER_ERRORS: Readonly<Record<string, string>> = {
  QR_INPUT_REQUIRED: "Seleziona un'immagine oppure incolla una matrice QR, righe di 0 e 1, oppure un SVG prodotto da questo strumento.",
  QR_IMAGE_TOO_SMALL: "L'immagine è troppo piccola per contenere un codice QR. Servono almeno 21×21 pixel.",
  QR_IMAGE_TOO_LARGE: `L'immagine supera il limite di ${Math.round(QR_RASTER_MAX_PIXELS / 1_000_000)} megapixel impostato per questa lettura locale. Riducila e riprova.`,
  QR_DECODE_FAILED: "Non riconosco un codice QR leggibile in questa immagine. Prova un'immagine più nitida, meno ruotata o con più margine bianco attorno al simbolo.",
  QR_IMAGE_DECODER_UNAVAILABLE: "Questo browser non permette di leggere i pixel dell'immagine. Incolla allora la matrice o l'SVG del codice.",
  QR_INVALID_MATRIX: "La matrice incollata non è valida: le righe devono essere composte solo da 0 e 1 e avere la stessa lunghezza.",
  QR_INVALID_INPUT: "L'ingresso non è riconosciuto. Incolla una matrice, righe di 0 e 1, oppure un SVG generato da questo strumento.",
  QR_ERROR_CORRECTION_FAILED: "Il codice non supera la verifica di correzione errori: l'immagine è danneggiata o non è un QR valido.",
  QR_UNSUPPORTED_VERSION: "Il codice usa una versione o un formato che questo strumento non implementa.",
  QR_UNSUPPORTED_MODE: "Il codice usa una modalità di codifica che questo strumento non implementa.",
  QR_UNSUPPORTED_ERROR_CORRECTION_LEVEL: "Il livello di correzione errori del codice non è fra quelli supportati.",
  QR_UNSUPPORTED_ECI: "Il codice dichiara una codifica caratteri non supportata.",
  QR_INVALID_UTF8: "I byte del codice non sono testo UTF-8 valido.",
  QR_INVALID_ECI_DESIGNATOR: "L'indicatore ECI del codice non è valido.",
};

/** Reads the code an engine threw rather than the code the runtime reported. */
function readerThrownIt(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return READER_ERRORS[message] ?? "Non riesco a leggere questo codice QR. Controlla l'ingresso e riprova.";
}

function readerErrorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata. Nessun risultato è stato prodotto.";
  const key = result.message.split(":")[0] ?? result.message;
  return READER_ERRORS[key] ?? "Non riesco a leggere questo codice QR. Controlla l'ingresso e riprova.";
}

export function QrReaderTool() {
  const [file, setFile] = useState<File | null>(null);
  const [matrix, setMatrix] = useState("");
  const operation = useToolOperation<QrReadResult>(
    async (signal) => {
      const input = file === null
        ? { rows: matrix.trim() }
        : { pixels: await imagePixelsFrom(file) };
      return toolRuntime.run("qr-reader", input, {}, signal);
    },
    { formatError: readerErrorIt, formatThrownError: readerThrownIt },
  );

  const result = operation.result;

  function reset() {
    operation.reset();
    setFile(null);
    setMatrix("");
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
            <span>Immagine del codice QR</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/bmp"
              disabled={operation.isRunning}
              onChange={(event) => setFile(event.currentTarget.files?.item(0) ?? null)}
            />
            <small>
              {file === null
                ? "Facoltativa. La lettura avviene nel browser con il rilevatore locale di questo strumento: nessun file viene caricato e non serve alcuna API del browser."
                : `${file.name} · elaborazione locale`}
            </small>
          </label>
          <label class="field">
            <span>Matrice, righe o SVG</span>
            <textarea
              aria-label="Matrice, righe o SVG"
              rows={9}
              value={matrix}
              placeholder={'Righe di 0 e 1, una per riga — oppure incolla qui l\'SVG prodotto da "Genera codice QR".'}
              onInput={(event) => setMatrix(event.currentTarget.value)}
              disabled={operation.isRunning || file !== null}
            />
            <small>Usata solo quando non hai selezionato un'immagine.</small>
          </label>
        </ToolFormCard>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Decodifica QR</ToolSubmitButton>
          <ToolResetButton onClick={reset} />
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow="Contenuto decodificato"
        placeholder="Il testo letto dal codice e i parametri del simbolo appariranno qui."
        busy={operation.isRunning}
        state={operation.status === "success" ? "success" : operation.status === "error" ? "error" : "idle"}
      >
        {result !== null && (
          <>
            <pre class="json-result">{result.payload}</pre>
            <dl class="assumptions">
              <div><dt>Origine</dt><dd>{sourceLabelIt(result.source)}</dd></div>
              <div><dt>Versione</dt><dd>{result.version === 0 ? "non determinata dall'immagine" : `${result.version} · ${result.size} moduli per lato`}</dd></div>
              <div><dt>Correzione errori</dt><dd>Livello {result.errorCorrection}</dd></div>
              <div><dt>Maschera</dt><dd>{result.mask}</dd></div>
              <div><dt>Byte UTF-8</dt><dd>{result.byteLength}</dd></div>
            </dl>
            <ul class="status-list">
              <li>
                <StatusMark kind="ok" label={statusMarkLabel("ok")} />{" "}
                Sintomi di Reed–Solomon verificati: nessun errore rilevato nei codeword letti.
              </li>
              <li>
                <StatusMark kind={result.maskFromFormatInformation ? "ok" : "warn"} label={statusMarkLabel(result.maskFromFormatInformation ? "ok" : "warn")} />{" "}
                {result.maskFromFormatInformation
                  ? `Maschera letta dal campo di formato del simbolo; le due copie ${result.formatCopiesAgree ? "coincidono" : "non coincidono"}.`
                  : "Campo di formato illeggibile: la maschera è stata determinata provando tutte e otto e verificando i sintomi."}
              </li>
            </ul>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}

function sourceLabelIt(source: string): string {
  if (source === "image") return "immagine locale";
  if (source === "svg") return "SVG incollato";
  if (source === "rows") return "righe incollate";
  return "matrice incollata";
}