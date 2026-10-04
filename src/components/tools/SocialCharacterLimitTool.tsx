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

interface SocialResult {
  readonly platformLabelIt: string;
  readonly limit: number;
  readonly declaredLimit: number;
  readonly limitOverridden: boolean;
  readonly limitScopeIt: string;
  readonly limitSource: string;
  readonly limitVerifiedOn: string;
  readonly characters: number;
  readonly weightedCharacters: number | null;
  readonly countingMethod: "codePoints" | "xWeighted";
  readonly remaining: number;
  readonly remainingWeighted: number | null;
  readonly overBy: number;
  readonly withinLimit: boolean;
  readonly withinLimitWeighted: boolean | null;
  readonly lineBreaks: number;
}

const SOCIAL_ERRORS: Readonly<Record<string, string>> = {
  INVALID_SOCIAL_PLATFORM: "Scegli una delle piattaforme elencate: lo strumento non usa limiti presunti.",
  INVALID_SOCIAL_LIMIT: "Il limite personalizzato deve essere un numero intero maggiore di zero.",
  INVALID_INPUT: "Inserisci il testo del post da controllare.",
  INPUT_TOO_LARGE: "Il testo supera il limite locale previsto da questo strumento. Accorcialo e riprova.",
};

const PLATFORMS = [
  { id: "x", label: "X (ex Twitter) · 280" },
  { id: "linkedin", label: "LinkedIn · 3.000" },
  { id: "instagram", label: "Instagram · 2.200" },
  { id: "facebook", label: "Facebook · 63.206" },
  { id: "youtube", label: "YouTube, titolo · 100" },
  { id: "tiktok", label: "TikTok · 2.200" },
  { id: "mastodon", label: "Mastodon · 500" },
  { id: "bluesky", label: "Bluesky · 300" },
] as const;

function socialErrorIt(result: Extract<ToolRunResult, { ok: false }>): string {
  if (result.code === "CANCELLED") return "Operazione annullata. Nessun risultato è stato prodotto.";
  const key = result.message.split(":")[0] ?? result.message;
  return SOCIAL_ERRORS[key] ?? "Non riesco a controllare la lunghezza del testo con questi dati.";
}

export function SocialCharacterLimitTool() {
  const [platform, setPlatform] = useState<string>("x");
  const [text, setText] = useState("");
  const [customLimit, setCustomLimit] = useState("");
  const operation = useToolOperation<SocialResult>(
    async (signal) => {
      const input: Record<string, unknown> = { platform, text };
      if (customLimit.trim() !== "") input.limit = Number(customLimit);
      return toolRuntime.run("social-character-limit", input, {}, signal);
    },
    { formatError: socialErrorIt },
  );
  const result: SocialResult | null = operation.result;

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
            <span>Piattaforma</span>
            <select
              aria-label="Piattaforma"
              value={platform}
              onChange={(event) => setPlatform(event.currentTarget.value)}
              disabled={operation.isRunning}
            >
              {PLATFORMS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
          <label class="field">
            <span>Testo del post</span>
            <textarea
              aria-label="Testo del post"
              rows={7}
              value={text}
              placeholder="Scrivi qui il testo da controllare."
              onInput={(event) => setText(event.currentTarget.value)}
              disabled={operation.isRunning}
            />
          </label>
          <label class="field">
            <span>Limite personalizzato</span>
            <input
              aria-label="Limite personalizzato"
              type="number"
              min="1"
              step="1"
              value={customLimit}
              placeholder="Lascia vuoto per usare quello dichiarato dalla piattaforma"
              onInput={(event) => setCustomLimit(event.currentTarget.value)}
              disabled={operation.isRunning}
            />
            <small>Utile quando l'istanza, il piano o la campagna hanno un limite diverso.</small>
          </label>
        </ToolFormCard>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Controlla lunghezza</ToolSubmitButton>
          <ToolResetButton onClick={() => {
            operation.reset();
            setText("");
            setCustomLimit("");
          }} />
        </ToolActions>
      </form>
      <ToolResultPanel
        eyebrow="Controllo lunghezza"
        placeholder="Conteggio, spazio rimanente e fonte del limite appariranno qui."
        busy={operation.isRunning}
        state={operation.status === "success" ? "success" : operation.status === "error" ? "error" : "idle"}
      >
        {result !== null && (
          <>
            <ul class="status-list">
              <li>
                <StatusMark kind={result.withinLimit ? "ok" : "error"} label={statusMarkLabel(result.withinLimit ? "ok" : "error")} />{" "}
                <RangeMark start="0" end={String(result.characters)} />{" "}
                <span class="count-chip">
                  {result.characters} caratteri su {result.limit}
                  {result.withinLimit
                    ? ` · ne restano ${Math.max(0, result.remaining)}`
                    : ` · ${result.overBy} caratteri di troppo`}
                </span>
              </li>
              {result.weightedCharacters !== null && (
                <li>
                  <StatusMark kind={result.withinLimitWeighted === true ? "ok" : "error"} label={statusMarkLabel(result.withinLimitWeighted === true ? "ok" : "error")} />{" "}
                  <RangeMark start="0" end={String(result.weightedCharacters)} />{" "}
                  <span class="count-chip">
                    {result.weightedCharacters} caratteri ponderati
                    {result.withinLimitWeighted === true
                      ? ` · ne restano ${Math.max(0, result.remainingWeighted ?? 0)}`
                      : " · il post supera il limite della piattaforma"}
                  </span>
                </li>
              )}
            </ul>

            <dl class="assumptions">
              <div><dt>Piattaforma</dt><dd>{result.platformLabelIt} · {result.limitScopeIt}</dd></div>
              <div>
                <dt>Conteggio</dt>
                <dd>
                  {result.countingMethod === "xWeighted"
                    ? "Punti di codice Unicode più il conteggio ponderato pubblicato dalla piattaforma: i caratteri CJK valgono 2 e ogni link vale 23."
                    : "Punti di codice Unicode. È il metodo dichiarato per questa piattaforma; la piattaforma potrebbe contarne diversamente."}
                </dd>
              </div>
              <div><dt>Limite dichiarato</dt><dd>{result.declaredLimit} caratteri</dd></div>
              {result.limitOverridden && <div><dt>Limite applicato</dt><dd>{result.limit} caratteri, indicato da te al posto di quello dichiarato</dd></div>}
              <div><dt>Righe</dt><dd>{result.lineBreaks}</dd></div>
              <div><dt>Fonte del limite</dt><dd>{result.limitSource} · verificato il {result.limitVerifiedOn}</dd></div>
            </dl>

            <p class="file-note">
              Le piattaforme cambiano questi valori: la data serve a dirti da quanto sono controllati, non a garantire
              che non siano cambiati nel frattempo. Se conosci il limite applicato al tuo caso, usa il campo
              personalizzato.
            </p>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}