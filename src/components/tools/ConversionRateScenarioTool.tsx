import { useState } from "preact/hooks";
import type { ConversionScenarioResult } from "../../engines/marketing-math";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { conversionRateScenarioManifest } from "../../tools/conversion-rate-scenario/manifest";
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
  ToolFormCard,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  gutterStateFor,
  useToolOperation,
} from "./shared";
import { CONTROL, it } from "./shared/controlLabels";

export function ConversionRateScenarioTool() {
  const [visits, setVisits] = useState("");
  const [conversions, setConversions] = useState("");
  const [targetRatePercent, setTargetRatePercent] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const operation = useToolOperation<ConversionScenarioResult>(
    (signal: AbortSignal) => toolRuntime.run("conversion-rate-scenario", { visits, conversions, targetRatePercent }, {}, signal),
    { formatError: () => "Inserisci visite, conversioni di partenza e percentuale obiettivo." },
  );
  const result = operation.result;
  const declaration = conversionRateScenarioManifest.result;
  const copyPayload = result === null ? "" : `${result.projectedConversions} conversioni previste`;
  const resultActions = result === null ? [] : resolveResultActions({
    declaration,
    primary: "copy",
    hasCopyPayload: true,
    resetReady: true,
  });

  function reset() {
    setVisits("");
    setConversions("");
    setTargetRatePercent("");
    setActionStatus("");
    operation.reset();
  }

  async function copyResult() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    await navigator.clipboard.writeText(copyPayload);
    setActionStatus("Risultato copiato.");
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={(event) => { event.preventDefault(); void operation.run(); }}>
        <ToolFormCard>
          <div class="field-grid">
            <label class="field"><span>Visite</span><input aria-label="Visite" inputMode="decimal" value={visits} onInput={(event) => setVisits(event.currentTarget.value)} placeholder="1000" /></label>
            <label class="field"><span>Conversioni di partenza</span><input aria-label="Conversioni di partenza" inputMode="decimal" value={conversions} onInput={(event) => setConversions(event.currentTarget.value)} placeholder="25" /></label>
          </div>
          <label class="field"><span>Tasso di conversione obiettivo (%)</span><input aria-label="Tasso di conversione obiettivo" inputMode="decimal" value={targetRatePercent} onInput={(event) => setTargetRatePercent(event.currentTarget.value)} placeholder="3" /></label>
          <InlineError message={operation.error} />
          <ToolActions>
            <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Proietta conversioni</ToolSubmitButton>
            <ToolResetButton onClick={reset} disabled={operation.isRunning} />
          </ToolActions>
        </ToolFormCard>
      </form>
      <ToolResultPanel eyebrow="Scenario" placeholder="Valori di partenza, conversioni previste e incremento appariranno qui." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && (
          <div data-result-class="calculator">
            <ResultExplanation
              primary={<div data-result-slot="primary"><ResultPrimaryAnswer label="Conversioni previste">{result.projectedConversions}</ResultPrimaryAnswer></div>}
              interpretation={<div data-result-slot="interpretation"><ResultInterpretation state="success">Con il tasso obiettivo indicato, il traffico corrente produrrebbe questa proiezione.</ResultInterpretation></div>}
              breakdown={<div data-result-slot="breakdown"><ResultBreakdown rows={[
                { label: "Visite", value: result.visits },
                { label: "Conversioni attuali", value: result.baselineConversions },
                { label: "Tasso attuale", value: `${result.baselineRatePercent}%` },
                { label: "Tasso obiettivo", value: `${result.targetRatePercent}%` },
                { label: "Incremento assoluto", value: result.absoluteLift },
                { label: "Incremento relativo", value: result.liftPercent === "undefined" ? "Non definito" : `${result.liftPercent}%` },
              ]} /></div>}
              assumptions={<div data-result-slot="assumptions"><ResultAssumptions items={[
                { label: "Formula", value: result.formula },
                { label: "Arrotondamento", value: "Metà verso l'alto · 2 decimali · solo sul risultato finale" },
              ]} /></div>}
              provenance={<div data-result-slot="provenance"><ResultProvenance>Calcolo locale deterministico, senza richieste di rete.</ResultProvenance></div>}
            />
            <ResultActions actions={resultActions} onAction={{ copy: copyResult, reset }} />
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
