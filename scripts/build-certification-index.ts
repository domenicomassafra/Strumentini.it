import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildCertificationIndex,
  renderCertificationIndex,
} from "../src/quality/certification";

const root = resolve(import.meta.dirname, "..");
const outputPath = "quality/receipts/expanded-catalog-certification.json";
const checkOnly = process.argv.includes("--check");
const index = await buildCertificationIndex(root);
const rendered = renderCertificationIndex(index);

if (checkOnly) {
  const existing = await readFile(resolve(root, outputPath), "utf8").catch(() => "");
  if (existing !== rendered) {
    console.error(`certification output is stale: ${outputPath}`);
    process.exitCode = 1;
  } else {
    console.log(`certification: ${index.catalogToolCount} tool(s), output current`);
  }
} else {
  await mkdir(resolve(root, "quality/receipts"), { recursive: true });
  await writeFile(resolve(root, outputPath), rendered, "utf8");
  console.log(`certification: ${index.catalogToolCount} tool(s), output generated`);
}
