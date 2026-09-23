import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildPhysicalImageReceipt, type PhysicalImageTarget } from "./lib/image-resize-physical";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : process.argv[index + 1];
}

function required(name: string): string {
  const value = argument(name)?.trim();
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function dimensions(name: string): [number, number] {
  const value = required(name);
  const match = /^(\d+)x(\d+)$/iu.exec(value);
  if (match === null) throw new Error(`--${name} must use WIDTHxHEIGHT, for example 4032x3024`);
  return [Number(match[1]), Number(match[2])];
}

const target = required("target") as PhysicalImageTarget;
if (target !== "ios-safari" && target !== "android-chrome") {
  throw new Error("--target must be ios-safari or android-chrome");
}
const [sourceWidth, sourceHeight] = dimensions("source");
const [outputWidth, outputHeight] = dimensions("output");
const observedAt = argument("observed-at");
const notes = argument("notes");
const passFlags = ["files-photos-pass", "resize-pass", "download-pass", "no-crash-pass", "layout-pass"];
const missingPassFlags = passFlags.filter((flag) => !hasFlag(flag));
if (missingPassFlags.length > 0) {
  throw new Error(`refusing to record PASS without explicit physical observations: ${missingPassFlags.map((flag) => `--${flag}`).join(", ")}`);
}

const receipt = buildPhysicalImageReceipt({
  target,
  device: required("device"),
  browser: required("browser"),
  sourceWidth,
  sourceHeight,
  outputWidth,
  outputHeight,
  checks: {
    filesOrPhotosPicker: "PASS",
    resizeCompleted: "PASS",
    verifiedDownloadOpened: "PASS",
    noCrashOrReload: "PASS",
    mobileLayoutUsable: "PASS",
  },
  ...(observedAt === undefined ? {} : { observedAt }),
  ...(notes === undefined ? {} : { notes }),
});

const root = resolve(import.meta.dirname, "..");
const filename = target === "ios-safari" ? "ios-safari-physical.json" : "android-chrome-physical.json";
const path = resolve(root, "quality/receipts/image-resize", filename);
if (hasFlag("dry-run")) {
  console.log("Physical image receipt validation PASS (dry-run; no file written)");
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(0);
}
await mkdir(resolve(root, "quality/receipts/image-resize"), { recursive: true });
await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(`Physical image receipt PASS recorded: ${path}`);
console.log(`source=${receipt.source.width}x${receipt.source.height} (${receipt.maxSourcePixelsTested} px)`);
console.log(`estimated decoded working set tested=${receipt.maxEstimatedDecodedBytesTested} bytes`);
