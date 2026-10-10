import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_HIGH_PRIORITY_FORMAT_OPERATION_IDS,
  validateFormatOperationRegistry,
  type FormatOperationRow,
} from "../src/quality/format-operations";

const root = fileURLToPath(new URL("../", import.meta.url));
const registryPath = resolve(root, "quality/format-operations/registry.json");
const coveragePath = resolve(root, "quality/format-operations/coverage.json");
const reportPath = resolve(root, "quality/format-operations/coverage-report.json");
const binaryReceiptPath = resolve(root, "quality/format-operations/conversion-output-proof.json");

export interface ImplementationProof65 {
  readonly ids: readonly string[];
  readonly engine: string;
  readonly route?: string;
  readonly exposure?: "engine-only";
  readonly test: string;
  readonly checks: readonly string[];
}

export interface FormatCoverage65 {
  readonly schemaVersion: number;
  readonly implementationEvidence: readonly ImplementationProof65[];
  readonly releaseRestrictions?: Readonly<Record<string, string>>;
}

export interface FormatCoverageRecord65 {
  readonly id: string;
  readonly classification: "IMPLEMENTED" | "BLOCKED" | "REFUSED";
  readonly fidelity: string;
  readonly engine?: string;
  readonly route?: string;
  readonly exposure?: "engine-only";
  readonly proof?: string;
  readonly checks?: readonly string[];
  readonly blocker?: string;
  readonly reason?: string;
  /** Functional browser support is separate from device/source release approval. */
  readonly releaseEligible?: false;
  readonly releaseReason?: string;
  readonly source: string;
}

export interface FormatCoverageReport65 {
  readonly schemaVersion: 1;
  readonly source: string;
  readonly total: number;
  readonly counts: { readonly IMPLEMENTED: number; readonly BLOCKED: number; readonly REFUSED: number };
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly rows: readonly FormatCoverageRecord65[];
}

/** A browser receipt is admissible only when every claimed direction is represented
 * by actual output bytes, a matching binary signature and a successful reopen. */
export function validateConversionOutputProof65(
  raw: unknown, coverage: FormatCoverage65, rows: readonly FormatOperationRow[],
): readonly string[] {
  const issues: string[] = [];
  if (!raw || typeof raw !== "object") return ["Missing conversion browser proof payload"];
  const receipt = raw as Record<string, unknown>;
  if (receipt.schemaVersion !== 1 || receipt.gate !== "65" || receipt.browser !== "chromium" ||
    receipt.status !== "PASS" || receipt.locality !== "zero off-origin requests") {
    issues.push("Conversion proof lacks successful current local-browser acceptance metadata");
  }
  if (!Array.isArray(receipt.directions)) return [...issues, "Conversion proof directions are missing"];
  const expectedIds = coverage.implementationEvidence
    .filter((proof) => proof.engine === "src/engines/image/visual-tools.ts" ||
      proof.engine === "src/tools/images-to-pdf/module.ts" || proof.engine === "src/tools/pdf-to-images/module.ts")
    .flatMap((proof) => proof.ids);
  const eligible = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  for (const [i, rawDirection] of receipt.directions.entries()) {
    if (!rawDirection || typeof rawDirection !== "object") { issues.push(`direction[${i}] invalid`); continue; }
    const value = rawDirection as Record<string, unknown>;
    const id = String(value.id ?? "");
    const mime = String(value.mime ?? "");
    const row = eligible.get(id);
    if (!expectedIds.includes(id) || row?.state !== "IMPLEMENT" || !row.outputFormats.includes(mime)) {
      issues.push(`direction[${i}] unsupported advertised conversion: ${id}/${mime}`);
      continue;
    }
    const key = `${id}/${mime}`;
    if (seen.has(key)) issues.push(`Duplicate conversion binary evidence: ${key}`);
    seen.add(key);
    if (!Number.isSafeInteger(value.inputBytes) || (value.inputBytes as number) <= 0 ||
      !Number.isSafeInteger(value.outputBytes) || (value.outputBytes as number) <= 0) {
      issues.push(`${key}: missing real before/after bytes`);
    }
    const signature = value.signature;
    if (!Array.isArray(signature) || signature.length < 8 || signature.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      issues.push(`${key}: invalid output signature`);
    } else {
      const head = signature as number[];
      const ascii = (start: number, length: number) => String.fromCharCode(...head.slice(start, start + length));
      const valid = mime === "image/png" ? head.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
        : mime === "image/jpeg" ? head[0] === 255 && head[1] === 216 && head[2] === 255
        : mime === "image/webp" ? ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP"
        : mime === "application/pdf" ? ascii(0, 5) === "%PDF-" : false;
      if (!valid) issues.push(`${key}: output signature/MIME mismatch`);
    }
    const reopen = value.reopen as Record<string, unknown> | undefined;
    if (!reopen || (mime === "application/pdf"
      ? reopen.method !== "PDF parser" || !Number.isInteger(reopen.pageCount) || (reopen.pageCount as number) < 1
      : reopen.method !== "browser createImageBitmap" || !Number.isInteger(reopen.width) || !Number.isInteger(reopen.height) ||
        (reopen.width as number) <= 0 || (reopen.height as number) <= 0)) issues.push(`${key}: independent reopen absent`);
    if (id === "convert-gif-static-raster" && value.framePolicy !== "first-frame-only") issues.push(`${key}: GIF animation-loss statement absent`);
  }
  for (const id of expectedIds) {
    const row = eligible.get(id);
    // Multi-page ZIP is a packaging option, not a single-page raster direction;
    // the separate browser matrix validates ZIP entry counts and reopening.
    for (const mime of row?.outputFormats ?? []) if (mime !== "application/zip" && !seen.has(`${id}/${mime}`)) issues.push(`Missing browser conversion binary evidence: ${id}/${mime}`);
  }
  return issues;
}

const supportedChecks = new Set(["signature", "reopen", "fidelity", "actual-bytes", "target"]);
const safeRelative = (value: string) =>
  !value.startsWith("/") && !value.includes("\\") && value.split("/").every((part) => part !== ".." && part !== "." && part !== "");

/** Only user-facing route files are accepted as advertised routes; engine-only paths are explicit. */
export function auditFormatOperationCoverage65(
  rawRows: readonly unknown[],
  coverage: FormatCoverage65,
  hasFile: (path: string) => boolean,
  required: readonly string[] = REQUIRED_HIGH_PRIORITY_FORMAT_OPERATION_IDS,
): FormatCoverageReport65 {
  const registry = validateFormatOperationRegistry(rawRows, required);
  const errors = [...registry.issues];
  const byId = new Map<string, ImplementationProof65>();
  const physicalHeicIds = ["convert-heic-jpeg", "convert-heic-png", "convert-heic-webp", "convert-heic-pdf"];
  for (const id of physicalHeicIds) {
    if (typeof coverage.releaseRestrictions?.[id] !== "string" || !coverage.releaseRestrictions[id]!.includes("#280/#281")) {
      errors.push(`${id}: missing HEIC authenticity/device promotion restriction`);
    }
  }
  for (const id of Object.keys(coverage.releaseRestrictions ?? {})) {
    if (!required.includes(id)) errors.push(`Unknown release restriction: ${id}`);
  }
  if (coverage.schemaVersion !== 1 || !Array.isArray(coverage.implementationEvidence)) {
    errors.push("Invalid format-operation implementation evidence schema.");
  } else for (const [index, proof] of coverage.implementationEvidence.entries()) {
    if (!Array.isArray(proof.ids) || proof.ids.length === 0) {
      errors.push(`proof[${index}]: missing operation IDs`);
      continue;
    }
    for (const id of proof.ids) {
      if (byId.has(id)) errors.push(`duplicate implementation proof: ${id}`);
      byId.set(id, proof);
    }
    if (typeof proof.engine !== "string" || !safeRelative(proof.engine) || !proof.engine.startsWith("src/") || !hasFile(proof.engine)) {
      errors.push(`proof[${index}]: missing or invalid engine file`);
    }
    if (typeof proof.test !== "string" || !safeRelative(proof.test) || !/^(tests|scripts)\//u.test(proof.test) || !hasFile(proof.test)) {
      errors.push(`proof[${index}]: missing or invalid executable test source`);
    }
    if (proof.route === undefined) {
      if (proof.exposure !== "engine-only") errors.push(`proof[${index}]: no public route and no explicit engine-only disclosure`);
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(proof.route) || !hasFile(`src/pages/tools/${proof.route}.astro`) || proof.exposure !== undefined) {
      errors.push(`proof[${index}]: nonexistent route or conflicting exposure`);
    }
    if (!Array.isArray(proof.checks) || proof.checks.some((check: string) => !supportedChecks.has(check))) {
      errors.push(`proof[${index}]: unsupported or missing verification checks`);
    }
  }

  const output: FormatCoverageRecord65[] = [];
  for (const row of registry.rows) {
    const proof = byId.get(row.id);
    if (row.state === "IMPLEMENT") {
      if (!proof) errors.push(`IMPLEMENT row missing runnable route/engine proof: ${row.id}`);
      else {
        const obligatory = row.operation === "compress" || row.operation === "optimize" || row.operation === "package"
          ? ["actual-bytes", "fidelity"]
          : ["signature", "reopen", "fidelity"];
        if (row.id.includes("target-size")) obligatory.push("target");
        for (const check of obligatory) if (!proof.checks.includes(check)) errors.push(`${row.id}: missing ${check} verification contract`);
      }
      output.push({ id: row.id, classification: "IMPLEMENTED", source: row.source, fidelity: row.fidelity,
        ...(proof ? { engine: proof.engine, ...(proof.route ? { route: `/tools/${proof.route}/` } : { exposure: "engine-only" as const }),
          proof: proof.test, checks: proof.checks } : {}),
        ...(coverage.releaseRestrictions?.[row.id] ? { releaseEligible: false as const, releaseReason: coverage.releaseRestrictions[row.id] } : {}) });
    } else if (row.state === "SPIKE") {
      if (!row.ticket || !safeRelative(row.ticket) || !hasFile(row.ticket)) errors.push(`BLOCKED row missing source decision: ${row.id}`);
      if (proof) errors.push(`non-implemented row advertises implementation evidence: ${row.id}`);
      output.push({ id: row.id, classification: "BLOCKED", source: row.source, fidelity: row.fidelity,
        ...(row.ticket ? { blocker: row.ticket } : {}), reason: row.fidelity });
    } else {
      if (!row.reason?.trim() || (!row.ticket && !row.source)) errors.push(`REFUSED row missing source and reason: ${row.id}`);
      if (row.ticket && (!safeRelative(row.ticket) || !hasFile(row.ticket))) errors.push(`REFUSED row has no source decision file: ${row.id}`);
      if (proof) errors.push(`refused row advertises implementation evidence: ${row.id}`);
      output.push({ id: row.id, classification: "REFUSED", source: row.source, fidelity: row.fidelity, reason: row.reason ?? "" });
    }
  }
  for (const id of byId.keys()) if (!registry.rows.some((row) => row.id === id)) errors.push(`orphan implementation proof: ${id}`);
  const counts = { IMPLEMENTED: 0, BLOCKED: 0, REFUSED: 0 };
  for (const row of output) counts[row.classification]++;
  return { schemaVersion: 1, source: "docs/11-format-operation-matrix.md", total: output.length,
    counts, ok: errors.length === 0, errors, rows: output };
}

export function loadFormatCoverage65(): FormatCoverageReport65 {
  const raw = JSON.parse(readFileSync(registryPath, "utf8")) as unknown[];
  const coverage = JSON.parse(readFileSync(coveragePath, "utf8")) as FormatCoverage65;
  const base = auditFormatOperationCoverage65(raw, coverage, (path) => existsSync(resolve(root, path)));
  const binary = existsSync(binaryReceiptPath) ? JSON.parse(readFileSync(binaryReceiptPath, "utf8")) : null;
  const parsedRows = validateFormatOperationRegistry(raw).rows;
  const errors = [...base.errors, ...validateConversionOutputProof65(binary, coverage, parsedRows)];
  return { ...base, ok: errors.length === 0, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = loadFormatCoverage65();
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--write")) writeFileSync(reportPath, serialized);
  if (process.argv.includes("--check") && (!existsSync(reportPath) || readFileSync(reportPath, "utf8") !== serialized)) {
    report.errors.forEach((error) => console.error(error));
    console.error("Format-operation coverage report stale or missing; run --write and review source claims.");
    process.exitCode = 1;
  }
  if (!report.ok) {
    report.errors.forEach((error) => console.error(error));
    process.exitCode = 1;
  }
  console.log(JSON.stringify({ ok: report.ok, counts: report.counts, errors: report.errors.length }));
}
