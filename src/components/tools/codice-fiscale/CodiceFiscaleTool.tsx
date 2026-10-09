import { useMemo, useState } from "preact/hooks";
import {
  generateCodiceFiscale121,
  validateCodiceFiscale121,
  type CodiceFiscaleGeneration121,
  type CodiceFiscaleValidation121,
} from "../../../engines/italy/codice-fiscale-121";
import {
  decodeCodiceFiscale122,
  type CodiceFiscaleDecoding122,
} from "../../../engines/italy/codice-fiscale-122";
import { ITALIAN_GEOGRAPHY_115_METADATA } from "../../../reference-data/italy/geography-115";
import geography from "../../../reference-data/italy/geography-115.snapshot.json";
import "./codice-fiscale.css";

type Mode = "generate" | "validate" | "decode";
type GeoKind = "current" | "suppressed" | "foreign";
type Outcome =
  | { mode: "generate"; value: CodiceFiscaleGeneration121 }
  | { mode: "validate"; value: CodiceFiscaleValidation121; decoded: CodiceFiscaleDecoding122 }
  | { mode: "decode"; value: CodiceFiscaleDecoding122 };

const sourceLabel = "ISTAT, elenco comuni del 21/02/2026; SITUAS per codici soppressi ed esteri";
const kinds: Record<GeoKind, string> = {
  current: "Comune italiano corrente",
  suppressed: "Comune storico o soppresso",
  foreign: "Stato o territorio estero",
};

function normalizedSearch(input: string): string {
  return input.normalize("NFD").replace(/\p{Mark}/gu, "").toLocaleLowerCase("it").trim();
}

function validExport(result: Outcome | null): string | null {
  if (!result) return null;
  if (result.mode === "generate") return result.value.status === "GENERATED_CANDIDATE" ? result.value.code : null;
  if (result.mode === "validate") {
    return result.value.status === "FORMALLY_VALID" && result.decoded.status === "DECODED_FORMALLY"
      && result.decoded.geographyCandidates.length > 0 ? result.value.normalizedCode : null;
  }
  return result.value.status === "DECODED_FORMALLY" && result.value.geographyCandidates.length > 0
    ? result.value.normalizedCode : null;
}

export function CodiceFiscaleTool() {
  const [mode, setMode] = useState<Mode>("generate");
  const [surname, setSurname] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<"M" | "F">("M");
  const [kind, setKind] = useState<GeoKind>("current");
  const [placeQuery, setPlaceQuery] = useState("");
  const [istatCode, setIstatCode] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Outcome | null>(null);
  const [feedback, setFeedback] = useState("");

  const options = useMemo(() => {
    if (kind !== "current" || normalizedSearch(placeQuery).length < 2) return [];
    const query = normalizedSearch(placeQuery);
    return geography.current.filter((candidate) => normalizedSearch(candidate.name).includes(query)
      || candidate.istatCode.startsWith(placeQuery.trim()))
      .sort((a, b) => {
        const rank = (name: string) => normalizedSearch(name) === query ? 0 : normalizedSearch(name).startsWith(query) ? 1 : 2;
        return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "it");
      }).slice(0, 8);
  }, [kind, placeQuery]);

  function dirty(): void {
    setResult(null);
    setFeedback("");
  }

  function changeMode(next: Mode): void {
    setMode(next);
    dirty();
  }

  function changeKind(next: GeoKind): void {
    setKind(next);
    setPlaceQuery("");
    setIstatCode("");
    dirty();
  }

  function selectPlace(candidate: (typeof geography.current)[number]): void {
    setIstatCode(candidate.istatCode);
    setPlaceQuery(`${candidate.name} (${candidate.province})`);
    dirty();
  }

  function submit(event: Event): void {
    event.preventDefault();
    setFeedback("");
    if (mode === "generate") {
      const value = generateCodiceFiscale121({ surname, name, birthDate, sex, birthPlace: { kind, istatCode } });
      setResult({ mode, value });
      return;
    }
    if (mode === "validate") {
      setResult({ mode, value: validateCodiceFiscale121(code), decoded: decodeCodiceFiscale122(code) });
      return;
    }
    setResult({ mode, value: decodeCodiceFiscale122(code) });
  }

  const exported = validExport(result);
  const decoded = result?.mode === "decode" ? result.value
    : result?.mode === "validate" ? result.decoded : null;
  const validDecoded = decoded?.status === "DECODED_FORMALLY" ? decoded : null;
  const rejected = result?.mode === "generate" ? result.value.status === "REFUSED"
    : result?.mode === "validate" ? result.value.status === "INVALID"
      : result?.mode === "decode" ? result.value.status === "INVALID" : false;
  const reason = result?.mode === "generate" && result.value.status === "REFUSED" ? result.value.reason
    : result?.mode === "validate" && result.value.status === "INVALID" ? result.value.reason
      : result?.mode === "decode" && result.value.status === "INVALID" ? result.value.reason : null;

  async function copyResult(): Promise<void> {
    if (!exported) return;
    try {
      await navigator.clipboard.writeText(exported);
      setFeedback("Codice copiato. È soltanto un risultato formale, non un'attribuzione ufficiale.");
    } catch {
      setFeedback("Copia non disponibile in questo browser: usa la selezione manuale.");
    }
  }

  function downloadResult(): void {
    if (!exported) return;
    const text = [
      `Codice fiscale (risultato locale): ${exported}`,
      "NON È un'attribuzione o una conferma dell'Agenzia delle Entrate.",
      "Validità anagrafica/storica non verificata, anche se il controllo formale è superato.",
      `Fonti: ${sourceLabel}; versione geografica ${ITALIAN_GEOGRAPHY_115_METADATA.version}.`,
    ].join("\n") + "\n";
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "codice-fiscale-risultato-locale.txt";
    document.body.append(link);
    link.click();
    link.remove();
    // Revoke after the browser has consumed the generated local click.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setFeedback("File di testo creato localmente. Nessun dato è stato caricato.");
  }

  return (
    <section class="cf08-tool" data-cf-public-tool="08" aria-label="Codice fiscale locale">
      <div class="cf08-notice" role="note">
        <strong>Copertura geografica rigorosamente limitata — fonte ISTAT del 21/02/2026.</strong>
        <p>La generazione è supportata <strong>solo per nati il 21/02/2026 in un comune presente nello snapshot corrente</strong>. Per altre date, comuni soppressi e Stati esteri, la validità alla nascita non è dimostrata: il sistema rifiuta il calcolo, senza inventare un codice.</p>
        <p>Calcolo solo nel browser. Non è un'identificazione, una verifica anagrafica né un'attribuzione ufficiale dell'Agenzia delle Entrate.</p>
      </div>

      <div class="cf08-tabs" role="group" aria-label="Operazione codice fiscale">
        {([
          ["generate", "Genera (limitato)"],
          ["validate", "Verifica formale"],
          ["decode", "Decodifica"],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" class={mode === key ? "cf08-tab cf08-active" : "cf08-tab"}
            data-cf-mode={key} aria-pressed={mode === key} onClick={() => changeMode(key)}>{label}</button>
        ))}
      </div>

      <div class="cf08-grid">
        <section class="cf08-panel" aria-labelledby="cf08-input-title">
          <h2 id="cf08-input-title">{mode === "generate" ? "Dati dichiarati" : "Codice da controllare"}</h2>
          <form data-cf-form onSubmit={submit} autoComplete="off" noValidate>
            {mode === "generate" ? (
              <>
                <div class="cf08-row">
                  <label class="field" for="cf08-surname"><span>Cognome</span>
                    <input id="cf08-surname" value={surname} required maxLength={160} placeholder="Rossi" onInput={(e) => { setSurname(e.currentTarget.value); dirty(); }} /></label>
                  <label class="field" for="cf08-name"><span>Nome</span>
                    <input id="cf08-name" value={name} required maxLength={160} placeholder="Mario" onInput={(e) => { setName(e.currentTarget.value); dirty(); }} /></label>
                </div>
                <div class="cf08-row">
                  <label class="field" for="cf08-date"><span>Data di nascita</span>
                    <input id="cf08-date" type="date" value={birthDate} required onInput={(e) => { setBirthDate(e.currentTarget.value); dirty(); }} /></label>
                  <label class="field" for="cf08-sex"><span>Sesso codificato</span>
                    <select id="cf08-sex" value={sex} onChange={(e) => { setSex(e.currentTarget.value as "M" | "F"); dirty(); }}>
                      <option value="M">M (giorno 01–31)</option><option value="F">F (giorno 41–71)</option>
                    </select></label>
                </div>
                <label class="field" for="cf08-place-kind"><span>Tipo di luogo di nascita</span>
                  <select id="cf08-place-kind" value={kind} onChange={(e) => changeKind(e.currentTarget.value as GeoKind)}>
                    {(Object.keys(kinds) as GeoKind[]).map((key) => <option value={key} key={key}>{kinds[key]}</option>)}
                  </select></label>
                {kind === "current" && (
                  <div class="cf08-place-search">
                    <label class="field" for="cf08-place-search"><span>Cerca comune ISTAT (solo dati ufficiali in locale)</span>
                      <input id="cf08-place-search" type="search" value={placeQuery} placeholder="Es. Roma" autoComplete="off"
                        onInput={(e) => { setPlaceQuery(e.currentTarget.value); setIstatCode(""); dirty(); }} /></label>
                    {options.length > 0 && !istatCode && (
                      <ul class="cf08-options" aria-label="Comuni trovati">
                        {options.map((candidate) => <li key={candidate.istatCode}>
                          <button type="button" onClick={() => selectPlace(candidate)}>{candidate.name} ({candidate.province}) — {candidate.istatCode}</button>
                        </li>)}
                      </ul>
                    )}
                  </div>
                )}
                <label class="field" for="cf08-istat"><span>Codice ISTAT {kind === "foreign" ? "estero (3 cifre)" : "comune (6 cifre)"}</span>
                  <input id="cf08-istat" inputMode="numeric" maxLength={6} value={istatCode}
                    placeholder={kind === "foreign" ? "201" : "058091"}
                    onInput={(e) => { setIstatCode(e.currentTarget.value); dirty(); }} /></label>
                <p class="cf08-hint">Il codice deve appartenere alla fonte #115. Per luoghi storici/esteri il motore segnala perché non può provarne la validità alla data scelta.</p>
              </>
            ) : (
              <label class="field" for="cf08-code"><span>Codice fiscale (16 caratteri)</span>
                <input id="cf08-code" maxLength={16} value={code} autoCapitalize="characters" spellcheck={false}
                  placeholder="RSSMRA80A01H501U" onInput={(e) => { setCode(e.currentTarget.value); dirty(); }} /></label>
            )}
            <button class="btn btn-primary cf08-submit" type="submit" data-cf-submit>
              {mode === "generate" ? "Calcola solo se verificabile" : mode === "validate" ? "Verifica struttura e controllo" : "Decodifica senza identificare"}
            </button>
          </form>
        </section>

        <section class="cf08-panel cf08-result" aria-labelledby="cf08-result-title" aria-live="polite" data-cf-result>
          <h2 id="cf08-result-title">Risultato</h2>
          {!result && <p class="cf08-hint">Inserisci i dati e avvia l'operazione. Nessun risultato viene calcolato dal server.</p>}
          {result && rejected && (
            <div role="alert" class="cf08-refused" data-cf-refused>
              <strong>{result.mode === "generate" ? "REFUSED — calcolo non supportato" : "Codice formalmente non valido"}</strong>
              <p>{reason}</p>
              <p>Nessun codice viene inventato, copiato o scaricato.</p>
            </div>
          )}
          {result?.mode === "generate" && result.value.status === "GENERATED_CANDIDATE" && (
            <div data-cf-generated>
              <p class="cf08-status">Candidato calcolato — non assegnato ufficialmente</p>
              <output class="cf08-code" data-cf-code>{result.value.code}</output>
              <p>Comune: <strong>{result.value.geography.name}</strong> ({result.value.geography.istatCode}), Belfiore {result.value.geography.belfiore}.</p>
              <p class="cf08-hint">Fonte: {result.value.geography.provenance}. Non sono noti eventuali codici omocodici assegnati dall'autorità.</p>
            </div>
          )}
          {result?.mode === "validate" && result.value.status === "FORMALLY_VALID" && (
            <div data-cf-validated>
              <p class="cf08-status">Checksum e struttura formalmente validi — non conferma ufficiale</p>
              <output class="cf08-code" data-cf-code>{result.value.normalizedCode}</output>
            </div>
          )}
          {result?.mode === "decode" && result.value.status === "DECODED_FORMALLY" && (
            <div data-cf-decoded>
              <p class="cf08-status">Decodifica solo formale — nessuna identità dedotta</p>
              <output class="cf08-code" data-cf-code>{result.value.normalizedCode}</output>
            </div>
          )}
          {validDecoded && (
            <div class="cf08-facts" data-cf-ambiguity>
              <p><strong>Dati codificati:</strong> anno a due cifre {String(validDecoded.yearSuffix).padStart(2, "0")}, mese {validDecoded.month}, giorno {validDecoded.day}, sesso {validDecoded.sex}.</p>
              <p><strong>Date compatibili:</strong> {validDecoded.possibleBirthDates.join(" oppure ")} {validDecoded.centuryAmbiguous ? "— secolo ambiguo, non è possibile ricavare l'età." : "— altri secoli non sono valutati."}</p>
              <p><strong>Omocodia:</strong> {validDecoded.omocodia.length === 0 ? "nessuna sostituzione rilevata" : validDecoded.omocodia.map((item) => `posizione ${item.position}: ${item.letter}→${item.digit}`).join("; ")}.</p>
              <p><strong>Luogo codificato {validDecoded.belfiore}:</strong> {validDecoded.geographyCandidates.length === 0
                ? "nessun candidato nelle fonti disponibili, significato sconosciuto"
                : `${validDecoded.geographyCandidates.length} candidato/i ISTAT/SITUAS; validità alla data di nascita non dimostrata.`}</p>
              {validDecoded.geographyCandidates.length > 0 && <ul class="cf08-candidates">
                {validDecoded.geographyCandidates.slice(0, 8).map((candidate, i) => (
                  <li key={`${candidate.istatCode}-${candidate.provenance}-${candidate.sourceRow ?? i}`}>
                    {candidate.name} ({candidate.istatCode}) — {candidate.provenance}, versione {candidate.sourceVersion}{candidate.changeDate ? `, evento ${candidate.changeDate}` : ""}
                  </li>
                ))}
              </ul>}
              {validDecoded.geographyCandidates.length > 8 && <p>Ulteriori {validDecoded.geographyCandidates.length - 8} corrispondenze non mostrate, senza scelta automatica.</p>}
              <p class="cf08-hint">Non è possibile verificare dal solo codice il nominativo, il secolo, l'assegnazione ufficiale o il comune alla nascita.</p>
            </div>
          )}
          {result && !rejected && !exported && (
            <p class="cf08-refused" data-cf-export-blocked>Esportazione disabilitata: il codice del luogo non è disponibile nelle fonti #115, anche se il checksum può essere formalmente corretto.</p>
          )}
          {exported && (
            <div class="cf08-actions">
              <button type="button" class="btn" data-cf-copy onClick={() => void copyResult()}>Copia codice</button>
              <button type="button" class="btn" data-cf-download onClick={downloadResult}>Scarica .txt locale</button>
            </div>
          )}
          {feedback && <p class="cf08-hint" role="status" data-cf-feedback>{feedback}</p>}
        </section>
      </div>
      <footer class="cf08-source">
        <strong>Fonte delle regole:</strong> DM Finanze 23 dicembre 1976, artt. 3–7. <strong>Fonte dei codici:</strong> {sourceLabel}, versione {ITALIAN_GEOGRAPHY_115_METADATA.version}.
        <p>Copertura incompleta: 16 comuni soppressi senza codice, 23 territori esteri senza codice, storia estera dal 1990 e intervalli storici alla nascita non attestati. Nessuna verifica su archivi di persone.</p>
      </footer>
    </section>
  );
}
