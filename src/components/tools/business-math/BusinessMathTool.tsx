import { useState } from "preact/hooks";
import type { BusinessOperation } from "../../../engines/business-math";
import type { ToolRunResult } from "../../../runtime/types";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { useWorkProfile } from "../client-time-math/work-profile";
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
} from "../shared";

export type BusinessFieldKind = "text" | "number" | "select" | "date";

export interface BusinessFieldConfig {
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly kind?: BusinessFieldKind;
  readonly help?: string;
  readonly options?: readonly string[];
}

export interface BusinessToolConfig {
  readonly id: string;
  readonly operation: BusinessOperation;
  readonly title: string;
  readonly lede: string;
  readonly resultLabel: string;
  readonly placeholder: string;
  readonly fields: readonly BusinessFieldConfig[];
  readonly showCurrency?: boolean;
}

function initialValues(config: BusinessToolConfig): Record<string, string> {
  return Object.fromEntries(config.fields.map((field) => [field.name, field.defaultValue]));
}

function resultEntries(value: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(value).filter(([key]) => ![
    "assumptions",
    "formulas",
    "rounding",
    "currencyProvenance",
  ].includes(key));
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "None" : value.map((item) => displayValue(item)).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return "Unavailable";
  }
}

function objectEntries(value: unknown): Array<[string, unknown]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>);
}

function inputValue(values: Record<string, string>, config: BusinessToolConfig): Record<string, unknown> {
  return Object.fromEntries(
    config.fields
      .filter((field) => values[field.name] !== "")
      .map((field) => [field.name, values[field.name]]),
  );
}

export function BusinessMathTool({ config }: { config: BusinessToolConfig }) {
  const { profile, ready } = useWorkProfile();
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(config));
  const [currencyOverride, setCurrencyOverride] = useState<string | undefined>();
  const currency = currencyOverride ?? profile.currency;
  const operation = useToolOperation<Record<string, unknown>>(
    (signal: AbortSignal) => toolRuntime.run(
      config.id,
      inputValue(values, config),
      {
        explicit: currencyOverride === undefined ? {} : { currency: currencyOverride },
        profile: { currency: profile.currency },
      },
      signal,
    ),
    {
      formatError: (run: Extract<ToolRunResult, { ok: false }>) => run.code === "INVALID_INPUT"
        ? "Check the values and try again. Percentages use plain numbers such as 3 or 3.5."
        : run.message,
    },
  );

  function setField(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function submit(event: Event) {
    event.preventDefault();
    void operation.run();
  }

  function reset() {
    setValues(initialValues(config));
    setCurrencyOverride(undefined);
    operation.reset();
  }

  const result = operation.result;
  const primaryEntries = result === null ? [] : resultEntries(result);
  const formulas = result === null ? [] : objectEntries(result.formulas);
  const assumptions = result === null ? [] : objectEntries(result.assumptions);
  const currencyProvenance = result?.currencyProvenance;

  return (
    <ToolOperation busy={operation.isRunning}>
      <form onSubmit={submit} noValidate>
        <div class="field-grid">
          {config.fields.map((field) => {
            const value = values[field.name] ?? "";
            const inputId = `${config.id}-${field.name}`;
            if (field.kind === "select") {
              return (
                <label class="field" key={field.name} htmlFor={inputId}>
                  <span>{field.label}</span>
                  <select id={inputId} value={value} onChange={(event) => setField(field.name, (event.currentTarget as HTMLSelectElement).value)}>
                    {(field.options ?? []).map((option) => <option value={option} key={option}>{option}</option>)}
                  </select>
                  {field.help !== undefined && <small>{field.help}</small>}
                </label>
              );
            }
            return (
              <label class="field" key={field.name} htmlFor={inputId}>
                <span>{field.label}</span>
                <input
                  id={inputId}
                  required={field.defaultValue === ""}
                  type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
                  step={field.kind === "number" ? "any" : undefined}
                  inputMode={field.kind === "number" ? "decimal" : undefined}
                  value={value}
                  onInput={(event) => setField(field.name, (event.currentTarget as HTMLInputElement).value)}
                  aria-describedby={field.help === undefined ? undefined : `${inputId}-help`}
                />
                {field.help !== undefined && <small id={`${inputId}-help`}>{field.help}</small>}
              </label>
            );
          })}
          {config.showCurrency === true && (
            <div class="field">
              <label htmlFor={`${config.id}-currency`}>Currency label</label>
              <input
                id={`${config.id}-currency`}
                required
                value={currency}
                onInput={(event) => setCurrencyOverride((event.currentTarget as HTMLInputElement).value.toUpperCase())}
                aria-describedby={`${config.id}-currency-help`}
              />
              <ProfileOverrideHint
                id={`${config.id}-currency-help`}
                ready={ready}
                overridden={currencyOverride !== undefined}
                profileLabel="Work Profile currency label"
                overrideLabel="Current task currency label"
              />
              <ProfileResetButton disabled={currencyOverride === undefined} onReset={() => setCurrencyOverride(undefined)}>Use Work Profile currency</ProfileResetButton>
            </div>
          )}
        </div>
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel="Calculating…">Calculate</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning} />
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow={config.resultLabel} placeholder={config.placeholder} busy={operation.isRunning}>
        {result !== null && (
          <>
            {typeof result.currency === "string" && <strong class="result-value">{result.currency} result</strong>}
            <dl class="assumptions">
              {primaryEntries.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{displayValue(value)}</dd></div>)}
              {typeof currencyProvenance === "string" && <div><dt>Currency source</dt><dd><ProvenanceBadge provenance={currencyProvenance as "explicit" | "profile" | "tool-default" | "system-derived"} /></dd></div>}
            </dl>
            {assumptions.length > 0 && <details><summary>Assumptions</summary><dl class="assumptions">{assumptions.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{displayValue(value)}</dd></div>)}</dl></details>}
            {formulas.length > 0 && <details><summary>Formula</summary><dl class="assumptions">{formulas.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{displayValue(value)}</dd></div>)}</dl></details>}
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
