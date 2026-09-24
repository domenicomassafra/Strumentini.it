import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const workbenchCss = readFileSync(new URL("../src/components/workbench/Workbench.module.css", import.meta.url), "utf8");

const rootEnd = globalCss.indexOf("\n}", globalCss.indexOf(":root {"));
const lightCss = globalCss.slice(globalCss.indexOf(":root {"), rootEnd);
const darkStart = globalCss.indexOf("@media (prefers-color-scheme: dark)");
const darkCss = globalCss.slice(darkStart);

function tokens(css: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/gu)) {
    values.set(match[1]!, match[2]!.trim());
  }
  return values;
}

const lightTokens = tokens(lightCss);
const darkTokens = tokens(darkCss);

const colorTokens = [
  "canvas",
  "surface",
  "surface-subtle",
  "text",
  "text-muted",
  "text-faint",
  "border",
  "border-strong",
  "action",
  "action-hover",
  "action-soft",
  "action-ink",
  "success",
  "success-surface",
  "warning",
  "warning-surface",
  "danger",
  "danger-surface",
  "info",
  "info-surface",
] as const;

const scaleTokens = [
  "font-family-ui",
  "font-family-mono",
  "font-size-display",
  "font-size-h1",
  "font-size-h2",
  "font-size-body",
  "font-size-sm",
  "font-size-xs",
  "line-height-body",
  "line-height-relaxed",
  "font-weight-semibold",
  "font-weight-bold",
  "space-1",
  "space-2",
  "space-3",
  "space-4",
  "space-5",
  "space-6",
  "space-8",
  "space-10",
  "space-12",
  "space-16",
  "radius-xs",
  "radius-sm",
  "radius-md",
  "radius-lg",
  "radius-full",
  "border-width",
  "state-border-width",
  "focus-width",
  "focus-offset",
  "control-height",
  "control-height-touch",
  "row-height",
  "row-height-compact",
  "container-gutter",
  "container-max",
  "container-workbench-max",
  "motion-fast",
  "motion-panel",
  "motion-ease",
  "motion-reduced",
  "elevation-0",
  "elevation-1",
  "elevation-2",
] as const;

function rgb(value: string): [number, number, number] {
  const hex = value.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/iu.test(hex)) throw new Error(`Expected a six-digit color, received ${value}`);
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

function luminance(value: string): number {
  const channels = rgb(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string): number {
  const light = luminance(foreground);
  const dark = luminance(background);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

describe("canonical design-system tokens", () => {
  it("keeps the complete token vocabulary in the light and dark authority blocks", () => {
    for (const name of [...colorTokens, ...scaleTokens]) {
      expect(lightTokens.has(name), `missing light token --${name}`).toBe(true);
    }
    for (const name of colorTokens) {
      expect(darkTokens.has(name), `missing dark token --${name}`).toBe(true);
    }
    expect(lightTokens.get("ink")).toBe("var(--text)");
    expect(lightTokens.get("muted")).toBe("var(--text-muted)");
    expect(lightTokens.get("line")).toBe("var(--border)");
    expect(lightTokens.get("surface-muted")).toBe("var(--surface-subtle)");
    expect(lightTokens.get("accent")).toBe("var(--action)");
    expect(lightTokens.get("radius")).toBe("var(--radius-md)");
    expect(lightTokens.get("focus-ring")).toBe("var(--action)");
  });

  it("does not leave a second local token authority in the Workbench module", () => {
    expect(workbenchCss).not.toMatch(/--wb-/u);
    expect(workbenchCss).not.toMatch(/--[\w-]+\s*:/u);
    for (const token of ["--text", "--text-muted", "--surface", "--border", "--action", "--warning-surface", "--danger-surface", "--radius-sm", "--space-4", "--motion-fast"]) {
      expect(workbenchCss, `Workbench does not consume ${token}`).toContain(`var(${token})`);
    }
  });

  it("retains browser defaults, focus, responsive containers, and reduced motion", () => {
    for (const declaration of [
      "box-sizing: border-box",
      "button, input, select, textarea",
      ":focus-visible",
      "prefers-reduced-motion",
      "prefers-color-scheme: dark",
      "@media (max-width: 760px)",
      "@media (min-width: 960px)",
      "@media (max-width: 640px)",
      "var(--container-gutter)",
      "var(--container-max)",
    ]) {
      expect(globalCss, `missing design-system rule ${declaration}`).toContain(declaration);
    }
  });

  it("keeps the Quiet Workbench surface free of gradients, glass, and local color literals", () => {
    for (const css of [globalCss, workbenchCss]) {
      expect(css).not.toMatch(/gradient\(|backdrop-filter|filter\s*:\s*blur/iu);
    }
    expect(workbenchCss).not.toMatch(/#[0-9a-f]{3,8}\b|color-mix\(|rgba?\(/iu);
  });

  it("meets the AA contrast floor for text, action, and semantic states in both themes", () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ["text", "canvas"],
      ["text", "surface"],
      ["text-muted", "canvas"],
      ["text-muted", "surface"],
      ["action-ink", "action"],
      ["success", "success-surface"],
      ["warning", "warning-surface"],
      ["danger", "danger-surface"],
      ["info", "info-surface"],
    ];
    for (const theme of [lightTokens, darkTokens]) {
      for (const [foreground, background] of pairs) {
        const foregroundValue = theme.get(foreground);
        const backgroundValue = theme.get(background);
        expect(foregroundValue, `missing ${foreground}`).toBeDefined();
        expect(backgroundValue, `missing ${background}`).toBeDefined();
        expect(contrast(foregroundValue!, backgroundValue!)).toBeGreaterThanOrEqual(4.5);
      }
      const focusValue = theme.get("action")!;
      const surfaceValue = theme.get("canvas")!;
      expect(contrast(focusValue, surfaceValue)).toBeGreaterThanOrEqual(3);
    }
  });
});
