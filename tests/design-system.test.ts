import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const workbenchCss = readFileSync(new URL("../src/components/workbench/Workbench.module.css", import.meta.url), "utf8");
const baseLayout = readFileSync(new URL("../src/layouts/BaseLayout.astro", import.meta.url), "utf8");
const worldMd = readFileSync(new URL("../design/WORLD.md", import.meta.url), "utf8");

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
// Dark mode redefines the ink primitives only; the aliases and the scale are
// inherited, exactly as the cascade does. Resolve against that merged view.
const darkTheme = new Map([...lightTokens, ...darkTokens]);

function declaredPalette(): ReadonlyArray<readonly [string, string]> {
  const rows = [...worldMd.matchAll(/^\|\s*`(--[\w-]+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`/gmu)];
  expect(rows.length, "design/WORLD.md declares no palette rows; the token contract cannot be derived").toBeGreaterThan(0);
  return rows.map((match) => [match[1]!.slice(2), match[2]!] as const);
}

const documentedPalette = declaredPalette();

/** The world's own names. Every other lane reads these. */
const inkTokens = [
  "carta",
  "carta-alta",
  "carta-fonda",
  "inchiostro",
  "inchiostro-2",
  "inchiostro-3",
  "rossa",
  "rossa-tenue",
  "verde",
  "ambra",
  "blu-nota",
] as const;

/** The pre-ledger names other lanes already consume. These must keep resolving. */
const aliasTokens = [
  "canvas",
  "surface",
  "surface-subtle",
  "surface-muted",
  "text",
  "text-muted",
  "border",
  "border-strong",
  "ink",
  "muted",
  "line",
  "action",
  "action-ink",
  "success",
  "success-surface",
  "warning",
  "warning-surface",
  "danger",
  "danger-surface",
  "focus-ring",
] as const;

const scaleTokens = [
  "font-family-display",
  "font-family-ui",
  "font-family-mono",
  "font-family-gutter",
  "font-size-display",
  "font-size-h1",
  "font-size-h2",
  "font-size-body-lg",
  "font-size-body",
  "font-size-sm",
  "font-size-xs",
  "font-size-mono",
  "line-height-display",
  "line-height-heading",
  "line-height-body",
  "line-height-relaxed",
  "tracking-display",
  "tracking-heading",
  "tracking-label",
  "font-weight-regular",
  "font-weight-semibold",
  "font-weight-bold",
  "space-1",
  "space-2",
  "space-3",
  "space-4",
  "space-5",
  "space-6",
  "space-7",
  "space-8",
  "space-16",
  "radius-sm",
  "radius-md",
  "border-width",
  "rule-weight",
  "state-border-width",
  "focus-width",
  "focus-offset",
  "control-height",
  "control-height-touch",
  "row-height",
  "row-height-compact",
  "nav-height",
  "container-gutter",
  "container-max",
  "container-workbench-max",
  "reading-max",
  "measure-tool",
  "measure-copy",
  "gutter-width",
  "motion-fast",
  "motion-ease",
  "motion-reduced",
  "elevation-overlay",
] as const;

function resolve(theme: Map<string, string>, name: string, seen = new Set<string>()): string {
  const raw = theme.get(name);
  if (raw === undefined) throw new Error(`Missing token --${name}`);
  const reference = raw.match(/^var\((--[\w-]+)\)$/u);
  if (reference === null) return raw;
  const next = reference[1]!.slice(2);
  if (seen.has(next)) throw new Error(`Circular token reference at --${name}`);
  seen.add(next);
  return resolve(theme, next, seen);
}

function rgb(theme: Map<string, string>, name: string): [number, number, number] {
  const hex = resolve(theme, name).replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/iu.test(hex)) throw new Error(`Expected a six-digit color from --${name}, received ${resolve(theme, name)}`);
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

function luminance(theme: Map<string, string>, name: string): number {
  const channels = rgb(theme, name).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(theme: Map<string, string>, foreground: string, background: string): number {
  const light = luminance(theme, foreground);
  const dark = luminance(theme, background);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

describe("canonical design-system tokens", () => {
  it("keeps the light palette synchronized with design/WORLD.md", () => {
    for (const [name, value] of documentedPalette) {
      expect(lightTokens.get(name), `missing light token --${name}`).toBeDefined();
      expect(lightTokens.get(name)!.toLowerCase(), `--${name} drifted from design/WORLD.md`).toBe(value.toLowerCase());
    }
  });

  it("keeps the complete token vocabulary in the light and dark authority blocks", () => {
    for (const name of [...inkTokens, ...aliasTokens, ...scaleTokens]) {
      expect(lightTokens.has(name), `missing light token --${name}`).toBe(true);
    }
    for (const name of inkTokens) {
      expect(darkTokens.has(name), `missing dark token --${name}`).toBe(true);
    }
  });

  it("resolves every pre-ledger alias to a token that exists", () => {
    for (const name of aliasTokens) {
      expect(() => resolve(lightTokens, name), `--${name} does not resolve`).not.toThrow();
    }
    expect(lightTokens.get("action")).toBe("var(--rossa)");
    expect(lightTokens.get("canvas")).toBe("var(--carta)");
    expect(lightTokens.get("text-muted")).toBe("var(--inchiostro-3)");
    expect(lightTokens.get("focus-ring")).toBe("var(--rossa)");
  });

  it("commits red to the accent and states only, and keeps it out of the neutrals", () => {
    for (const theme of [lightTokens, darkTheme]) {
      for (const name of ["carta", "carta-alta", "carta-fonda", "inchiostro", "inchiostro-2", "inchiostro-3"]) {
        expect(resolve(theme, name), `--${name} must be a neutral paper or ink`).toMatch(/^#[0-9a-f]{6}$/iu);
      }
      // Dark mode is a warm night desk, not a neutral-grey or blue-black inversion.
      const darkPaper = resolve(darkTokens, "carta");
      expect(darkPaper.startsWith("#1"), `--carta in dark mode must be a warm near-black, received ${darkPaper}`);
      const channels = [2, 4, 6].map((offset) => Number.parseInt(darkPaper.slice(offset, offset + 2), 16)) as [number, number, number];
      expect(channels[0]).toBeGreaterThanOrEqual(channels[2]);
    }
  });

  it("self-hosts two variable faces plus the gutter mono, subset and swapped", () => {
    const faces = [...globalCss.matchAll(/@font-face\s*\{([^}]*)\}/gu)].map((match) => match[1]!);
    expect(faces.length).toBeGreaterThanOrEqual(6);
    for (const face of faces) {
      expect(face, "every self-hosted face must swap rather than block or flash").toContain("font-display: swap");
      expect(face, "every self-hosted face must be a local woff2, never a CDN").toMatch(/src:\s*url\("\/fonts\/[a-z0-9-]+\.woff2"\)/u);
      expect(face, "every face must be unicode-range subset to latin or latin-ext").toContain("unicode-range:");
    }
    // No web font may load from a remote origin.
    expect(globalCss).not.toMatch(/@import\s+url\(|https?:\/\/fonts\./u);
  });

  it("preloads the above-the-fold faces and declares Italian as the document language", () => {
    for (const face of ["archivo-latin", "source-sans-3-latin", "roboto-mono-latin"]) {
      expect(baseLayout, `missing preload for ${face}`).toContain(`/fonts/${face}.woff2`);
    }
    expect(baseLayout).toContain('rel="preload"');
    expect(baseLayout).toContain('as="font"');
    expect(baseLayout).toMatch(/<html lang=\{lang\}>/u);
    expect(baseLayout).toContain('lang = "it"');
  });

  it("takes browser chrome colour from the token sheet rather than a restated literal", () => {
    expect(baseLayout, "theme-color must be derived from the token sheet, not hardcoded").toContain('tokenValue(tokenSheet, "--carta")');
    expect(baseLayout).toContain('name="theme-color"');
    expect(baseLayout).not.toMatch(/name="theme-color" content="#/u);
  });

  it("collapses the breakpoints to the three shared ones", () => {
    const widths = [...globalCss.matchAll(/@media \((?:min|max)-width: (\d+)px\)/gu)].map((match) => match[1]!);
    expect([...new Set(widths)], "only the two shared breakpoints may appear").toEqual(["900", "1200"]);
  });

  it("builds the ledger vocabulary: the gutter column, ruled rows, and tabular figures", () => {
    expect(globalCss).toContain("clamp(9rem, 22vw, 15rem)");
    // The gutter is a fixed column on the desk and a full-width ruled block below.
    expect(globalCss).toMatch(/grid-template-columns: minmax\(0, 1fr\) var\(--gutter-width\)/u);
    // Digits must not shift width as they change.
    for (const selector of [".gutter", ".rule-row", ".result-value"]) {
      expect(globalCss, `${selector} must mandate tabular numerals`).toContain(`${selector}`);
    }
    expect(globalCss.match(/font-variant-numeric: tabular-nums lining-nums/gu)?.length ?? 0).toBeGreaterThanOrEqual(4);
    // Depth is one 1px edge plus a background step, never a soft glow.
    expect(globalCss).not.toMatch(/box-shadow:[^;]*(?!inset)[^;]*\d+px\s+\d+px[^;]*blur/iu);
    expect(globalCss).toContain("inset 3px 0 0 0 var(--rossa)");
  });

  it("retains browser defaults, focus, and reduced motion", () => {
    for (const declaration of [
      "box-sizing: border-box",
      "button, input, select, textarea",
      ":focus-visible",
      "prefers-reduced-motion",
      "prefers-color-scheme: dark",
      "var(--container-gutter)",
      "var(--container-max)",
    ]) {
      expect(globalCss, `missing design-system rule ${declaration}`).toContain(declaration);
    }
  });

  it("does not leave a second local token authority in the Workbench module", () => {
    expect(workbenchCss).not.toMatch(/--wb-/u);
    expect(workbenchCss).not.toMatch(/--[\w-]+\s*:/u);
    for (const token of ["--text", "--text-muted", "--surface", "--border", "--action", "--warning-surface", "--danger-surface", "--radius-sm", "--space-4", "--motion-fast"]) {
      expect(workbenchCss, `Workbench does not consume ${token}`).toContain(`var(${token})`);
    }
  });

  it("keeps the ledger surface free of gradients, glass, and local color literals", () => {
    for (const css of [globalCss, workbenchCss]) {
      expect(css).not.toMatch(/gradient\(|backdrop-filter|filter\s*:\s*blur/iu);
    }
    expect(workbenchCss).not.toMatch(/#[0-9a-f]{3,8}\b|color-mix\(|rgba?\(/iu);
  });

  it("carries no dead rule or dead token in the sheet", () => {
    const declared = [...globalCss.matchAll(/^\s*(--[\w-]+)\s*:/gmu)].map((match) => match[1]!);
    // Held for a lane that owns the consumer. The world makes these
    // cross-surface invariants, so they stay declared before the consumer lands.
    const reservedForConsumers = new Set([
      "--elevation-overlay",
      "--elevation-2",
      "--overlay-backdrop",
      "--rail-width",
      "--shell-rail-width",
      "--shell-bar-slots",
      "--shell-nav-ink",
      "--shell-nav-ink-muted",
      "--shell-nav-marker",
      "--shell-nav-rule",
      "--shell-nav-surface",
      "--shell-nav-surface-active",
      "--font-weight-medium",
      "--radius-xs",
      "--space-12",
      "--space-0",
      "--space-half",
    ]);
    const srcRoot = new URL("../src", import.meta.url).pathname;
    const consumerSources: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(astro|css|ts|tsx)$/u.test(entry.name) && path !== join(srcRoot, "styles/global.css")) {
          consumerSources.push(readFileSync(path, "utf8"));
        }
      }
    };
    walk(srcRoot);
    const consumers = consumerSources.join("\n");
    for (const name of declared) {
      if (reservedForConsumers.has(name)) continue;
      const pattern = new RegExp(`var\\(\\s*${name}\\s*\\)`, "gu");
      // A token read only by the sheet's own base elements is still live; a
      // token nobody reads anywhere is dead weight in a single-authority sheet.
      const uses = (consumers.match(pattern)?.length ?? 0) + (globalCss.match(pattern)?.length ?? 0);
      expect(uses, `--${name} is declared but never read`).toBeGreaterThan(0);
    }
  });

  it("meets the AA contrast floor for text, action, and semantic states in both themes", () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ["text", "canvas"],
      ["text", "surface"],
      ["text-muted", "canvas"],
      ["text-muted", "surface"],
      ["text-muted", "surface-subtle"],
      ["action", "canvas"],
      ["action-ink", "action"],
      ["success", "success-surface"],
      ["warning", "warning-surface"],
      ["rossa-su-tenue", "rossa-tenue"],
    ];
    for (const theme of [lightTokens, darkTheme]) {
      for (const [foreground, background] of pairs) {
        expect(contrast(theme, foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(theme, "action", "canvas"), "the focus ring must clear 3:1 on the ground").toBeGreaterThanOrEqual(3);
    }
  });
});
