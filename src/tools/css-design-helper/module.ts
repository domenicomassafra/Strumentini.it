import { buildCssDesign, type CssDesignInput } from "../../engines/design-css";
import type { ToolModule } from "../../runtime/types";

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_INPUT");
  return value as Record<string, unknown>;
}

function numberValue(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`INVALID_${field.toUpperCase()}`);
  return value;
}

function textValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`INVALID_${field.toUpperCase()}`);
  return value;
}

function normalize(value: unknown): CssDesignInput {
  const input = record(value);
  if (input.mode === "gradient") return {
    mode: "gradient",
    angle: numberValue(input.angle, "angle"),
    startColor: textValue(input.startColor, "start_color"),
    endColor: textValue(input.endColor, "end_color"),
  };
  if (input.mode === "shadow") return {
    mode: "shadow",
    offsetX: numberValue(input.offsetX, "offset_x"),
    offsetY: numberValue(input.offsetY, "offset_y"),
    blur: numberValue(input.blur, "blur"),
    spread: numberValue(input.spread, "spread"),
    color: textValue(input.color, "color"),
  };
  if (input.mode === "radius") return {
    mode: "radius",
    topLeft: numberValue(input.topLeft, "top_left"),
    topRight: numberValue(input.topRight, "top_right"),
    bottomRight: numberValue(input.bottomRight, "bottom_right"),
    bottomLeft: numberValue(input.bottomLeft, "bottom_left"),
  };
  throw new Error("INVALID_MODE");
}

const module: ToolModule = {
  run(input, _context, signal) {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    return buildCssDesign(normalize(input));
  },
};

export default module;
