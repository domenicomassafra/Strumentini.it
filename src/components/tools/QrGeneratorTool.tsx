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
import { downloadBlob, qrPngBlob, safeFilename, svgBlob } from "./marketing-media/localFiles";
import { QR_MAX_BYTES } from "../../engines/qr";

interface QrResult {
  readonly payload: string;
  readonly byteLength: number;
  readonly byteLimit: number;
  readonly bytesRemaining: number;
  readonly version: number;
  readonly size: number;
  readonly quietZone: number;
  readonly errorCorrection: string;
  readonly mask: number;
  readonly matrixRows: readonly string[];
  readonly svg: string;
}

const BYTE_LIMIT = QR_MAX_BYTES;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

const GENERATOR_ERRORS: Readonly<Record<string, string>> = {
  QR_INPUT_REQUIRED: "Inserisci il testo o l'URL da trasformare in codice QR.",
  QR_PAYLOAD_TOO_LARGE: `Il contenuto supera i ${BYTE_LIMIT} byte del formato supportato da questo strumento. Accorcia il testo o l'URL e riprova.`,
  QR_INVALID_MASK: "La maschera richiesta non è un valore valido da 0 a 7.",
  QR_PNG_EXPORT_UNAVAILABLE: "Questo browser non riesce a esportare il PNG. Scarica il file SVG, che è equivalente.",
};

function generatorErrorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata. Nessun risultato è stato prodotto.";
  const key = result.message.split(":")[0] ?? result.message;
  return GENERATOR_ERRORS[key] ?? "Non riesco a generare il codice QR con questi dati. Controlla il contenuto inserito.";
}

export function QrGeneratorTool() {
  const [preset, setPreset] = useState<"text" | "wifi">("text");
  const [payload, setPayload] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [hidden, setHidden] = useState(false);
  const operation = useToolOperation<QrResult>(
    async (signal) => toolRuntime.run("qr-generator", preset === "wifi"
      ? { preset, ssid, password, security, hidden }
      : { preset, payload }, {}, signal),
    { formatError: generatorErrorIt },
  );

  const used = byteLength(payload);
  const overBy = Math.max(0, used - BYTE_LIMIT);
  const counter: "ok" | "warn" | "error" = overBy > 0 ? "error" : overBy === 0 && used > 0 ? "warn" : "ok";
  const result = operation.result;
  const downloadNameSeed = preset === "wifi" ? "rete-wifi" : result?.payload ?? "codice-qr";

  function reset() {
    operation.reset();
    setPayload("");
    setSsid("");
    setPassword("");
    setSecurity("WPA");
    setHidden(false);
    setPreset("text");
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
          <label class="field"><span>Tipo di QR</span><select value={preset} onChange={(event) => setPreset(event.currentTarget.value as "text" | "wifi")}><option value="text">Testo o URL</option><option value="wifi">Rete Wi-Fi</option></select></label>
          {preset === "text" ? (
            <label class="field">
              <span>Contenuto da codificare</span>
              <textarea aria-label="Contenuto da codificare" rows={4} value={payload} placeholder="https://esempio.it/campagna" onInput={(event) => setPayload(event.currentTarget.value)} disabled={operation.isRunning} />
              <small><StatusMark kind={counter} label={statusMarkLabel(counter)} />{" "}{used === 0 ? `Nessun carattere. Limite: ${BYTE_LIMIT} byte UTF-8.` : overBy > 0 ? `${used} byte UTF-8: supera di ${overBy} il limite di ${BYTE_LIMIT} byte.` : `${used} byte UTF-8 su ${BYTE_LIMIT} disponibili.`}</small>
            </label>
          ) : (
            <>
              <label class="field"><span>Nome rete (SSID)</span><input type="text" value={ssid} onInput={(event) => setSsid(event.currentTarget.value)} autoComplete="off" /></label>
              <label class="field"><span>Sicurezza</span><select value={security} onChange={(event) => setSecurity(event.currentTarget.value as "WPA" | "WEP" | "nopass")}><option value="WPA">WPA/WPA2/WPA3</option><option value="WEP">WEP</option><option value="nopass">Nessuna password</option></select></label>
              {security !== "nopass" && <label class="field"><span>Password Wi-Fi</span><input type="password" value={password} onInput={(event) => setPassword(event.currentTarget.value)} autoComplete="new-password" /></label>}
              <label class="choice-line"><input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.currentTarget.checked)} /> Rete nascosta</label>
              <small>SSID e password restano nello stato locale della pagina: non vengono aggiunti all'URL o alla cronologia.</small>
            </>
          )}
        </ToolFormCard>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Genera codice QR</ToolSubmitButton>
          <ToolResetButton onClick={reset} />
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow="Codice QR"
        placeholder="Il simbolo generato, i suoi parametri e i file da scaricare appariranno qui."
        busy={operation.isRunning}
        state={operation.status === "success" ? "success" : operation.status === "error" ? "error" : "idle"}
      >
        {result !== null && (
          <>
            <img
              src={`data:image/svg+xml,${encodeURIComponent(result.svg)}`}
              alt={`Codice QR del contenuto inserito, versione ${result.version}`}
              width={240}
              height={240}
              style={{ maxWidth: "100%", height: "auto", "image-rendering": "pixelated" }}
            />
            <dl class="assumptions">
              <div><dt>Versione</dt><dd>{result.version} · {result.size} moduli per lato</dd></div>
              <div><dt>Correzione errori</dt><dd>Livello {result.errorCorrection}</dd></div>
              <div><dt>Maschera</dt><dd>{result.mask} (scelta automaticamente dal miglior punteggio)</dd></div>
              <div><dt>Zona di silenzio</dt><dd>{result.quietZone} moduli su ogni lato</dd></div>
              <div><dt>Byte UTF-8</dt><dd>{result.byteLength} di {result.byteLimit}</dd></div>
            </dl>
            <p class="file-note">
              Il simbolo è generato interamente in locale con codifica in modalità byte e correzione errori di
              livello L, come specificato da ISO/IEC 18004. Nessun dato lascia il dispositivo.
            </p>
            <ToolActions>
              <button
                class="button primary"
                type="button"
                onClick={() => downloadBlob(svgBlob(result.svg), safeFilename(downloadNameSeed, "codice-qr", "svg"))}
              >
                {it(CONTROL.download)} SVG
              </button>
              <button
                class="button"
                type="button"
                onClick={() => {
                  void qrPngBlob(result.matrixRows, result.quietZone)
                    .then((blob) => downloadBlob(blob, safeFilename(downloadNameSeed, "codice-qr", "png")))
                    .catch(() => undefined);
                }}
              >
                {it(CONTROL.download)} PNG
              </button>
            </ToolActions>
            <details>
              <summary>Righe della matrice</summary>
              <pre class="schema-preview">{result.matrixRows.join("\n")}</pre>
            </details>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
