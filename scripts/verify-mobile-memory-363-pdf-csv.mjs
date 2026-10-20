/* STR-363: independent output/hash checks on partial Android traces. Never PASS the device gate. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { PDFDocument } from "pdf-lib";

const root = resolve(import.meta.dirname, "..");
const artifacts = resolve(root, ".tmp-str363-pdf-csv");
const sha = data => createHash("sha256").update(data).digest("hex");
const routes = { pdf: "/tools/pdf-rotate/", csv: "/tools/csv-cleaner/" };
const expectedCounts = { pdf: { S: 1, M: 12, L: 45 }, csv: { S: 100, M: 5000, L: 30000 } };
const errors = [], seen = new Set(), observed = [];
if (process.argv.length < 3) throw Error("Provide one or more saved raw JSON traces");
for (const filename of process.argv.slice(2)) {
  try {
    const absolute = resolve(artifacts, filename);
    assert(absolute.startsWith(artifacts + sep) && basename(absolute) === filename);
    const report = JSON.parse(await readFile(absolute, "utf8"));
    assert.equal(report.ticket, "STR-363");
    assert.equal(report.status, "INCOMPLETE_REVIEW_REQUIRED");
    assert.equal(report.evidenceKind, "ANDROID_EMULATOR_PARTIAL_RAW_UNATTESTED");
    assert.equal(report.physicalDeviceObserved, false);
    assert.match(report.sourceRevision, /^[a-f0-9]{40}$/);
    assert.equal(report.emulator.id, "emulator-5554");
    assert.match(report.emulator.fingerprint, /sdk_gphone/);
    assert(Array.isArray(report.observations) && report.observations.length === 6);
    for (const [format, route] of Object.entries(routes)) {
      assert.equal(report.routeSha[format],
        sha(await readFile(resolve(root, "dist", route.slice(1), "index.html"))));
    }
    for (const row of report.observations) {
      assert.equal(row.platform, "ANDROID_EMULATOR");
      assert.equal(row.status, "OBSERVED_PARTIAL_REVIEW_REQUIRED");
      assert.equal(row.route, routes[row.format]);
      assert.equal(row.routeSha256, report.routeSha[row.format]);
      assert.equal(row.input.expectedCount, expectedCounts[row.format]?.[row.size]);
      assert(["cold", "warm"].includes(row.phase));
      const key = [row.format, row.size, row.phase].join("/");
      assert(!seen.has(key), "Duplicate case " + key);
      seen.add(key);
      const inputFile = resolve(artifacts, report.runId + "-" + row.format + "-" + row.size + "-" + row.phase + "-input." + row.format);
      const input = await readFile(inputFile);
      assert.equal(input.length, row.input.bytes);
      assert.equal(sha(input), row.input.sha256);
      const outputFile = resolve(row.output.local);
      assert(outputFile.startsWith(artifacts + sep), "Unexpected output path");
      const output = await readFile(outputFile);
      assert.equal(output.length, row.output.bytes);
      assert.equal(sha(output), row.output.sha256);
      if (row.format === "pdf") {
        const original = await PDFDocument.load(input);
        const reopened = await PDFDocument.load(output);
        assert.equal(original.getPageCount(), row.input.expectedCount);
        assert.equal(reopened.getPageCount(), row.output.pages);
        assert.equal(row.output.pages, row.input.expectedCount);
        assert.equal(reopened.getPage(0).getRotation().angle, 90);
        assert.equal(row.output.rotatedFirstPageDegrees, 90);
      } else {
        const csvRows = data => {
          const lines = data.toString("utf8").trimEnd().split(/\r?\n/);
          assert.equal(lines[0], "id,value,note");
          assert(lines.slice(1).every((line, index) =>
            line === String(index) + "," + String(index % 101) + ",record-" + index + "-observable"));
          return lines.length - 1;
        };
        assert.equal(csvRows(input), row.input.expectedCount);
        assert.equal(csvRows(output), row.output.rows);
        assert.equal(row.output.rows, row.input.expectedCount);
      }
      assert(Number.isFinite(row.memory.before) && Number.isFinite(row.memory.after));
      assert(row.memory.sampledPeak >= Math.max(row.memory.before, row.memory.after));
      assert(row.mainProcessMemoryKb.before.pssKb > 0 && row.mainProcessMemoryKb.after.pssKb > 0);
      assert(row.timing.samples > 0 && row.timing.maxIntervalMs >= 0 && row.timing.elapsedMs > 0);
      assert.deepEqual(row.errors, []);
      assert.deepEqual(row.offsite, []);
      assert(["NOT_RUN"].every(status => Object.values(row.recovery).every(v => v === status)));
      observed.push({ key, inputBytes: input.length, outputBytes: output.length,
        inputSha256: sha(input), outputSha256: sha(output) });
    }
  } catch (error) { errors.push(filename + ": " + String(error)); }
}
console.log(JSON.stringify({
  status: "PARTIAL_RAW_CROSSCHECKED_REVIEW_REQUIRED", observed: observed.length, errors,
  cases: observed,
  limits: ["Only PDF/CSV Android Chrome on scripted file inputs",
    "PSS/raw rAF values not independently verifiable without original capture command logs",
    "Cancel, background, retry, OOM/recovery and iOS simulator acceptance missing",
    "Device authenticity and timing require independent human session review"],
}, null, 2));
process.exitCode = errors.length ? 1 : 2;
