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

interface ComparisonDifference {
  readonly field: string;
  readonly left: string;
  readonly right: string;
}

interface ComparisonResult {
  readonly equal: boolean;
  readonly mode: "exact" | "semantic";
  readonly left: string;
  readonly right: string;
  readonly differences: readonly ComparisonDifference[];
  readonly credentialWarning: boolean;
}

/** Italian names for the URL parts the engine compares. */
const FIELD_IT: Readonly<Record<string, string>> = {
  origin: "origine (schema, host e porta)",
  path: "percorso",
  query: "parametri",
  hash: "frammento",
  credentials: "credenziali",
};

const COMPARISON_ERRORS: Readonly<Record<string, string>> = {
  INVALID_URL: "Inserisci due URL HTTP(S) completi di protocollo, per esempio https://esempio.it/pagina.",
  UNSAFE_URL_SCHEME: "Sono ammessi solo URL http e https: nessuno schema viene seguito o aperto.",
  INVALID_COMPARISON_MODE: "Scegli una delle due modalità di confronto proposte.",
  INVALID_INPUT: "Compila entrambi i campi URL con un indirizzo valido.",
};

function comparisonErrorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata. Nessun risultato è stato prodotto.";
  const key = result.message.split(":")[0] ?? result.message;
  return COMPARISON_ERRORS[key] ?? "Non riesco a confrontare questi due URL. Controlla i campi inseriti.";
}

export function UrlComparisonTool() {
  const [leftUrl, setLeftUrl] = useState("");
  const [rightUrl, setRightUrl] = useState("");
  const [mode, setMode] = useState<"semantic" | "exact">("semantic");
  const [ignoreFragment, setIgnoreFragment] = useState(true);
  const operation = useToolOperation<ComparisonResult>(
    async (signal) => toolRuntime.run("url-comparison", { leftUrl, rightUrl, mode, ignoreFragment }, {}, signal),
    { formatError: comparisonErrorIt },
  );
  const result: ComparisonResult | null = operation.result;

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
            <span>Primo URL</span>
            <input
              aria-label="Primo URL"
              value={leftUrl}
              placeholder="https://esempio.it/pagina?a=1"
              onInput={(event) => setLeftUrl(event.currentTarget.value)}
              disabled={operation.isRunning}
            />
          </label>
          <label class="field">
            <span>Secondo URL</span>
            <input
              aria-label="Secondo URL"
              value={rightUrl}
              placeholder="https://esempio.it/pagina?a=1"
              onInput={(event) => setRightUrl(event.currentTarget.value)}
              disabled={operation.isRunning}
            />
          </label>
          <label class="field">
            <span>Modalità di confronto</span>
            <select
              aria-label="Modalità di confronto"
              value={mode}
              onChange={(event) => setMode(event.currentTarget.value as "semantic" | "exact")}
              disabled={operation.isRunning}
            >
              <option value="semantic">Semantica: ordine dei parametri indifferente</option>
              <option value="exact">Forma esatta: ogni carattere conta</option>
            </select>
          </label>
          <label class="check-field">
            <input
              type="checkbox"
              aria-label="Ignora il frammento"
              checked={ignoreFragment}
              onChange={(event) => setIgnoreFragment(event.currentTarget.checked)}
              disabled={operation.isRunning}
            />
            <span>
              <span>Ignora il frammento dopo <code>#</code></span>
              <small>Attivo in modalità semantica; disattivalo per confrontare anche l'ancora.</small>
            </span>
          </label>
        </ToolFormCard>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Confronta URL</ToolSubmitButton>
          <ToolResetButton onClick={() => {
            operation.reset();
            setLeftUrl("");
            setRightUrl("");
          }} />
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow="Confronto"
        placeholder="Gli URL normalizzati e le parti che differiscono appariranno qui."
        busy={operation.isRunning}
        state={operation.status === "success" ? "success" : operation.status === "error" ? "error" : "idle"}
      >
        {result !== null && (
          <>
            <ul class="status-list">
              <li>
                <StatusMark kind={result.equal ? "ok" : "warn"} label={statusMarkLabel(result.equal ? "ok" : "warn")} />{" "}
                {result.equal
                  ? `I due URL sono equivalenti in modalità ${result.mode === "semantic" ? "semantica" : "esatta"}.`
                  : `${result.differences.length} ${result.differences.length === 1 ? "parte differisce" : "parti differiscono"}.`}
              </li>
              {result.credentialWarning && (
                <li>
                  <StatusMark kind="warn" label={statusMarkLabel("warn")} /> Uno dei due URL conteneva credenziali: sono
                  state rimosse dal confronto e non compaiono nel risultato.
                </li>
              )}
            </ul>

            <dl class="assumptions">
              <div><dt>Primo URL normalizzato</dt><dd>{result.left}</dd></div>
              <div><dt>Secondo URL normalizzato</dt><dd>{result.right}</dd></div>
            </dl>

            {result.differences.length > 0 && (
              <>
                <p class="eyebrow">Differenze</p>
                <ul class="diff-list">
                  {result.differences.map((difference) => (
                    <li key={difference.field} class="diff-row">
                      <span class="diff-symbol" aria-hidden="true">≠</span>
                      <span class="count-chip">{FIELD_IT[difference.field] ?? difference.field}</span>
                      <code>{difference.left === "" ? "(assente)" : difference.left}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p class="file-note">
              Il confronto non apre nessuno dei due indirizzi e non effettua alcuna richiesta di rete: opera solo sulla
              forma normalizzata del testo.
            </p>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}