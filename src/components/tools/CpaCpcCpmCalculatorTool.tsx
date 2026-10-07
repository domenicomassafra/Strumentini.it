import { useState } from "preact/hooks";
import type { PerformanceResult } from "../../engines/marketing-math";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { cpaCpcCpmCalculatorManifest } from "../../tools/cpa-cpc-cpm-calculator/manifest";
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

const METRIC_LABELS = { cpa: "CPA", cpc: "CPC", cpm: "CPM" } as const;

export function CpaCpcCpmCalculatorTool() {
  const [metric, setMetric] = useState("cpa");
  const [spend, setSpend] = useState("");
  const [denominator, setDenominator] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const operation = useToolOperation<PerformanceResult>(
    (signal: AbortSignal) => toolRuntime.run("cpa-cpc-cpm-calculator", { metric, spend, denominator }, {}, signal),
    { formatError: () => "Scegli una metrica e inserisci spesa e denominatore maggiore di zero." },
  );
  const result = operation.result;
  const declaration = cpaCpcCpmCalculatorManifest.result;
  const copyPayload = result === null ? "" : `${METRIC_LABELS[result.metric]} ${result.value}`;
  const resultActions = result === null ? [] : resolveResultActions({ declaration, primary: "copy", hasCopyPayload: true, resetReady: true });

  function reset() {
    setMetric("cpa");
    setSpend("");
    setDenominator("");
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
          <label class="field"><span>Metrica</span><select aria-label="Metrica" value={metric} onChange={(event) => setMetric(event.currentTarget.value)}><option value="cpa">CPA — acquisizioni</option><option value="cpc">CPC — clic</option><option value="cpm">CPM — impressioni</option></select></label>
          <div class="field-grid"><label class="field"><span>Spesa</span><input aria-label="Spesa" inputMode="decimal" value={spend} onInput={(event) => setSpend(event.currentTarget.value)} placeholder="200,00" /></label><label class="field"><span>Quantità di riferimento</span><input aria-label="Quantità di riferimento" inputMode="decimal" value={denominator} onInput={(event) => setDenominator(event.currentTarget.value)} placeholder="8" /></label></div>
          <InlineError message={operation.error} />
          <ToolActions><ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Calcola metrica</ToolSubmitButton><ToolResetButton onClick={reset} disabled={operation.isRunning} /></ToolActions>
        </ToolFormCard>
      </form>
      <ToolResultPanel eyebrow="Metrica di rendimento" placeholder="Qui appariranno valore calcolato, unità e formula." busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {result !== null && (
          <div data-result-class="calculator">
            <ResultExplanation
              primary={<div data-result-slot="primary"><ResultPrimaryAnswer label={METRIC_LABELS[result.metric]}>{result.value}</ResultPrimaryAnswer></div>}
              interpretation={<div data-result-slot="interpretation"><ResultInterpretation state="success">Metrica calcolata con la spesa e la quantità di riferimento inserite.</ResultInterpretation></div>}
              breakdown={<div data-result-slot="breakdown"><ResultBreakdown rows={[{ label: "Spesa", value: result.spend }, { label: "Denominatore", value: result.denominator }]} /></div>}
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
