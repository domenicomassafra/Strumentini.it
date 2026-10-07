import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const forbidden = new RegExp(["Strumenti" + "Utili", "Strumenti Utili", "strumenti" + "utili"].join("|"), "iu");
const textExtensions = new Set([".astro", ".css", ".html", ".json", ".md", ".svg", ".ts", ".tsx", ".txt", ".xml"]);

async function textFiles(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await textFiles(path));
    else if (textExtensions.has(extname(entry.name))) output.push(path);
  }
  return output;
}

describe("Strumentini public rebrand", () => {
  it("keeps the old brand/domain out of public UI, SEO, copy and public assets", async () => {
    const files = [
      ...await textFiles(resolve(root, "src/pages")),
      ...await textFiles(resolve(root, "src/layouts")),
      ...await textFiles(resolve(root, "src/components")),
      ...await textFiles(resolve(root, "src/i18n")),
      ...await textFiles(resolve(root, "public")),
      resolve(root, "astro.config.mjs"),
    ];
    const leaks: string[] = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      if (forbidden.test(text)) leaks.push(file.slice(root.length + 1));
    }
    expect(leaks).toEqual([]);
  });

  it("uses Strumentini in the package, canonical site and public Cloudflare route", async () => {
    const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as { name?: unknown };
    const astro = await readFile(resolve(root, "astro.config.mjs"), "utf8");
    const wrangler = await readFile(resolve(root, "wrangler.jsonc"), "utf8");
    expect(packageJson.name).toBe("strumentini-it");
    expect(astro).toContain("https://strumentini.it");
    expect(wrangler).toContain('"pattern": "strumentini.it"');
  });

  it("uses the Strumentini domain in current quality schema identifiers", async () => {
    const schemaFiles = [
      "quality/functional-audit/schema.json",
      "quality/functional-audit/assignment-index.schema.json",
      "quality/functional-audit/inventory.schema.json",
    ];
    for (const file of schemaFiles) {
      const schema = JSON.parse(await readFile(resolve(root, file), "utf8")) as {
        $id?: unknown;
        title?: unknown;
      };
      expect(schema.$id).toEqual(expect.stringContaining("https://strumentini.it/"));
      expect(schema.$id).not.toMatch(forbidden);
      expect(schema.title).toEqual(expect.stringContaining("Strumentini.it"));
      expect(schema.title).not.toMatch(forbidden);
    }
  });
});
