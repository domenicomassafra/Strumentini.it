import { basename, resolve } from "node:path";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";

const root = resolve(import.meta.dirname, "../..");
const pagePath = resolve(root, "dist/tools/image-resize/index.html");
const assetDir = resolve(root, "dist/_astro");
const marker = "OUTPUT_VALIDATION_FAILED";

const page = await readFile(pagePath, "utf8");
const assets = (await readdir(assetDir)).filter((file) => file.endsWith(".js"));
const js = await Promise.all(
  assets.map(async (file) => ({
    file,
    bytes: (await stat(resolve(assetDir, file))).size,
    text: await readFile(resolve(assetDir, file), "utf8"),
  })),
);

const implementationChunks = js.filter((entry) => entry.text.includes(marker));
if (implementationChunks.length === 0) {
  throw new Error("No Image Resize implementation chunk found in build");
}

const initialAssets = new Set([
  ...[...page.matchAll(/<script[^>]+src="([^"]+)"/gu)].map((match) => basename(match[1] ?? "")),
  ...[...page.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/gu)].map((match) => basename(match[1] ?? "")),
]);
const eagerImplementation = implementationChunks.filter((entry) => initialAssets.has(entry.file));
if (eagerImplementation.length > 0) {
  throw new Error(
    `Image Resize implementation is eager: ${eagerImplementation.map((entry) => entry.file).join(", ")}`,
  );
}

const receipt = {
  schemaVersion: 1,
  page: "tools/image-resize/index.html",
  htmlBytes: Buffer.byteLength(page),
  initialAssets: [...initialAssets].sort(),
  implementationChunks: implementationChunks.map(({ file, bytes }) => ({ file, bytes })),
  implementationEager: false,
};

await mkdir(resolve(root, "quality/receipts/image-resize"), { recursive: true });
await writeFile(
  resolve(root, "quality/receipts/image-resize/bundle.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);
console.log(
  `Image Resize bundle PASS: ${implementationChunks.length} lazy implementation chunk(s), none referenced by initial HTML`,
);
