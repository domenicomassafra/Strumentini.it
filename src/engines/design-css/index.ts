import { parseHexColor, rgbToHex } from "../image/visual";

export type CssDesignMode = "gradient" | "shadow" | "radius";

export type CssDesignInput =
  | { readonly mode: "gradient"; readonly angle: number; readonly startColor: string; readonly endColor: string }
  | { readonly mode: "shadow"; readonly offsetX: number; readonly offsetY: number; readonly blur: number; readonly spread: number; readonly color: string }
  | { readonly mode: "radius"; readonly topLeft: number; readonly topRight: number; readonly bottomRight: number; readonly bottomLeft: number };

export interface CssDesignResult {
  readonly mode: CssDesignMode;
  readonly property: "background" | "box-shadow" | "border-radius";
  readonly value: string;
  readonly css: string;
  readonly model: Readonly<Record<string, string | number>>;
}

function finiteInRange(value: number, minimum: number, maximum: number, field: string): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`INVALID_${field.toUpperCase()}`);
  return Object.is(value, -0) ? 0 : value;
}

function color(value: string, field: string): string {
  try {
    const rgb = parseHexColor(value);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  } catch {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

function compactNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

export function buildCssDesign(input: CssDesignInput): CssDesignResult {
  if (input.mode === "gradient") {
    const angle = finiteInRange(input.angle, 0, 360, "angle");
    const startColor = color(input.startColor, "start_color");
    const endColor = color(input.endColor, "end_color");
    const value = `linear-gradient(${compactNumber(angle)}deg, ${startColor}, ${endColor})`;
    return {
      mode: input.mode,
      property: "background",
      value,
      css: `background: ${value};`,
      model: { angle, startColor, endColor },
    };
  }
  if (input.mode === "shadow") {
    const offsetX = finiteInRange(input.offsetX, -200, 200, "offset_x");
    const offsetY = finiteInRange(input.offsetY, -200, 200, "offset_y");
    const blur = finiteInRange(input.blur, 0, 300, "blur");
    const spread = finiteInRange(input.spread, -200, 200, "spread");
    const shadowColor = color(input.color, "color");
    const value = `${compactNumber(offsetX)}px ${compactNumber(offsetY)}px ${compactNumber(blur)}px ${compactNumber(spread)}px ${shadowColor}`;
    return {
      mode: input.mode,
      property: "box-shadow",
      value,
      css: `box-shadow: ${value};`,
      model: { offsetX, offsetY, blur, spread, color: shadowColor },
    };
  }
  if (input.mode === "radius") {
    const topLeft = finiteInRange(input.topLeft, 0, 1000, "top_left");
    const topRight = finiteInRange(input.topRight, 0, 1000, "top_right");
    const bottomRight = finiteInRange(input.bottomRight, 0, 1000, "bottom_right");
    const bottomLeft = finiteInRange(input.bottomLeft, 0, 1000, "bottom_left");
    const value = `${compactNumber(topLeft)}px ${compactNumber(topRight)}px ${compactNumber(bottomRight)}px ${compactNumber(bottomLeft)}px`;
    return {
      mode: input.mode,
      property: "border-radius",
      value,
      css: `border-radius: ${value};`,
      model: { topLeft, topRight, bottomRight, bottomLeft },
    };
  }
  throw new Error("INVALID_MODE");
}
