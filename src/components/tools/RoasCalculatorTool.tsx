import { useState } from "preact/hooks";
import type { RoasResult } from "../../engines/marketing-math";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { roasCalculatorManifest } from "../../tools/roas-calculator/manifest";
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

export function RoasCalculatorTool() {
  const [spend, setSpend] = useState("");
  const [revenue, setRevenue] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const operation = useToolOperation<RoasResult>(
    (signal: AbortSignal) => toolRuntime.run("roas-calculator", { spend, revenue }, {}, signal),
    { formatError: () => "Inserisci valori non negativi per spesa e ricavi." },
  );
  const result = operation.result;
  const declaration = roasCalculatorManifest.result;
  const copyPayload = result === null ? "" : `${result.roas}× (${result.roasPercent}%)`;
  const resultActions = result === null ? [] : resolveResultActions({ declaration, primary: "copy", hasCopyPayload: true, resetReady: true });

  function reset() {
    setSpend("");
    setRevenue("");
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
          <div class="field-grid"><label class="field"><span>Spesa</span><input aria-label="Spesa" inputMode="decimal" value={spend} onInput={(event) => setSpend(event.currentTarget.value)} placeholder="200,00" /></label><label class="field"><span>Ricavi</span><input aria-label="Ricavi" inputMode="decimal" value={revenue} onInput={(event) => setRevenue(event.currentTarget.value)} placeholder="1000,00" /></label></div>
          <InlineError message={operation.error} />
          <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Calcola ROAS</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
        </ToolFormCard>
      </form>
      <ToolResultPanel eyebrow="ROAS" placeholder="Qui appariranno rapporto, percentuale e criterio di arrotondamento." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && (
          <div data-result-class="calculator">
            <ResultExplanation
              primary={<div data-result-slot="primary"><ResultPrimaryAnswer label="ROAS" unit="×">{result.roas}</ResultPrimaryAnswer></div>}
              interpretation={<div data-result-slot="interpretation"><ResultInterpretation state="success">Il ritorno equivale al {result.roasPercent}% della spesa pubblicitaria.</ResultInterpretation></div>}
              breakdown={<div data-result-slot="breakdown"><ResultBreakdown rows={[{ label: "Spesa", value: result.spend }, { label: "Ricavi", value: result.revenue }, { label: "Rapporto esatto", value: result.roasExact }]} /></div>}
              assumptions={<div data-result-slot="assumptions"><ResultAssumptions items={[{ label: "Formula", value: result.formula }, { label: "Arrotondamento", value: "Metà verso l'alto · 2 decimali · solo sul risultato finale" }]} /></div>}
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
