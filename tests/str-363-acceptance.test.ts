import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { mutatePdf } from "../src/engines/pdf";
import { cleanCsvText } from "../src/engines/table/csv";
import { preflightAllocation } from "../src/engines/image/policy";
import {
  assessMobileMemory363, MOBILE_363_FORMATS, MOBILE_363_PHASES,
  MOBILE_363_PLATFORMS, MOBILE_363_SIZES, validateMobileMemory363,
} from "../scripts/lib/mobile-memory-363";

const sha = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");

describe("STR-363 mobile editor memory acceptance seams", () => {
  it("runs S/M/L source-preserving PDF, image preflight and CSV through existing engines", async () => {
    for (const [label, pages, side, rows] of [
      ["S", 1, 320, 100], ["M", 12, 1280, 5000], ["L", 45, 2400, 30000],
    ] as const) {
      const document = await PDFDocument.create();
      for (let i = 0; i < pages; i++) document.addPage([300, 400]);
      const input = Buffer.from(await document.save({ useObjectStreams: false }));
      const before = sha(input);
      const artifact = (await mutatePdf(new Blob([input]), {
        kind: "rotate", filename: `${label}.pdf`, rotations: { 1: 90 },
      }))[0]!.bytes;
      const reopened = await PDFDocument.load(artifact);
      expect(reopened.getPageCount()).toBe(pages);
      expect(reopened.getPage(0).getRotation().angle).toBe(90);
      expect(sha(input)).toBe(before);

      const picture = await sharp({ create: { width: side, height: side, channels: 3,
        background: "#476a93" } }).png().toBuffer();
      const imageBefore = sha(picture);
      const allocation = preflightAllocation(picture.length, side, side, side / 2, side / 2);
      expect(allocation.estimatedDecodedBytes).toBeGreaterThan(picture.length);
      const decoded = await sharp(picture).metadata();
      expect([decoded.width, decoded.height]).toEqual([side, side]);
      expect(sha(picture)).toBe(imageBefore);

      const csv = "id,value\n" + Array.from({ length: rows }, (_, n) => `${n},v${n}\n`).join("");
      const result = cleanCsvText(csv);
      expect(result.rows).toBe(rows + 1);
      expect(sha(result.output)).toBe(sha(csv));
      expect(cleanCsvText(result.output).output).toBe(result.output);
    }
  }, 30_000);

  it("represents all 36 platform/format/size/temperature slots without invented device measurements", () => {
    const receipt = JSON.parse(readFileSync(resolve(import.meta.dirname,
      "../quality/receipts/mobile-memory-363-simulated.json"), "utf8"));
    const keys = receipt.cases.map((entry: { platform: string; format: string; size: string; phase: string }) =>
      [entry.platform, entry.format, entry.size, entry.phase].join("/"));
    const expected = MOBILE_363_PLATFORMS.flatMap(platform => MOBILE_363_FORMATS.flatMap(format =>
      MOBILE_363_SIZES.flatMap(size => MOBILE_363_PHASES.map(phase =>
        [platform, format, size, phase].join("/")))));
    expect(new Set(keys)).toEqual(new Set(expected));
    expect(keys).toHaveLength(36);
    expect(receipt.cases.every((row: { status: string }) => row.status === "NOT_RUN")).toBe(true);
    expect(receipt.physicalDeviceObserved).toBe(false);
    expect(validateMobileMemory363(receipt)).toEqual([]);
    expect(assessMobileMemory363(receipt).status).toBe("BLOCKED");
  });

  it("reuses one animation-frame sampler and pointer listener during warm capture", () => {
    // The browser runner self-executes on import; evaluate its actual helper in an isolated DOM.
    const source = readFileSync(resolve(import.meta.dirname, "str-363-consumer.browser.mjs"), "utf8");
    const helper = source.match(/function installFrameProbe\(\) \{[\s\S]*?\n\}\n(?=\nasync function fixture\()/u)?.[0];
    expect(helper).toBeDefined();
    const frames: Array<(time: number) => void> = [];
    const listeners: string[] = [];
    const page = {
      window: {},
      document: { addEventListener: (type: string) => listeners.push(type) },
      requestAnimationFrame: (callback: (time: number) => void) => frames.push(callback),
      performance: { now: () => 0 },
    };
    runInNewContext(`${helper}\ninstallFrameProbe(); installFrameProbe();`, page);
    expect(frames).toHaveLength(1);
    expect(listeners).toEqual(["pointerdown"]);
  });
});
