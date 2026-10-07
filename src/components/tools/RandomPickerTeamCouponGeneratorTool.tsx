import { useMemo, useState } from "preact/hooks";
import {
  COUPON_LENGTH_MAX,
  COUPON_LENGTH_MIN,
  DEFAULT_COUPON_ALPHABET,
  generateCouponCodes,
  generateRandomNumbers,
  drawRandomItems,
  splitBalancedTeams,
  type RandomnessMode,
  type RandomUtilityResult,
} from "../../tools/random-picker-team-coupon-generator/module";
import { InlineError, ResultBreakdown, ResultProvenance, ToolActions, ToolGutter, ToolSurface } from "./shared";

type Mode = "number" | "picker" | "teams" | "coupon";

const MODE_LABELS: Readonly<Record<Mode, string>> = {
  number: "Numero casuale",
  picker: "Estrazione da lista",
  teams: "Dividi in team",
  coupon: "Codici coupon",
};

const ERROR_COPY: Readonly<Record<string, string>> = {
  WEBCRYPTO_UNAVAILABLE: "Questo browser non espone WebCrypto: usa un browser compatibile oppure la modalità con seed solo per risultati riproducibili non sicuri.",
  RANDOM_RANGE_ORDER_INVALID: "Il massimo deve essere maggiore o uguale al minimo.",
  RANDOM_RANGE_TOO_LARGE: "L'intervallo può contenere al massimo 2^32 valori interi.",
  RANDOM_COUNT_INVALID: "La quantità richiesta non è valida.",
  RANDOM_UNIQUE_COUNT_EXCEEDS_RANGE: "Hai chiesto più numeri unici di quanti ne contenga l'intervallo.",
  LIST_REQUIRED: "Inserisci almeno una riga non vuota.",
  LIST_TOO_LARGE: "La lista supera il limite locale di 2.000 righe non vuote.",
  PICK_COUNT_INVALID: "Il numero di estrazioni deve stare tra 1 e il numero di righe disponibili.",
  TEAM_DUPLICATE_PARTICIPANT: "I team richiedono nomi unici dopo la rimozione degli spazi iniziali e finali.",
  TEAM_COUNT_INVALID: "Il numero di team deve essere almeno 2 e non può superare il numero di partecipanti.",
  COUPON_COUNT_INVALID: "Il numero di coupon deve stare tra 1 e 1.000.",
  COUPON_LENGTH_INVALID: `La parte casuale del coupon deve avere tra ${COUPON_LENGTH_MIN} e ${COUPON_LENGTH_MAX} caratteri.`,
  COUPON_ALPHABET_INVALID: "L'alfabeto deve contenere tra 2 e 64 caratteri distinti e non può contenere spazi o caratteri di controllo.",
  COUPON_PREFIX_INVALID: "Il prefisso può contenere al massimo 24 caratteri e non può contenere ritorni a capo o caratteri di controllo.",
  COUPON_COUNT_EXCEEDS_SPACE: "Lo spazio di codici possibile è più piccolo del numero di coupon richiesto.",
  COUPON_COLLISION_LIMIT: "Troppe collisioni casuali: aumenta lunghezza o alfabeto e riprova.",
  SEED_INVALID: "Inserisci un seed non vuoto, lungo al massimo 256 caratteri.",
};

function errorMessage(error: unknown): string {
  const key = error instanceof Error ? error.message : "";
  return ERROR_COPY[key] ?? "Non riesco a completare questa generazione con i vincoli scelti.";
}

function formatResult(result: RandomUtilityResult): string {
  if (result.mode === "number") return result.values.join("\n");
  if (result.mode === "picker") return result.picks.map(({ sourceIndex, label }) => `${sourceIndex}. ${label}`).join("\n");
  if (result.mode === "coupon") return result.codes.join("\n");
  return result.teams.map((team, index) => `Team ${index + 1}\n${team.map((name) => `- ${name}`).join("\n")}`).join("\n\n");
}

function resultValue(result: RandomUtilityResult | null): string | undefined {
  if (result === null) return undefined;
  if (result.mode === "number") return result.values.length === 1 ? String(result.values[0]) : `${result.values.length} numeri`;
  if (result.mode === "picker") return result.picks.length === 1 ? result.picks[0]!.label : `${result.picks.length} estratti`;
  if (result.mode === "teams") return `${result.teamCount} team · ${result.participantCount} persone`;
  return `${result.codes.length} coupon`;
}

export function RandomPickerTeamCouponGeneratorTool() {
  const [mode, setMode] = useState<Mode>("number");
  const [randomness, setRandomness] = useState<RandomnessMode>("secure");
  const [seed, setSeed] = useState("demo-205");
  const [minimum, setMinimum] = useState(1);
  const [maximum, setMaximum] = useState(100);
  const [count, setCount] = useState(1);
  const [allowDuplicates, setAllowDuplicates] = useState(true);
  const [items, setItems] = useState("Ada\nBruno\nCarla\nDiego");
  const [participants, setParticipants] = useState("Ada\nBruno\nCarla\nDiego\nElena\nFabio");
  const [teamCount, setTeamCount] = useState(2);
  const [couponLength, setCouponLength] = useState(10);
  const [couponPrefix, setCouponPrefix] = useState("PROMO-");
  const [couponAlphabet, setCouponAlphabet] = useState(DEFAULT_COUPON_ALPHABET);
  const [result, setResult] = useState<RandomUtilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");

  const modeLabel = useMemo(() => MODE_LABELS[mode], [mode]);
  const gutterValue = resultValue(result);

  function clearResult() {
    setResult(null);
    setError(null);
    setCopyStatus("");
  }

  function generate() {
    try {
      setError(null);
      setCopyStatus("");
      const randomOptions = randomness === "seeded" ? { randomness, seed } as const : { randomness } as const;
      if (mode === "number") {
        setResult(generateRandomNumbers({ minimum, maximum, count, allowDuplicates, ...randomOptions }));
      } else if (mode === "picker") {
        setResult(drawRandomItems({ items, count, ...randomOptions }));
      } else if (mode === "teams") {
        setResult(splitBalancedTeams({ participants, teamCount, ...randomOptions }));
      } else {
        setResult(generateCouponCodes({ count, length: couponLength, prefix: couponPrefix, alphabet: couponAlphabet, ...randomOptions }));
      }
    } catch (cause) {
      setResult(null);
      setError(errorMessage(cause));
    }
  }

  async function copyResult() {
    if (result === null || navigator.clipboard === undefined) {
      setCopyStatus("Gli appunti non sono disponibili: seleziona il risultato e copialo manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(formatResult(result));
      setCopyStatus("Risultato copiato negli appunti.");
    } catch {
      setCopyStatus("Il browser ha bloccato gli appunti: seleziona il risultato e copialo manualmente.");
    }
  }

  return (
    <ToolSurface
      gutter={
        <ToolGutter
          label="Risultato"
          state={result === null ? "idle" : "success"}
          {...(gutterValue === undefined ? {} : { value: gutterValue })}
          placeholder="Scegli modalità, casualità e vincoli, poi genera il risultato."
          entries={result === null ? [] : [
            { label: "Modalità", value: modeLabel },
            { label: "Casualità", value: result.randomness.secure ? "sicura · WebCrypto" : "seeded · non sicura" },
            { label: "Persistenza", value: "nessuna" },
          ]}
        >
          {result !== null && <ResultProvenance>{result.randomness.label}</ResultProvenance>}
        </ToolGutter>
      }
    >
      <p>
        Tutto resta nel browser e nello stato della pagina. La modalità sicura usa WebCrypto con rejection sampling; la modalità con seed serve solo a riprodurre lo stesso risultato ed è esplicitamente non sicura.
      </p>
      <form onSubmit={(event) => { event.preventDefault(); generate(); }} autoComplete="off" noValidate>
        <div class="field-grid">
          <label class="field">
            <span>Modalità</span>
            <select value={mode} onChange={(event) => { setMode(event.currentTarget.value as Mode); setCount(1); clearResult(); }}>
              <option value="number">Numero casuale</option>
              <option value="picker">Estrazione da lista</option>
              <option value="teams">Dividi in team</option>
              <option value="coupon">Codici coupon</option>
            </select>
          </label>
          <label class="field">
            <span>Origine casualità</span>
            <select value={randomness} onChange={(event) => { setRandomness(event.currentTarget.value as RandomnessMode); clearResult(); }}>
              <option value="secure">Sicura · WebCrypto</option>
              <option value="seeded">Riproducibile con seed · NON sicura</option>
            </select>
          </label>
          {randomness === "seeded" && (
            <label class="field">
              <span>Seed riproducibile</span>
              <input value={seed} maxLength={256} onInput={(event) => setSeed(event.currentTarget.value)} />
              <small>Non usare questa modalità per password, premi o estrazioni dove serve imprevedibilità.</small>
            </label>
          )}

          {mode === "number" && (
            <>
              <label class="field"><span>Minimo incluso</span><input type="number" value={minimum} onInput={(event) => setMinimum(Number(event.currentTarget.value))} /></label>
              <label class="field"><span>Massimo incluso</span><input type="number" value={maximum} onInput={(event) => setMaximum(Number(event.currentTarget.value))} /></label>
              <label class="field"><span>Quantità</span><input type="number" min={1} max={1000} value={count} onInput={(event) => setCount(Number(event.currentTarget.value))} /></label>
              <label class="choice-line"><input type="checkbox" checked={allowDuplicates} onChange={(event) => setAllowDuplicates(event.currentTarget.checked)} /> consenti numeri duplicati nella stessa generazione</label>
            </>
          )}

          {mode === "picker" && (
            <>
              <label class="field"><span>Una voce per riga</span><textarea rows={9} value={items} onInput={(event) => setItems(event.currentTarget.value)} /></label>
              <label class="field"><span>Quante righe estrarre</span><input type="number" min={1} max={1000} value={count} onInput={(event) => setCount(Number(event.currentTarget.value))} /></label>
              <small>Le righe vuote sono ignorate. Due righe con la stessa etichetta sono due ticket distinti; una singola riga non può uscire due volte nello stesso draw.</small>
            </>
          )}

          {mode === "teams" && (
            <>
              <label class="field"><span>Una persona per riga</span><textarea rows={9} value={participants} onInput={(event) => setParticipants(event.currentTarget.value)} /></label>
              <label class="field"><span>Numero di team</span><input type="number" min={2} max={64} value={teamCount} onInput={(event) => setTeamCount(Number(event.currentTarget.value))} /></label>
              <small>I duplicati esatti dopo trim vengono rifiutati. I team hanno dimensioni che differiscono al massimo di una persona.</small>
            </>
          )}

          {mode === "coupon" && (
            <>
              <label class="field"><span>Numero di coupon</span><input type="number" min={1} max={1000} value={count} onInput={(event) => setCount(Number(event.currentTarget.value))} /></label>
              <label class="field"><span>Lunghezza casuale</span><input type="number" min={COUPON_LENGTH_MIN} max={COUPON_LENGTH_MAX} value={couponLength} onInput={(event) => setCouponLength(Number(event.currentTarget.value))} /></label>
              <label class="field"><span>Prefisso facoltativo</span><input value={couponPrefix} maxLength={24} onInput={(event) => setCouponPrefix(event.currentTarget.value)} /></label>
              <label class="field"><span>Alfabeto</span><input value={couponAlphabet} onInput={(event) => setCouponAlphabet(event.currentTarget.value)} /></label>
              <small>I caratteri duplicati dell'alfabeto vengono rimossi preservando la prima occorrenza. I coupon finali sono sempre unici.</small>
            </>
          )}
        </div>
        <InlineError message={error} />
        <ToolActions>
          <button class="button primary" type="submit">Genera</button>
          <button type="button" onClick={clearResult}>Cancella risultato</button>
        </ToolActions>
      </form>

      {result !== null && (
        <section aria-live="polite" aria-label="Risultato generatore casuale">
          <pre class="schema-preview" data-random-output>{formatResult(result)}</pre>
          <ResultBreakdown
            label="Contratto della generazione"
            rows={[
              { label: "Origine", value: result.randomness.secure ? "WebCrypto getRandomValues" : "PRNG seeded riproducibile · NON sicuro" },
              { label: "Selezione", value: "rejection sampling senza modulo bias" },
              { label: "Rete", value: "vietata" },
              { label: "URL / storage", value: "non usati" },
            ]}
          />
          {result.mode === "picker" && <ResultProvenance>{result.duplicatePolicy}</ResultProvenance>}
          {result.mode === "teams" && <ResultProvenance>{result.duplicatePolicy}</ResultProvenance>}
          {result.mode === "coupon" && <ResultProvenance>{result.duplicatePolicy}</ResultProvenance>}
          <ToolActions><button type="button" onClick={() => void copyResult()}>Copia risultato</button></ToolActions>
          {copyStatus !== "" && <p role="status" aria-live="polite">{copyStatus}</p>}
        </section>
      )}
    </ToolSurface>
  );
}
