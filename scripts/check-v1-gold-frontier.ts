import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { catalog } from "../src/generated/catalog";

const root = resolve(import.meta.dirname, "..");
const receiptRoot = resolve(root, "quality/receipts");
const expectedToolCount = 15;
const v1ToolIds = new Set([
  "business-day",
  "campaign-name",
  "csv-cleaner",
  "csv-column-map",
  "csv-dedupe",
  "doi-isbn-normalizer",
  "file-hash",
  "image-resize",
  "list-compare",
  "margin-markup",
  "rate-converter",
  "text-diff",
  "timezone-overlap",
  "tracking-cleaner",
  "utm-builder",
]);

async function jsonFiles(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...await jsonFiles(child));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(child);
  }
  return files;
}

type ToolReceipt = {
  path: string;
  toolId: string;
  status: string;
  goldEligible?: boolean;
};

const toolReceipts: ToolReceipt[] = [];
for (const path of await jsonFiles(receiptRoot)) {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    continue;
  }
  if (typeof value !== "object" || value === null) continue;
  const record = value as Record<string, unknown>;
  if (typeof record.toolId !== "string" || typeof record.status !== "string") continue;
  toolReceipts.push({
    path,
    toolId: record.toolId,
    status: record.status,
    ...(typeof record.goldEligible === "boolean" ? { goldEligible: record.goldEligible } : {}),
  });
}

const v1Catalog = catalog.filter((tool) => v1ToolIds.has(tool.id));
const expansionCatalog = catalog.filter((tool) => !v1ToolIds.has(tool.id));
if (v1Catalog.length !== expectedToolCount) {
  throw new Error(`V1 catalog must contain exactly ${expectedToolCount} tools before Ticket 11; found ${v1Catalog.length}`);
}

const tools = v1Catalog.map((tool) => {
  const candidates = toolReceipts.filter((receipt) => receipt.toolId === tool.id);
  if (candidates.length !== 1) {
    throw new Error(`${tool.id}: expected exactly one tool certification receipt, found ${candidates.length}`);
  }
  const receipt = candidates[0]!;
  const gold = receipt.status === "GOLD" && receipt.goldEligible !== false;
  return {
    toolId: tool.id,
    name: tool.name,
    status: receipt.status,
    gold,
    receipt: relative(root, receipt.path),
  };
});

const goldCount = tools.filter((tool) => tool.gold).length;
const blocked = tools.filter((tool) => !tool.gold);
const report = {
  schemaVersion: 1,
  expectedToolCount,
  catalogToolCount: catalog.length,
  expansionToolCount: expansionCatalog.length,
  goldCount,
  blockedCount: blocked.length,
  readyForTicket11: goldCount === expectedToolCount,
  tools,
  blockers: blocked.map((tool) => ({ toolId: tool.toolId, status: tool.status, receipt: tool.receipt })),
};

await mkdir(receiptRoot, { recursive: true });
await writeFile(resolve(receiptRoot, "v1-gold-frontier.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (report.readyForTicket11) {
  console.log(`V1 Gold frontier PASS: ${goldCount}/${expectedToolCount}; Ticket 11 is unblocked by tool certification.`);
} else {
  console.log(`V1 Gold frontier BLOCKED: ${goldCount}/${expectedToolCount}; ${blocked.map((tool) => `${tool.toolId}=${tool.status}`).join(", ")}`);
}

if (process.argv.includes("--require-all-gold") && !report.readyForTicket11) process.exit(1);
