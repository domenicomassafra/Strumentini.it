import { useMemo, useState } from "preact/hooks";
import { ITALIAN_PASSPHRASE_WORDLIST } from "../../reference-data/italian-passphrase-v1";
import {
  generateSecret,
  PASSPHRASE_WORDS_MAX,
  PASSPHRASE_WORDS_MIN,
  PASSWORD_LENGTH_MAX,
  PASSWORD_LENGTH_MIN,
  PIN_LENGTH_MAX,
  PIN_LENGTH_MIN,
  type GeneratedSecret,
} from "../../tools/password-pin-passphrase-generator/module";
import { InlineError, ResultBreakdown, ResultProvenance, ToolActions, ToolGutter, ToolSurface } from "./shared";

type Mode = "password" | "pin" | "passphrase";

const ERROR_COPY: Readonly<Record<string, string>> = {
  WEBCRYPTO_UNAVAILABLE: "Questo browser non espone WebCrypto: non posso generare il segreto in modo sicuro.",
  PASSWORD_CHARACTER_SET_REQUIRED: "Seleziona almeno una classe di caratteri.",
  PASSWORD_LENGTH_INVALID: `La password deve avere tra ${PASSWORD_LENGTH_MIN} e ${PASSWORD_LENGTH_MAX} caratteri.`,
  PIN_LENGTH_INVALID: `Il PIN deve avere tra ${PIN_LENGTH_MIN} e ${PIN_LENGTH_MAX} cifre.`,
  PASSPHRASE_WORD_COUNT_INVALID: `La passphrase deve avere tra ${PASSPHRASE_WORDS_MIN} e ${PASSPHRASE_WORDS_MAX} parole.`,
};

function errorMessage(error: unknown): string {
  const key = error instanceof Error ? error.message : "";
  return ERROR_COPY[key] ?? "Non riesco a generare il valore con queste opzioni.";
}

export function PasswordPinPassphraseGeneratorTool() {
  const [mode, setMode] = useState<Mode>("password");
  const [length, setLength] = useState(20);
  const [lowercase, setLowercase] = useState(true);
  const [uppercase, setUppercase] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [wordCount, setWordCount] = useState(7);
  const [separator, setSeparator] = useState("-");
  const [result, setResult] = useState<GeneratedSecret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");

  const modeLabel = useMemo(() => mode === "password" ? "Password" : mode === "pin" ? "PIN" : "Passphrase italiana", [mode]);

  function generate() {
    try {
      setError(null);
      setCopyStatus("");
      setResult(generateSecret(mode === "password"
        ? { mode, length, lowercase, uppercase, digits, symbols }
        : mode === "pin"
          ? { mode, length }
          : { mode, wordCount, separator }));
    } catch (cause) {
      setResult(null);
      setError(errorMessage(cause));
    }
  }

  async function copySecret() {
    if (result === null || navigator.clipboard === undefined) {
      setCopyStatus("Gli appunti non sono disponibili: seleziona il valore e copialo manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(result.secret);
      setCopyStatus("Copiato negli appunti.");
    } catch {
      setCopyStatus("Il browser ha bloccato gli appunti: seleziona il valore e copialo manualmente.");
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setCopyStatus("");
  }

  return (
    <ToolSurface
      gutter={
        <ToolGutter
          label="Valore generato"
          state={result === null ? "idle" : "success"}
          {...(result === null ? {} : { value: result.secret })}
          placeholder="Scegli modalità e vincoli, poi genera un nuovo valore."
          entries={result === null ? [] : [
            { label: "Modalità", value: modeLabel },
            { label: "Rete", value: "vietata" },
            { label: "Persistenza", value: "nessuna" },
          ]}
        >
          {result !== null && <ResultProvenance>{result.provenance}</ResultProvenance>}
        </ToolGutter>
      }
    >
      <p>
        Il valore viene creato nel browser. Non viene scritto nell'URL, nella cronologia, nello storage o in telemetria applicativa.
        Gli appunti vengono usati soltanto quando premi “Copia”.
      </p>
      <form onSubmit={(event) => { event.preventDefault(); generate(); }} autoComplete="off" noValidate>
        <div class="field-grid">
          <label class="field">
            <span>Modalità</span>
            <select value={mode} onChange={(event) => { setMode(event.currentTarget.value as Mode); reset(); }}>
              <option value="password">Password</option>
              <option value="pin">PIN numerico</option>
              <option value="passphrase">Passphrase italiana</option>
            </select>
          </label>
          {mode !== "passphrase" && (
            <label class="field">
              <span>{mode === "pin" ? "Cifre" : "Lunghezza"}</span>
              <input
                aria-label={mode === "pin" ? "Cifre del PIN" : "Lunghezza password"}
                type="number"
                min={mode === "pin" ? PIN_LENGTH_MIN : PASSWORD_LENGTH_MIN}
                max={mode === "pin" ? PIN_LENGTH_MAX : PASSWORD_LENGTH_MAX}
                value={length}
                onInput={(event) => setLength(Number(event.currentTarget.value))}
              />
            </label>
          )}
          {mode === "password" && (
            <fieldset class="field">
              <legend>Classi di caratteri</legend>
              <label class="choice-line"><input type="checkbox" checked={lowercase} onChange={(event) => setLowercase(event.currentTarget.checked)} /> minuscole</label>
              <label class="choice-line"><input type="checkbox" checked={uppercase} onChange={(event) => setUppercase(event.currentTarget.checked)} /> maiuscole</label>
              <label class="choice-line"><input type="checkbox" checked={digits} onChange={(event) => setDigits(event.currentTarget.checked)} /> cifre</label>
              <label class="choice-line"><input type="checkbox" checked={symbols} onChange={(event) => setSymbols(event.currentTarget.checked)} /> simboli</label>
            </fieldset>
          )}
          {mode === "passphrase" && (
            <>
              <label class="field">
                <span>Numero di parole</span>
                <input type="number" min={PASSPHRASE_WORDS_MIN} max={PASSPHRASE_WORDS_MAX} value={wordCount} onInput={(event) => setWordCount(Number(event.currentTarget.value))} />
              </label>
              <label class="field">
                <span>Separatore</span>
                <select value={separator} onChange={(event) => setSeparator(event.currentTarget.value)}>
                  <option value="-">trattino (-)</option>
                  <option value=".">punto (.)</option>
                  <option value="_">underscore (_)</option>
                  <option value=" ">spazio</option>
                </select>
              </label>
              <small>
                Lista: <code>{ITALIAN_PASSPHRASE_WORDLIST.id}</code> · versione {ITALIAN_PASSPHRASE_WORDLIST.version} · {ITALIAN_PASSPHRASE_WORDLIST.words.length} parole.
                {" "}{ITALIAN_PASSPHRASE_WORDLIST.provenance}
              </small>
            </>
          )}
        </div>
        <InlineError message={error} />
        <ToolActions>
          <button class="button primary" type="submit">Genera {modeLabel.toLocaleLowerCase("it-IT")}</button>
          <button type="button" onClick={reset}>Cancella risultato</button>
        </ToolActions>
      </form>

      {result !== null && (
        <section aria-live="polite" aria-label="Risultato generatore">
          <pre class="schema-preview" data-secret-output>{result.secret}</pre>
          <ResultBreakdown
            label="Contratto locale"
            rows={[
              { label: "Casualità", value: "WebCrypto getRandomValues" },
              { label: "Selezione", value: "rejection sampling, senza modulo bias" },
              { label: "URL / cronologia", value: "non usati" },
              { label: "Storage", value: "non usato" },
            ]}
          />
          {result.wordlist !== undefined && (
            <ResultProvenance>
              Wordlist {result.wordlist.id}, versione {result.wordlist.version}, {result.wordlist.wordCount} parole. {result.wordlist.provenance}
            </ResultProvenance>
          )}
          <ToolActions><button type="button" onClick={() => void copySecret()}>Copia</button></ToolActions>
          {copyStatus !== "" && <p role="status" aria-live="polite">{copyStatus}</p>}
        </section>
      )}
    </ToolSurface>
  );
}
