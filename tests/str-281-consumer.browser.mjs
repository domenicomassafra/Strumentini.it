/**
 * STR-281: replay the existing mobile WebKit acceptance on the compiled dist.
 * Bounded execution prevents another silent browser newPage hang; failure is not a PASS.
 * Native Files/Photos and Share sheet remain explicitly outside this macOS simulation.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { IOS281_ROUTES, validateIosSafariSim281 } from "../scripts/lib/ios-safari-sim-281.ts";

const root = resolve(import.meta.dirname, "..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const scratch = await mkdtemp(join(tmpdir(), "str281-consumer-"));
const receiptPath = join(scratch, "ios-safari.json");

function run(label, argumentsList, options = {}) {
  try {
    const output = execFileSync(process.execPath, argumentsList, {
      cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 128 * 1024,
      ...options,
    });
    console.log(`${label}: exit 0`);
    return output;
  } catch (error) {
    const detail = [error.message, error.stdout?.toString(), error.stderr?.toString()].filter(Boolean).join("\n");
    throw new Error(`${label}: no consumer acceptance PASS (${detail.slice(0, 3000)})`, { cause: error });
  }
}

try {
  run("image fixture generation", ["--import", "tsx", "scripts/generate-image-resize-physical-fixtures.ts"]);
  run("compiled WebKit heavy routes", ["scripts/acceptance-ios-safari-sim-281.mjs"], {
    env: { ...process.env, IOS281_RECEIPT: receiptPath },
  });
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.deepEqual(validateIosSafariSim281(receipt), [], "independent receipt validator");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  assert.equal(receipt.build.revision, head, "receipt must identify the consumer source");
  for (const route of IOS281_ROUTES) {
    const compiledHtml = await readFile(resolve(root, "dist", route.slice(1), "index.html"));
    assert.equal(receipt.build.pages[route], sha(compiledHtml), `${route}: stale compiled page fingerprint`);
    const result = receipt.routes.find((entry) => entry.route === route);
    assert.equal(result.status, "PASS", `${route}: complete and real browser processing required`);
    assert.equal(result.download.reopenedIndependently, "PASS", `${route}: download must reopen`);
    assert.equal(result.share.status, "NOT_RUN", "native share must not be invented");
  }
  assert.equal(receipt.build.fingerprintSha256, sha(JSON.stringify(receipt.build.pages)));
  console.log(`PASS STR-281 compiled WebKit consumer: ${receipt.routes.length}/${IOS281_ROUTES.length} routes, exact source/HTML fingerprints, local Blob/download reopened, picker/cancel/retry, share NOT_RUN, browser heap estimated only`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
