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

interface OpenGraphResult {
  readonly tags: Readonly<Record<string, string>>;
  readonly tagCount: number;
  readonly title: string | null;
  readonly description: string | null;
  readonly image: string | null;
  readonly url: string | null;
  readonly type: string | null;
  readonly imageSourceKey: string | null;
  readonly relativeBase: string | null;
  readonly titleCharacters: number;
  readonly descriptionCharacters: number;
  readonly missingCore: readonly string[];
  readonly warnings: readonly string[];
}

const OPEN_GRAPH_ERRORS: Readonly<Record<string, string>> = {
  INVALID_INPUT: "Incolla intestazione HTML o metadati che contengano tag social. Il testo viene solo letto: nessun file viene eseguito o scaricato.",
  INPUT_TOO_LARGE: "Il testo supera il limite locale previsto da questo strumento. Incolla solo l'intestazione della pagina.",
  QR_INPUT_REQUIRED: "",
};

/** Italian names for the warnings the engine can emit, keyed by code. */
const WARNING_IT: Readonly<Record<string, string>> = {
  MISSING_TITLE: "manca il titolo",
  MISSING_DESCRIPTION: "manca la descrizione",
  MISSING_IMAGE: "manca l'immagine",
  MISSING_URL: "manca l'URL",
  MISSING_TYPE: "manca il tipo",
  RELATIVE_URL_RESOLVED: "un URL relativo è stato reso assoluto",
  UNSAFE_OG_IMAGE: "l'URL dell'immagine usa uno schema non ammesso ed è stato ignorato",
  INVALID_OG_IMAGE_WIDTH: "la larghezza dichiarata dell'immagine non è un numero valido",
  INVALID_OG_IMAGE_HEIGHT: "l'altezza dichiarata dell'immagine non è un numero valido",
  INVALID_OG_URL: "l'URL dichiarato non è valido",
  INVALID_TWITTER_IMAGE: "l'URL dell'immagine Twitter non è valido",
  UNSAFE_OG_URL: "l'URL dichiarato usa uno schema non ammesso ed è stato ignorato",
  UNSAFE_TWITTER_URL: "l'URL Twitter usa uno schema non ammesso ed è stato ignorato",
};

const CORE_IT: Readonly<Record<string, string>> = {
  title: "titolo",
  description: "descrizione",
  image: "immagine",
  url: "URL",
  type: "tipo",
};

function warningIt(code: string): string {
  const known = WARNING_IT[code];
  if (known !== undefined) return known;
  const normalized = code.toLowerCase().replaceAll("_", " ");
  return `avviso del motore: ${normalized}`;
}

function openGraphErrorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata. Nessun risultato è stato prodotto.";
  const key = result.message.split(":")[0] ?? result.message;
  return OPEN_GRAPH_ERRORS[key] ?? "Non riesco a leggere i tag social da questo testo. Controlla di aver incollato l'intestazione della pagina.";
}

export function OpenGraphPreviewTool() {
  const [html, setHtml] = useState("");
  const operation = useToolOperation<OpenGraphResult>(
    async (signal) => toolRuntime.run("open-graph-preview", { html }, {}, signal),
    { formatError: openGraphErrorIt },
  );
  const result: OpenGraphResult | null = operation.result;

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
            <span>Intestazione HTML o metadati</span>
            <textarea
              aria-label="Intestazione HTML o metadati"
              rows={10}
              value={html}
              placeholder={'<meta property="og:title" content="Titolo">'}
              onInput={(event) => setHtml(event.currentTarget.value)}
              disabled={operation.isRunning}
            />
            <small>
              Il testo viene analizzato come dato: nessun collegamento viene seguito e nessuno script viene eseguito.
            </small>
          </label>
        </ToolFormCard>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Estrai tag social</ToolSubmitButton>
          <ToolResetButton onClick={() => {
            operation.reset();
            setHtml("");
          }} />
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow="Anteprima social"
        placeholder="I tag trovati, l'anteprima che ne deriva e gli avvisi appariranno qui."
        busy={operation.isRunning}
        state={operation.status === "success" ? "success" : operation.status === "error" ? "error" : "idle"}
      >
        {result !== null && (
          <>
            <dl class="assumptions">
              <div><dt>Tag sociali trovati</dt><dd>{result.tagCount}</dd></div>
              <div>
                <dt>Proprietà core mancanti</dt>
                <dd>{result.missingCore.length === 0 ? "nessuna" : result.missingCore.map((key) => CORE_IT[key] ?? key).join(", ")}</dd>
              </div>
              <div><dt>Immagine da</dt><dd>{result.imageSourceKey ?? "nessun tag immagine"}</dd></div>
              <div><dt>Lunghezza titolo</dt><dd>{result.titleCharacters} caratteri</dd></div>
              <div><dt>Lunghezza descrizione</dt><dd>{result.descriptionCharacters} caratteri</dd></div>
            </dl>

            <p class="eyebrow">Anteprima della scheda</p>
            <p style={{ color: "var(--brand)", margin: "0 0 var(--space-1)", overflowWrap: "anywhere" }}>{result.url ?? "URL non dichiarato"}</p>
            <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--font-size-lg)" }}>{result.title ?? "Nessun titolo"}</p>
            <p style={{ margin: "0 0 var(--space-4)", color: "var(--text-muted)" }}>{result.description ?? "Nessuna descrizione"}</p>
            {result.image !== null
              ? (
                <>
                  <pre class="schema-preview">{result.image}</pre>
                  <p class="file-note">
                    L'indirizzo è mostrato come testo e non caricato: aprire un'immagine dichiarata da una pagina
                    qualsiasi farebbe uscire questo strumento dalla rete locale, che è il suo unico patto.
                  </p>
                </>
              )
              : <p class="file-note">Nessuna immagine dichiarata.</p>}

            <ul class="status-list">
              {result.warnings.length === 0 && (
                <li><StatusMark kind="ok" label={statusMarkLabel("ok")} /> Nessun avviso: le proprietà sociali obbligatorie sono presenti.</li>
              )}
              {result.warnings.map((warning) => (
                <li key={warning}>
                  <StatusMark kind="warn" label={statusMarkLabel("warn")} /> {warningIt(warning)}
                </li>
              ))}
            </ul>

            {result.relativeBase !== null && (
              <p class="file-note">
                Un URL relativo è stato reso assoluto usando {result.relativeBase} come base fittizia, così da non
                scaricare nulla. Sostituiscilo con l'indirizzo reale del sito prima di pubblicare.
              </p>
            )}

            <details>
              <summary>Tutti i tag trovati</summary>
              <pre class="schema-preview">{Object.entries(result.tags).map(([key, value]) => `${key} = ${value}`).join("\n")}</pre>
            </details>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}