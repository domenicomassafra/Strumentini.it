import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const assetsDir = resolve(root, "dist/_astro");
const files = (await readdir(assetsDir)).filter((file) => file.endsWith(".js"));
const papaChunks: string[] = [];

for (const file of files) {
  const text = await readFile(resolve(assetsDir, file), "utf8");
  if (text.includes("MissingQuotes") || text.includes("Papa Parse") || text.includes("papaparse")) papaChunks.push(file);
}

if (papaChunks.length === 0) throw new Error("Papa Parse production chunk not found");

const csvHtml = await readFile(resolve(root, "dist/tools/csv-cleaner/index.html"), "utf8");
const businessDayHtml = await readFile(resolve(root, "dist/tools/business-day/index.html"), "utf8");
const leaks = papaChunks.filter((chunk) => businessDayHtml.includes(chunk));
if (leaks.length > 0) throw new Error(`Papa Parse leaked into unrelated Business Day route: ${leaks.join(", ")}`);

await mkdir(resolve(root, "quality/receipts/csv-cleaner"), { recursive: true });
await writeFile(
  resolve(root, "quality/receipts/csv-cleaner/bundle.json"),
  `${JSON.stringify({
    schemaVersion: 1,
    status: "PASS",
    papaChunks,
    csvRouteReferencesToolUi: /CsvCleanerTool\.[^"']+\.js/u.test(csvHtml),
    unrelatedBusinessDayReferencesPapa: false,
  }, null, 2)}\n`,
);
console.log(`CSV bundle PASS: Papa confined to ${papaChunks.join(", ")}; no Business Day reference`);
