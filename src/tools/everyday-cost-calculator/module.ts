import { createBusinessModule, currencyDecoration, optionalDecimal, optionalInputString, requiredString } from "../business-module";
import type { EverydayCostMode } from "../../engines/business-math";

const MODES = new Set<EverydayCostMode>(["unit-price", "split-bill", "annual-subscription", "energy-cost", "car-trip-cost", "salary-hourly"]);
const DECIMAL_KEYS = ["price", "quantity", "bill", "tipPercent", "people", "periodicCost", "periodsPerYear", "power", "usageHours", "pricePerKwh", "distance", "consumptionLitersPer100Km", "fuelPricePerLiter", "amount", "hoursPerWeek", "weeksPerYear"] as const;
const STRING_KEYS = ["quantityUnit", "normalizeUnit", "powerUnit", "distanceUnit", "salaryDirection"] as const;

const module = createBusinessModule(
  "everyday-cost-calculator",
  (input) => {
    const mode = requiredString(input, "mode") as EverydayCostMode;
    if (!MODES.has(mode)) throw new Error("INVALID_MODE");
    return {
      mode,
      ...Object.fromEntries(DECIMAL_KEYS.flatMap((key) => {
        const value = optionalDecimal(input, key);
        return value === undefined ? [] : [[key, value]];
      })),
      ...Object.fromEntries(STRING_KEYS.flatMap((key) => {
        const value = optionalInputString(input, key);
        return value === undefined ? [] : [[key, value]];
      })),
    };
  },
  (value, context) => ({ ...(value as object), ...currencyDecoration(context) }),
);

export default module;
