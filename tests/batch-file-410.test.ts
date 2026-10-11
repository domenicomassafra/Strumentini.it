import { describe, expect, it } from "vitest";
import { gunzipSync as independentlyDecompressGzip } from "node:zlib";
import { BATCH_410_MAX_FILE_BYTES, runBatchTextGzip410 } from "../src/runtime/batch-file-410";

const utf8 = (value: string) => new TextEncoder().encode(value);
const txt = (name: string, content: string, type = "text/plain") =>
  new File([utf8(content)], name, { type });

describe("#410 bounded local batch gzip: actual result bytes and lifecycle", () => {
  it("compresses multiple original text files and assigns deterministic case-insensitive collision-free names", async () => {
    const payloads = ["First report — α\n".repeat(90), "Second report — β\n".repeat(120), "Third report — γ\n".repeat(75)];
    const files = [
      txt("report.txt", payloads[0]!),
      txt("REPORT.TXT", payloads[1]!),
      txt("report.txt", payloads[2]!),
    ];
    const result = await runBatchTextGzip410(files);
    expect(result.map((item) => [item.status, item.output?.name])).toEqual([
      ["success", "report.txt.gz"],
      ["success", "REPORT.TXT (2).gz"],
      ["success", "report.txt (3).gz"],
    ]);
    for (const [index, item] of result.entries()) {
      expect(item.output?.blob.type).toBe("application/gzip");
      const zip = new Uint8Array(await item.output!.blob.arrayBuffer());
      expect(Array.from(independentlyDecompressGzip(zip))).toEqual(Array.from(utf8(payloads[index]!)));
    }
  });

  it("returns per-file refusal and errors while retaining earlier and later verified successes", async () => {
    const badRead = txt("bad.txt", "unreadable");
    Object.defineProperty(badRead, "arrayBuffer", { value: async () => { throw new Error("private error content must not leak"); } });
    const files = [
      txt("ok.txt", "Keep this success"), new File([new Uint8Array([0, 1, 2])], "binary.png", { type: "image/png" }),
      badRead, txt("after.txt", "Keep later success"),
    ];
    const result = await runBatchTextGzip410(files);
    expect(result.map((entry) => entry.status)).toEqual(["success", "unsupported", "error", "success"]);
    expect(JSON.stringify(result)).not.toContain("private error content");
    expect(new TextDecoder().decode(independentlyDecompressGzip(new Uint8Array(await result[3]!.output!.blob.arrayBuffer())))).toBe("Keep later success");
    expect(result[1]!.output).toBeUndefined();
    expect(result[2]!.output).toBeUndefined();
  });

  it("keeps prior successes after cancellation and never publishes partial or subsequent outputs", async () => {
    const signal = new AbortController();
    const files = [txt("one.txt", "first"), txt("two.txt", "second"), txt("three.txt", "third")];
    const report = await runBatchTextGzip410(files, {
      signal: signal.signal,
      onItem(item) { if (item.status === "success") signal.abort(); },
    });
    expect(report.map((item) => item.status)).toEqual(["success", "cancelled", "cancelled"]);
    expect(new TextDecoder().decode(independentlyDecompressGzip(new Uint8Array(await report[0]!.output!.blob.arrayBuffer())))).toBe("first");
    expect(report.slice(1).every((item) => item.output === undefined)).toBe(true);
  });

  it("refuses deceptive UTF-8, oversized files, empty input and too many files without read-all allocations", async () => {
    const invalid = new File([new Uint8Array([0xff, 0xfe, 0x00])], "fake.txt", { type: "text/plain" });
    const tooBig = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "huge.txt", { type: "text/plain" });
    const results = await runBatchTextGzip410([invalid, tooBig, txt("empty.txt", "")]);
    expect(results.map((item) => item.status)).toEqual(["unsupported", "unsupported", "unsupported"]);
    expect(results.every((item) => item.output === undefined)).toBe(true);
    await expect(runBatchTextGzip410([])).rejects.toThrow(/BATCH_COUNT/u);
    await expect(runBatchTextGzip410(Array.from({ length: 9 }, (_, i) => txt(String(i) + ".txt", "small")))).rejects.toThrow(/BATCH_COUNT/u);
  });

  it("sanitizes traversal and Windows reserved names without duplicate outputs", async () => {
    const result = await runBatchTextGzip410([txt("../CON.txt", "one"), txt("CON.txt", "two"), txt("bad\\path.txt", "three")]);
    const names = result.map((item) => item.output?.name);
    expect(names).toEqual(["_CON.txt.gz", "_CON.txt (2).gz", "bad_path.txt.gz"]);
    expect(names.every((name) => name && !name.includes("/") && !name.includes("\\"))).toBe(true);
  });

  it("collapses canonical Unicode collisions and strips bidi control characters from download names", async () => {
    const outputs = await runBatchTextGzip410([
      txt("café.txt", "one"), txt("cafe\u0301.txt", "two"), txt("report\u202Etxt.txt", "three"),
    ]);
    expect(outputs.map((item) => item.output?.name)).toEqual([
      "café.txt.gz", "café.txt (2).gz", "report_txt.txt.gz",
    ]);
    for (const item of outputs) expect(item.status).toBe("success");
  });

  it("cancels a pending read without publishing an incomplete output", async () => {
    const controller = new AbortController();
    const pending = txt("pending.txt", "will not be published");
    Object.defineProperty(pending, "arrayBuffer", { value: async () => {
      controller.abort();
      return utf8("will not be published").buffer;
    } });
    const items = await runBatchTextGzip410([pending, txt("later.txt", "remain cancelled")], { signal: controller.signal });
    expect(items.map((item) => item.status)).toEqual(["cancelled", "cancelled"]);
    expect(items.every((item) => item.output === undefined)).toBe(true);
  });

  it("produces identical reproducible gzip bytes on repeated runs", async () => {
    const files = [txt("stable.json", "{\"ok\":true}\n".repeat(8))];
    const first = await runBatchTextGzip410(files);
    const second = await runBatchTextGzip410(files);
    expect(new Uint8Array(await first[0]!.output!.blob.arrayBuffer())).toEqual(
      new Uint8Array(await second[0]!.output!.blob.arrayBuffer()));
  });

  it("keeps the first four valid outputs when a later file exceeds the aggregate 8 MiB budget", async () => {
    const content = "x".repeat(BATCH_410_MAX_FILE_BYTES);
    const files = Array.from({ length: 5 }, (_, index) => txt("log" + String(index) + ".txt", content));
    const rows = await runBatchTextGzip410(files);
    expect(rows.map((item) => item.status)).toEqual(["success", "success", "success", "success", "unsupported"]);
    expect(rows[4]).toMatchObject({ reason: "TOTAL_BYTES_LIMIT" });
    expect(rows[4]!.output).toBeUndefined();
    const restored = independentlyDecompressGzip(new Uint8Array(await rows[3]!.output!.blob.arrayBuffer()));
    expect(restored.byteLength).toBe(BATCH_410_MAX_FILE_BYTES);
    expect(restored[0]).toBe(120);
    expect(restored[restored.length - 1]).toBe(120);
  });
});
