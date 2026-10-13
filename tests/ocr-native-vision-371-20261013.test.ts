/** #371: genuinely invoke Apple's installed Vision.framework; no mocks/donors/network. */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OCR_371_SOURCE } from "../scripts/ocr-language-audit-371";

const onArmMac = process.platform === "darwin" && process.arch === "arm64";
const root = resolve(import.meta.dirname, "..");
const swiftSource = resolve(root, "scripts/ocr-native-vision-371.swift");
const fixture = resolve(root, OCR_371_SOURCE.fixtureRelativePath);
const reference = OCR_371_SOURCE.annotatedExpectedText;
const fixtureSha = OCR_371_SOURCE.fixtureSha256;
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

type Result371 = {
  ticket: number; decision: string; scope: string; language: string; engine: string;
  fileSha256: string; inputBytes: number; imageWidth: number; imageHeight: number;
  referenceText: string; recognizedText: string; exact: boolean;
  characterErrors: number; characterReferenceScalars: number; characterErrorRate: number;
  wordErrors: number; referenceWords: number; wordErrorRate: number; recognitionMs: number;
  candidateScoreMeaning: string; measuredMemory: string;
  nativeProcessHighWaterRssBytes: number; nativeVisionAndXpcPeakMemory: string;
  physicalIosAndroid: string; englishComparativeQuality: string;
  explicitNetworkApiCalls: number; operatingSystemNetworkEgress: string;
};

describe.skipIf(!onArmMac)("#371 native macOS Vision local OCR (NOT_RUN off-arm64-macOS)", () => {
  let folder = "";
  let binary = "";
  const run = (args: string[], environment?: { useDenyNetworkSandbox: boolean }) => {
    const sandbox = environment?.useDenyNetworkSandbox;
    const program = sandbox ? "/usr/bin/sandbox-exec" : binary;
    const argv = sandbox
      ? ["-p", "(version 1) (allow default) (deny network*)", binary, ...args] : args;
    const result = spawnSync(program, argv, {
      encoding: "utf8", timeout: 40_000, maxBuffer: 64 * 1024,
      env: { ...process.env, HOME: folder, TMPDIR: folder, URLSessionConfiguration: "ephemeral" },
    });
    expect(result.error).toBeUndefined();
    return result;
  };
  const args = (image: string = fixture, sha256: string = fixtureSha,
    expected: string = reference, language: string = "it-IT") =>
    ["--image", image, "--expected-sha256", sha256, "--expected-text", expected, "--language", language];
  const readJson = (output: ReturnType<typeof run>): Result371 => {
    expect(output.status, output.stderr).toBe(0);
    expect(output.stderr).toBe("");
    const result = JSON.parse(output.stdout) as Result371;
    expect(result.decision).toBe("NO_GO");
    return result;
  };
  const refused = (output: ReturnType<typeof run>, code: string) => {
    expect(output.status, output.stdout).toBe(2);
    expect(output.stdout).toBe("");
    expect(output.stderr).toContain(`OCR371_REFUSED:${code}`);
  };
  const tempFile = (name: string, content: Buffer): string => {
    const path = join(folder, name);
    writeFileSync(path, content, { flag: "wx", mode: 0o600 });
    return path;
  };

  beforeAll(() => {
    folder = mkdtempSync(join(tmpdir(), "ocr371-vision-offline-"));
    binary = join(folder, "native-vision");
    // Use the macOS toolchain-selection shim, not the raw Xcode swiftc binary:
    // the latter lacks the SDK/stdlib resolution environment in hermetic
    // Vitest children on this host.
    const compiler = "/usr/bin/swiftc";
    expect(existsSync(compiler)).toBe(true);
    execFileSync(compiler, [swiftSource, "-o", binary], {
      timeout: 180_000, maxBuffer: 80 * 1024, encoding: "utf8",
    });
  }, 200_000);

  afterAll(() => {
    if (folder) rmSync(folder, { recursive: true, force: true });
  });

  it("SHA-pinned actual Italian invoice is recognized locally with exact normalized CER/WER and NO_GO", () => {
    const source = readFileSync(fixture);
    expect(source.length).toBe(OCR_371_SOURCE.fixtureBytes);
    expect(digest(source)).toBe(fixtureSha);
    const result = readJson(run(args()));
    expect(result).toMatchObject({
      ticket: 371, scope: "MACOS_VISION_LOCAL_SINGLE_HOST_SYNTHETIC_IT_ONLY",
      language: "it-IT", fileSha256: fixtureSha, inputBytes: source.length,
      imageWidth: 1280, imageHeight: 240, referenceText: reference,
      recognizedText: reference, exact: true, characterErrors: 0, characterErrorRate: 0,
      wordErrors: 0, wordErrorRate: 0, referenceWords: 7,
      measuredMemory: "DARWIN_PROCESS_RUSAGE_MAXRSS_ONLY",
      nativeVisionAndXpcPeakMemory: "NOT_MEASURED",
      physicalIosAndroid: "NOT_RUN",
      englishComparativeQuality: "NOT_MEASURED", explicitNetworkApiCalls: 0,
      operatingSystemNetworkEgress: "NOT_ATTESTED_BY_COMPARATOR",
    });
    expect(result.recognitionMs).toBeGreaterThan(0);
    expect(result.nativeProcessHighWaterRssBytes).toBeGreaterThan(0);
    expect(result.candidateScoreMeaning).toBe("UNCALIBRATED_NATIVE_MODEL_SCORE_NOT_A_PROBABILITY");
    console.log(`#371 Vision real IT upright OCR ${JSON.stringify({
      sourceSha256: result.fileSha256, text: result.recognizedText,
      cer: result.characterErrorRate, wer: result.wordErrorRate,
      recognitionMs: result.recognitionMs, processHighWaterRssBytes: result.nativeProcessHighWaterRssBytes,
      decision: result.decision,
    })}`);
  }, 50_000);

  it("reports exact one-character/one-word Levenshtein changes, not score-based quality", () => {
    const alternativeAnnotation = "Fattura numero 12345 - Totale euro 678,91";
    const result = readJson(run(args(fixture, fixtureSha, alternativeAnnotation)));
    expect(result.recognizedText).toBe(reference);
    expect(result.exact).toBe(false);
    expect(result.characterErrors).toBe(1);
    expect(result.characterReferenceScalars).toBe(41);
    expect(result.characterErrorRate).toBeCloseTo(1 / 41);
    expect(result.wordErrors).toBe(1);
    expect(result.wordErrorRate).toBeCloseTo(1 / 7);
  }, 50_000);

  it("runs deterministic grayscale and raw rotated-90 invoice comparisons without claiming mobile quality", async () => {
    const original = readFileSync(fixture);
    const variants = [
      { name: "grayscale", bytes: await sharp(original).greyscale().png().toBuffer(), width: 1280, height: 240 },
      { name: "rotated90", bytes: await sharp(original).rotate(90).png().toBuffer(), width: 240, height: 1280 },
    ];
    for (const item of variants) {
      const path = tempFile(`${item.name}.png`, item.bytes);
      const sha = digest(item.bytes);
      const result = readJson(run(args(path, sha)));
      expect(result).toMatchObject({
        imageWidth: item.width, imageHeight: item.height, fileSha256: sha,
        referenceText: reference, language: "it-IT", decision: "NO_GO",
      });
      expect(result.characterErrorRate).toBeGreaterThanOrEqual(0);
      expect(result.wordErrorRate).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.recognitionMs)).toBe(true);
      console.log(`#371 Vision ${item.name} comparison ${JSON.stringify({
        sha256: sha, text: result.recognizedText, cer: result.characterErrorRate,
        wer: result.wordErrorRate, recognitionMs: result.recognitionMs,
      })}`);
    }
  }, 75_000);

  it("rejects a wrong pinned digest before decoding", () => {
    refused(run(args(fixture, "0".repeat(64))), "SOURCE_SHA256_MISMATCH");
  });

  it("rejects malformed PNG content even when its SHA is correctly supplied", () => {
    const source = Buffer.alloc(112, 0x20);
    const path = tempFile("not-a-png.png", source);
    refused(run(args(path, digest(source))), "INVALID_PNG");
  });

  it("rejects a truncated input with a correct digest before native image decode", () => {
    const input = Buffer.from(readFileSync(fixture).subarray(0, 24));
    const path = tempFile("truncated.png", input);
    refused(run(args(path, digest(input))), "FILE_LIMIT");
  });

  it("rejects >5MiB before hashing/allocating regardless of the asserted digest", () => {
    const path = tempFile("oversize.png", Buffer.alloc(5 * 1024 * 1024 + 1, 0xff));
    refused(run(args(path, "0".repeat(64))), "FILE_LIMIT");
  });

  it("rejects an oversized IHDR pixel claim before passing bytes into ImageIO", () => {
    const image = Buffer.from(readFileSync(fixture));
    image.writeUInt32BE(5001, 16);
    const path = tempFile("huge-dimensions.png", image);
    refused(run(args(path, digest(image))), "DIMENSION_LIMIT");
  });

  it("rejects symlink substitution without following the input file", () => {
    const link = join(folder, "source-link.png");
    symlinkSync(fixture, link);
    refused(run(args(link)), "UNREADABLE_FILE");
  });

  it("rejects unsupported language and missing authoritative arguments", () => {
    refused(run(args(fixture, fixtureSha, reference, "fr-FR")), "UNSUPPORTED_LANGUAGE");
    refused(run(["--image", fixture]), "ARGUMENTS");
    refused(run(args(fixture, "xyz")), "INVALID_SHA256");
  });

  it.skipIf(!existsSync("/usr/bin/sandbox-exec"))(
    "recognizes the authentic pinned fixture under a kernel deny-network sandbox",
    () => {
      const output = readJson(run(args(), { useDenyNetworkSandbox: true }));
      expect(output.recognizedText).toBe(reference);
      expect(output.exact).toBe(true);
    },
    50_000,
  );
});
