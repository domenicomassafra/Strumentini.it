import { useState } from "preact/hooks";
import { calculateTfr15, parseTfrRows15, TFR_15_SOURCES, type TfrEstimate15 } from "../../engines/italy/tfr-15";

const euro = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

export function TfrCalculator15() {
  const [annual, setAnnual] = useState("2023;30000;\n2024;32000;1,09335576\n2025;35000;1,08153078");
  const [reduction, setReduction] = useState("0,5");
  const [result, setResult] = useState<TfrEstimate15 | null>(null);
  const [error, setError] = useState("");
  function compute(event: Event) {
    event.preventDefault();
    setError(""); setResult(null);
    try {
      if (!/^(?:0(?:[.,]\d+)?|0[.,]5)$/u.test(reduction)) throw new Error("Riduzione IVS ammessa da 0% a 0,50%.");
      setResult(calculateTfr15(parseTfrRows15(annual), Number(reduction.replace(",", "."))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossibile calcolare TFR.");
    }
  }
  return (
    <section class="tfr15" aria-label="Calcolatore TFR lordo">
      <form onSubmit={compute}>
        <label>Retribuzione lorda utile per anno (formato: anno; euro; variazione percentuale indice FOI dicembre su dicembre)
          <textarea rows={7} value={annual} onInput={(event) => { setAnnual(event.currentTarget.value); setResult(null); }} aria-describedby="tfr-help" />
        </label>
        <p id="tfr-help">Una riga per ogni anno completo e consecutivo. La prima variazione FOI è ignorata: il TFR maturato nello stesso anno non si rivaluta. Le retribuzioni nell'esempio sono fittizie; le variazioni FOI di dicembre 2024 e 2025 derivano dagli indici ISTAT (120,2/118,9 e 121,5/120,2). Inserisci le variazioni del periodo effettivo: il calcolatore non le recupera automaticamente.</p>
        <label>Riduzione IVS in percentuale sulla retribuzione utile (0–0,50%; dipende dalle esenzioni applicabili)
          <input type="text" inputMode="decimal" value={reduction} onInput={(event) => { setReduction(event.currentTarget.value); setResult(null); }} />
        </label>
        <button class="btn btn-primary" type="submit">Calcola TFR lordo</button>
      </form>
      {error && <p role="alert" class="tfr-error">{error}</p>}
      {result && <section class="tfr-result" aria-live="polite">
        <h2>{result.status === "COMPLETE" ? "TFR lordo stimato" : "Calcolo parziale — dati storici mancanti"}</h2>
        <dl>
          <div><dt>Quote annue accantonate</dt><dd>{euro(result.accruedGrossCents)}</dd></div>
          <div><dt>Rivalutazione totale</dt><dd>{result.totalRevaluationCents === null ? "Non calcolabile" : euro(result.totalRevaluationCents)}</dd></div>
          <div><dt>Totale lordo (quote + rivalutazioni)</dt><dd>{result.grossTotalCents === null ? "Non calcolabile" : euro(result.grossTotalCents)}</dd></div>
        </dl>
        {result.missingFoiYears.length > 0 && <p>Inserisci la variazione FOI per: {result.missingFoiYears.join(", ")}. Le quote sono consultabili, ma il totale non è affidabile finché manca la rivalutazione.</p>}
        <div class="tfr-table-scroll"><table><caption>Calcolo annuale verificabile</caption><thead><tr><th>Anno</th><th>Quota TFR</th><th>FOI annuo</th><th>Tasso rivalutazione</th><th>Rivalutazione pregresso</th><th>Montante lordo</th></tr></thead><tbody>
          {result.lines.map((line) => <tr key={line.year}><th scope="row">{line.year}</th><td>{euro(line.annualAccrualCents)}</td><td>{line.foiGrowthPercent === null ? "—" : `${line.foiGrowthPercent}%`}</td><td>{line.revaluationPercent === null ? "—" : `${line.revaluationPercent.toFixed(6)}%`}</td><td>{line.revaluationCents === null ? "?" : euro(line.revaluationCents)}</td><td>{line.yearEndGrossCents === null ? "?" : euro(line.yearEndGrossCents)}</td></tr>)}
        </tbody></table></div>
      </section>}
      <p>Formula: quota annua = retribuzione utile / 13,5 − riduzione IVS applicabile; rivalutazione sul fondo precedente = 1,5% + 75% dell'aumento FOI annuale (dicembre/dicembre), con componente FOI posta a zero se negativa, e capitalizzazione. L'esempio è una simulazione: non considera frazioni di anno, anticipazioni, imposta sostitutiva sulla rivalutazione, fondi pensione, trasferimenti o tassazione finale. Il lordo stimato non è un saldo ufficiale del datore di lavoro.</p>
      <p>La tassazione separata non è stimabile dal solo lordo qui calcolato. La <a href="/tools/calcoli-fiscali-italia/#tfr134-title">simulazione fiscale TFR distinta</a> permette una valutazione puramente indicativa solo con dati storici documentati e non sostituisce il conteggio di liquidazione.</p>
      <p>Fonti: {TFR_15_SOURCES.map((source, index) => <span key={source.url}>{index > 0 ? " · " : ""}<a href={source.url} target="_blank" rel="noopener noreferrer">{source.authority}: {source.title}</a></span>)} · <a href="https://www.istat.it/" target="_blank" rel="noopener noreferrer">ISTAT (indice FOI, verifica l'anno di riferimento)</a>.</p>
    </section>
  );
}
