import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gzipSync, zipSync } from "fflate";
import { extractGzip416, extractZip416, runArchive416 } from "../src/engines/archive-safe";

const encoder = new TextEncoder();
const f = (name: string, contents: string | Uint8Array): File => new File([typeof contents === "string" ? contents : new Uint8Array(contents)], name);
const bytes = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());
const asFile = (data: Uint8Array, extension: string) => f("archive." + extension, data);

function editCentral(zip: Uint8Array, change: (bytes: Uint8Array, view: DataView, offset: number) => void): Uint8Array {
  const result = zip.slice();
  const view = new DataView(result.buffer);
  for (let p = 0; p < result.length - 46; p++) {
    if (view.getUint32(p, true) === 0x02014b50) {
      change(result, view, p);
      return result;
    }
  }
  throw new Error("fixture missing central directory");
}
function fixtureZip(name = "file.txt", text = "hello hello hello"): Uint8Array {
  return zipSync({ [name]: encoder.encode(text) }, { level: 6 });
}
function pythonZipReopen(archive: Uint8Array): string {
  const temporary = mkdtempSync(join(tmpdir(), "str-416-"));
  try {
    const filename = join(temporary, "archive.zip");
    writeFileSync(filename, archive);
    return execFileSync("python3", ["-c", [
      "import sys,zipfile,json",
      "with zipfile.ZipFile(sys.argv[1]) as z:",
      " assert z.testzip() is None, 'CRC mismatch'",
      " print(json.dumps({n:z.read(n).decode('utf-8') for n in z.namelist()}))",
    ].join("\n"), filename], { encoding: "utf8" }).trim();
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
}
function independentGunzip(input: Uint8Array): string {
  const temporary = mkdtempSync(join(tmpdir(), "str-416-gz-"));
  try {
    const filename = join(temporary, "payload.gz");
    writeFileSync(filename, input);
    return execFileSync("gzip", ["-dc", filename], { encoding: "utf8" });
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

describe("STR-416 safe ZIP/GZIP", () => {
  it("compresses real ZIP/DEFLATE; independently reopens each entry with Python zipfile", async () => {
    const result = await runArchive416("create-zip", [f("a.txt", "a".repeat(4000)), f("b.txt", "completato")]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({ name: "a.txt", status: "success", method: "deflate" });
    expect(result.entries[0]!.resultBytes).toBeLessThan(100);
    expect(result.outputs).toHaveLength(1);
    expect(JSON.parse(pythonZipReopen(await bytes(result.outputs[0]!.blob)))).toEqual({
      "a.txt": "a".repeat(4000), "b.txt": "completato",
    });
  });

  it("creates GZIP streams independently readable by gunzip; extracts ZIP/GZIP with per-entry results", async () => {
    const gzip = await runArchive416("create-gzip", [f("uno.txt", "ripeti ".repeat(300))]);
    expect(gzip.entries).toMatchObject([{ status: "success", method: "gzip" }]);
    expect(independentGunzip(await bytes(gzip.outputs[0]!.blob))).toBe("ripeti ".repeat(300));
    const expanded = await runArchive416("extract", [new File([new Uint8Array(await bytes(gzip.outputs[0]!.blob))], "uno.txt.gz")]);
    expect(await expanded.outputs[0]!.blob.text()).toBe("ripeti ".repeat(300));
    expect(expanded.outputs[0]!.name).toBe("uno.txt");
    const zip = fixtureZip("docs/risultato.txt", "test ZIP");
    const unzipped = await runArchive416("extract", [asFile(zip, "zip")]);
    expect(unzipped.entries).toMatchObject([{ name: "docs/risultato.txt", status: "success", method: "deflate" }]);
    expect(unzipped.outputs[0]!.name).toBe("docs__risultato.txt");
    expect(await unzipped.outputs[0]!.blob.text()).toBe("test ZIP");
  });

  it("refuses path traversal, aliases, duplicates, nested archives and symlinks, without partial files", async () => {
    const slip = fixtureZip("../outside.txt", "no");
    await expect(runArchive416("extract", [asFile(slip, "zip")])).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE_PATH" });
    for (const name of ["/absolute.txt", "C:/win.txt", "a/%2e%2e/escape", "a\\..\\evil.txt", "CON.txt"]) {
      await expect(runArchive416("extract", [asFile(fixtureZip(name), "zip")])).rejects.toHaveProperty("code");
    }
    const nested = fixtureZip("data.bin", "x");
    const envelope = zipSync({ "inside.bin": nested });
    await expect(runArchive416("extract", [asFile(envelope, "zip")])).rejects.toMatchObject({ code: "UNSUPPORTED_ARCHIVE" });
    const namedNested = zipSync({ "inside.gz": encoder.encode("not an archive") });
    await expect(runArchive416("extract", [asFile(namedNested, "zip")])).rejects.toMatchObject({ code: "UNSUPPORTED_ARCHIVE" });
    const forgedLink = editCentral(fixtureZip(), (_data, view, at) => {
      view.setUint16(at + 4, 0x0314, true);
      view.setUint32(at + 38, 0xa1ff0000, true);
    });
    await expect(runArchive416("extract", [asFile(forgedLink, "zip")])).rejects.toMatchObject({ code: "UNSUPPORTED_ARCHIVE" });
    const duplicate = zipSync({ "Folder/a.txt": encoder.encode("A"), "folder/A.txt": encoder.encode("B") });
    await expect(runArchive416("extract", [asFile(duplicate, "zip")])).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE_PATH" });
    await expect(runArchive416("create-zip", [f("../escape.txt", "bad")])).rejects.toMatchObject({ code: "UNSAFE_ARCHIVE_PATH" });
    const folderFile = f("a.txt", "content");
    Object.defineProperty(folderFile, "webkitRelativePath", { value: "folder/a.txt" });
    await expect(runArchive416("create-gzip", [folderFile, f("folder__a.txt", "content")]))
      .rejects.toMatchObject({ code: "UNSAFE_ARCHIVE_PATH" });
  });

  it("refuses inflated bombs before allocation, and corrupt CRC after real inflation", async () => {
    const zip = fixtureZip("small.txt", "abcde".repeat(400));
    const bomb = editCentral(zip, (_data, view, at) => view.setUint32(at + 24, 0x7fffffff, true));
    await expect(runArchive416("extract", [asFile(bomb, "zip")])).rejects.toMatchObject({ code: "ARCHIVE_TOO_LARGE" });
    const crcMismatch = editCentral(zip, (_data, view, at) => view.setUint32(at + 16, 0x12345678, true));
    await expect(runArchive416("extract", [asFile(crcMismatch, "zip")])).rejects.toMatchObject({ code: "CORRUPT_ARCHIVE" });
    const localMismatch = editCentral(zip, (_data, view, at) => view.setUint16(at + 10, 0, true));
    await expect(runArchive416("extract", [asFile(localMismatch, "zip")])).rejects.toMatchObject({ code: "CORRUPT_ARCHIVE" });
    const zip64 = editCentral(zip, (_data, view, at) => view.setUint32(at + 24, 0xffffffff, true));
    await expect(runArchive416("extract", [asFile(zip64, "zip")])).rejects.toMatchObject({ code: "UNSUPPORTED_ARCHIVE" });
    const gz = gzipSync(encoder.encode("x".repeat(4096)));
    const forgedGzipBomb = gz.slice();
    new DataView(forgedGzipBomb.buffer).setUint32(forgedGzipBomb.length - 4, 0x7fffffff, true);
    await expect(runArchive416("extract", [asFile(forgedGzipBomb, "gz")])).rejects.toMatchObject({ code: "ARCHIVE_TOO_LARGE" });
    const badCrc = gz.slice();
    badCrc[badCrc.length - 8] = badCrc[badCrc.length - 8]! ^ 0x01;
    await expect(runArchive416("extract", [asFile(badCrc, "gz")])).rejects.toMatchObject({ code: "CORRUPT_ARCHIVE" });
    expect(extractGzip416(gz, "plain.txt.gz").bytes).toEqual(encoder.encode("x".repeat(4096)));
  });

  it("bounds total file count/size, unsupported inputs, header tampering and cancellation", async () => {
    await expect(runArchive416("extract", [f("invalid.zip", "not a zip")])).rejects.toHaveProperty("code", "UNSUPPORTED_ARCHIVE");
    await expect(runArchive416("extract", [asFile(fixtureZip(), "gz")])).rejects.toHaveProperty("code", "UNSUPPORTED_ARCHIVE");
    await expect(runArchive416("create-gzip", Array.from({ length: 9 }, (_, i) => f(i + ".txt", "hello"))))
      .rejects.toHaveProperty("code", "INVALID_INPUT");
    await expect(runArchive416("create-zip", [f("huge.dat", "a".repeat(8 * 1024 * 1024 + 1))]))
      .rejects.toHaveProperty("code", "ARCHIVE_TOO_LARGE");
    const encrypted = editCentral(fixtureZip(), (_data, view, at) => view.setUint16(at + 8, 1, true));
    expect(() => extractZip416(encrypted)).toThrowError(/supportato/iu);
    const controller = new AbortController();
    controller.abort();
    await expect(runArchive416("create-zip", [f("hello.txt", "hello")], controller.signal))
      .rejects.toHaveProperty("code", "CANCELLED");
  });
});
