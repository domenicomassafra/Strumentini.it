import { createBusinessModule, requiredString } from "../business-module";

const module = createBusinessModule(
  "scientific-expression-calculator",
  (input) => ({ expression: requiredString(input, "expression") }),
);

export default module;
