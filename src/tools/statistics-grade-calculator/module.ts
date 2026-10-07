import { createBusinessModule, optionalDecimal, optionalInputString, requiredString } from "../business-module";
import type { StatisticsGradeMode } from "../../engines/business-math";

const MODES = new Set<StatisticsGradeMode>(["descriptive", "weighted", "completion"]);

const module = createBusinessModule(
  "descriptive-statistics-grades",
  (input) => {
    const mode = requiredString(input, "mode") as StatisticsGradeMode;
    if (!MODES.has(mode)) throw new Error("INVALID_MODE");
    const values = optionalInputString(input, "values");
    const weights = optionalInputString(input, "weights");
    const completed = optionalDecimal(input, "completed");
    const total = optionalDecimal(input, "total");
    return {
      mode,
      ...(values === undefined ? {} : { values }),
      ...(weights === undefined ? {} : { weights }),
      ...(completed === undefined ? {} : { completed }),
      ...(total === undefined ? {} : { total }),
    };
  },
);

export default module;
