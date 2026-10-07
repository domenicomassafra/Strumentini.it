import { createBusinessModule, optionalInputString, requiredString } from "../business-module";
import type { ExactIntegerToolkitMode, ExactIntegerToolkitOperation } from "../../engines/business-math";

const MODES = new Set<ExactIntegerToolkitMode>(["fraction", "gcd-lcm", "prime-factor", "combinatorics", "roman", "number-words"]);
const OPERATIONS = new Set<ExactIntegerToolkitOperation>(["add", "subtract", "multiply", "divide", "combination", "permutation"]);

const module = createBusinessModule(
  "exact-fractions-integer-toolkit",
  (input) => {
    const mode = requiredString(input, "mode") as ExactIntegerToolkitMode;
    if (!MODES.has(mode)) throw new Error("INVALID_MODE");
    const requestedOperation = optionalInputString(input, "operation") as ExactIntegerToolkitOperation | undefined;
    if (requestedOperation !== undefined && !OPERATIONS.has(requestedOperation)) throw new Error("INVALID_OPERATION");
    const operation = mode === "fraction"
      ? requestedOperation === "add" || requestedOperation === "subtract" || requestedOperation === "multiply" || requestedOperation === "divide"
        ? requestedOperation
        : undefined
      : mode === "combinatorics"
        ? requestedOperation === "combination" || requestedOperation === "permutation"
          ? requestedOperation
          : undefined
        : undefined;
    return {
      mode,
      left: requiredString(input, "left"),
      ...(optionalInputString(input, "right") === undefined ? {} : { right: optionalInputString(input, "right") }),
      ...(operation === undefined ? {} : { operation }),
    };
  },
);

export default module;
