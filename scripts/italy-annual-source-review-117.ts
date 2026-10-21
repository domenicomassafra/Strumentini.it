/**
 * #117 annual official fiscal source review.
 *
 * Runs on a schedule and before publishing. `--check` exits 1 when a dataset
 * that advertises a current-year calculation has no checked official snapshot
 * for the current year, so the annual refresh becomes a tracked task instead of
 * a silent assumption. It never fetches the network and never writes tax values.
 */
import {
  ANNUAL_FISCAL_SOURCE_ROWS_117,
  buildAnnualFiscalSourceReview117,
} from "../src/reference-data/italy/annual-source-registry-117";
import { todayItaly158 } from "../src/reference-data/italy/freshness-158";

const args = process.argv.slice(2);
const check = args.includes("--check");
const json = args.includes("--json");
const dateFlag = args.indexOf("--as-of");
const asOf = dateFlag < 0 ? todayItaly158() : args[dateFlag + 1];
const known = new Set(["--check", "--json", "--as-of", asOf]);
if (!asOf || args.some((arg) => !known.has(arg)) || (dateFlag >= 0 && asOf.startsWith("--"))) {
  throw new Error("Usage: tsx scripts/italy-annual-source-review-117.ts [--as-of YYYY-MM-DD] [--check] [--json]");
}

const review = buildAnnualFiscalSourceReview117(asOf);
if (json) {
  console.log(JSON.stringify(review, null, 2));
} else {
  console.log(`Fonti fiscali annuali #117 (${asOf}): ${ANNUAL_FISCAL_SOURCE_ROWS_117.length} snapshot ufficiali, ` +
    `${review.currentYearDatasets.length} dataset con claim anno corrente, ${review.blockedClaims.length} bloccati; ` +
    `prossima revisione ${review.nextAnnualReviewAt}; nessuna richiesta di rete`);
  for (const datasetId of review.currentYearCovered) console.log(`  OK: ${datasetId} ${review.currentYear}`);
  for (const blocked of review.blockedClaims) console.error(`  STALE: ${blocked}`);
  for (const warning of review.warnings) console.warn(`  HISTORICAL: ${warning}`);
}
if (check && !review.ok) process.exitCode = 1;
