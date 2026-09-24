import type { BusinessToolConfig } from "./BusinessMathTool";

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

export const percentageHelperConfig = {
  id: "percentage-helper",
  operation: "percentage-helper",
  title: "VAT / General Percentage Helper",
  lede: "Add a general percentage or reverse-calculate the net from an inclusive total.",
  resultLabel: "Percentage result",
  placeholder: "Your percentage result appears here.",
  showCurrency: true,
  fields: [
    { name: "base", label: "Base or inclusive amount", defaultValue: "100", kind: "number" },
    { name: "ratePercent", label: "Percentage", defaultValue: "20", kind: "number" },
    { name: "mode", label: "Calculation", defaultValue: "add", kind: "select", options: ["add", "reverse"] },
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
