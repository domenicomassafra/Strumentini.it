import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { mutatePdf } from "../src/engines/pdf";
import { readBlobText, cleanCsvText } from "../src/engines/table/csv";
import { ImageResizeError, preflightAllocation } from "../src/engines/image/policy";
import { preflightHeavyLocalJob } from "../src/runtime/heavy-preflight";

const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

describe("STR-363 refusal and recovery at product engine boundaries", () => {
  it("cancels PDF without publishing output then reopens the independent retry", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]);
    const original = Buffer.from(await doc.save());
    const initial = sha(original);
    const blob = new Blob([original]);
    const controller = new AbortController();
    controller.abort();
    await expect(mutatePdf(blob, { kind: "rotate", filename: "before.pdf", rotations: { 1: 90 } }, controller.signal))
      .rejects.toMatchObject({ code: "CANCELLED" });
    const output = (await mutatePdf(blob, { kind: "rotate", filename: "after.pdf", rotations: { 1: 90 } }))[0]!.bytes;
    const reopened = await PDFDocument.load(output);
    expect(reopened.getPage(0).getRotation().angle).toBe(90);
    expect(sha(original)).toBe(initial);
  });

  it("rejects unsafe image allocation and accepts a safe retry without mutating input", () => {
    const caps = { worker: true, wasm: true, "image-decode": true };
    const policy = { capabilities: { worker: "required" as const },
      limits: { hardInputBytes: 1024, hardWorkingSetBytes: 2048 } };
    expect(preflightHeavyLocalJob(policy, { inputBytes: 1025, estimatedWorkingSetBytes: 4096 }, caps).resourceState)
      .toBe("blocked");
    expect(() => preflightAllocation(512, 8192, 8192, 8192, 8192)).toThrow(ImageResizeError);
    expect(preflightHeavyLocalJob(policy, { inputBytes: 128, estimatedWorkingSetBytes: 512 }, caps).state)
      .toBe("supported");
    expect(preflightAllocation(128, 64, 64, 32, 32).estimatedDecodedBytes).toBeGreaterThan(0);
  });

  it("rejects cancelled CSV read and allows an independent retry of the same bytes", async () => {
    const source = "id,value\n1,ok\n2,again\n";
    const sourceHash = sha(source);
    const blob = new Blob([source]);
    const controller = new AbortController();
    controller.abort();
    await expect(readBlobText(blob, controller.signal)).rejects.toMatchObject({ code: "CANCELLED" });
    const retry = cleanCsvText(await readBlobText(blob));
    expect(retry.rows).toBe(3);
    expect(sha(retry.output)).toBe(sourceHash);
    expect(sha(await blob.text())).toBe(sourceHash);
  });
});
