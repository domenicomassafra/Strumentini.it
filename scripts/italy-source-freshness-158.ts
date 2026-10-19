import { buildItalyFreshnessReport158, todayItaly158 } from "../src/reference-data/italy/freshness-158";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const check = args.includes("--check");
const dateFlag = args.indexOf("--as-of");
const asOf = dateFlag < 0 ? todayItaly158() : args[dateFlag + 1];
if (!asOf || args.filter((arg) => arg !== "--check" && arg !== "--as-of" && arg !== asOf).length > 0
  || (dateFlag >= 0 && (!args[dateFlag + 1] || args[dateFlag + 1] === "--check"))) {
  throw new Error("Usage: tsx scripts/italy-source-freshness-158.ts [--as-of YYYY-MM-DD] [--check]");
}
const report = buildItalyFreshnessReport158(asOf);
if (!check) console.log(JSON.stringify(report, null, 2));
else {
  const failures: string[] = [];
  const currentYear = Number(asOf.slice(0, 4));
  for (const consumer of report.consumers) {
    if (!consumer.source || !consumer.source.sourceUrl || !consumer.source.checkedAt
      || !consumer.source.owner || !consumer.source.nextReviewCondition) {
      failures.push(`MISSING_PROVENANCE: ${consumer.consumerId} (${consumer.datasetId})`);
    }
    if (!existsSync(resolve(process.cwd(), consumer.path))) {
      failures.push(`MISSING_CONSUMER: ${consumer.consumerId} (${consumer.path})`);
    }
  }
  const currentClaimDatasets = new Set(report.consumers
    .filter((consumer) => consumer.claim === "current-year").map((consumer) => consumer.datasetId));
  for (const datasetId of currentClaimDatasets) {
    const source = report.entries.find((entry) => entry.datasetId === datasetId && entry.latestSupportedYear !== null);
    if (!source || source.latestSupportedYear !== currentYear || source.status !== "CURRENT_BOUNDED") {
      failures.push(`CURRENT_CLAIM_BLOCKED: ${datasetId} ${currentYear} (${source?.status ?? "MISSING"})`);
    }
  }
  console.log(`Italy freshness #158 (${asOf}): ${report.entries.length} versioned records, ${report.consumers.length} audited consumers, ${report.warnings.length} warnings, ${failures.length} blocked current claims/inventory errors; no live-source fetch`);
  for (const warning of report.warnings) console.warn(`  REVIEW: ${warning}`);
  for (const failure of failures) console.error(`  FAIL: ${failure}`);
  if (failures.length) process.exitCode = 1;
}
