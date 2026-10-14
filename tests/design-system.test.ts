/**
 * The design-system contract.
 *
 * `design/WORLD.md` is the written authority and `src/styles/global.css` is the
 * implemented one. This suite parses the palette table out of the document and
 * refuses to let the two drift, then holds the rules that are easy to break one
 * component at a time: no local colour literal, no second token authority, no
 * dead token, and the contrast floors in both themes.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

function read(relative: string): string {
  return readFileSync(new URL(relative, root), "utf8");
}

const globalCss = read("src/styles/global.css");
const world = read("design/WORLD.md");
const baseLayout = read("src/layouts/BaseLayout.astro");

const rootStart = globalCss.indexOf(":root {");
const lightCss = globalCss.slice(rootStart, globalCss.indexOf("\n}", rootStart));
const darkStart = globalCss.indexOf(':root[data-theme="dark"]');
const darkCss = globalCss.slice(
  darkStart,
  globalCss.indexOf("\n}", darkStart),
);
function tokens(css: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/gu)) {
    found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

const light = tokens(lightCss);
const dark = tokens(darkCss);

/** Every role that must be defined for both themes. */
const themed = [
  "brand", "brand-hover", "brand-soft", "brand-soft-strong", "brand-ink",
  "canvas", "surface", "surface-subtle", "surface-muted",
  "text", "text-muted", "text-faint", "on-tone",
  "border", "border-strong",
  "success", "success-soft", "warning", "warning-soft", "danger", "danger-soft", "info", "info-soft",
  "tone-1", "tone-2", "tone-3", "tone-4", "tone-5", "tone-6", "tone-7", "tone-8",
  "shadow-card", "shadow-raised", "elevation-2", "overlay-backdrop",
] as const;

/** The written authority publishes these as a table; everything else is derived. */
function documentedPalette(): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const line of world.split("\n")) {
    const match = line.match(/^\|\s*`--([\w-]+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|/iu);
    if (match !== null) rows.push([match[1]!, match[2]!.toLowerCase()]);
  }
  return rows;
}

function resolve(theme: Map<string, string>, name: string, seen = new Set<string>()): string {
  const value = theme.get(name);
  if (value === undefined) throw new Error(`--${name} is not declared`);
  const alias = value.match(/^var\(--([\w-]+)\)$/u);
  if (alias === null) return value;
  if (seen.has(name)) throw new Error(`--${name} is circular`);
  seen.add(name);
  return resolve(theme, alias[1]!, seen);
}

function rgb(theme: Map<string, string>, name: string): [number, number, number] {
  const value = resolve(theme, name).toLowerCase();
  const hex = value.match(/^#([0-9a-f]{6})$/u);
  if (hex !== null) {
    const n = Number.parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/u);
  if (parts !== null) return [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  throw new Error(`--${name} is not a resolvable colour: ${value}`);
}

function luminance(theme: Map<string, string>, name: string): number {
  const [r, g, b] = rgb(theme, name).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(theme: Map<string, string>, foreground: string, background: string): number {
  const a = luminance(theme, foreground);
  const b = luminance(theme, background);
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high + 0.05) / (low + 0.05);
}

/** Every stylesheet a component owns, with `.astro` <style> blocks extracted. */
function componentStyles(): Array<{ file: string; css: string }> {
  const out: Array<{ file: string; css: string }> = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (entry.endsWith(".css")) {
        out.push({ file: path, css: readFileSync(path, "utf8") });
        continue;
      }
      if (entry.endsWith(".astro")) {
        const source = readFileSync(path, "utf8");
        const blocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gu)].map((match) => match[1]!).join("\n");
        if (blocks.trim() !== "") out.push({ file: path, css: blocks });
      }
    }
  };
  walk(new URL("src", root).pathname);
  return out.filter(({ file }) => !file.endsWith(join("styles", "global.css")));
}

const styles = componentStyles();

/** Every text file a token could be consumed from, concatenated once. */
function allSourceText(): string {
  const parts: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (/\.(?:astro|css|ts|tsx|mjs)$/u.test(entry)) parts.push(readFileSync(path, "utf8"));
    }
  };
  walk(new URL("src", root).pathname);
  return parts.join("\n");
}

describe("canonical design-system tokens", () => {
  it("keeps the light palette synchronized with design/WORLD.md", () => {
    const documented = documentedPalette();
    expect(documented.length, "design/WORLD.md publishes no palette rows").toBeGreaterThan(10);
    for (const [name, value] of documented) {
      expect(light.get(name), `missing light token --${name}`).toBeDefined();
      expect(light.get(name)!.toLowerCase(), `--${name} drifted from design/WORLD.md`).toBe(value);
    }
  });

  it("declares the complete themed vocabulary in both themes", () => {
    for (const name of themed) {
      expect(light.has(name), `missing light token --${name}`).toBe(true);
      expect(dark.has(name), `missing dark token --${name}`).toBe(true);
    }
  });

  it("never lets the operating system choose the ground on its own", () => {
    // Dark is an explicit choice: the sheet must not switch themes from a media
    // query. `:root` is the light world and there is exactly one dark block.
    expect(globalCss).not.toContain("prefers-color-scheme");
    expect(globalCss.match(/:root\[data-theme="dark"\]/gu)?.length ?? 0).toBe(1);
    expect(lightCss).toContain("color-scheme: light;");
    expect(darkCss).toContain("color-scheme: dark;");
  });

  it("resolves every alias and keeps one accent family", () => {
    for (const name of light.keys()) {
      expect(() => resolve(light, name), `--${name} does not resolve`).not.toThrow();
    }
    for (const name of dark.keys()) {
      expect(() => resolve(dark, name), `--${name} does not resolve in dark`).not.toThrow();
    }
    expect(light.get("focus-ring")).toBe("var(--brand)");
    expect(light.get("info-soft")).toBe("var(--brand-soft)");
  });

  it("meets the AA contrast floor for text and states in both themes", () => {
    const pairs: Array<[string, string, number]> = [
      ["text", "canvas", 4.5],
      ["text", "surface", 4.5],
      ["text", "surface-subtle", 4.5],
      ["text-muted", "surface", 4.5],
      ["text-faint", "surface", 3],
      // WCAG 2.2 SC 1.4.11: resting input/control boundaries must be perceptible.
      ["border-strong", "surface", 3],
      ["brand-ink", "brand", 4.5],
      ["brand", "surface", 3],
      ["success", "success-soft", 4.5],
      ["warning", "warning-soft", 4.5],
      ["danger", "danger-soft", 4.5],
      ["info", "info-soft", 4.5],
    ];
    for (const theme of [light, dark]) {
      for (const [foreground, background, floor] of pairs) {
        expect(
          contrast(theme, foreground, background),
          `--${foreground} on --${background}`,
        ).toBeGreaterThanOrEqual(floor);
      }
    }
  });
});

describe("the sheet's own rules", () => {
  it("uses the AA-contrast border role for resting form fields", () => {
    const selectorStart = globalCss.indexOf(".field input,\n.field textarea,");
    expect(selectorStart).toBeGreaterThan(-1);
    const declarationEnd = globalCss.indexOf("}", selectorStart);
    const fields = globalCss.slice(selectorStart, declarationEnd);
    expect(fields).toContain("border: var(--border-width) solid var(--border-strong);");
  });

  it("self-hosts its faces, subset and swapped, with no CDN", () => {
    const faces = globalCss.match(/@font-face\s*\{[\s\S]*?\}/gu) ?? [];
    expect(faces.length).toBeGreaterThanOrEqual(4);
    for (const face of faces) {
      expect(face, "every self-hosted face must swap rather than block or flash").toContain("font-display: swap");
      expect(face, "every face must be a local woff2, never a CDN").toMatch(/src:\s*url\("\/fonts\/[a-z0-9-]+\.woff2"\)/u);
      expect(face, "every face must be unicode-range subset to latin or latin-ext").toContain("unicode-range:");
    }
    expect(globalCss).not.toMatch(/@import\s+url\(|https?:\/\/fonts\./u);
    expect(baseLayout).toContain('rel="preload"');
    expect(baseLayout).toContain('as="font"');
    expect(baseLayout).toContain("/fonts/inter-latin.woff2");
    expect(baseLayout).toContain('<html lang="it"');
  });

  it("takes browser chrome colour from the token sheet rather than a restated literal", () => {
    expect(baseLayout, "theme-color must be derived from the token sheet, not hardcoded").toContain('tokenValue(tokenSheet, "--canvas")');
    expect(baseLayout).toContain('name="theme-color"');
    expect(baseLayout).not.toMatch(/name="theme-color" content="#/u);
  });

  it("collapses the breakpoints to the two shared ones", () => {
    const widths = [...globalCss.matchAll(/@media \(min-width: (\d+)px\)/gu)].map((match) => match[1]!);
    expect([...new Set(widths)], "only the two shared breakpoints may appear").toEqual(["900", "1200"]);
  });

  it("mandates tabular numerals wherever a value is read", () => {
    expect(globalCss).toMatch(/grid-template-columns: minmax\(0, 1fr\) var\(--gutter-width\)/u);
    for (const selector of [".gutter", ".result-value", ".table-output", ".stat-value"]) {
      expect(globalCss, `${selector} must be in the tabular rule`).toContain(selector);
    }
    expect(globalCss.match(/font-variant-numeric: tabular-nums lining-nums/gu)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("retains browser defaults, focus, and reduced motion", () => {
    for (const declaration of [
      "box-sizing: border-box",
      ":focus-visible",
      "outline-offset",
      "text-size-adjust: 100%",
      ".visually-hidden",
      "@media (prefers-reduced-motion: reduce)",
    ]) {
      expect(globalCss, `missing design-system rule ${declaration}`).toContain(declaration);
    }
  });

  it("carries no dead token in the sheet", () => {
    const consumers = allSourceText();
    for (const name of light.keys()) {
      // The tone wheel is read through `var(--tone-${tone})`, so a literal
      // search cannot see it; its completeness is asserted by `themed` above.
      if (/^tone-[1-8]$/u.test(name)) continue;
      const uses = consumers.match(new RegExp(`var\\(--${name}\\)`, "gu"))?.length ?? 0;
      expect(uses, `--${name} is declared but never read`).toBeGreaterThan(0);
    }
  });
});

describe("component stylesheets", () => {
  it("introduce no local colour literal", () => {
    for (const { file, css } of styles) {
      expect(css, `${file} declares a hex colour`).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
      expect(css, `${file} declares an rgb()/hsl() colour`).not.toMatch(/\b(?:rgba?|hsla?)\(/iu);
    }
  });

  it("declare no second token authority", () => {
    for (const { file, css } of styles) {
      const declared = [...css.matchAll(/--([\w-]+)\s*:/gu)].map((match) => match[1]!);
      const local = declared.filter((name) => name !== "tile-tone" && name !== "gutter-width" && name !== "gutter-tone");
      expect(local, `${file} declares local custom properties: ${local.join(", ")}`).toEqual([]);
    }
  });

  it("leans on the shared vocabulary instead of restating layout", () => {
    for (const { file, css } of styles) {
      expect(css, `${file} restates a spacing scale`).not.toMatch(/--space-\d+\s*:/u);
      expect(css, `${file} restates a radius`).not.toMatch(/--radius-[\w-]+\s*:/u);
    }
  });
});
