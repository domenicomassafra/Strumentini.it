import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { runImageCompressionQueue } from "../src/engines/image/batch-compression";

const file = (name: string, size = 1500) => new File([new Uint8Array(size)], name, { type: "image/png" });
const validOutput = (index: number) => ({
  blob: new Blob([new Uint8Array([index + 1, 2, 3])], { type: "image/png" }),
  filename: "out.png", inputMime: "image/png", outputMime: "image/png" as const,
  width: 1, height: 1,
});

describe("ticket 211 — local mixed-image bounded queue", () => {
  it("isolates corrupt files, reconciles exact byte totals and builds a reopenable ZIP", async () => {
    const files = [file("first.png"), file("broken.png", 200), file("last.png", 1700)];
    const order: number[] = [];
    const result = await runImageCompressionQueue(files, async (_input, index) => {
      order.push(index);
      if (index === 1) throw new Error("INVALID_IMAGE: contenuto non valido");
      return validOutput(index);
    });
    expect(order).toEqual([0, 1, 2]);
    expect(result.maxConcurrent).toBe(1);
    expect(result.processedCount).toBe(3);
    expect(result.failures).toMatchObject([{ sourceIndex: 1, name: "broken.png" }]);
    expect(result.items.map(({ filename, sourceIndex }) => [filename, sourceIndex])).toEqual([
      ["01-out.png", 0], ["03-out.png", 2],
    ]);
    expect(result.originalBytes).toBe(3400);
    expect(result.successfulOriginalBytes).toBe(3200);
    expect(result.outputBytes).toBe(6);
    expect(result.savedBytes).toBe(3194);
    expect(result.savedPercent).toBeCloseTo(99.81, 2);
    expect(result.zipBlob?.type).toBe("application/zip");
    const archive = unzipSync(new Uint8Array(await result.zipBlob!.arrayBuffer()));
    expect(Object.keys(archive).sort()).toEqual(["01-out.png", "03-out.png"]);
    expect([...archive["01-out.png"]!]).toEqual([1, 2, 3]);
    expect([...archive["03-out.png"]!]).toEqual([3, 2, 3]);
  });

  it("reports all-failed explicitly, without a fake empty downloadable ZIP", async () => {
    const result = await runImageCompressionQueue([file("invalid.png")], async () => {
      throw new Error("Unsupported image");
    });
    expect(result.items).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.savedBytes).toBe(0);
    expect(result.zipBlob).toBeNull();
  });

  it("rejects oversized queues and stops without continuing after cancellation", async () => {
    await expect(runImageCompressionQueue(Array.from({ length: 9 }, (_, i) => file(`${i}.png`)),
      async () => validOutput(0))).rejects.toThrow("1 a 8");
    const controller = new AbortController();
    let calls = 0;
    await expect(runImageCompressionQueue([file("a.png"), file("b.png")], async () => {
      calls++;
      controller.abort();
      return validOutput(0);
    }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(1);
  });
});
