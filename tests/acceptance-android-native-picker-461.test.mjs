import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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

test("an interrupted zero-byte Android fixture is repaired through ADB upload", async () => {
  const temp = await mkdtemp(resolve(tmpdir(), "str461-empty-fixture-"));
  const adb = resolve(temp, "adb");
  const attemptedUpload = resolve(temp, "attempted-upload");
  await writeFile(adb, `#!/bin/sh
case "$*" in
  get-serialno) echo emulator-5554 ;;
  'shell getprop sys.boot_completed') echo 1 ;;
  'shell pm list packages com.android.chrome') echo package:com.android.chrome ;;
  'shell sha256sum /sdcard/Download/str461-source.png') echo 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  /sdcard/Download/str461-source.png' ;;
  push*) printf 'attempted\\n' > "$STR461_TEST_UPLOAD_MARKER"; exit 17 ;;
esac
`);
  await chmod(adb, 0o700);
  let receiptDir;
  try {
    const result = spawnSync(process.execPath, ["scripts/acceptance-android-chrome-avd-461.mjs"], {
      cwd: root,
      env: { ...process.env, STR461_ADB: adb, STR461_TEST_UPLOAD_MARKER: attemptedUpload },
      encoding: "utf8", timeout: 20_000,
    });
    assert.equal(result.status, 2, `Unexpected runner result: ${result.stderr}`);
    const receiptPath = result.stderr.match(/STR461_NOT_RUN receipt=([^\s]+)/u)?.[1];
    assert(receiptPath, `Preflight receipt missing: ${result.stderr}`);
    receiptDir = dirname(receiptPath);
    assert.equal(await readFile(attemptedUpload, "utf8"), "attempted\n",
      "A zero-byte leftover must be repaired through the native ADB upload boundary");
    assert.match(JSON.parse(await readFile(receiptPath, "utf8")).error, /push/u);
  } finally {
    await rm(temp, { recursive: true, force: true });
    if (receiptDir) await rm(receiptDir, { recursive: true, force: true });
  }
});
