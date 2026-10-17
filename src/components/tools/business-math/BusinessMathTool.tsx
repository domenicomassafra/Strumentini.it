import { useState } from "preact/hooks";
import type { ResultDeclaration } from "../../../catalog/manifest";
import { formatResultNumber } from "../../../i18n/it/result-format";
import { resolveResultActions } from "../../../runtime/result-actions";
import { createOutputArtifactDescriptor } from "../../../runtime/output-artifact";
import type { ToolRunResult } from "../../../runtime/types";
import { toolRuntime } from "../../../runtime/tool-runtime";
import { useWorkProfile } from "../client-time-math/work-profile";
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
  gutterStateFor,
  useToolOperation,
} from "../shared";
import { CONTROL, it } from "../shared/controlLabels";
import { PreviousValue } from "../shared/PreviousValue";
import { TOOL_COPY_IT } from "../../../i18n/it/tool-copy";
import { friendlyToolErrorIt } from "../../../i18n/it/errors";

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
  readonly operation: string;
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
    "scheduleRows",
    "schedulePreview",
    "scheduleCsv",
    "scenarioRows",
  ].includes(key));
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return formatResultNumber(value);
  if (typeof value === "boolean") return value ? "Sì" : "No";
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
  "monthlyPayment",
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
  rates: "Sconti concatenati (separati da ;)",
  ratePercent: "Percentuale",
  mode: "Calcolo",
  amount: "Importo di origine",
  rate: "Unità di destinazione per unità di origine",
  fromCurrency: "Valuta di origine",
  toCurrency: "Valuta di destinazione",
  termMonths: "Durata (mesi)",
  lengthUnit: "Unità lunghezza",
  coefficientA: "Coefficiente a",
  coefficientB: "Coefficiente b",
  coefficientC: "Coefficiente c",
  legA: "Cateto A",
  legB: "Cateto B",
  radius: "Raggio",
  depth: "Profondità",
  speed: "Velocità",
  speedUnit: "Unità velocità",
  distance: "Distanza",
  distanceUnit: "Unità distanza",
  time: "Tempo",
  timeUnit: "Unità tempo",
  quantity: "Quantità",
  quantityUnit: "Unità quantità",
  normalizeUnit: "Normalizza a",
  bill: "Conto",
  tipPercent: "Mancia",
  people: "Persone",
  periodicCost: "Costo per periodo",
  periodsPerYear: "Addebiti per anno",
  power: "Potenza",
  powerUnit: "Unità potenza",
  usageHours: "Ore di utilizzo",
  pricePerKwh: "Prezzo per kWh",
  consumptionLitersPer100Km: "Consumo (L/100 km)",
  fuelPricePerLiter: "Prezzo carburante/L",
  salaryDirection: "Direzione salario",
  hoursPerWeek: "Ore per settimana",
  weeksPerYear: "Settimane per anno",
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
  dimension: "Dimensione",
  from: "Unità di origine",
  to: "Unità di destinazione",
  input: "Valore inserito",
  seconds: "Secondi stimati",
  fileBits: "Dimensione in bit",
  enteredBitsPerSecond: "Velocità inserita (bit/s)",
  effectiveBitsPerSecond: "Velocità effettiva (bit/s)",
  voltage: "Tensione",
  direction: "Direzione",
  paper: "Formato carta",
  width: "Larghezza",
  height: "Altezza",
  diagonal: "Diagonale",
  aspect: "Rapporto d'aspetto",
  unit: "Unità",
  monthlyPayment: "Rata mensile",
  lastPayment: "Ultima rata",
  totalInterest: "Interessi totali",
  totalRepaid: "Totale rimborsato",
  tanPercent: "TAN annuo (%)",
  periodicRatePercent: "Tasso mensile (%)",
  termMonths: "Numero rate",
  area: "Area",
  perimeter: "Perimetro",
  volume: "Volume",
  hypotenuse: "Ipotenusa",
  root1: "Radice 1",
  root2: "Radice 2",
  discriminant: "Discriminante",
  rootType: "Tipo di radici",
  unitPrice: "Prezzo unitario",
  normalizedQuantity: "Quantità normalizzata",
  baseShare: "Quota base",
  higherShare: "Quota con centesimo extra",
  peopleWithHigherShare: "Persone con centesimo extra",
  tipAmount: "Mancia",
  totalWithTip: "Totale con mancia",
  annualCost: "Costo annuo",
  periodicCost: "Costo per periodo",
  periodsPerYear: "Addebiti annui",
  energyKwh: "Energia (kWh)",
  powerKw: "Potenza (kW)",
  distanceKm: "Distanza (km)",
  liters: "Carburante (L)",
  annualSalary: "Salario annuo",
  hourlyRate: "Tariffa oraria",
  assumedAnnualHours: "Ore annue assunte",
};

const OPTION_LABEL_IT: Readonly<Record<string, string>> = {
  add: "Aggiungi percentuale",
  reverse: "Ricava il netto",
  of: "X% di Y",
  "what-percent": "X è quale % di Y",
  increase: "Aumenta del X%",
  decrease: "Riduci del X%",
  variation: "Variazione percentuale",
  "reverse-discount": "Prezzo prima dello sconto",
  cascade: "Sconti concatenati",
  fraction: "Frazioni",
  "gcd-lcm": "MCD e MCM",
  "prime-factor": "Primi e fattorizzazione",
  combinatorics: "Combinazioni e permutazioni",
  roman: "Numeri romani",
  "number-words": "Numero in parole",
  subtract: "Sottrai",
  multiply: "Moltiplica",
  divide: "Dividi",
  combination: "Combinazione",
  permutation: "Permutazione",
  descriptive: "Statistiche descrittive",
  weighted: "Media pesata",
  completion: "Percentuale completata",
  simple: "Interesse semplice",
  compound: "Interesse composto",
  contribution: "Crescita con versamenti",
  goal: "Versamento per obiettivo",
  storage: "Conversione spazio digitale",
  "download-time": "Stima tempo di download",
  battery: "mAh ↔ Wh",
  fuel: "Consumi auto",
  power: "Potenza kW/CV/hp",
  "mah-to-wh": "mAh → Wh",
  "wh-to-mah": "Wh → mAh",
  "l-per-100km": "L/100 km",
  "km-per-liter": "km/L",
  "mpg-us": "MPG US",
  "mpg-imperial": "MPG Imperial",
  paper: "Formato carta ISO",
  "model-scale": "Scala di modellismo",
  "tv-diagonal-to-dimensions": "Diagonale TV → larghezza/altezza",
  "tv-dimensions-to-diagonal": "Larghezza/altezza TV → diagonale",
  "real-to-model": "Reale → modello",
  "model-to-real": "Modello → reale",
  rectangle: "Rettangolo",
  circle: "Cerchio",
  "rectangular-prism": "Parallelepipedo rettangolo",
  pythagorean: "Teorema di Pitagora",
  quadratic: "Equazione quadratica",
  speed: "Calcola velocità",
  distance: "Calcola distanza",
  time: "Calcola tempo",
  "unit-price": "Prezzo per unità",
  "split-bill": "Dividi conto e mancia",
  "annual-subscription": "Costo annuo abbonamento",
  "energy-cost": "Costo energia",
  "car-trip-cost": "Costo viaggio auto",
  "salary-hourly": "Salario ↔ tariffa oraria",
  "salary-to-hourly": "Salario annuo → tariffa oraria",
  "hourly-to-salary": "Tariffa oraria → salario annuo",
};

function businessMathErrorMessage(run: Extract<ToolRunResult, { ok: false }>, toolId: string): string {
  const code = run.message.toUpperCase();
  if (toolId === "scientific-calculator") {
    if (/EMPTY_EXPRESSION|INVALID_EXPRESSION|UNSUPPORTED_IDENTIFIER/u.test(code)) {
      return "Inserisci un'espressione con numeri, operatori, parentesi e solo le funzioni o costanti indicate.";
    }
    if (/DIVISION_BY_ZERO/u.test(code)) return "La divisione per zero non è definita. Modifica il denominatore e riprova.";
    if (/MATH_DOMAIN_ERROR/u.test(code)) return "La funzione non è definita per questo valore reale. Controlla l'argomento e riprova.";
    if (/NON_FINITE_RESULT/u.test(code)) return "Il calcolo produce un valore troppo grande o non finito. Riduci l'espressione o i valori.";
    if (/EXPRESSION_TOO_COMPLEX/u.test(code)) return "L'espressione supera i limiti locali di lunghezza o profondità. Riducila e riprova.";
  }
  if (toolId === "fraction-integer-toolkit") {
    if (/INVALID_ROMAN|ROMAN_OUT_OF_RANGE/u.test(code)) return "Usa un numero romano canonico compreso tra I e MMMCMXCIX, oppure un intero da 1 a 3999.";
    if (/FACTORIZATION_UNDEFINED_ZERO/u.test(code)) return "La fattorizzazione in numeri primi di zero non è definita.";
    if (/COMBINATORIC_OUT_OF_RANGE/u.test(code)) return "Per combinazioni e permutazioni usa 0 ≤ r ≤ n ≤ 1000.";
    if (/INTEGER_OUT_OF_RANGE|FRACTION_OUT_OF_RANGE/u.test(code)) return "Il valore supera il limite dichiarato per questa modalità. Riduci il numero di cifre e riprova.";
  }
  if (toolId === "statistics-grade-calculator") {
    if (/WEIGHT_LENGTH_MISMATCH/u.test(code)) return "Inserisci esattamente un peso per ogni valore.";
    if (/ZERO_WEIGHT_SUM/u.test(code)) return "La somma dei pesi deve essere maggiore di zero.";
    if (/COMPLETED_EXCEEDS_TOTAL/u.test(code)) return "Il numero completato non può superare il totale.";
    if (/TOO_MANY_VALUES|NUMBER_OUT_OF_RANGE/u.test(code)) return "La serie supera i limiti locali di quantità o grandezza. Riduci i valori e riprova.";
  }
  if (toolId === "interest-savings-calculator") {
    if (/INFEASIBLE_GOAL/u.test(code)) return "Con durata zero l'obiettivo non può essere raggiunto dal capitale iniziale indicato.";
    if (/INVALID_PERIOD_COUNT/u.test(code)) return "Anni e frequenza devono produrre un numero intero di periodi entro il limite supportato.";
    if (/INVALID_SAVINGS_RATE/u.test(code)) return "Per i calcoli con versamenti o obiettivo usa un tasso annuo non negativo.";
    if (/FINANCE_RESULT_OUT_OF_RANGE/u.test(code)) return "Il risultato supera il limite numerico del calcolatore. Riduci importi, tasso o durata.";
  }
  if (toolId === "basic-unit-converter" || toolId === "engineering-unit-converter") {
    if (/ROOT_FONT_SIZE_REQUIRED/u.test(code)) return "Per convertire rem devi indicare esplicitamente il root font-size in pixel.";
    if (/CURRENT_FONT_SIZE_REQUIRED/u.test(code)) return "Per convertire em devi indicare esplicitamente il font-size corrente in pixel.";
    if (/INVALID_(ROOT|CURRENT)_FONT_SIZE|INVALID_CSS_UNIT_MODE/u.test(code)) return "Il contesto CSS deve essere un valore positivo e la modalità/direzione devono essere supportate.";
    if (/CROSS_DIMENSION_CONVERSION|UNSUPPORTED_.*DIMENSION/u.test(code)) return "Le due unità appartengono a dimensioni diverse. Scegli unità compatibili e riprova.";
    if (/AMBIGUOUS_UNIT_ALIAS/u.test(code)) return "L'abbreviazione è ambigua. Scegli una delle unità esplicite dall'elenco.";
    if (/UNKNOWN_UNIT|INVALID_UNIT/u.test(code)) return "Scegli un'unità supportata dall'elenco.";
    if (/INVALID_VALUE|VALUE_OUT_OF_RANGE/u.test(code)) return "Inserisci un numero non raggruppato, usando virgola o punto come separatore decimale.";
  }
  if (toolId === "storage-download-calculator") {
    if (/UNKNOWN_UNIT|INVALID_STORAGE_UNIT/u.test(code)) return "Controlla l'unità: bit e byte sono distinti e le maiuscole contano nei simboli.";
    if (/INVALID_OVERHEAD/u.test(code)) return "Inserisci un overhead da 0% fino a meno del 100%.";
    if (/INVALID_DOWNLOAD_INPUT/u.test(code)) return "Dimensione e velocità devono essere valide; la velocità deve essere maggiore di zero.";
  }
  if (toolId === "battery-vehicle-power-helper") {
    if (/VOLTAGE_REQUIRED/u.test(code)) return "Inserisci la tensione in volt per convertire tra mAh e Wh.";
    if (/INVALID_VOLTAGE/u.test(code)) return "La tensione deve essere maggiore di zero.";
    if (/INVALID_FUEL_UNIT/u.test(code)) return "Per i consumi scegli L/100 km, km/L, MPG US oppure MPG Imperial.";
    if (/INVALID_FUEL_VALUE/u.test(code)) return "Il valore di consumo deve essere maggiore di zero.";
    if (/INVALID_POWER_UNIT/u.test(code)) return "Per la potenza scegli W, kW, MW, hp meccanici oppure CV.";
  }
  if (toolId === "reference-size-converter") {
    if (/UNKNOWN_PAPER_SIZE/u.test(code)) return "Scegli un formato ISO A o B disponibile nell'elenco.";
    if (/INVALID_SCALE/u.test(code)) return "Il denominatore della scala 1:n deve essere maggiore di zero.";
    if (/INVALID_ASPECT|INVALID_DIAGONAL|INVALID_WIDTH|INVALID_HEIGHT/u.test(code)) return "Dimensioni e rapporto d'aspetto devono essere maggiori di zero.";
    if (/UNSOURCED_REFERENCE_FIT/u.test(code)) return "Non viene proposta alcuna equivalenza di scarpe o abbigliamento senza una tabella regionale mantenuta e documentata.";
  }
  if (toolId === "mortgage-amortization-calculator") {
    if (/INVALID_TERM_MONTHS/u.test(code)) return "Inserisci un numero intero di rate mensili da 1 a 3600.";
    if (/INVALID_PRINCIPAL/u.test(code)) return "Il capitale deve essere maggiore di zero e rientrare nel limite dichiarato.";
    if (/INVALID_RATE/u.test(code)) return "Il TAN deve essere un numero da 0% a 1000%.";
    if (/TERM_NOT_REPRESENTABLE_AT_CENT_PRECISION/u.test(code)) return "Con questo capitale, tasso e durata non è possibile costruire tutte le rate a precisione di centesimo. Riduci la durata o aumenta il capitale.";
  }
  if (toolId === "geometry-equation-motion-helper") {
    if (/INVALID_DIMENSION|INVALID_LENGTH_UNIT/u.test(code)) return "Le dimensioni geometriche devono essere positive e usare un'unità di lunghezza supportata.";
    if (/DEGENERATE_QUADRATIC/u.test(code)) return "Il coefficiente a deve essere diverso da zero per un'equazione quadratica.";
    if (/CROSS_DIMENSION_CONVERSION|INVALID_UNIT/u.test(code)) return "Le unità scelte non sono compatibili con la grandezza da calcolare.";
    if (/INVALID_(TIME|SPEED|DISTANCE|MOTION_INPUT)/u.test(code)) return "Controlla distanza, tempo e velocità: i divisori devono essere maggiori di zero e le unità devono essere coerenti.";
  }
  if (toolId === "everyday-cost-calculator") {
    if (/CROSS_DIMENSION_CONVERSION/u.test(code)) return "Per il prezzo unitario scegli due unità della stessa dimensione fisica.";
    if (/INVALID_PEOPLE/u.test(code)) return "Il numero di persone deve essere un intero positivo.";
    if (/INVALID_QUANTITY/u.test(code)) return "La quantità da normalizzare deve essere maggiore di zero.";
    if (/INVALID_CONSUMPTION/u.test(code)) return "Il consumo in L/100 km deve essere maggiore di zero.";
    if (/INVALID_(HOURS|WEEKS)/u.test(code)) return "Ore settimanali e settimane annue devono essere maggiori di zero.";
  }
  return friendlyToolErrorIt(run.message);
}

function formatHeadline(value: number): string {
  return formatResultNumber(value);
}

function resultDeclarationFor(toolId: string): ResultDeclaration {
  if (toolId === "invoice-math-validator") {
    return { class: "validator", capabilities: ["copy", "retry", "reset", "provenance"] };
  }
  if (toolId === "invoice-number-generator") {
    return { class: "text-code", capabilities: ["copy", "reset", "provenance"] };
  }
  if (toolId === "mortgage-amortization-calculator") {
    return { class: "calculator", capabilities: ["copy", "download", "reset", "provenance"] };
  }
  return { class: "calculator", capabilities: ["copy", "reset", "provenance"] };
}

interface SchedulePreviewRow {
  readonly period: number;
  readonly payment: string;
  readonly principal: string;
  readonly interest: string;
  readonly balance: string;
}

interface ScenarioRow {
  readonly label: string;
  readonly units: string;
  readonly revenue: string;
  readonly totalCosts: string;
  readonly profit: string;
}

function scenarioComparisonRows(value: unknown, currency: string): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Partial<ScenarioRow>;
    if ([row.label, row.units, row.revenue, row.totalCosts, row.profit].some((entry) => typeof entry !== "string")) return [];
    return [{ label: `${row.label} (${row.units} unità)`, value: `Ricavi ${currency} ${row.revenue} · costi ${currency} ${row.totalCosts} · utile ${currency} ${row.profit}` }];
  });
}

function schedulePreviewRows(value: unknown, currency: string): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return [];
    const row = candidate as Partial<SchedulePreviewRow>;
    if (typeof row.period !== "number" || typeof row.payment !== "string" || typeof row.principal !== "string" || typeof row.interest !== "string" || typeof row.balance !== "string") return [];
    return [{
      label: `Rata ${row.period}`,
      value: `${currency} ${row.payment} · capitale ${row.principal} · interessi ${row.interest} · residuo ${row.balance}`,
    }];
  });
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
  const [copyStatus, setCopyStatus] = useState("");
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
      formatError: (run: Extract<ToolRunResult, { ok: false }>) => businessMathErrorMessage(run, config.id),
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
    setCopyStatus("");
    operation.reset();
  }

  const result = operation.result;
  const primaryEntries = result === null ? [] : resultEntries(result);
  const formulas = result === null ? [] : objectEntries(result.formulas);
  const assumptions = result === null ? [] : objectEntries(result.assumptions);
  const currencyProvenance = result?.currencyProvenance;
  const headline = result === null ? null : headlineKey(result);
  const primaryKey = headline ?? primaryEntries[0]?.[0] ?? null;
  const gutterState = gutterStateFor(operation.status);
  const primaryDisplay = result === null || primaryKey === null
    ? ""
    : headline !== null && typeof result[headline] === "number"
      ? typeof result.currency === "string"
        ? currency + " " + formatHeadline(result[headline] as number)
        : formatHeadline(result[headline] as number)
      : displayValue(result[primaryKey]);
  const primaryLabel = primaryKey === null
    ? "Risultato"
    : RESULT_LABEL_IT[primaryKey] ?? FIELD_LABEL_IT[primaryKey] ?? config.resultLabel;
  const declaration = resultDeclarationFor(config.id);
  const scheduleCsv = typeof result?.scheduleCsv === "string" ? result.scheduleCsv : null;
  const scheduleArtifact = scheduleCsv === null
    ? null
    : createOutputArtifactDescriptor({
        kind: "text",
        name: "piano-ammortamento-mutuo.csv",
        mime: "text/csv",
        bytes: new TextEncoder().encode(scheduleCsv),
        verification: { state: "verified", verifiedMime: "text/csv", method: "serializzatore CSV locale del piano di ammortamento" },
        fidelity: "lossless",
        fidelityNote: "Il CSV contiene tutte e sole le righe del piano usato per calcolare i totali mostrati.",
      });
  const scheduleRows = result === null
    ? []
    : schedulePreviewRows(result.schedulePreview, typeof result.currency === "string" ? result.currency : currency);
  const scenarioRows = result === null
    ? []
    : scenarioComparisonRows(result.scenarioRows, typeof result.currency === "string" ? result.currency : currency);
  const resultActions = result === null
    ? []
    : resolveResultActions({
        declaration,
        primary: "copy",
        hasCopyPayload: primaryDisplay !== "",
        ...(scheduleArtifact === null ? {} : { artifact: scheduleArtifact }),
        resetReady: true,
        retryReady: declaration.class === "validator",
      });
  const publicCopy = TOOL_COPY_IT[config.id];

  async function copyPrimaryResult() {
    if (primaryDisplay === "" || navigator.clipboard === undefined) {
      setCopyStatus("Gli appunti non sono disponibili; seleziona il risultato e copialo manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(primaryDisplay);
      setCopyStatus("Risultato copiato.");
    } catch {
      setCopyStatus("L'accesso agli appunti è stato bloccato; seleziona il risultato e copialo manualmente.");
    }
  }

  function downloadSchedule() {
    if (scheduleArtifact === null || scheduleCsv === null || !scheduleArtifact.download.ready) return;
    const blob = new Blob([scheduleCsv], { type: scheduleArtifact.download.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = scheduleArtifact.download.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setCopyStatus("Piano di ammortamento CSV scaricato.");
  }

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
                  {field.help !== undefined && <small>{field.help}</small>}
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
                {field.help !== undefined && <small id={`${inputId}-help`}>{field.help}</small>}
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
        <InlineError message={operation.error} />
        <ToolActions>
          <ToolSubmitButton busy={operation.isRunning} busyLabel={it(CONTROL.working)}>{it(CONTROL.submit)}</ToolSubmitButton>
          <ToolResetButton onClick={reset} disabled={operation.isRunning}>{it(CONTROL.reset)}</ToolResetButton>
        </ToolActions>
      </form>
      <ToolResultPanel eyebrow="Risultato" placeholder={`Il risultato di ${publicCopy?.name ?? "questo calcolo"} apparirà qui.`} busy={operation.isRunning} state={gutterState}>
        {(result !== null || operation.isRunning) && (
          <>
            <ResultExplanation
              primary={
                <ResultPrimaryAnswer label={primaryLabel}>
                  <PreviousValue value={primaryDisplay} className="" retain={operation.isRunning} />
                </ResultPrimaryAnswer>
              }
              interpretation={
                result === null
                  ? <ResultInterpretation>Calcolo in corso.</ResultInterpretation>
                  : declaration.class === "validator"
                    ? <ResultInterpretation state={result.valid === false ? "warning" : "success"}>
                        {result.valid === false ? "I controlli hanno trovato una differenza." : "I controlli risultano coerenti."}
                      </ResultInterpretation>
                    : declaration.class === "text-code"
                      ? <ResultInterpretation state="success">Valore generato con i dati inseriti.</ResultInterpretation>
                      : <ResultInterpretation state="success">Calcolo completato con i dati inseriti.</ResultInterpretation>
              }
              breakdown={
                result === null
                  ? undefined
                  : <>
                      <ResultBreakdown rows={[
                        ...primaryEntries
                          .filter(([key]) => key !== primaryKey && !(config.id === "mortgage-amortization-calculator" && key === "result"))
                          .map(([key, value]) => ({ label: RESULT_LABEL_IT[key] ?? key, value: displayValue(value) })),
                      ]} />
                      {scheduleRows.length > 0 && <ResultBreakdown label="Anteprima piano di ammortamento" rows={scheduleRows} />}
                      {scenarioRows.length > 0 && <ResultBreakdown label="Confronto scenari di pareggio" rows={scenarioRows} />}
                    </>
              }
              assumptions={
                result === null
                  ? undefined
                  : <>
                      <ResultAssumptions
                        items={assumptions.map(([key, value]) => ({
                          label: RESULT_LABEL_IT[key] ?? FIELD_LABEL_IT[key] ?? key,
                          value: displayValue(value),
                        }))}
                      />
                      <ResultAssumptions
                        label="Formula"
                        items={formulas.map(([key, value]) => ({
                          label: RESULT_LABEL_IT[key] ?? FIELD_LABEL_IT[key] ?? key,
                          value: displayValue(value),
                        }))}
                      />
                    </>
              }
              provenance={
                result === null
                  ? undefined
                  : <ResultProvenance>
                      Calcolo locale deterministico.
                      {typeof currencyProvenance === "string" && (
                        <> Origine valuta: <ProvenanceBadge provenance={currencyProvenance as "explicit" | "profile" | "tool-default" | "system-derived"} /></>
                      )}
                    </ResultProvenance>
              }
            />
            {result !== null && (
              <ResultActions
                actions={resultActions}
                onAction={{
                  copy: copyPrimaryResult,
                  download: downloadSchedule,
                  reset,
                  retry: operation.retry,
                }}
              />
            )}
            {copyStatus !== "" && <p class="success" role="status" aria-live="polite">{copyStatus}</p>}
          </>
        )}
      </ToolResultPanel>
    </ToolOperation>
  );
}
