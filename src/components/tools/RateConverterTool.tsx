import { useState } from "preact/hooks";
import { profileValuesForTool } from "../../profile/work-profile";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { RateUnit } from "../../engines/client-time-math";
import { rateConverterManifest } from "../../tools/rate-converter/manifest";
import type { RateConverterOutput } from "../../tools/rate-converter/types";
import { useWorkProfile } from "./client-time-math/work-profile";
import {
  InlineError,
  ProfileOverrideHint,
  ProfileResetButton,
  ProvenanceBadge,
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
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";
import { gutterStateFor } from "./shared/ToolGutter";
import { PreviousValue } from "./shared/PreviousValue";

const UNITS: readonly RateUnit[] = ["hour", "day", "project"];
const UNIT_LABELS: Readonly<Record<RateUnit, string>> = {
  hour: "ora",
  day: "giorno",
  project: "progetto",
};

export function RateConverterTool() {
  const { profile, ready } = useWorkProfile();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<RateUnit>("hour");
  const [to, setTo] = useState<RateUnit>("day");
  const [hoursPerDayOverride, setHoursPerDayOverride] = useState<string | undefined>();
  const [projectHours, setProjectHours] = useState("40");
  const [currencyOverride, setCurrencyOverride] = useState<string | undefined>();
  const [actionStatus, setActionStatus] = useState("");
  const currency = currencyOverride ?? profile.currency;
  const hoursPerDay = hoursPerDayOverride ?? "8";
  const usesProject = from === "project" || to === "project";
  const operation = useToolOperation<RateConverterOutput>(
    (signal: AbortSignal) => toolRuntime.run(
      rateConverterManifest.id,
      { amount, from, to, ...(usesProject ? { projectHours } : {}) },
      {
        explicit: {
          ...(currencyOverride === undefined ? {} : { currency: currencyOverride }),
          ...(hoursPerDayOverride === undefined ? {} : { hoursPerDay: hoursPerDayOverride }),
        },
        profile: profileValuesForTool(rateConverterManifest, profile),
      },
      signal,
    ),
    {
      formatError: (run) => run.message === "INVALID_PROJECT_HOURS_REQUIRED"
        ? "Le ore di progetto sono obbligatorie quando una delle due tariffe è a progetto."
        : "Controlla l'importo e le ipotesi sulla base di lavoro.",
    },
  );

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  function reset() {
    setAmount("");
    setFrom("hour");
    setTo("day");
    setHoursPerDayOverride(undefined);
    setProjectHours("40");
    setCurrencyOverride(undefined);
    setActionStatus("");
    operation.reset();
  }

  const rateResult = operation.result;
  const rateHeadline = rateResult === null ? "" : `${rateResult.currency} ${rateResult.amount} / ${UNIT_LABELS[to]}`;
  const declaration = rateConverterManifest.result;
  const resultActions = rateResult === null ? [] : resolveResultActions({
    declaration,
    primary: "copy",
    hasCopyPayload: rateHeadline !== "",
    resetReady: true,
  });

  async function copyResult() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    await navigator.clipboard.writeText(rateHeadline);
    setActionStatus("Risultato copiato.");
  }
  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        <div class="field-grid">
          <label class="field"><span>Importo della tariffa</span><input required inputMode="decimal" value={amount} onInput={(event) => setAmount(event.currentTarget.value)} placeholder="50,00" /></label>
          <label class="field">
            <span>Valuta</span>
            <input required value={currency} onInput={(event) => setCurrencyOverride(event.currentTarget.value.toUpperCase())} aria-describedby="currency-help" />
            <ProfileOverrideHint
              id="currency-help"
              ready={ready}
              overridden={currencyOverride !== undefined}
              profileLabel="Valore predefinito dal profilo · solo etichetta, nessuna conversione valutaria"
              overrideLabel="Valore specifico per questa attività · solo etichetta, nessuna conversione valutaria"
            />
            <ProfileResetButton disabled={currencyOverride === undefined} onReset={() => setCurrencyOverride(undefined)}>Usa la valuta del profilo</ProfileResetButton>
          </label>
        </div>
        <div class="field-grid">
          <label class="field"><span>Da</span><select value={from} onChange={(event) => setFrom(event.currentTarget.value as RateUnit)}>{UNITS.map((unit) => <option value={unit} key={unit}>{UNIT_LABELS[unit]}</option>)}</select></label>
          <label class="field"><span>A</span><select value={to} onChange={(event) => setTo(event.currentTarget.value as RateUnit)}>{UNITS.map((unit) => <option value={unit} key={unit}>{UNIT_LABELS[unit]}</option>)}</select></label>
        </div>
        <label class="field">
          <span>Ore al giorno</span>
          <input required inputMode="decimal" value={hoursPerDay} onInput={(event) => setHoursPerDayOverride(event.currentTarget.value)} />
          <small>{hoursPerDayOverride === undefined ? "Valore predefinito: 8 ore al giorno" : "Valore specifico per questa attività"}</small>
          <ProfileResetButton disabled={hoursPerDayOverride === undefined} onReset={() => setHoursPerDayOverride(undefined)}>Usa il valore predefinito di 8 ore</ProfileResetButton>
        </label>
        {usesProject && <label class="field"><span>Ore del progetto</span><input required inputMode="decimal" value={projectHours} onInput={(event) => setProjectHours(event.currentTarget.value)} /><small>Base temporale necessaria per convertire una tariffa a progetto.</small></label>}
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Converti tariffa</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Tasso convertito" placeholder={it(CONTROL.gutterIdle)} busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {(rateResult !== null || operation.isRunning) && (
          <div data-result-class="calculator">
            <ResultExplanation
              primary={<div data-result-slot="primary"><ResultPrimaryAnswer label="Tariffa convertita"><PreviousValue value={rateHeadline} className="" retain={operation.isRunning} /></ResultPrimaryAnswer></div>}
              interpretation={<div data-result-slot="interpretation"><ResultInterpretation state="success">{rateResult === null ? "Conversione in corso." : "Tariffa convertita sulla base temporale dichiarata, senza cambio valuta."}</ResultInterpretation></div>}
              breakdown={rateResult === null ? undefined : <div data-result-slot="breakdown"><ResultBreakdown rows={[
                { label: "Ore al giorno", value: rateResult.assumptions.hoursPerDay },
                ...(rateResult.assumptions.projectHours === undefined ? [] : [{ label: "Ore del progetto", value: rateResult.assumptions.projectHours }]),
              ]} /></div>}
              assumptions={rateResult === null ? undefined : <div data-result-slot="assumptions"><ResultAssumptions items={[
                { label: "Formula", value: rateResult.formula },
                { label: "Arrotondamento", value: "Solo sul risultato finale · metà verso l'alto · 2 decimali" },
                { label: "Valuta", value: `${rateResult.currency} è solo un'etichetta; nessuna conversione valutaria è implicita.` },
              ]} /></div>}
              provenance={rateResult === null ? undefined : <div data-result-slot="provenance"><ResultProvenance>Calcolo locale deterministico. Base ore/giorno: <ProvenanceBadge provenance={rateResult.provenance.hoursPerDay} />.</ResultProvenance></div>}
            />
            {rateResult !== null && <ResultActions actions={resultActions} onAction={{ copy: copyResult, reset }} />}
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
