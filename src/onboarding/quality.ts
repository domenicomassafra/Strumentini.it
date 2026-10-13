import { validateGoldReceipts, type ToolCertificationReceipt } from "../release/validation";

export interface GoldToolQuality {
  readonly toolId: string;
  readonly status: "GOLD";
  readonly receiptPath: string;
  readonly oracleEntryIds: readonly string[];
  readonly fixtureFamilies: readonly string[];
  /** Only the source-bound generator may supply these proof bindings. */
  readonly sourceFingerprint?: string;
  readonly receiptSha256?: string;
}

export interface GoldQualityIndex {
  readonly schemaVersion: 1;
  readonly tools: readonly GoldToolQuality[];
}

export interface QualityIndexResult {
  readonly index: GoldQualityIndex;
  readonly excludedToolIds: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim() !== "");
}

function goldReceipt(value: unknown, catalogToolIds: ReadonlySet<string>): GoldToolQuality | undefined {
  if (!isRecord(value)) return undefined;
  if (value.schemaVersion !== 1 || value.status !== "GOLD" || value.goldEligible === false) return undefined;
  if (typeof value.toolId !== "string" || !catalogToolIds.has(value.toolId)) return undefined;
  if (typeof value.receiptPath !== "string" || value.receiptPath.trim() === "") return undefined;
  const oracleEntryIds = value.oracleEntryIds === undefined
    ? (typeof value.oracleEntryId === "string" ? [value.oracleEntryId] : undefined)
    : value.oracleEntryIds;
  if (!stringArray(oracleEntryIds) || oracleEntryIds.length === 0 || new Set(oracleEntryIds).size !== oracleEntryIds.length || oracleEntryIds.some((entry) => entry.trim() === "")) return undefined;
  const fixtureFamilies = value.fixtureFamilies;
  if (!stringArray(fixtureFamilies) || fixtureFamilies.length === 0 || new Set(fixtureFamilies).size !== fixtureFamilies.length) return undefined;
  return {
    toolId: value.toolId,
    status: "GOLD",
    receiptPath: value.receiptPath,
    oracleEntryIds: [...oracleEntryIds],
    fixtureFamilies,
  };
}

export function buildGoldQualityIndex(
  rawReceipts: readonly unknown[],
  catalogToolIds: readonly string[],
): QualityIndexResult {
  const catalog = new Set(catalogToolIds);
  const candidates = new Map<string, GoldToolQuality[]>();
  const excluded = new Set<string>();
  for (const raw of rawReceipts) {
    if (isRecord(raw) && typeof raw.toolId === "string" && catalog.has(raw.toolId)) excluded.add(raw.toolId);
    const receipt = goldReceipt(raw, catalog);
    if (receipt === undefined) continue;
    const current = candidates.get(receipt.toolId) ?? [];
    current.push(receipt);
    candidates.set(receipt.toolId, current);
  }
  const tools: GoldToolQuality[] = [];
  for (const toolId of [...candidates.keys()].sort()) {
    const receipts = candidates.get(toolId) ?? [];
    if (receipts.length !== 1) continue;
    const receipt = receipts[0]!;
    excluded.delete(toolId);
    tools.push({ ...receipt, oracleEntryIds: [...receipt.oracleEntryIds], fixtureFamilies: [...receipt.fixtureFamilies] });
  }
  return {
    index: { schemaVersion: 1, tools },
    excludedToolIds: [...excluded].sort(),
  };
}

/**
 * Public projection gate: the historical index builder above remains useful
 * for fixtures, but the shipped catalog MUST use this source-bound variant.
 * A Worker/D1-only edit changes the same global fingerprint as a frontend
 * edit, invalidating all source-wide (not per-route) Gold certifications.
 */
export function buildSourceBoundGoldQualityIndex(
  rawReceipts: readonly unknown[],
  catalogToolIds: readonly string[],
  currentSourceFingerprint: string,
): QualityIndexResult {
  const catalog = new Set(catalogToolIds);
  const accepted: GoldToolQuality[] = [];
  const excluded = new Set<string>();
  const byId = new Map<string, Record<string, unknown>[]>();
  for (const raw of rawReceipts) {
    if (!isRecord(raw) || typeof raw.toolId !== "string" || !catalog.has(raw.toolId)) continue;
    byId.set(raw.toolId, [...byId.get(raw.toolId) ?? [], raw]);
    excluded.add(raw.toolId);
  }
  const validSource = /^[a-f0-9]{64}$/u.test(currentSourceFingerprint);
  for (const [toolId, candidates] of byId) {
    if (!validSource || candidates.length !== 1) continue;
    const raw = candidates[0]!;
    const receipt = goldReceipt(raw, catalog);
    if (!receipt || raw.sourceFingerprint !== currentSourceFingerprint ||
        !/^[a-f0-9]{64}$/u.test(String(raw.receiptSha256 ?? "")) ||
        typeof raw.revision !== "string" || !/^[a-f0-9]{40}$/u.test(raw.revision)) continue;
    if (typeof raw.receiptPath !== "string" ||
        !/^quality\/receipts\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.json$/u.test(raw.receiptPath) ||
        raw.receiptPath.split("/").at(-1) !== `${toolId}.gold.json`) continue;
    const validatorResults = validateGoldReceipts(
      [{ id: toolId, route: `/tools/${toolId}` }],
      [raw as unknown as ToolCertificationReceipt],
      raw.revision,
      currentSourceFingerprint,
    );
    if (validatorResults.length > 0) continue;
    accepted.push({
      ...receipt,
      sourceFingerprint: currentSourceFingerprint,
      receiptSha256: raw.receiptSha256 as string,
    });
    excluded.delete(toolId);
  }
  return {
    index: { schemaVersion: 1, tools: accepted.sort((a, b) => a.toolId.localeCompare(b.toolId)) },
    excludedToolIds: [...excluded].sort(),
  };
}

export function renderGoldQualitySource(index: GoldQualityIndex): string {
  return `// AUTO-GENERATED by scripts/tool-factory/generate-catalog.ts. Do not edit.\n` +
    `import type { GoldQualityIndex } from "../onboarding/quality";\n\n` +
    `export const qualityIndex = ${JSON.stringify(index, null, 2)} as const satisfies GoldQualityIndex;\n`;
}

export function goldToolIds(index: GoldQualityIndex): ReadonlySet<string> {
  return new Set(index.tools.map(({ toolId }) => toolId));
}
