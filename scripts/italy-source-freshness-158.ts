import { buildItalyFreshnessReport158 } from "../src/reference-data/italy/freshness-158";

const args = process.argv.slice(2);
const check = args.includes("--check");
const dateFlag = args.indexOf("--as-of");
const asOf = dateFlag < 0 ? new Date().toISOString().slice(0, 10) : args[dateFlag + 1];
if (!asOf || args.filter((arg) => arg !== "--check" && arg !== "--as-of" && arg !== asOf).length > 0
  || (dateFlag >= 0 && (!args[dateFlag + 1] || args[dateFlag + 1] === "--check"))) {
  throw new Error("Usage: tsx scripts/italy-source-freshness-158.ts [--as-of YYYY-MM-DD] [--check]");
}
const report = buildItalyFreshnessReport158(asOf);
if (!check) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Italy freshness #158 (${asOf}): ${report.entries.length} versioned records, ${report.warnings.length} historical/blocked/not-yet-verified scopes; no live-source fetch`);
  for (const warning of report.warnings) console.warn(`  REVIEW: ${warning}`);
}
