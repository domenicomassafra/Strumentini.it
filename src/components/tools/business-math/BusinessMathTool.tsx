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
  gutterStateFor,
  useToolOperation,
} from "../shared";
import { CONTROL, it } from "../shared/controlLabels";
import { PreviousValue } from "../shared/PreviousValue";
import { TOOL_COPY_IT } from "../../../i18n/it/tool-copy";

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
  if (Array.isArray(value)) return value.length === 0 ? "Nessuno" : value.map((item) => displayValue(item)).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return "Non disponibile";
  }
}

function objectEntries(value: unknown): Array<[string, unknown]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>);
}

/**
 * The gutter headline: the one currency-bearing number the tool exists to
 * produce, falling back to the generic word when a result has no single
 * dominant figure (a ratio tool, a schedule, a plain yes/no).
 */
function headlineKey(value: Record<string, unknown>): string | null {
  for (const key of HEADLINE_KEYS) {
    if (typeof value[key] === "number") return key;
  }
  return null;
}

const HEADLINE_KEYS = [
  "total",
  "net",
  "amount",
  "result",
  "value",
  "cost",
  "price",
  "revenue",
  "rate",
] as const;

const FIELD_LABEL_IT: Readonly<Record<string, string>> = {
  revenue: "Ricavi",
  hours: "Ore totali",
  costs: "Costi",
  targetIncome: "Reddito obiettivo",
  billableHours: "Ore fatturabili",
  nonBillableHours: "Ore non fatturabili",
  expenses: "Spese aziendali",
  hoursPerDay: "Ore al giorno",
  availableHours: "Ore disponibili",
  targetUtilizationPercent: "Utilizzo obiettivo",
  reservedHours: "Ore riservate",
  capacityHours: "Ore mensili di capacità",
  deliveryHoursPerClient: "Ore per cliente",
  retainerAmount: "Compenso per cliente",
  monthlyCosts: "Costi aziendali mensili",
  targetMarginPercent: "Margine obiettivo",
  hourlyRate: "Tariffa oraria",
  originalHours: "Ore originali",
  additionalHours: "Ore aggiuntive",
  originalBudget: "Budget originale",
  fixedCosts: "Costi fissi",
  unitPrice: "Prezzo unitario",
  unitVariableCost: "Costo variabile unitario",
  units: "Unità",
  targetNet: "Netto obiettivo",
  feePercent: "Commissione di pagamento",
  principal: "Importo scaduto",
  annualRatePercent: "Tasso di interesse annuo",
  daysLate: "Giorni di ritardo",
  dayCountBasis: "Base di calcolo dei giorni",
  originalPrice: "Prezzo unitario originale",
  discountPercent: "Sconto",
  quotedPrice: "Prezzo proposto",
  estimatedHours: "Ore stimate",
  directCosts: "Costi diretti",
  contingencyPercent: "Imprevisti",
  hourlyCost: "Costo orario",
  prefix: "Prefisso",
  year: "Anno",
  sequence: "Sequenza",
  padding: "Cifre della sequenza",
  separator: "Separatore",
  subtotal: "Imponibile",
  taxRatePercent: "Aliquota",
  total: "Totale inserito",
  base: "Importo base o comprensivo",
  ratePercent: "Percentuale",
  mode: "Calcolo",
  amount: "Importo di origine",
  rate: "Unità di destinazione per unità di origine",
  fromCurrency: "Valuta di origine",
  toCurrency: "Valuta di destinazione",
};

const RESULT_LABEL_IT: Readonly<Record<string, string>> = {
  total: "Totale",
  net: "Netto",
  amount: "Importo",
  result: "Risultato",
  value: "Valore",
  cost: "Costo",
  price: "Prezzo",
  revenue: "Ricavi",
  rate: "Tariffa",
  profit: "Profitto",
  marginPercent: "Margine percentuale",
  markupPercent: "Ricarico percentuale",
  effectiveHourlyRate: "Tariffa oraria effettiva",
  utilizationPercent: "Utilizzo percentuale",
  availableHours: "Ore disponibili",
  billableHours: "Ore fatturabili",
  nonBillableHours: "Ore non fatturabili",
  capacityHours: "Ore di capacità",
  clientCapacity: "Numero di clienti",
  contributionPerHour: "Contributo per ora",
  additionalCost: "Costo aggiuntivo",
  newProjectCost: "Nuovo costo del progetto",
  breakEvenUnits: "Unità di pareggio",
  breakEvenRevenue: "Ricavi di pareggio",
  grossAmount: "Importo lordo",
  feeAmount: "Commissione",
  interest: "Interessi",
  totalDue: "Totale dovuto",
  discountedPrice: "Prezzo scontato",
  revenueLost: "Ricavi persi",
  requiredRate: "Tariffa necessaria",
  invoiceNumber: "Numero fattura",
  expectedTotal: "Totale atteso",
  difference: "Differenza",
  valid: "Valido",
  percentageAmount: "Importo percentuale",
  sourceAmount: "Importo di origine",
  targetAmount: "Importo di destinazione",
  currency: "Valuta",
};

const OPTION_LABEL_IT: Readonly<Record<string, string>> = {
  add: "Aggiungi percentuale",
  reverse: "Ricava il netto",
};

function formatHeadline(value: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(value);
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
      formatError: (_run: Extract<ToolRunResult, { ok: false }>) =>
        "Controlla i valori e riprova. Le percentuali vanno inserite come numeri, per esempio 3 oppure 3,5.",
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
  const headline = result === null ? null : headlineKey(result);
  const gutterState = gutterStateFor(operation.status);
  const gutterHeadline = result === null || headline === null
    ? ""
    : typeof result.currency === "string"
      ? `${currency} ${formatHeadline(result[headline] as number)}`
      : formatHeadline(result[headline] as number);
  const publicCopy = TOOL_COPY_IT[config.id];

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
                  <span>{FIELD_LABEL_IT[field.name] ?? field.label}</span>
                  <select id={inputId} value={value} onChange={(event) => setField(field.name, (event.currentTarget as HTMLSelectElement).value)}>
                    {(field.options ?? []).map((option) => <option value={option} key={option}>{OPTION_LABEL_IT[option] ?? option}</option>)}
                  </select>
                  {field.help !== undefined && <small>Inserisci la percentuale come numero, per esempio 10 per indicare il 10%.</small>}
                </label>
              );
            }
            return (
              <label class="field" key={field.name} htmlFor={inputId}>
                <span>{FIELD_LABEL_IT[field.name] ?? field.label}</span>
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
                {field.help !== undefined && <small id={`${inputId}-help`}>Inserisci la percentuale come numero, per esempio 10 per indicare il 10%.</small>}
              </label>
            );
          })}
          {config.showCurrency === true && (
            <label class="field" htmlFor={`${config.id}-currency`}>
              <span>Valuta</span>
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
                profileLabel={it(CONTROL.profileDefault)}
                overrideLabel={it(CONTROL.taskOverride)}
              />
              <ProfileResetButton disabled={currencyOverride === undefined} onReset={() => setCurrencyOverride(undefined)}>{it(CONTROL.useProfileDefault)}</ProfileResetButton>
            </label>
          )}
        </div>
        <InlineError message={operation.error === "" ? "" : "Impossibile completare il calcolo. Controlla i valori inseriti."} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{it(CONTROL.submit)}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning}>{it(CONTROL.reset)}</ToolResetButton>
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder={`Il risultato di ${publicCopy?.name ?? "questo calcolo"} apparirà qui.`} busy={operation.isRunning} state={gutterState}>
        {/* Held outside the result branch: a recompute clears the result for a
            tick, and the headline has to keep its state through that. */}
        <PreviousValue value={gutterHeadline} retain={operation.isRunning} />
        {result !== null && (
          <>
            <dl class="gutter-rows">
              {primaryEntries
                .filter(([key]) => key !== headline)
                .map(([key, value]) => <div key={key}><dt>{RESULT_LABEL_IT[key] ?? key}</dt><dd>{displayValue(value)}</dd></div>)}
              {typeof currencyProvenance === "string" && <div><dt>Origine della valuta</dt><dd><ProvenanceBadge provenance={currencyProvenance as "explicit" | "profile" | "tool-default" | "system-derived"} /></dd></div>}
            </dl>
            {assumptions.length > 0 && <details><summary>Ipotesi</summary><dl class="assumptions">{assumptions.map(([key, value]) => <div key={key}><dt>{RESULT_LABEL_IT[key] ?? FIELD_LABEL_IT[key] ?? key}</dt><dd>{displayValue(value)}</dd></div>)}</dl></details>}
            {formulas.length > 0 && <details><summary>Formula</summary><dl class="assumptions">{formulas.map(([key, value]) => <div key={key}><dt>{RESULT_LABEL_IT[key] ?? FIELD_LABEL_IT[key] ?? key}</dt><dd>{displayValue(value)}</dd></div>)}</dl></details>}
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
