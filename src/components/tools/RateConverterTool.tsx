import { useState } from "preact/hooks";
import { profileValuesForTool } from "../../profile/work-profile";
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
  ToolActions,
  ToolOperation,
  ToolResetButton,
  ToolResultPanel,
  ToolSubmitButton,
  useToolOperation,
} from "./shared";

const UNITS: readonly RateUnit[] = ["hour", "day", "project"];

export function RateConverterTool() {
  const { profile, ready } = useWorkProfile();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<RateUnit>("hour");
  const [to, setTo] = useState<RateUnit>("day");
  const [hoursPerDayOverride, setHoursPerDayOverride] = useState<string | undefined>();
  const [projectHours, setProjectHours] = useState("40");
  const [currencyOverride, setCurrencyOverride] = useState<string | undefined>();
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
        ? "Project hours are required when either side is a project rate."
        : "Check the amount and work-basis assumptions.",
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
    operation.reset();
  }

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        <div class="field-grid">
          <label class="field"><span>Rate amount</span><input required inputMode="decimal" value={amount} onInput={(event) => setAmount(event.currentTarget.value)} placeholder="50.00" /></label>
          <label class="field">
            <span>Currency label</span>
            <input required value={currency} onInput={(event) => setCurrencyOverride(event.currentTarget.value.toUpperCase())} aria-describedby="currency-help" />
            <ProfileOverrideHint
              id="currency-help"
              ready={ready}
              overridden={currencyOverride !== undefined}
              profileLabel="Work Profile default · label only, no FX conversion"
              overrideLabel="Current task override · label only, no FX conversion"
            />
            <ProfileResetButton disabled={currencyOverride === undefined} onReset={() => setCurrencyOverride(undefined)}>Use Work Profile currency</ProfileResetButton>
          </label>
        </div>
        <div class="field-grid">
          <label class="field"><span>From</span><select value={from} onChange={(event) => setFrom(event.currentTarget.value as RateUnit)}>{UNITS.map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label>
          <label class="field"><span>To</span><select value={to} onChange={(event) => setTo(event.currentTarget.value as RateUnit)}>{UNITS.map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label>
        </div>
        <label class="field">
          <span>Hours per day</span>
          <input required inputMode="decimal" value={hoursPerDay} onInput={(event) => setHoursPerDayOverride(event.currentTarget.value)} />
          <small>{hoursPerDayOverride === undefined ? "Tool default: 8 hours/day" : "Current task override"}</small>
          <ProfileResetButton disabled={hoursPerDayOverride === undefined} onReset={() => setHoursPerDayOverride(undefined)}>Use 8-hour tool default</ProfileResetButton>
        </label>
        {usesProject && <label class="field"><span>Project hours</span><input required inputMode="decimal" value={projectHours} onInput={(event) => setProjectHours(event.currentTarget.value)} /><small>Required dimensional basis for a project rate.</small></label>}
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel="Converting…">Convert rate</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Converted rate" placeholder="Your converted rate appears here." busy={operation.isRunning}>
        {operation.result !== null && (
          <>
            <strong class="result-value">{operation.result.currency} {operation.result.amount} / {to}</strong>
            <dl class="assumptions">
              <div><dt>Formula</dt><dd>{operation.result.formula}</dd></div>
              <div><dt>Hours/day</dt><dd>{operation.result.assumptions.hoursPerDay} · <ProvenanceBadge provenance={operation.result.provenance.hoursPerDay} /></dd></div>
              {operation.result.assumptions.projectHours !== undefined && <div><dt>Project hours</dt><dd>{operation.result.assumptions.projectHours}</dd></div>}
              <div><dt>Rounding</dt><dd>Final result only · half-up · 2 decimal places</dd></div>
              <div><dt>Currency</dt><dd>{operation.result.currency} is a label only. No live or implied FX conversion.</dd></div>
            </dl>
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
