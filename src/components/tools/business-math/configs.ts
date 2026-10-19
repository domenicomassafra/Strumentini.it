import type { BusinessToolConfig } from "./BusinessMathTool";
import { UNIT_REGISTRY, type UnitDimension } from "../../../engines/unit-conversion";

const BASIC_DIMENSIONS = new Set<UnitDimension>(["length", "mass", "temperature", "area", "volume"]);
const ENGINEERING_DIMENSIONS = new Set<UnitDimension>(["speed", "time", "angle", "energy", "pressure", "power", "force", "torque", "frequency", "density", "flow", "illuminance"]);
const BASIC_UNIT_OPTIONS = UNIT_REGISTRY.filter((unit) => BASIC_DIMENSIONS.has(unit.dimension)).map((unit) => unit.id);
const ENGINEERING_UNIT_OPTIONS = UNIT_REGISTRY.filter((unit) => ENGINEERING_DIMENSIONS.has(unit.dimension)).map((unit) => unit.id);
const STORAGE_UNIT_OPTIONS = UNIT_REGISTRY.filter((unit) => unit.dimension === "digital-storage").map((unit) => unit.id);
const RATE_UNIT_OPTIONS = UNIT_REGISTRY.filter((unit) => unit.dimension === "data-rate").map((unit) => unit.id);
const POWER_UNIT_OPTIONS = UNIT_REGISTRY.filter((unit) => unit.dimension === "power").map((unit) => unit.id);
const LENGTH_UNIT_OPTIONS = UNIT_REGISTRY.filter((unit) => unit.dimension === "length").map((unit) => unit.id);
const SPEED_UNIT_OPTIONS = UNIT_REGISTRY.filter((unit) => unit.dimension === "speed").map((unit) => unit.id);
const TIME_UNIT_OPTIONS = UNIT_REGISTRY.filter((unit) => unit.dimension === "time").map((unit) => unit.id);
const COST_QUANTITY_UNIT_OPTIONS = UNIT_REGISTRY.filter((unit) => ["length", "mass", "volume"].includes(unit.dimension)).map((unit) => unit.id);

export const effectiveHourlyRateConfig = {
  id: "effective-hourly-rate",
  operation: "effective-hourly-rate",
  title: "Effective Hourly Rate",
  lede: "Include the costs that turn gross revenue into an honest hourly return.",
  resultLabel: "Effective rate",
  placeholder: "Your effective hourly rate appears here.",
  showCurrency: true,
  fields: [
    { name: "revenue", label: "Revenue", defaultValue: "1200", kind: "number" },
    { name: "hours", label: "Total hours", defaultValue: "24", kind: "number" },
    { name: "costs", label: "Costs", defaultValue: "0", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const targetIncomeRateConfig = {
  id: "target-income-rate",
  operation: "target-income-rate",
  title: "Target-income Rate Calculator",
  lede: "Price the billable work needed to reach an income target after expenses and overhead time.",
  resultLabel: "Required rate",
  placeholder: "Your required rate appears here.",
  showCurrency: true,
  fields: [
    { name: "targetIncome", label: "Target income", defaultValue: "60000", kind: "number" },
    { name: "billableHours", label: "Billable hours", defaultValue: "1200", kind: "number" },
    { name: "nonBillableHours", label: "Non-billable hours", defaultValue: "200", kind: "number" },
    { name: "expenses", label: "Business expenses", defaultValue: "5000", kind: "number" },
    { name: "hoursPerDay", label: "Hours per day", defaultValue: "8", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const utilizationCalculatorConfig = {
  id: "utilization-calculator",
  operation: "utilization",
  title: "Utilization Calculator",
  lede: "Make the difference between available time and billable time visible.",
  resultLabel: "Utilization",
  placeholder: "Your utilization appears here.",
  fields: [
    { name: "availableHours", label: "Available hours", defaultValue: "160", kind: "number" },
    { name: "billableHours", label: "Billable hours", defaultValue: "120", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const capacityPlannerConfig = {
  id: "capacity-planner",
  operation: "capacity-planner",
  title: "Capacity Planner",
  lede: "Reserve delivery time before promising the rest of your available capacity.",
  resultLabel: "Capacity plan",
  placeholder: "Your capacity plan appears here.",
  fields: [
    { name: "availableHours", label: "Available hours", defaultValue: "160", kind: "number" },
    { name: "targetUtilizationPercent", label: "Target utilization", defaultValue: "80", kind: "number", help: "Enter a percentage from 0 to 100." },
    { name: "reservedHours", label: "Reserved hours", defaultValue: "16", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const retainerCapacityConfig = {
  id: "retainer-capacity",
  operation: "retainer-capacity",
  title: "Retainer-capacity Calculator",
  lede: "Estimate client count from a declared delivery budget, then show the contribution per delivery hour.",
  resultLabel: "Retainer capacity",
  placeholder: "Your retainer capacity appears here.",
  showCurrency: true,
  fields: [
    { name: "capacityHours", label: "Monthly delivery hours", defaultValue: "120", kind: "number" },
    { name: "deliveryHoursPerClient", label: "Hours per client", defaultValue: "20", kind: "number" },
    { name: "retainerAmount", label: "Retainer per client", defaultValue: "2000", kind: "number" },
    { name: "monthlyCosts", label: "Monthly business costs", defaultValue: "4000", kind: "number" },
    { name: "targetMarginPercent", label: "Target margin", defaultValue: "40", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const scopeCreepCostConfig = {
  id: "scope-creep-cost",
  operation: "scope-creep-cost",
  title: "Scope-creep Cost Calculator",
  lede: "Put a price on additional work before it changes the original project budget.",
  resultLabel: "Scope-creep cost",
  placeholder: "Your scope-creep cost appears here.",
  showCurrency: true,
  fields: [
    { name: "hourlyRate", label: "Hourly rate", defaultValue: "100", kind: "number" },
    { name: "originalHours", label: "Original hours", defaultValue: "40", kind: "number" },
    { name: "additionalHours", label: "Additional hours", defaultValue: "5", kind: "number" },
    { name: "originalBudget", label: "Original budget", defaultValue: "4000", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const breakEvenConfig = {
  id: "break-even",
  operation: "break-even",
  title: "Break-even Calculator",
  lede: "Find the smallest unit count and revenue needed to cover fixed and variable costs.",
  resultLabel: "Break-even",
  placeholder: "Your break-even result appears here.",
  showCurrency: true,
  fields: [
    { name: "fixedCosts", label: "Fixed costs", defaultValue: "1000", kind: "number" },
    { name: "unitPrice", label: "Unit price", defaultValue: "25", kind: "number" },
    { name: "unitVariableCost", label: "Variable cost per unit", defaultValue: "15", kind: "number" },
    { name: "units", label: "Current units", defaultValue: "0", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const paymentFeeGrossUpConfig = {
  id: "payment-fee-gross-up",
  operation: "payment-fee-gross-up",
  title: "Payment-fee Gross-up",
  lede: "Calculate the gross charge needed to keep your intended net after a stated fee.",
  resultLabel: "Gross-up",
  placeholder: "Your gross-up appears here.",
  showCurrency: true,
  fields: [
    { name: "targetNet", label: "Target net", defaultValue: "100", kind: "number" },
    { name: "feePercent", label: "Payment fee", defaultValue: "3", kind: "number", help: "Enter 3 for a 3% fee." },
  ],
} as const satisfies BusinessToolConfig;

export const latePaymentInterestConfig = {
  id: "late-payment-interest",
  operation: "late-payment-interest",
  title: "Late-payment Interest Calculator",
  lede: "Estimate simple interest on an overdue amount without implying a legal or statutory rate.",
  resultLabel: "Late-payment estimate",
  placeholder: "Your late-payment estimate appears here.",
  showCurrency: true,
  fields: [
    { name: "principal", label: "Overdue principal", defaultValue: "1000", kind: "number" },
    { name: "annualRatePercent", label: "Annual interest rate", defaultValue: "12", kind: "number" },
    { name: "daysLate", label: "Days late", defaultValue: "30", kind: "number" },
    { name: "dayCountBasis", label: "Day-count basis", defaultValue: "365", kind: "select", options: ["360", "365"] },
  ],
} as const satisfies BusinessToolConfig;

export const discountImpactConfig = {
  id: "discount-impact",
  operation: "discount-impact",
  title: "Discount Impact Calculator",
  lede: "See the unit and volume revenue effect of a discount before accepting it.",
  resultLabel: "Discount impact",
  placeholder: "Your discount impact appears here.",
  showCurrency: true,
  fields: [
    { name: "originalPrice", label: "Original unit price", defaultValue: "100", kind: "number" },
    { name: "discountPercent", label: "Discount", defaultValue: "10", kind: "number", help: "Enter 10 for a 10% discount." },
    { name: "units", label: "Units", defaultValue: "100", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const proposalBudgetCheckerConfig = {
  id: "proposal-budget-checker",
  operation: "proposal-budget",
  title: "Proposal Budget Checker",
  lede: "Check a proposed price against labor, direct costs, contingency, and a target margin.",
  resultLabel: "Proposal check",
  placeholder: "Your proposal check appears here.",
  showCurrency: true,
  fields: [
    { name: "quotedPrice", label: "Quoted price", defaultValue: "10000", kind: "number" },
    { name: "estimatedHours", label: "Estimated hours", defaultValue: "80", kind: "number" },
    { name: "hourlyRate", label: "Hourly rate", defaultValue: "100", kind: "number" },
    { name: "directCosts", label: "Direct costs", defaultValue: "500", kind: "number" },
    { name: "contingencyPercent", label: "Contingency", defaultValue: "10", kind: "number" },
    { name: "targetMarginPercent", label: "Target margin", defaultValue: "30", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const projectProfitabilityConfig = {
  id: "project-profitability",
  operation: "project-profitability",
  title: "Project Profitability Calculator",
  lede: "Make project cost, profit, margin, and effective hourly return comparable in one result.",
  resultLabel: "Project profitability",
  placeholder: "Your project profitability appears here.",
  showCurrency: true,
  fields: [
    { name: "revenue", label: "Project revenue", defaultValue: "10000", kind: "number" },
    { name: "fixedCosts", label: "Fixed project costs", defaultValue: "1000", kind: "number" },
    { name: "hours", label: "Project hours", defaultValue: "80", kind: "number" },
    { name: "hourlyCost", label: "Hourly cost", defaultValue: "50", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const invoiceNumberGeneratorConfig = {
  id: "invoice-number-generator",
  operation: "invoice-number",
  title: "Invoice Number Generator",
  lede: "Format a repeatable invoice reference from explicit fields; no clock or random state is used.",
  resultLabel: "Invoice number",
  placeholder: "Your invoice number appears here.",
  fields: [
    { name: "prefix", label: "Prefix", defaultValue: "INV" },
    { name: "year", label: "Year", defaultValue: "2026", kind: "number" },
    { name: "sequence", label: "Sequence", defaultValue: "1", kind: "number" },
    { name: "padding", label: "Sequence padding", defaultValue: "4", kind: "number" },
    { name: "separator", label: "Separator", defaultValue: "-" },
  ],
} as const satisfies BusinessToolConfig;

export const invoiceMathValidatorConfig = {
  id: "invoice-math-validator",
  operation: "invoice-math",
  title: "Invoice Math Validator",
  lede: "Recalculate an invoice from subtotal, discount, and tax before sending it.",
  resultLabel: "Invoice validation",
  placeholder: "Your invoice validation appears here.",
  showCurrency: true,
  fields: [
    { name: "subtotal", label: "Subtotal", defaultValue: "100", kind: "number" },
    { name: "discountPercent", label: "Discount", defaultValue: "0", kind: "number" },
    { name: "taxRatePercent", label: "Tax rate", defaultValue: "20", kind: "number" },
    { name: "total", label: "Entered total", defaultValue: "120", kind: "number" },
  ],
} as const satisfies BusinessToolConfig;

export const currencyScenarioConfig = {
  id: "currency-scenario",
  operation: "currency-scenario",
  title: "Currency Scenario Calculator",
  lede: "Apply a user-entered rate as a scenario; no live exchange-rate service is contacted.",
  resultLabel: "Currency scenario",
  placeholder: "Your currency scenario appears here.",
  showCurrency: true,
  fields: [
    { name: "amount", label: "Source amount", defaultValue: "100", kind: "number" },
    { name: "rate", label: "Target units per source unit", defaultValue: "1.2", kind: "number" },
    { name: "fromCurrency", label: "Source currency", defaultValue: "EUR" },
    { name: "toCurrency", label: "Target currency", defaultValue: "USD" },
  ],
} as const satisfies BusinessToolConfig;

export const scientificCalculatorConfig = {
  id: "scientific-calculator",
  operation: "scientific-expression-calculator",
  title: "Calcolatrice scientifica",
  lede: "Valuta espressioni matematiche con operatori, parentesi, funzioni e costanti documentate, interamente in locale.",
  resultLabel: "Risultato",
  placeholder: "Il risultato dell'espressione apparirà qui.",
  fields: [
    { name: "expression", label: "Espressione", defaultValue: "sqrt(81) + 2^3", kind: "text", help: "Funzioni supportate: sqrt, sin, cos, tan, asin, acos, atan, ln, log, exp, abs, floor, ceil e round. Angoli in radianti." },
  ],
} as const satisfies BusinessToolConfig;

export const fractionIntegerToolkitConfig = {
  id: "fraction-integer-toolkit",
  operation: "exact-fractions-integer-toolkit",
  title: "Frazioni e interi esatti",
  lede: "Calcola frazioni, MCD/MCM, fattori primi, combinazioni, permutazioni, numeri romani e numeri in parole senza perdere precisione intera.",
  resultLabel: "Risultato esatto",
  placeholder: "Il risultato esatto apparirà qui.",
  fields: [
    { name: "mode", label: "Modalità", defaultValue: "fraction", kind: "select", options: ["fraction", "gcd-lcm", "prime-factor", "combinatorics", "roman", "number-words"] },
    { name: "left", label: "Primo valore", defaultValue: "2/3", kind: "text" },
    { name: "right", label: "Secondo valore", defaultValue: "5/7", kind: "text" },
    { name: "operation", label: "Operazione", defaultValue: "add", kind: "select", options: ["add", "subtract", "multiply", "divide", "combination", "permutation"] },
  ],
} as const satisfies BusinessToolConfig;

export const statisticsGradeCalculatorConfig = {
  id: "statistics-grade-calculator",
  operation: "descriptive-statistics-grades",
  title: "Statistiche, medie e completamento",
  lede: "Calcola media, mediana, moda, varianza, deviazione standard, media pesata e percentuale di completamento con regole esplicite.",
  resultLabel: "Risultato statistico",
  placeholder: "Il risultato statistico apparirà qui.",
  fields: [
    { name: "mode", label: "Modalità", defaultValue: "descriptive", kind: "select", options: ["descriptive", "weighted", "completion"] },
    { name: "values", label: "Valori", defaultValue: "10; 20; 20; 30", kind: "text", help: "Separa i valori con punto e virgola o spazi. La virgola può essere usata come separatore decimale." },
    { name: "weights", label: "Pesi", defaultValue: "1; 2; 3; 4", kind: "text", help: "Per la media pesata inserisci un peso per ogni valore." },
    { name: "completed", label: "Completati", defaultValue: "75", kind: "text" },
    { name: "total", label: "Totale", defaultValue: "100", kind: "text" },
  ],
} as const satisfies BusinessToolConfig;

export const interestSavingsCalculatorConfig = {
  id: "interest-savings-calculator",
  operation: "interest-savings-calculator",
  title: "Interessi e obiettivo di risparmio",
  lede: "Calcola interesse semplice o composto, crescita con versamenti periodici e il versamento richiesto per raggiungere un obiettivo.",
  resultLabel: "Risultato finanziario",
  placeholder: "Il risultato del calcolo apparirà qui.",
  showCurrency: true,
  fields: [
    { name: "mode", label: "Modalità", defaultValue: "compound", kind: "select", options: ["simple", "compound", "contribution", "goal"] },
    { name: "principal", label: "Capitale iniziale", defaultValue: "10000", kind: "text" },
    { name: "annualRatePercent", label: "Tasso annuo (%)", defaultValue: "5", kind: "text" },
    { name: "years", label: "Anni", defaultValue: "10", kind: "text" },
    { name: "compoundsPerYear", label: "Capitalizzazioni per anno", defaultValue: "12", kind: "text" },
    { name: "periodicContribution", label: "Versamento per periodo", defaultValue: "100", kind: "text" },
    { name: "target", label: "Obiettivo", defaultValue: "30000", kind: "text" },
  ],
} as const satisfies BusinessToolConfig;

export const basicUnitConverterConfig = {
  id: "basic-unit-converter",
  operation: "basic-unit-conversion",
  title: "Convertitore di unità di base",
  lede: "Converte lunghezza, massa, temperatura, area e volume; include anche px↔rem/em quando indichi esplicitamente la dimensione font di contesto.",
  resultLabel: "Valore convertito",
  placeholder: "Il valore convertito apparirà qui.",
  fields: [
    { name: "cssMode", label: "Modalità", defaultValue: "standard", kind: "select", options: ["standard", "rem", "em"], help: "Per rem/em non viene assunto alcun valore font predefinito." },
    { name: "cssDirection", label: "Direzione CSS", defaultValue: "px-to-relative", kind: "select", options: ["px-to-relative", "relative-to-px"], help: "Usata solo nelle modalità rem/em." },
    { name: "value", label: "Valore", defaultValue: "1,5", kind: "text", help: "Puoi usare virgola o punto come separatore decimale; i separatori delle migliaia non sono accettati." },
    { name: "from", label: "Da", defaultValue: "meter", kind: "select", options: BASIC_UNIT_OPTIONS },
    { name: "to", label: "A", defaultValue: "kilometer", kind: "select", options: BASIC_UNIT_OPTIONS },
    { name: "rootFontSize", label: "Root font-size (px)", defaultValue: "", kind: "text", help: "Obbligatorio per rem; nessun 16 px implicito." },
    { name: "currentFontSize", label: "Font-size corrente (px)", defaultValue: "", kind: "text", help: "Obbligatorio per em; rappresenta il contesto corrente." },
  ],
} as const satisfies BusinessToolConfig;

export const engineeringUnitConverterConfig = {
  id: "engineering-unit-converter",
  operation: "engineering-unit-conversion",
  title: "Convertitore di unità tecniche",
  lede: "Converte velocità, tempo, angoli, energia, pressione, potenza, forza, coppia, frequenza, densità, portata e illuminamento con costanti dichiarate.",
  resultLabel: "Valore convertito",
  placeholder: "Il valore convertito apparirà qui.",
  fields: [
    { name: "value", label: "Valore", defaultValue: "100", kind: "text" },
    { name: "from", label: "Da", defaultValue: "kilometer-per-hour", kind: "select", options: ENGINEERING_UNIT_OPTIONS },
    { name: "to", label: "A", defaultValue: "meter-per-second", kind: "select", options: ENGINEERING_UNIT_OPTIONS },
  ],
} as const satisfies BusinessToolConfig;

export const storageDownloadCalculatorConfig = {
  id: "storage-download-calculator",
  operation: "storage-download-calculator",
  title: "Spazio digitale e tempo di download",
  lede: "Distingue unità decimali e binarie e stima il tempo di download dalla velocità inserita, senza eseguire speed test.",
  resultLabel: "Risultato",
  placeholder: "La conversione o la stima apparirà qui.",
  fields: [
    { name: "mode", label: "Modalità", defaultValue: "storage", kind: "select", options: ["storage", "download-time"] },
    { name: "value", label: "Valore da convertire", defaultValue: "1", kind: "text" },
    { name: "from", label: "Unità di origine", defaultValue: "megabyte", kind: "select", options: STORAGE_UNIT_OPTIONS },
    { name: "to", label: "Unità di destinazione", defaultValue: "mebibyte", kind: "select", options: STORAGE_UNIT_OPTIONS },
    { name: "size", label: "Dimensione file", defaultValue: "100", kind: "text" },
    { name: "sizeUnit", label: "Unità file", defaultValue: "megabyte", kind: "select", options: STORAGE_UNIT_OPTIONS },
    { name: "throughput", label: "Velocità inserita", defaultValue: "100", kind: "text" },
    { name: "throughputUnit", label: "Unità velocità", defaultValue: "megabit-per-second", kind: "select", options: RATE_UNIT_OPTIONS },
    { name: "overheadPercent", label: "Overhead (%)", defaultValue: "0", kind: "text", help: "Percentuale della velocità nominale non disponibile per il payload. 0 significa nessun overhead aggiuntivo." },
  ],
} as const satisfies BusinessToolConfig;

export const batteryVehiclePowerConfig = {
  id: "battery-vehicle-power-helper",
  operation: "battery-vehicle-power-helper",
  title: "Batteria, consumi auto e potenza",
  lede: "Converte mAh e Wh con tensione obbligatoria, consumi tra L/100 km, km/L e MPG distinti, e potenza tra kW, CV e hp.",
  resultLabel: "Risultato",
  placeholder: "Il risultato apparirà qui.",
  fields: [
    { name: "mode", label: "Modalità", defaultValue: "battery", kind: "select", options: ["battery", "fuel", "power"] },
    { name: "direction", label: "Direzione batteria", defaultValue: "mah-to-wh", kind: "select", options: ["mah-to-wh", "wh-to-mah"] },
    { name: "value", label: "Valore", defaultValue: "5000", kind: "text" },
    { name: "voltage", label: "Tensione (V)", defaultValue: "3,7", kind: "text", help: "Obbligatoria e maggiore di zero per mAh↔Wh." },
    { name: "from", label: "Da", defaultValue: "l-per-100km", kind: "select", options: ["l-per-100km", "km-per-liter", "mpg-us", "mpg-imperial", ...POWER_UNIT_OPTIONS] },
    { name: "to", label: "A", defaultValue: "mpg-us", kind: "select", options: ["l-per-100km", "km-per-liter", "mpg-us", "mpg-imperial", ...POWER_UNIT_OPTIONS] },
  ],
} as const satisfies BusinessToolConfig;

export const referenceSizeConverterConfig = {
  id: "reference-size-converter",
  operation: "reference-size-converter",
  title: "Formati carta, scale e dimensioni TV",
  lede: "Converte formati ISO, scale di modellismo e geometria TV con input espliciti; non inventa equivalenze di vestibilità per scarpe o abbigliamento.",
  resultLabel: "Dimensione calcolata",
  placeholder: "La dimensione calcolata apparirà qui.",
  fields: [
    { name: "mode", label: "Modalità", defaultValue: "paper", kind: "select", options: ["paper", "model-scale", "tv-diagonal-to-dimensions", "tv-dimensions-to-diagonal"] },
    { name: "paper", label: "Formato carta", defaultValue: "A4", kind: "select", options: ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "B0", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10"] },
    { name: "value", label: "Lunghezza", defaultValue: "6", kind: "text" },
    { name: "inputUnit", label: "Unità di ingresso", defaultValue: "meter", kind: "select", options: LENGTH_UNIT_OPTIONS },
    { name: "outputUnit", label: "Unità di uscita", defaultValue: "millimeter", kind: "select", options: LENGTH_UNIT_OPTIONS },
    { name: "scale", label: "Denominatore scala 1:n", defaultValue: "50", kind: "text" },
    { name: "direction", label: "Direzione scala", defaultValue: "real-to-model", kind: "select", options: ["real-to-model", "model-to-real"] },
    { name: "diagonal", label: "Diagonale TV", defaultValue: "55", kind: "text" },
    { name: "width", label: "Larghezza TV", defaultValue: "47,94", kind: "text" },
    { name: "height", label: "Altezza TV", defaultValue: "26,96", kind: "text" },
    { name: "aspectWidth", label: "Rapporto larghezza", defaultValue: "16", kind: "text" },
    { name: "aspectHeight", label: "Rapporto altezza", defaultValue: "9", kind: "text" },
  ],
} as const satisfies BusinessToolConfig;

export const mortgageAmortizationCalculatorConfig = {
  id: "mortgage-amortization-calculator",
  operation: "mortgage-amortization-calculator",
  title: "Mutuo, prestito e ammortamento alla francese",
  lede: "Stima rata, interessi e piano mensile per mutui o prestiti generici con TAN nominale. Le spese entrano nel costo totale solo se le inserisci esplicitamente; TAEG e altri costi non vengono inventati.",
  resultLabel: "Rata mensile",
  placeholder: "La rata stimata e il piano di ammortamento appariranno qui.",
  showCurrency: true,
  fields: [
    { name: "principal", label: "Capitale finanziato", defaultValue: "200000", kind: "text" },
    { name: "annualRatePercent", label: "TAN annuo (%)", defaultValue: "3,5", kind: "text", help: "Tasso annuo nominale: il tasso mensile usato nel piano è TAN ÷ 12 ÷ 100." },
    { name: "termMonths", label: "Durata (mesi)", defaultValue: "240", kind: "text", help: "Numero intero di rate mensili, da 1 a 3600." },
    { name: "explicitFees", label: "Spese una tantum esplicite", defaultValue: "", kind: "text", help: "Facoltative. Sono sommate al costo totale ma non modificheranno capitale, TAN o piano di ammortamento." },
  ],
} as const satisfies BusinessToolConfig;

export const geometryEquationMotionHelperConfig = {
  id: "geometry-equation-motion-helper",
  operation: "geometry-equation-motion-helper",
  title: "Geometria, equazioni e moto",
  lede: "Calcola geometria di base, Pitagora, radici quadratiche reali e velocità-distanza-tempo con unità esplicite.",
  resultLabel: "Risultato",
  placeholder: "Il risultato del calcolo apparirà qui.",
  fields: [
    { name: "mode", label: "Calcolo", defaultValue: "rectangle", kind: "select", options: ["rectangle", "circle", "rectangular-prism", "pythagorean", "quadratic", "speed", "distance", "time"] },
    { name: "width", label: "Larghezza", defaultValue: "4", kind: "text" },
    { name: "height", label: "Altezza", defaultValue: "3", kind: "text" },
    { name: "depth", label: "Profondità", defaultValue: "2", kind: "text" },
    { name: "radius", label: "Raggio", defaultValue: "2", kind: "text" },
    { name: "legA", label: "Cateto A", defaultValue: "3", kind: "text" },
    { name: "legB", label: "Cateto B", defaultValue: "4", kind: "text" },
    { name: "lengthUnit", label: "Unità lunghezza", defaultValue: "meter", kind: "select", options: LENGTH_UNIT_OPTIONS },
    { name: "coefficientA", label: "Coefficiente a", defaultValue: "1", kind: "text" },
    { name: "coefficientB", label: "Coefficiente b", defaultValue: "-3", kind: "text" },
    { name: "coefficientC", label: "Coefficiente c", defaultValue: "2", kind: "text" },
    { name: "speed", label: "Velocità", defaultValue: "90", kind: "text" },
    { name: "speedUnit", label: "Unità velocità", defaultValue: "kilometer-per-hour", kind: "select", options: SPEED_UNIT_OPTIONS },
    { name: "distance", label: "Distanza", defaultValue: "180", kind: "text" },
    { name: "distanceUnit", label: "Unità distanza", defaultValue: "kilometer", kind: "select", options: LENGTH_UNIT_OPTIONS },
    { name: "time", label: "Tempo", defaultValue: "2", kind: "text" },
    { name: "timeUnit", label: "Unità tempo", defaultValue: "hour", kind: "select", options: TIME_UNIT_OPTIONS },
  ],
} as const satisfies BusinessToolConfig;

export const everydayCostCalculatorConfig = {
  id: "everyday-cost-calculator",
  operation: "everyday-cost-calculator",
  title: "Costi quotidiani",
  lede: "Confronta prezzo unitario, dividi un conto, annualizza abbonamenti e stima costi di energia, viaggio e lavoro con ipotesi esplicite.",
  resultLabel: "Costo calcolato",
  placeholder: "Il costo calcolato apparirà qui.",
  showCurrency: true,
  fields: [
    { name: "mode", label: "Calcolo", defaultValue: "unit-price", kind: "select", options: ["unit-price", "split-bill", "annual-subscription", "energy-cost", "car-trip-cost", "salary-hourly"] },
    { name: "price", label: "Prezzo", defaultValue: "4,50", kind: "text" },
    { name: "quantity", label: "Quantità", defaultValue: "750", kind: "text" },
    { name: "quantityUnit", label: "Unità quantità", defaultValue: "gram", kind: "select", options: COST_QUANTITY_UNIT_OPTIONS },
    { name: "normalizeUnit", label: "Normalizza a", defaultValue: "kilogram", kind: "select", options: COST_QUANTITY_UNIT_OPTIONS },
    { name: "bill", label: "Conto", defaultValue: "100", kind: "text" },
    { name: "tipPercent", label: "Mancia (%)", defaultValue: "10", kind: "text" },
    { name: "people", label: "Persone", defaultValue: "3", kind: "text" },
    { name: "periodicCost", label: "Costo per periodo", defaultValue: "9,99", kind: "text" },
    { name: "periodsPerYear", label: "Addebiti per anno", defaultValue: "12", kind: "text" },
    { name: "power", label: "Potenza", defaultValue: "1500", kind: "text" },
    { name: "powerUnit", label: "Unità potenza", defaultValue: "watt", kind: "select", options: POWER_UNIT_OPTIONS },
    { name: "usageHours", label: "Ore di utilizzo", defaultValue: "2", kind: "text" },
    { name: "pricePerKwh", label: "Prezzo per kWh", defaultValue: "0,30", kind: "text" },
    { name: "distance", label: "Distanza viaggio", defaultValue: "250", kind: "text" },
    { name: "distanceUnit", label: "Unità distanza", defaultValue: "kilometer", kind: "select", options: LENGTH_UNIT_OPTIONS },
    { name: "consumptionLitersPer100Km", label: "Consumo (L/100 km)", defaultValue: "6,5", kind: "text" },
    { name: "fuelPricePerLiter", label: "Prezzo carburante/L", defaultValue: "1,85", kind: "text" },
    { name: "salaryDirection", label: "Direzione salario", defaultValue: "salary-to-hourly", kind: "select", options: ["salary-to-hourly", "hourly-to-salary"] },
    { name: "amount", label: "Salario o tariffa", defaultValue: "40000", kind: "text" },
    { name: "hoursPerWeek", label: "Ore per settimana", defaultValue: "40", kind: "text" },
    { name: "weeksPerYear", label: "Settimane per anno", defaultValue: "52", kind: "text" },
  ],
} as const satisfies BusinessToolConfig;
