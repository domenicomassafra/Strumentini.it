/** #371: a named pipe must be refused before the comparator attempts a blocking read. */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const onArmMac = process.platform === "darwin" && process.arch === "arm64";

describe.skipIf(!onArmMac)("#371 macOS native Vision named-pipe refusal (NOT_RUN off-arm64-macOS)", () => {
  let folder = "";
  let binary = "";

  beforeAll(() => {
    folder = mkdtempSync(join(tmpdir(), "ocr371-vision-fifo-"));
    binary = join(folder, "native-vision");
    execFileSync("/usr/bin/swiftc", [
      resolve(import.meta.dirname, "../scripts/ocr-native-vision-371.swift"), "-o", binary,
    ], { encoding: "utf8", timeout: 180_000, maxBuffer: 80 * 1024 });
  }, 200_000);

  afterAll(() => {
    if (folder) rmSync(folder, { recursive: true, force: true });
  });

  it("refuses a FIFO with no writer promptly, without waiting inside open()", () => {
    const fifo = join(folder, "input-fifo.png");
    execFileSync("/usr/bin/mkfifo", ["-m", "600", fifo]);
    const output = spawnSync(binary, [
      "--image", fifo,
      "--expected-sha256", "0".repeat(64),
      "--expected-text", "Fattura numero 12345 - Totale euro 678,90",
      "--language", "it-IT",
    ], {
      encoding: "utf8", timeout: 1_500, killSignal: "SIGKILL", maxBuffer: 8 * 1024,
    });
    // A timeout is a failure, even though the test harness kills the stalled child.
    expect(output.error).toBeUndefined();
    expect(output.status).toBe(2);
    expect(output.stdout).toBe("");
    expect(output.stderr).toBe("OCR371_REFUSED:UNSAFE_FILE\n");
  }, 5_000);
});
