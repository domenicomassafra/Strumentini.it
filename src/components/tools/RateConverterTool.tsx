import { useState } from "preact/hooks";
import { profileValuesForTool } from "../../profile/work-profile";
import { toolRuntime } from "../../runtime/tool-runtime";
import type { RateUnit } from "../../engines/client-time-math";
import { rateConverterManifest } from "../../tools/rate-converter/manifest";
import type { RateConverterOutput } from "../../tools/rate-converter/types";
import { useWorkProfile } from "./client-time-math/work-profile";

const UNITS: readonly RateUnit[] = ["hour", "day", "project"];

export function RateConverterTool() {
  const { profile, ready } = useWorkProfile();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<RateUnit>("hour");
  const [to, setTo] = useState<RateUnit>("day");
  const [hoursPerDayOverride, setHoursPerDayOverride] = useState<string | undefined>();
  const [projectHours, setProjectHours] = useState("40");
  const [currencyOverride, setCurrencyOverride] = useState<string | undefined>();
  const [result, setResult] = useState<RateConverterOutput | null>(null);
  const [error, setError] = useState("");
  const currency = currencyOverride ?? profile.currency;
  const hoursPerDay = hoursPerDayOverride ?? "8";
  const usesProject = from === "project" || to === "project";

  async function submit(event: Event) {
    event.preventDefault();
    setError("");
    setResult(null);
    const run = await toolRuntime.run(
      rateConverterManifest.id,
      { amount, from, to, ...(usesProject ? { projectHours } : {}) },
      {
        explicit: {
          ...(currencyOverride === undefined ? {} : { currency: currencyOverride }),
          ...(hoursPerDayOverride === undefined ? {} : { hoursPerDay: hoursPerDayOverride }),
        },
        profile: profileValuesForTool(rateConverterManifest, profile),
      },
    );
    if (!run.ok) {
      setError(run.message === "INVALID_PROJECT_HOURS_REQUIRED" ? "Project hours are required when either side is a project rate." : "Check the amount and work-basis assumptions.");
      return;
    }
    setResult(run.value as RateConverterOutput);
  }

  function reset() {
    setAmount("");
    setFrom("hour");
    setTo("day");
    setHoursPerDayOverride(undefined);
    setProjectHours("40");
    setCurrencyOverride(undefined);
    setResult(null);
    setError("");
  }

  return (
    <div class="tool-operation">
      <form onSubmit={submit} noValidate>
        <div class="field-grid">
          <label class="field"><span>Rate amount</span><input required inputMode="decimal" value={amount} onInput={(event) => setAmount(event.currentTarget.value)} placeholder="50.00" /></label>
          <label class="field">
            <span>Currency label</span>
            <input required value={currency} onInput={(event) => setCurrencyOverride(event.currentTarget.value.toUpperCase())} aria-describedby="currency-help" />
            <small id="currency-help">{ready && currencyOverride === undefined ? "Work Profile default · label only, no FX conversion" : "Current task override · label only, no FX conversion"}</small>
            <button class="text-button" type="button" disabled={currencyOverride === undefined} onClick={() => setCurrencyOverride(undefined)}>Use Work Profile currency</button>
          </label>
        </div>
        <div class="field-grid">
          <label class="field"><span>From</span><select value={from} onChange={(event) => setFrom(event.currentTarget.value as RateUnit)}>{UNITS.map((unit) => <option value={unit}>{unit}</option>)}</select></label>
          <label class="field"><span>To</span><select value={to} onChange={(event) => setTo(event.currentTarget.value as RateUnit)}>{UNITS.map((unit) => <option value={unit}>{unit}</option>)}</select></label>
        </div>
        <label class="field">
          <span>Hours per day</span>
          <input required inputMode="decimal" value={hoursPerDay} onInput={(event) => setHoursPerDayOverride(event.currentTarget.value)} />
          <small>{hoursPerDayOverride === undefined ? "Tool default: 8 hours/day" : "Current task override"}</small>
          <button class="text-button" type="button" disabled={hoursPerDayOverride === undefined} onClick={() => setHoursPerDayOverride(undefined)}>Use 8-hour tool default</button>
        </label>
        {usesProject && <label class="field"><span>Project hours</span><input required inputMode="decimal" value={projectHours} onInput={(event) => setProjectHours(event.currentTarget.value)} /><small>Required dimensional basis for a project rate.</small></label>}
        {error !== "" && <p class="error" role="alert">{error}</p>}
        <div class="actions"><button class="primary" type="submit">Convert rate</button><button type="button" onClick={reset}>Reset</button></div>
      </form>
      <section class="result-panel" aria-live="polite" aria-atomic="true">
        <p class="eyebrow">Converted rate</p>
        {result === null ? <p class="result-placeholder">Your converted rate appears here.</p> : (
          <>
            <strong class="result-value">{result.currency} {result.amount} / {to}</strong>
            <dl class="assumptions">
              <div><dt>Formula</dt><dd>{result.formula}</dd></div>
              <div><dt>Hours/day</dt><dd>{result.assumptions.hoursPerDay} · {result.provenance.hoursPerDay === "tool-default" ? "tool default" : "current task override"}</dd></div>
              {result.assumptions.projectHours !== undefined && <div><dt>Project hours</dt><dd>{result.assumptions.projectHours}</dd></div>}
              <div><dt>Rounding</dt><dd>Final result only · half-up · 2 decimal places</dd></div>
              <div><dt>Currency</dt><dd>{result.currency} is a label only. No live or implied FX conversion.</dd></div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
