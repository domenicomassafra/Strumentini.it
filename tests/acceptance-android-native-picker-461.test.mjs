import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("missing Android emulator writes a NOT_RUN receipt and exits 2", async () => {
  const result = spawnSync(process.execPath, ["scripts/acceptance-android-chrome-avd-461.mjs"], {
    cwd: root,
    env: { ...process.env, STR461_ADB: "/nonexistent/str461-adb" },
    encoding: "utf8",
    timeout: 20_000,
  });
  assert.equal(result.status, 2, `Unexpected runner result: ${result.stderr}`);
  const receiptPath = result.stderr.match(/STR461_NOT_RUN receipt=([^\s]+)/u)?.[1];
  assert(receiptPath, `No persistent preflight receipt path: ${result.stderr}`);
  try {
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    assert.equal(receipt.ticket, "STR-461");
    assert.equal(receipt.result, "NOT_RUN");
    assert.equal(receipt.failedStage, "preflight");
    assert.equal(receipt.unverified.photosPicker, "NOT_RUN");
    assert.equal(receipt.unverified.iosSafari, "NOT_RUN");
  } finally {
    await rm(dirname(receiptPath), { recursive: true, force: true });
  }
});
