/** STR-409 compiled fiscal consumer and annual rollover gate.
 * Reuse local Chromium acceptance, with an optional explicit CDP endpoint.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

await import("./italy-annual-sources-117.browser.mjs");
await import("./regroom-str-409.browser.mjs");

const review = (asOf) => {
  const result = spawnSync("npx", ["tsx", "scripts/italy-annual-source-review-117.ts",
    "--as-of", asOf, "--check", "--json"], {
    encoding: "utf8", timeout: 60_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return { status: result.status, data: JSON.parse(result.stdout) };
};

const current = review("2026-10-21");
assert.equal(current.status, 0, "2026 annual official-source gate");
assert.equal(current.data.ok, true);
const janFirst = review("2027-01-01");
assert.equal(janFirst.status, 1, "2027 rollover must fail closed");
assert.equal(janFirst.data.ok, false);
assert(janFirst.data.blockedClaims.includes("national-irpef-gross-subset:2027"));
console.log("STR-409 consumer PASS: compiled page owner, change log and IRPEF historical outputs; Jan 1 2027 NO_GO from official-source gate, input unchanged");
