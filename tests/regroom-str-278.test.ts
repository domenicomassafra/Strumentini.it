import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { inspectImageHeader, signatureMatches } from "../src/engines/image/format";
import { computeResizePlan, preflightAllocation } from "../src/engines/image/policy";

const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");

describe("STR-278 — resize input and independent image oracle", () => {
  it("plans a bounded crop and verifies MIME, size and pixels with sharp", async () => {
    const input = await sharp({ create: { width: 160, height: 120, channels: 3, background: "#e11d48" } })
      .png().toBuffer();
    const before = sha(input);
    expect(inspectImageHeader(input)).toEqual({ mime: "image/png", width: 160, height: 120 });
    const plan = computeResizePlan(160, 120, 80, 80, "cover");
    expect(plan).toMatchObject({ sourceX: 20, sourceWidth: 120, outputWidth: 80, outputHeight: 80 });
    expect(preflightAllocation(input.length, 160, 120, 80, 80).sourcePixels).toBe(19_200);

    const independentlyEncoded = await sharp(input)
      .extract({ left: plan.sourceX, top: plan.sourceY, width: plan.sourceWidth, height: plan.sourceHeight })
      .resize(plan.outputWidth, plan.outputHeight).jpeg().toBuffer();
    const metadata = await sharp(independentlyEncoded).metadata();
    const pixel = await sharp(independentlyEncoded).raw().toBuffer({ resolveWithObject: true });
    expect(signatureMatches(independentlyEncoded, "image/jpeg")).toBe(true);
    expect(metadata).toMatchObject({ format: "jpeg", width: 80, height: 80 });
    expect(pixel.info.channels).toBe(3);
    expect(pixel.data[0]).toBeGreaterThan(pixel.data[1] + 140);
    expect(pixel.data[0]).toBeGreaterThan(pixel.data[2] + 100);
    expect(sha(input)).toBe(before);
  });

  it("interprets EXIF orientation as displayed axes without mutating source bytes", async () => {
    const input = await sharp({ create: { width: 160, height: 120, channels: 3, background: "#2563eb" } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const before = sha(input);
    expect((await sharp(input).metadata()).orientation).toBe(6);
    expect(inspectImageHeader(input)).toEqual({ mime: "image/jpeg", width: 120, height: 160 });
    expect(computeResizePlan(120, 160, 90, 120, "contain")).toMatchObject({
      outputWidth: 90, outputHeight: 120,
    });
    const normalized = await sharp(input).autoOrient().toBuffer();
    expect(await sharp(normalized).metadata()).toMatchObject({ width: 120, height: 160 });
    expect(sha(input)).toBe(before);
  });
});
