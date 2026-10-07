import { createBusinessModule, optionalDecimal, optionalInputString, requiredString } from "../business-module";
import type { GeometryEquationMotionMode } from "../../engines/business-math";

const MODES = new Set<GeometryEquationMotionMode>(["rectangle", "circle", "rectangular-prism", "pythagorean", "quadratic", "speed", "distance", "time"]);
const DECIMAL_KEYS = ["width", "height", "depth", "radius", "legA", "legB", "coefficientA", "coefficientB", "coefficientC", "speed", "distance", "time"] as const;
const STRING_KEYS = ["lengthUnit", "speedUnit", "distanceUnit", "timeUnit"] as const;

const module = createBusinessModule(
  "geometry-equation-motion-helper",
  (input) => {
    const mode = requiredString(input, "mode") as GeometryEquationMotionMode;
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
);

export default module;
