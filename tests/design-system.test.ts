import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const workbenchCss = readFileSync(new URL("../src/components/workbench/Workbench.module.css", import.meta.url), "utf8");
const worldMd = readFileSync(new URL("../design/WORLD.md", import.meta.url), "utf8");

const rootStart = globalCss.indexOf(":root {");
const rootEnd = globalCss.indexOf("\n}", rootStart);
const lightCss = globalCss.slice(rootStart, rootEnd);
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

// WORLD.md is the standing design authority. The palette table it publishes is the token
// contract this suite guards, so the vocabulary is derived from the authority instead of
// being hardcoded here. Hardcoding a list is exactly how this test came to pin a deleted
// system: it kept passing against tokens nobody had removed because it never re-read the
// design record. If WORLD.md changes the palette, the contract below changes with it.
function declaredPalette(): ReadonlyArray<readonly [string, string]> {
  const rows = [...worldMd.matchAll(/^\|\s*`(--[\w-]+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`/gmu)];
  expect(rows.length, "design/WORLD.md declares no palette rows; the token contract cannot be derived").toBeGreaterThan(0);
  return rows.map((match) => [match[1]!.slice(2), match[2]!] as const);
}

const palette = declaredPalette();
const paletteNames = palette.map(([name]) => name);

// Semantic foreground/background pairs, expressed in the authority's own vocabulary.
// Each entry is [ink token, paper token]; the pair must clear the WCAG 2.2 AA floor.
const contrastPairs: ReadonlyArray<readonly [string, string, number]> = [
  ["inchiostro", "carta", 4.5],
  ["inchiostro-2", "carta", 4.5],
  ["inchiostro-3", "carta", 4.5],
  ["rossa", "carta", 4.5],
  ["rossa", "rossa-tenue", 4.5],
  ["verde", "carta", 4.5],
  ["ambra", "carta", 4.5],
  ["blu-nota", "carta", 4.5],
  ["inchiostro", "carta-alta", 4.5],
  ["inchiostro", "carta-fonda", 4.5],
  ["rossa", "carta", 3],
];

// Tokens the layout depends on structurally. Losing one of these is a layout regression
// even when every colour still passes contrast.
const structuralTokens = [
  "space-1",
  "space-2",
  "space-3",
  "space-4",
  "space-6",
  "space-8",
  "radius-sm",
  "radius-md",
  "border-width",
  "focus-width",
  "focus-offset",
  "control-height",
  "container-gutter",
  "container-max",
  "motion-fast",
  "motion-reduced",
] as const;

describe("design-system token contract (design/WORLD.md)", () => {
  it("declares every WORLD.md palette token in the light authority block at its documented value", () => {
    for (const [name, value] of palette) {
      const actual = lightTokens.get(name);
      expect(actual, `missing light token --${name}`).toBeDefined();
      expect(actual!.toLowerCase(), `--${name} drifted from the WORLD.md value`).toBe(value.toLowerCase());
    }
  });

  it("carries the same palette vocabulary into the dark authority block", () => {
    for (const name of paletteNames) {
      expect(darkTokens.has(name), `missing dark token --${name}`).toBe(true);
    }
  });

  it("keeps the flat-ledger material contract: no gradients, glass, or glow", () => {
    for (const css of [globalCss, workbenchCss]) {
      expect(css, "gradients/glow are banned by the ledger material rule").not.toMatch(/gradient\(|backdrop-filter|filter\s*:\s*blur/iu);
    }
  });

  it("rejects a second local token authority in the Workbench module", () => {
    expect(workbenchCss, "Workbench declares its own tokens instead of consuming the canonical ones").not.toMatch(/--[\w-]+\s*:/u);
    for (const token of ["--inchiostro", "--carta", "--rossa", "--inchiostro-2", "--space-4", "--radius-sm"]) {
      if (lightTokens.has(token.slice(2))) {
        expect(workbenchCss, `Workbench does not consume ${token}`).toContain(`var(${token})`);
      }
    }
  });

  it("keeps the numeric gutter tabular so digits never shift width", () => {
    // The gutter is the signature element; non-tabular digits break the one place the
    // product promises a value will always land in the same fixed position.
    expect(globalCss).toMatch(/font-variant-numeric\s*:\s*[^;]*tabular-nums/iu);
  });

  it("honours reduced motion, visible focus, and the responsive container", () => {
    for (const rule of [
      "box-sizing: border-box",
      ":focus-visible",
      "prefers-reduced-motion",
      "prefers-color-scheme: dark",
      "var(--container-gutter)",
      "var(--container-max)",
    ]) {
      expect(globalCss, `missing design-system rule ${rule}`).toContain(rule);
    }
  });

  it("keeps every structural layout token defined in the light block", () => {
    for (const name of structuralTokens) {
      expect(lightTokens.has(name), `missing structural token --${name}`).toBe(true);
    }
  });
});

describe("WORLD.md palette contrast floor", () => {
  it.each(contrastPairs)("--%s on --%s clears %i:1", (ink, paper, floor) => {
    for (const [themeName, theme] of [["light", lightTokens], ["dark", darkTokens]] as const) {
      const inkValue = theme.get(ink);
      const paperValue = theme.get(paper);
      expect(inkValue, `missing ${themeName} --${ink}`).toBeDefined();
      expect(paperValue, `missing ${themeName} --${paper}`).toBeDefined();
      const ratio = contrast(inkValue!, paperValue!);
      expect(ratio, `${themeName} --${ink} on --${paper} is ${ratio.toFixed(2)}:1, below ${floor}:1`).toBeGreaterThanOrEqual(floor);
    }
  });
});
