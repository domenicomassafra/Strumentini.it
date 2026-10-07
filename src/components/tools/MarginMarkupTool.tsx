import { useState } from "preact/hooks";
import { profileValuesForTool } from "../../profile/work-profile";
import { resolveResultActions } from "../../runtime/result-actions";
import { toolRuntime } from "../../runtime/tool-runtime";
import { marginMarkupManifest } from "../../tools/margin-markup/manifest";
import type { MarginMarkupOutput } from "../../tools/margin-markup/types";
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

export function MarginMarkupTool() {
  const { profile, ready } = useWorkProfile();
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [currencyOverride, setCurrencyOverride] = useState<string | undefined>();
  const [actionStatus, setActionStatus] = useState("");
  const currency = currencyOverride ?? profile.currency;
  const operation = useToolOperation<MarginMarkupOutput>(
    (signal: AbortSignal) => toolRuntime.run(
      marginMarkupManifest.id,
      { price, cost },
      {
        explicit: currencyOverride === undefined ? {} : { currency: currencyOverride },
        profile: profileValuesForTool(marginMarkupManifest, profile),
      },
      signal,
    ),
    { formatError: () => "Inserisci valori decimali validi per prezzo o ricavi e costo." },
  );

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  function reset() {
    setPrice("");
    setCost("");
    setCurrencyOverride(undefined);
    setActionStatus("");
    operation.reset();
  }

  const result = operation.result;
  const profitHeadline = result === null
    ? ""
    : `${result.currency} ${result.profit} di profitto`;
  const declaration = marginMarkupManifest.result;
  const resultActions = result === null ? [] : resolveResultActions({
    declaration,
    primary: "copy",
    hasCopyPayload: profitHeadline !== "",
    resetReady: true,
  });

  async function copyResult() {
    if (navigator.clipboard === undefined) {
      setActionStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    await navigator.clipboard.writeText(profitHeadline);
    setActionStatus("Risultato copiato.");
  }
  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        <div class="field-grid">
          <label class="field"><span>Prezzo o ricavi</span><input required inputMode="decimal" value={price} onInput={(event) => setPrice(event.currentTarget.value)} placeholder="100,00" /></label>
          <label class="field"><span>Costo</span><input required inputMode="decimal" value={cost} onInput={(event) => setCost(event.currentTarget.value)} placeholder="80,00" /></label>
        </div>
        <label class="field">
          <span>Valuta</span>
          <input required value={currency} onInput={(event) => setCurrencyOverride(event.currentTarget.value.toUpperCase())} aria-describedby="margin-currency-help" />
          <ProfileOverrideHint id="margin-currency-help" ready={ready} overridden={currencyOverride !== undefined} />
          <ProfileResetButton disabled={currencyOverride === undefined} onReset={() => setCurrencyOverride(undefined)}>Usa la valuta del profilo</ProfileResetButton>
        </label>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>Calcola margine e ricarico</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Redditività" placeholder={it(CONTROL.gutterIdle)} busy={operation.isRunning} state={gutterStateFor(operation.status)}>
        {(result !== null || operation.isRunning) && (
          <div data-result-class="calculator">
            <ResultExplanation
              primary={<div data-result-slot="primary"><ResultPrimaryAnswer label="Profitto"><PreviousValue value={profitHeadline} className="" retain={operation.isRunning} /></ResultPrimaryAnswer></div>}
              interpretation={<div data-result-slot="interpretation"><ResultInterpretation state={result?.denominatorErrors.length ? "warning" : "success"}>{result === null ? "Calcolo in corso." : result.denominatorErrors.length ? "Il profitto è disponibile, ma una percentuale non è definita con denominatore zero." : "Margine e ricarico calcolati con gli stessi importi inseriti."}</ResultInterpretation></div>}
              breakdown={result === null ? undefined : <div data-result-slot="breakdown"><ResultBreakdown rows={[
                { label: "Prezzo o ricavi", value: `${result.currency} ${result.price}` },
                { label: "Costo", value: `${result.currency} ${result.cost}` },
                { label: "Margine", value: result.marginPercent === null ? "Non definito" : `${result.marginPercent}% · profitto ÷ prezzo × 100` },
                { label: "Ricarico", value: result.markupPercent === null ? "Non definito" : `${result.markupPercent}% · profitto ÷ costo × 100` },
              ]} /></div>}
              assumptions={result === null ? undefined : <div data-result-slot="assumptions"><ResultAssumptions items={[
                { label: "Formula margine", value: "profitto ÷ prezzo × 100" },
                { label: "Formula ricarico", value: "profitto ÷ costo × 100" },
                { label: "Arrotondamento", value: "Solo sui valori finali · metà verso l'alto · 2 decimali" },
              ]} /></div>}
              provenance={result === null ? undefined : <div data-result-slot="provenance"><ResultProvenance>Calcolo locale deterministico. Origine valuta: <ProvenanceBadge provenance={result.currencyProvenance} />.</ResultProvenance></div>}
            />
            {result !== null && <ResultActions actions={resultActions} onAction={{ copy: copyResult, reset }} />}
            {actionStatus !== "" && <p class="success" role="status" aria-live="polite">{actionStatus}</p>}
          </div>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
