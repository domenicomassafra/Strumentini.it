import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const outputDir = path.join(repoRoot, "quality/benchmarks/heavy-local-feasibility");
const dist = path.join(root, "dist");
const manifest = JSON.parse(await readFile(path.join(dist, ".vite/manifest.json"), "utf8"));

const packageIds = new Map([
  ["libheif-js", "libheif-js"],
  ["tesseract.js", "tesseract-js"],
  ["xlsx", "xlsx"],
  ["mammoth", "mammoth"],
  ["docx/dist", "docx"],
  ["docx-preview", "docx-preview"],
  ["pptxgenjs", "pptxgenjs"],
  ["@cantoo/pdf-lib", "cantoo-pdf-lib"],
  ["pdfjs-dist/build/pdf.mjs", "pdfjs-dist"],
  ["mediabunny", "mediabunny"],
  ["mp4box", "mp4box"],
  ["pkijs", "pkijs-cms"],
  ["fflate", "fflate"],
]);

async function sizeOf(file) {
  const bytes = await readFile(path.join(dist, file));
  return { rawBytes: bytes.byteLength, gzipBytes: gzipSync(bytes, { level: 9 }).byteLength };
}

const chunks = [];
for (const [key, entry] of Object.entries(manifest)) {
  if (!entry.file) continue;
  const sizes = await sizeOf(entry.file);
  chunks.push({ key, src: entry.src ?? null, file: entry.file, dynamic: entry.isDynamicEntry === true, ...sizes });
}

const candidates = [];
for (const chunk of chunks) {
  const source = chunk.src ?? chunk.key;
  for (const [needle, id] of packageIds) {
    if (!source.includes(needle)) continue;
    const manifestEntry = manifest[chunk.key];
    const importFiles = (manifestEntry.imports ?? []).map((dependencyKey) => manifest[dependencyKey]?.file).filter(Boolean);
    const imported = [];
    for (const file of importFiles) imported.push({ file, ...(await sizeOf(file)) });
    const assets = [];
    const candidateAssets = [...(manifestEntry.assets ?? [])];
    if (id === "pdfjs-dist") {
      for (const file of manifest["index.html"]?.assets ?? []) {
        if (/pdf\.worker/u.test(file) && !candidateAssets.includes(file)) candidateAssets.push(file);
      }
    }
    for (const file of candidateAssets) assets.push({ file, ...(await sizeOf(file)) });
    candidates.push({
      id,
      entry: { file: chunk.file, rawBytes: chunk.rawBytes, gzipBytes: chunk.gzipBytes },
      imported,
      assets,
      lazyRawBytes: chunk.rawBytes + imported.reduce((sum, item) => sum + item.rawBytes, 0) + assets.reduce((sum, item) => sum + item.rawBytes, 0),
      lazyGzipBytes: chunk.gzipBytes + imported.reduce((sum, item) => sum + item.gzipBytes, 0) + assets.reduce((sum, item) => sum + item.gzipBytes, 0),
    });
    break;
  }
}

const entry = manifest["index.html"];
const entryFiles = [entry.file, ...(entry.imports ?? []).map((key) => manifest[key]?.file).filter(Boolean)];
const initial = [];
for (const file of entryFiles) initial.push({ file, ...(await sizeOf(file)) });

async function collectFiles(dir, prefix = "") {
  const items = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) items.push(...await collectFiles(absolute, relative));
    else if (entry.isFile()) {
      const bytes = await readFile(absolute);
      items.push({ file: relative.split(path.sep).join("/"), rawBytes: bytes.byteLength, gzipBytes: gzipSync(bytes, { level: 9 }).byteLength });
    }
  }
  return items;
}

const tesseractRuntimeAssets = await collectFiles(path.join(dist, "tesseract"));

const receipt = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  method: "Vite 8.3 production build; gzip level 9 over emitted bytes. lazy totals include direct emitted imports/assets, not runtime-fetched OCR language/core assets.",
  initial: {
    files: initial,
    rawBytes: initial.reduce((sum, item) => sum + item.rawBytes, 0),
    gzipBytes: initial.reduce((sum, item) => sum + item.gzipBytes, 0),
  },
  runtimeAssetGroups: {
    tesseract: {
      note: "Tesseract chooses a compatible core variant at runtime; these are all locally served worker/core/language assets available to the spike, not one-request transfer size.",
      files: tesseractRuntimeAssets,
      rawBytes: tesseractRuntimeAssets.reduce((sum, item) => sum + item.rawBytes, 0),
      gzipBytes: tesseractRuntimeAssets.reduce((sum, item) => sum + item.gzipBytes, 0),
    },
  },
  candidates,
  chunks,
};
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "bundle-sizes.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ initial: receipt.initial, candidates: candidates.map(({ id, lazyRawBytes, lazyGzipBytes }) => ({ id, lazyRawBytes, lazyGzipBytes })) }, null, 2));
