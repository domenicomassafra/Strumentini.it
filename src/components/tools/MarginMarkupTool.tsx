import { useState } from "preact/hooks";
import { profileValuesForTool } from "../../profile/work-profile";
import { toolRuntime } from "../../runtime/tool-runtime";
import { marginMarkupManifest } from "../../tools/margin-markup/manifest";
import type { MarginMarkupOutput } from "../../tools/margin-markup/types";
import { useWorkProfile } from "./client-time-math/work-profile";

export function MarginMarkupTool() {
  const { profile, ready } = useWorkProfile();
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [currencyOverride, setCurrencyOverride] = useState<string | undefined>();
  const [result, setResult] = useState<MarginMarkupOutput | null>(null);
  const [error, setError] = useState("");
  const currency = currencyOverride ?? profile.currency;

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    setResult(null);
    const run = await toolRuntime.run(
      marginMarkupManifest.id,
      { price, cost },
      {
        explicit: currencyOverride === undefined ? {} : { currency: currencyOverride },
        profile: profileValuesForTool(marginMarkupManifest, profile),
      },
    );
    if (!run.ok) {
      setError("Enter valid decimal values for price/revenue and cost.");
      return;
    }
    setResult(run.value as MarginMarkupOutput);
  }

  function reset() {
    setPrice("");
    setCost("");
    setCurrencyOverride(undefined);
    setResult(null);
    setError("");
  }

  return (
    <div class="tool-operation">
      <form onSubmit={submit} noValidate>
        <div class="field-grid">
          <label class="field"><span>Price / revenue</span><input required inputMode="decimal" value={price} onInput={(event) => setPrice(event.currentTarget.value)} placeholder="100.00" /></label>
          <label class="field"><span>Cost</span><input required inputMode="decimal" value={cost} onInput={(event) => setCost(event.currentTarget.value)} placeholder="80.00" /></label>
        </div>
        <label class="field">
          <span>Currency label</span>
          <input required value={currency} onInput={(event) => setCurrencyOverride(event.currentTarget.value.toUpperCase())} aria-describedby="margin-currency-help" />
          <small id="margin-currency-help">{ready && currencyOverride === undefined ? "Work Profile default" : "Current task override"}</small>
          <button class="text-button" type="button" disabled={currencyOverride === undefined} onClick={() => setCurrencyOverride(undefined)}>Use Work Profile currency</button>
        </label>
        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions"><button class="primary" type="submit">Calculate margin &amp; markup</button><button type="button" onClick={reset}>Reset</button></div>
      </form>
      <section class="result-panel" aria-live="polite" aria-atomic="true">
        <p class="eyebrow">Profitability</p>
        {result === null ? <p class="result-placeholder">Your margin and markup appear here.</p> : (
          <>
            <strong class="result-value">{result.currency} {result.profit} profit</strong>
            <dl class="assumptions">
              <div><dt>Margin</dt><dd>{result.marginPercent === null ? "Undefined" : `${result.marginPercent}%`} · profit ÷ price × 100</dd></div>
              <div><dt>Markup</dt><dd>{result.markupPercent === null ? "Undefined" : `${result.markupPercent}%`} · profit ÷ cost × 100</dd></div>
              {result.denominatorErrors.map((issue) => <div key={issue.code}><dt>{issue.metric} denominator</dt><dd>{issue.message}</dd></div>)}
              <div><dt>Rounding</dt><dd>Final values only · half-up · money 2 decimals · percentages 2 decimals</dd></div>
              <div><dt>Currency source</dt><dd>{result.currencyProvenance === "profile" ? "Work Profile default" : "Current task override"}</dd></div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
