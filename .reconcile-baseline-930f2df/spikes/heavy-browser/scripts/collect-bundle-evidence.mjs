import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repoRoot = path.resolve(root, "../..");
const distRoot = path.join(root, "dist-heavy-browser");
const outputDir = path.join(repoRoot, "quality/benchmarks/heavy-browser");
const targets = ["pdf-capabilities", "image-pipeline", "file-pipeline"];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const bundles = {};
for (const target of targets) {
  const dir = path.join(distRoot, target);
  const files = await walk(dir);
  const rows = [];
  let rawBytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const bytes = await fs.readFile(file);
    const gz = zlib.gzipSync(bytes, { level: 9 });
    rawBytes += bytes.byteLength;
    gzipBytes += gz.byteLength;
    rows.push({ file: path.relative(dir, file), rawBytes: bytes.byteLength, gzipBytes: gz.byteLength });
  }
  bundles[target] = { rawBytes, gzipBytes, files: rows.sort((a, b) => b.rawBytes - a.rawBytes) };
}

const artifact = { generatedAt: new Date().toISOString(), bundles };
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "bundle-sizes.json"), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify(artifact, null, 2));
