import { useState } from "preact/hooks";
import { profileValuesForTool } from "../../profile/work-profile";
import { toolRuntime } from "../../runtime/tool-runtime";
import { marginMarkupManifest } from "../../tools/margin-markup/manifest";
import type { MarginMarkupOutput } from "../../tools/margin-markup/types";
import { useWorkProfile } from "./client-time-math/work-profile";
import {
  InlineError,
  ProfileOverrideHint,
  ProfileResetButton,
  ProvenanceBadge,
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
    operation.reset();
  }

  const result = operation.result;
  const profitHeadline = result === null
    ? ""
    : `${result.currency} ${result.profit} di profitto`;
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
        {/* Outside the result branch on purpose: a recompute clears the result
            for a tick, and the headline has to keep its state through that. */}
        <PreviousValue value={profitHeadline} retain={operation.isRunning} />
        {operation.result !== null && (
          <>
            <dl class="assumptions">
              <div><dt>Margine</dt><dd>{operation.result.marginPercent === null ? "Non definito" : `${operation.result.marginPercent}%`} · profitto ÷ prezzo × 100</dd></div>
              <div><dt>Ricarico</dt><dd>{operation.result.markupPercent === null ? "Non definito" : `${operation.result.markupPercent}%`} · profitto ÷ costo × 100</dd></div>
              {operation.result.denominatorErrors.map((issue) => <div key={issue.code}><dt>Denominatore non valido</dt><dd>Il calcolo non è definito con il valore inserito.</dd></div>)}
              <div><dt>Arrotondamento</dt><dd>Solo sui valori finali · metà verso l'alto · importi a 2 decimali · percentuali a 2 decimali</dd></div>
              <div><dt>Origine della valuta</dt><dd><ProvenanceBadge provenance={operation.result.currencyProvenance} /></dd></div>
            </dl>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
