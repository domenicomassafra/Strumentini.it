import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const assetDir = resolve(root, "dist/_astro");
const files = (await readdir(assetDir)).filter((file) => file.endsWith(".js"));
const assets = await Promise.all(files.map(async (file) => ({
  file,
  text: await readFile(resolve(assetDir, file), "utf8"),
})));

function oneAsset(predicate: (text: string) => boolean, label: string) {
  const matches = assets.filter(({ text }) => predicate(text));
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one asset, found ${matches.map(({ file }) => file).join(", ")}`);
  const match = matches[0];
  if (match === undefined) throw new Error(`${label}: asset absent`);
  return match;
}

function importedJs(text: string): string[] {
  return [...text.matchAll(/from["']\.\/([^"']+\.js)["']/gu)].map((match) => match[1] ?? "");
}

const listModule = oneAsset((text) => text.includes("leftDeduped") && text.includes("engineVersion"), "list compare dynamic module");
const diffModule = oneAsset((text) => text.includes("INVALID_DIFF_TOO_LARGE") && text.includes("engineVersion"), "text diff dynamic module");
const listImports = new Set(importedJs(listModule.text));
const sharedImports = importedJs(diffModule.text).filter((file) => listImports.has(file));
if (sharedImports.length !== 1) {
  throw new Error(`text-list shared chunk: expected one common dynamic-module import, found ${sharedImports.join(", ")}`);
}
const sharedFile = sharedImports[0];
if (sharedFile === undefined) throw new Error("text-list shared chunk absent");
const sharedAsset = assets.find(({ file }) => file === sharedFile);
if (sharedAsset === undefined) throw new Error(`text-list shared chunk missing from assets: ${sharedFile}`);
if (!sharedAsset.text.includes("DIFF_TOO_LARGE") || !sharedAsset.text.includes("trim-nfc") || !sharedAsset.text.includes("text-list-v1")) {
  throw new Error(`shared text-list chunk does not contain the expected promoted primitives: ${sharedFile}`);
}

const researchModule = oneAsset(
  (text) => text.includes("invalid DOI syntax") && text.includes("check digit mismatch") && text.includes("research-reference-v1"),
  "research-reference dynamic module",
);

const routePages = [
  "tools/list-compare/index.html",
  "tools/text-diff/index.html",
  "tools/doi-isbn-normalizer/index.html",
];
const eagerReferences: Array<{ page: string; file: string }> = [];
for (const page of routePages) {
  const html = await readFile(resolve(root, "dist", page), "utf8");
  const initialScripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/gu)].map((match) => basename(match[1] ?? ""));
  for (const file of [sharedAsset.file, listModule.file, diffModule.file, researchModule.file]) {
    if (initialScripts.includes(file)) eagerReferences.push({ page, file });
  }
}
if (eagerReferences.length > 0) {
  throw new Error(`Ticket 08 implementation chunk is eagerly referenced: ${JSON.stringify(eagerReferences)}`);
}

const receipt = {
  schemaVersion: 1,
  status: "PASS",
  proof: "list-compare and text-diff dynamic modules import one identical text-list engine chunk",
  listCompareModule: listModule.file,
  textDiffModule: diffModule.file,
  sharedTextListChunk: sharedAsset.file,
  researchReferenceModule: researchModule.file,
  sharedChunkContains: ["trim-nfc equality", "DIFF_TOO_LARGE guard", "text-list-v1 engine identity"],
  eagerReferences,
  routesChecked: routePages,
};
const receiptDir = resolve(root, "quality/receipts/text-research");
await mkdir(receiptDir, { recursive: true });
await writeFile(resolve(receiptDir, "bundle-reuse.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(`text/research bundle PASS: ${listModule.file} + ${diffModule.file} share ${sharedAsset.file}; lazy on all 3 routes`);
