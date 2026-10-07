import { useMemo, useState } from "preact/hooks";
import type { ArtigianiCommerciantiResult, GestioneSeparataResult } from "../../engines/italy";
import type { ResultDeclaration } from "../../catalog/manifest";
import { toolRuntime } from "../../runtime/tool-runtime";
import { resolveResultActions } from "../../runtime/result-actions";
import {
  InlineError,
  ResultActions,
  ResultAssumptions,
  ResultBreakdown,
  ResultExplanation,
  ResultInterpretation,
  ResultPrimaryAnswer,
  ResultProvenance,
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "./shared";

const DECLARATION: ResultDeclaration = { class: "calculator", capabilities: ["copy", "reset", "provenance"] };

function euro(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(value);
}

function percent(value: number): string {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value) + "%";
}

function sourceLabel(result: { provenance: { checkedAt: string; snapshotHash: string; sources: readonly { authority: string; title: string }[] } }): string {
  return `${result.provenance.sources.map(({ authority, title }) => `${authority}: ${title}`).join(" · ")} · verificato ${result.provenance.checkedAt} · ${result.provenance.snapshotHash}`;
}

interface ArtigianiFormState {
  income: string;
  profile: "artigiano" | "commerciante";
  seniority: "before-1996" | "from-1996";
}

function ArtigianiCommerciantiCalculator() {
  const [form, setForm] = useState<ArtigianiFormState>({ income: "30000", profile: "artigiano", seniority: "from-1996" });
  const [copyStatus, setCopyStatus] = useState("");
  const operation = useToolOperation<ArtigianiCommerciantiResult>(
    (signal) => toolRuntime.run("inps-artigiani-commercianti", {
      year: 2026,
      profile: form.profile,
      incomeEur: form.income,
      contributionSeniority: form.seniority,
      role: "owner-or-adult-collaborator",
      reduction: "none",
    }, {}, signal),
    { formatError: (run) => run.message.includes("UNSUPPORTED") ? "La combinazione scelta non è coperta dal source pack INPS 2026." : "Controlla reddito e profilo e riprova." },
  );

  function reset() {
    setForm({ income: "30000", profile: "artigiano", seniority: "from-1996" });
    setCopyStatus("");
    operation.reset();
  }

  const copyText = operation.result === null ? "" : [
    `Contributi INPS 2026: ${euro(operation.result.totalContributionEur)}`,
    `Profilo: ${operation.result.profile}`,
    `Reddito dichiarato: ${euro(operation.result.declaredIncomeEur)}`,
    `Base contributiva: ${euro(operation.result.contributionBaseEur)}`,
    `Massimale: ${euro(operation.result.incomeMaximumEur)}`,
  ].join("\n");
  const actions = useMemo(() => operation.result === null ? [] : resolveResultActions({
    declaration: DECLARATION,
    primary: "copy",
    hasCopyPayload: true,
    resetReady: true,
  }), [operation.result]);

  async function copy() {
    if (navigator.clipboard === undefined) return setCopyStatus("Appunti non disponibili: seleziona il risultato manualmente.");
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyStatus("Risultato copiato.");
    } catch {
      setCopyStatus("Il browser ha bloccato gli appunti.");
    }
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }} noValidate>
        <div class="field-grid">
          <label class="field" for="inps-ac-income">
            <span>Reddito annuo 2026</span>
            <input id="inps-ac-income" type="number" min="0" step="0.01" value={form.income} onInput={(event) => setForm({ ...form, income: event.currentTarget.value })} />
          </label>
          <label class="field" for="inps-ac-profile">
            <span>Gestione</span>
            <select id="inps-ac-profile" value={form.profile} onChange={(event) => setForm({ ...form, profile: event.currentTarget.value as ArtigianiFormState["profile"] })}>
              <option value="artigiano">Artigiano</option>
              <option value="commerciante">Commerciante</option>
            </select>
          </label>
          <label class="field" for="inps-ac-seniority">
            <span>Anzianità contributiva</span>
            <select id="inps-ac-seniority" value={form.seniority} onChange={(event) => setForm({ ...form, seniority: event.currentTarget.value as ArtigianiFormState["seniority"] })}>
              <option value="before-1996">Con anzianità contributiva precedente al 1996</option>
              <option value="from-1996">Senza anzianità contributiva al 31/12/1995</option>
            </select>
          </label>
        </div>
        <p class="file-note">Questo percorso copre il profilo standard adulto proprietario/collaboratore adulto, senza riduzioni non presenti nel source pack.</p>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning}>Calcola contributi</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Contributi 2026" placeholder="Inserisci reddito e profilo per vedere il dettaglio per fasce." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {operation.result !== null && <div data-result-class="calculator" data-oracle-entry="cand-256">
          <ResultExplanation
            primary={<ResultPrimaryAnswer label="Contributi annui">{euro(operation.result.totalContributionEur)}</ResultPrimaryAnswer>}
            interpretation={<ResultInterpretation state="success">Calcolo locale sul solo profilo 2026 dichiarato; nessun altro regime viene dedotto.</ResultInterpretation>}
            breakdown={<>
              <ResultBreakdown rows={[
                { label: "Reddito dichiarato", value: euro(operation.result.declaredIncomeEur) },
                { label: "Base contributiva", value: euro(operation.result.contributionBaseEur) },
                { label: "Minimale", value: euro(operation.result.incomeMinimumEur) },
                { label: "Fine prima fascia", value: euro(operation.result.firstBandUpperEur) },
                { label: "Massimale selezionato", value: euro(operation.result.incomeMaximumEur) },
                { label: "Reddito oltre massimale", value: euro(operation.result.excludedAboveCeilingEur) },
              ]} />
              <ResultBreakdown label="Fasce contributive" rows={operation.result.bands.map((band) => ({
                label: band.id === "minimum" ? "Contributo minimo annuo" : band.id === "first-band-excess" ? "Eccedenza prima fascia" : "Seconda fascia",
                value: `${euro(band.contributionEur)} · base ${euro(band.baseEur)}${band.ratePercent === null ? "" : ` · ${percent(band.ratePercent)}`}`,
              }))} />
            </>}
            assumptions={<ResultAssumptions items={operation.result.assumptions.map((value, index) => ({ label: `Limite ${index + 1}`, value }))} />}
            provenance={<ResultProvenance>{sourceLabel(operation.result)}</ResultProvenance>}
          />
          <ResultActions actions={actions} onAction={{ copy, reset }} />
          {copyStatus !== "" && <p class="success" role="status" aria-live="polite">{copyStatus}</p>}
        </div>}
      </ToolResultPanel>
    </ToolOperation>
  );
}

interface GestioneFormState {
  income: string;
  profile: "professional-no-other-mandatory-pension-coverage" | "professional-pensioner-or-other-mandatory-pension-coverage";
}

function GestioneSeparataCalculator() {
  const [form, setForm] = useState<GestioneFormState>({ income: "30000", profile: "professional-no-other-mandatory-pension-coverage" });
  const [copyStatus, setCopyStatus] = useState("");
  const operation = useToolOperation<GestioneSeparataResult>(
    (signal) => toolRuntime.run("gestione-separata-contributi", { year: 2026, profile: form.profile, incomeEur: form.income }, {}, signal),
    { formatError: (run) => run.message.includes("UNSUPPORTED") ? "Questo profilo non è incluso nel source pack professionisti della Gestione Separata 2026." : "Controlla il reddito e riprova." },
  );
  function reset() {
    setForm({ income: "30000", profile: "professional-no-other-mandatory-pension-coverage" });
    setCopyStatus("");
    operation.reset();
  }
  const copyText = operation.result === null ? "" : `Contributi Gestione Separata 2026: ${euro(operation.result.totalContributionEur)}\nAliquota: ${percent(operation.result.ratePercent)}\nBase: ${euro(operation.result.contributionBaseEur)}`;
  const actions = useMemo(() => operation.result === null ? [] : resolveResultActions({ declaration: DECLARATION, primary: "copy", hasCopyPayload: true, resetReady: true }), [operation.result]);
  async function copy() {
    if (navigator.clipboard === undefined) return setCopyStatus("Appunti non disponibili.");
    try { await navigator.clipboard.writeText(copyText); setCopyStatus("Risultato copiato."); } catch { setCopyStatus("Il browser ha bloccato gli appunti."); }
  }
  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }} noValidate>
        <div class="field-grid">
          <label class="field" for="gs-income"><span>Reddito professionale 2026</span><input id="gs-income" type="number" min="0" step="0.01" value={form.income} onInput={(event) => setForm({ ...form, income: event.currentTarget.value })} /></label>
          <label class="field" for="gs-profile"><span>Profilo professionista</span><select id="gs-profile" value={form.profile} onChange={(event) => setForm({ ...form, profile: event.currentTarget.value as GestioneFormState["profile"] })}>
            <option value="professional-no-other-mandatory-pension-coverage">Senza altra copertura pensionistica obbligatoria</option>
            <option value="professional-pensioner-or-other-mandatory-pension-coverage">Pensionato o con altra copertura pensionistica obbligatoria</option>
          </select></label>
        </div>
        <InlineError message={operation.error} />
        <ToolActions><ToolSubmitButton busy={operation.isRunning}>Calcola contributi</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
      </form>
      <ToolResultPanel eyebrow="Gestione Separata 2026" placeholder="Il risultato mostra aliquota, base, massimale e soglia per l'accredito annuo." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {operation.result !== null && <div data-result-class="calculator" data-oracle-entry="cand-257">
          <ResultExplanation
            primary={<ResultPrimaryAnswer label="Contributi annui">{euro(operation.result.totalContributionEur)}</ResultPrimaryAnswer>}
            interpretation={<ResultInterpretation state={operation.result.belowFullYearCreditMinimum ? "warning" : "success"}>{operation.result.belowFullYearCreditMinimum ? "Il reddito è sotto la soglia 2026 indicata per l'accredito contributivo dell'intero anno; la soglia non viene trasformata in una base contributiva minima." : "Il reddito raggiunge la soglia 2026 indicata per l'accredito contributivo dell'intero anno."}</ResultInterpretation>}
            breakdown={<ResultBreakdown rows={[
              { label: "Aliquota", value: percent(operation.result.ratePercent) },
              { label: "Base contributiva", value: euro(operation.result.contributionBaseEur) },
              { label: "Massimale", value: euro(operation.result.incomeMaximumEur) },
              { label: "Reddito oltre massimale", value: euro(operation.result.excludedAboveCeilingEur) },
              { label: "Soglia reddito per accredito annuo", value: euro(operation.result.incomeMinimumForFullYearCreditEur) },
              { label: "Contributi alla soglia di accredito", value: euro(operation.result.contributionAtFullYearCreditMinimumEur) },
            ]} />}
            assumptions={<ResultAssumptions items={operation.result.assumptions.map((value, index) => ({ label: `Limite ${index + 1}`, value }))} />}
            provenance={<ResultProvenance>{sourceLabel(operation.result)}</ResultProvenance>}
          />
          <ResultActions actions={actions} onAction={{ copy, reset }} />
          {copyStatus !== "" && <p class="success" role="status" aria-live="polite">{copyStatus}</p>}
        </div>}
      </ToolResultPanel>
    </ToolOperation>
  );
}

export function InpsArtigianiCommerciantiTool() { return <ArtigianiCommerciantiCalculator />; }
export function GestioneSeparataContributiTool() { return <GestioneSeparataCalculator />; }
