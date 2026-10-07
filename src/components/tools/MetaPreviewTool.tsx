import { useState } from "preact/hooks";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { ToolRunResult } from "../../runtime/types";
import {
  CONTROL,
  InlineError,
  it,
  RangeMark,
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

interface MetaResult {
  readonly title: string;
  readonly description: string;
  readonly titleCharacters: number;
  readonly descriptionCharacters: number;
  readonly titleLimit: number;
  readonly descriptionLimit: number;
  readonly titleLimitOverridden: boolean;
  readonly descriptionLimitOverridden: boolean;
  readonly titleLimitSource: string;
  readonly descriptionLimitSource: string;
  readonly titleOverBy: number;
  readonly descriptionOverBy: number;
  readonly titleWithinLimit: boolean;
  readonly descriptionWithinLimit: boolean;
  readonly truncatedTitle: string;
  readonly truncatedDescription: string;
  readonly escapedTitle: string;
  readonly escapedDescription: string;
  readonly previewPreset: {
    readonly id: "search-mobile" | "search-desktop";
    readonly labelIt: string;
    readonly platformIt: string;
    readonly viewport: { readonly width: number; readonly height: number };
    readonly source: string;
    readonly checkedAt: string;
    readonly approximationIt: string;
  };
}

const META_ERRORS: Readonly<Record<string, string>> = {
  INVALID_INPUT: "Inserisci titolo e descrizione come testo.",
  INVALID_META_LIMIT: "I limiti di lunghezza devono essere numeri interi maggiori di zero.",
  INPUT_TOO_LARGE: "Il testo supera il limite locale previsto da questo strumento. Accorcialo e riprova.",
};

function metaErrorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata. Nessun risultato è stato prodotto.";
  const key = result.message.split(":")[0] ?? result.message;
  return META_ERRORS[key] ?? "Non riesco a valutare titolo e descrizione con questi dati. Controlla i campi inseriti.";
}

export function MetaPreviewTool() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleLimit, setTitleLimit] = useState("");
  const [descriptionLimit, setDescriptionLimit] = useState("");
  const [preset, setPreset] = useState<"search-mobile" | "search-desktop">("search-mobile");
  const [copyState, setCopyState] = useState("");

  const operation = useToolOperation<MetaResult>(
    async (signal) => {
      const overrides: { title?: number; description?: number } = {};
      if (titleLimit.trim() !== "") overrides.title = Number(titleLimit);
      if (descriptionLimit.trim() !== "") overrides.description = Number(descriptionLimit);
      return toolRuntime.run("meta-preview", { title, description, preset, ...overrides }, {}, signal);
    },
    { formatError: metaErrorIt },
  );
  const result: MetaResult | null = operation.result;

  function reset() {
    operation.reset();
    setTitle("");
    setDescription("");
    setTitleLimit("");
    setDescriptionLimit("");
    setPreset("search-mobile");
    setCopyState("");
  }

  async function copySnippet() {
    if (result === null || navigator.clipboard === undefined) {
      setCopyState("Copia non riuscita. Seleziona il testo e copialo manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`<title>${result.escapedTitle}</title>\n<meta name="description" content="${result.escapedDescription}">`);
      setCopyState("Tag copiati negli appunti.");
    } catch {
      setCopyState("Copia non riuscita. Seleziona il testo e copialo manualmente.");
    }
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
            <span>Titolo</span>
            <textarea
              aria-label="Titolo"
              rows={2}
              value={title}
              placeholder="Preventivo per sito web — Studio Rossi"
              onInput={(event) => setTitle(event.currentTarget.value)}
              disabled={operation.isRunning}
            />
          </label>
          <label class="field">
            <span>Descrizione</span>
            <textarea
              aria-label="Descrizione"
              rows={4}
              value={description}
              placeholder="Ricevi il preventivo entro due giorni lavorativi."
              onInput={(event) => setDescription(event.currentTarget.value)}
              disabled={operation.isRunning}
            />
          </label>
          <label class="field">
            <span>Preset anteprima</span>
            <select
              aria-label="Preset anteprima"
              value={preset}
              onChange={(event) => setPreset(event.currentTarget.value as "search-mobile" | "search-desktop")}
              disabled={operation.isRunning}
            >
              <option value="search-mobile">Ricerca mobile · 390 px</option>
              <option value="search-desktop">Ricerca desktop · 1280 px</option>
            </select>
            <small>Il preset descrive il contesto visivo; non simula pixel per pixel un motore di ricerca.</small>
          </label>
          <div class="field-grid">
            <label class="field">
              <span>Limite del titolo</span>
              <input
                aria-label="Limite del titolo"
                type="number"
                min="1"
                step="1"
                value={titleLimit}
                placeholder="60"
                onInput={(event) => setTitleLimit(event.currentTarget.value)}
                disabled={operation.isRunning}
              />
              <small>Lascia vuoto per il riferimento di 60 caratteri.</small>
            </label>
            <label class="field">
              <span>Limite della descrizione</span>
              <input
                aria-label="Limite della descrizione"
                type="number"
                min="1"
                step="1"
                value={descriptionLimit}
                placeholder="160"
                onInput={(event) => setDescriptionLimit(event.currentTarget.value)}
                disabled={operation.isRunning}
              />
              <small>Lascia vuoto per il riferimento di 160 caratteri.</small>
            </label>
          </div>
        </ToolFormCard>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Mostra anteprima</ToolSubmitButton>
          <ToolResetButton onClick={reset} />
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow="Anteprima di ricerca"
        placeholder="Come apparirà il risultato e quanto testo resta disponibile appariranno qui."
        busy={operation.isRunning}
        state={operation.status === "success" ? "success" : operation.status === "error" ? "error" : "idle"}
      >
        {result !== null && (
          <>
            <p class="eyebrow">Anteprima · {result.previewPreset.labelIt}</p>
            <div style={{ maxWidth: `${result.previewPreset.viewport.width}px` }}>
              <p style={{ color: "var(--brand)", margin: "0 0 var(--space-1)" }}>esempio.it</p>
              <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--font-size-lg)", overflowWrap: "anywhere" }}>
                {result.title.length === 0 ? "Nessun titolo" : result.truncatedTitle}
                {result.titleOverBy > 0 && <span class="count-chip"> …</span>}
              </p>
              <p style={{ margin: "0 0 var(--space-4)", color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                {result.description.length === 0 ? "Nessuna descrizione" : result.truncatedDescription}
                {result.descriptionOverBy > 0 && <span class="count-chip"> …</span>}
              </p>
            </div>

            <ul class="status-list">
              <li>
                <StatusMark kind={result.titleWithinLimit ? "ok" : "warn"} label={statusMarkLabel(result.titleWithinLimit ? "ok" : "warn")} />{" "}
                <RangeMark start="0" end={String(result.titleCharacters)} />{" "}
                <span class="count-chip">
                  titolo {result.titleCharacters}/{result.titleLimit}
                  {result.titleOverBy > 0 ? ` · ${result.titleOverBy} caratteri di troppo, troncati in anteprima` : ""}
                </span>
              </li>
              <li>
                <StatusMark kind={result.descriptionWithinLimit ? "ok" : "warn"} label={statusMarkLabel(result.descriptionWithinLimit ? "ok" : "warn")} />{" "}
                <RangeMark start="0" end={String(result.descriptionCharacters)} />{" "}
                <span class="count-chip">
                  descrizione {result.descriptionCharacters}/{result.descriptionLimit}
                  {result.descriptionOverBy > 0 ? ` · ${result.descriptionOverBy} caratteri di troppo, troncati in anteprima` : ""}
                </span>
              </li>
            </ul>

            <dl class="assumptions">
              <div><dt>Conteggio</dt><dd>Punti di codice Unicode, non byte né unità grafiche.</dd></div>
              <div>
                <dt>Riferimento</dt>
                <dd>
                  {result.titleLimitSource}. {result.descriptionLimitSource}
                </dd>
              </div>
              <div><dt>Preset</dt><dd>{result.previewPreset.platformIt} · {result.previewPreset.viewport.width}×{result.previewPreset.viewport.height}px</dd></div>
              <div><dt>Fonte preset</dt><dd>{result.previewPreset.source} · controllata il {result.previewPreset.checkedAt}</dd></div>
              {result.titleLimitOverridden && <div><dt>Limite titolo</dt><dd>{result.titleLimit}, indicato da te al posto del riferimento.</dd></div>}
              {result.descriptionLimitOverridden && <div><dt>Limite descrizione</dt><dd>{result.descriptionLimit}, indicato da te al posto del riferimento.</dd></div>}
              <div><dt>Spazi iniziali e finali</dt><dd>Rimossi prima del conteggio.</dd></div>
            </dl>

            <p class="file-note">
              {result.previewPreset.approximationIt} Il testo è contato come dato: non viene eseguito e non viene interpretato
              come markup. Qui sotto trovi la versione con i caratteri speciali già protetti, pronta da copiare.
            </p>
            <pre class="schema-preview">{`<title>${result.escapedTitle}</title>\n<meta name="description" content="${result.escapedDescription}">`}</pre>
            <ToolActions>
              <button class="button" type="button" onClick={() => void copySnippet()}>Copia i tag protetti</button>
            </ToolActions>
            {copyState !== "" && <p role="status" class="file-note">{copyState}</p>}
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
