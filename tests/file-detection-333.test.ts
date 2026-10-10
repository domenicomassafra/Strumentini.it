import { describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";

const asFile = (name: string, bytes: Uint8Array, type = ""): File => new File([new Uint8Array(bytes)], name, { type });
const asText = (name: string, content: string, type = "") => asFile(name, new TextEncoder().encode(content), type);

const png = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aRAAAAAASUVORK5CYII=", "base64",
));
const gif = Uint8Array.from(Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64"));
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xd9]);
const webp = Uint8Array.from([82,73,70,70,16,0,0,0,87,69,66,80,86,80,56,76,4,0,0,0,0,0,0,0]);

type DetectionExample = readonly [label: string, file: File, kind: string, mime: string];

const OOXML_MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

const contents = (kind: "docx" | "xlsx" | "pptx") => {
  const [root, type] = kind === "docx"
    ? ["word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"]
    : kind === "xlsx"
      ? ["xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"]
      : ["ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"];
  return {
    root,
    xml: `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${root}" ContentType="${type}"/></Types>`,
  };
};

function officeZip(kind: "docx" | "xlsx" | "pptx", override?: string): Uint8Array {
  const part = contents(kind);
  return zipSync({
    "[Content_Types].xml": strToU8(override ?? part.xml),
    "_rels/.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'),
    [part.root]: strToU8("<root/>")
  }, { level: 6 });
}

describe("#333 local bounded file recognition", () => {
  const examples: readonly DetectionExample[] = [
    ["a.pdf", asText("a.pdf", "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "application/pdf"), "pdf", "application/pdf"],
    ["a.png", asFile("a.png", png, "image/png"), "png", "image/png"],
    ["a.jpg", asFile("a.jpg", jpg, "image/jpeg"), "jpeg", "image/jpeg"],
    ["a.gif", asFile("a.gif", gif, "image/gif"), "gif", "image/gif"],
    ["a.webp", asFile("a.webp", webp, "image/webp"), "webp", "image/webp"],
    ["a.zip", asFile("a.zip", zipSync({ "hello.txt": strToU8("real ZIP bytes") }), "application/zip"), "zip", "application/zip"],
    ...(["docx", "pptx", "xlsx"] as const).map((kind) => [
      `a.${kind}`, asFile(`a.${kind}`, officeZip(kind), OOXML_MIME[kind]), kind, OOXML_MIME[kind]
    ] as const),
  ];
  it.each(examples)("recognizes supported %s via local bytes with deterministic evidence", async (_, file, kind, mime) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const first = await detectLocalFile(file);
      expect(first).toMatchObject({ status: "supported", format: kind, mime, bytes: file.size });
      expect(first).toEqual(await detectLocalFile(file));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });

  it("refuses zero byte, unknown, and unsupported extension claims", async () => {
    expect(await detectLocalFile(asText("empty.pdf", ""))).toMatchObject({ status: "refused", reason: "EMPTY" });
    expect(await detectLocalFile(asText("random.exe", "a file"))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    expect(await detectLocalFile(asFile("fake.png", jpg))).toMatchObject({ status: "refused", reason: "EXTENSION_MISMATCH" });
    expect(await detectLocalFile(asFile("fake.jpg", png, "image/jpeg"))).toMatchObject({ status: "refused", reason: "MIME_MISMATCH" });
    expect(await detectLocalFile(asFile("mystery.bin", png, "application/octet-stream"))).toMatchObject({ status: "supported", format: "png" });
    expect(await detectLocalFile(asFile("no-extension", png))).toMatchObject({ status: "supported", format: "png" });
  });

  it("refuses misleading OOXML extension/MIME with an ordinary ZIP or another Office kind", async () => {
    const generic = zipSync({ "hello.txt": strToU8("x") });
    expect(await detectLocalFile(asFile("fake.docx", generic, OOXML_MIME.docx))).toMatchObject({ status: "refused" });
    expect(await detectLocalFile(asFile("wrong.xlsx", officeZip("docx"), OOXML_MIME.xlsx))).toMatchObject({ status: "refused", reason: "MIME_MISMATCH" });
    expect(await detectLocalFile(asFile("wrong.docx", officeZip("xlsx"), OOXML_MIME.xlsx))).toMatchObject({ status: "refused", reason: "EXTENSION_MISMATCH" });
    expect(await detectLocalFile(asFile("bad.docx", officeZip("docx", "<Types />"), OOXML_MIME.docx))).toMatchObject({ status: "refused", reason: "MALFORMED" });
  });

  it("rejects ambiguous/malformed file headers and truncated structural boundaries", async () => {
    expect(await detectLocalFile(asFile("a.png", png.slice(0, 16)))).toMatchObject({ status: "refused", reason: "MALFORMED" });
    const badPng = png.slice(); badPng[16] = (badPng[16] ?? 0) ^ 1;
    expect(await detectLocalFile(asFile("crc.png", badPng))).toMatchObject({ status: "refused", reason: "MALFORMED" });
    expect(await detectLocalFile(asFile("a.webp", webp.slice(0, 14)))).toMatchObject({ status: "refused", reason: "MALFORMED" });
    expect(await detectLocalFile(asFile("a.gif", gif.slice(0, 10)))).toMatchObject({ status: "refused", reason: "MALFORMED" });
    expect(await detectLocalFile(asText("a.pdf", "%PDF-1.7\nnot terminated"))).toMatchObject({ status: "refused", reason: "MALFORMED" });
    expect(await detectLocalFile(asFile("a.zip", zipSync({ a: strToU8("z") }).slice(0, -10)))).toMatchObject({ status: "refused", reason: "MALFORMED" });
  });

  it("refuses JPEG+ZIP and PDF+ZIP concatenated polyglots", async () => {
    const pack = zipSync({ "data.txt": strToU8("hello") });
    const jpegPolyglot = new Uint8Array([...jpg, ...pack]);
    const pdfPolyglot = new Uint8Array([...new TextEncoder().encode("%PDF-1.7\n%%EOF\n"), ...pack]);
    expect(await detectLocalFile(asFile("hybrid.jpg", jpegPolyglot))).toMatchObject({ status: "refused" });
    expect(await detectLocalFile(asFile("hybrid.pdf", pdfPolyglot))).toMatchObject({ status: "refused" });
  });

  it("rejects deceptive, ambiguous, encrypted, duplicate, or macro-marked OOXML", async () => {
    const both = zipSync({ "[Content_Types].xml": strToU8(contents("docx").xml), "word/document.xml": strToU8("x"), "xl/workbook.xml": strToU8("y") });
    expect(await detectLocalFile(asFile("poly.docx", both))).toMatchObject({ status: "refused", reason: "POLYGLOT" });
    const macro = zipSync({ "[Content_Types].xml": strToU8(contents("docx").xml), "word/document.xml": strToU8("x"), "word/vbaProject.bin": strToU8("bad") });
    expect(await detectLocalFile(asFile("macro.docx", macro))).toMatchObject({ status: "refused" });
    const archive = zipSync({ "hello.txt": strToU8("payload") });
    const encrypted = archive.slice();
    encrypted[6] = 1;
    expect(await detectLocalFile(asFile("bad.zip", encrypted))).toMatchObject({ status: "refused" });
  });

  it("rejects ZIP bombs, unsupported compression, unsafe member paths and damaged central directory", async () => {
    const huge = zipSync({ "expansion.txt": new Uint8Array(512 * 1024) }, { level: 9 });
    expect(await detectLocalFile(asFile("bomb.zip", huge))).toMatchObject({ status: "refused", reason: "TOO_LARGE" });
    const traversing = zipSync({ "../payload.txt": strToU8("not safe") });
    expect(await detectLocalFile(asFile("unsafe.zip", traversing))).toMatchObject({ status: "refused", reason: "MALFORMED" });
    const ordinary = zipSync({ "file.txt": strToU8("compressed") });
    const localNameTamper = ordinary.slice();
    localNameTamper[30] = 0x66; // central still names file.txt; change local name from f to f? next byte differs
    localNameTamper[31] = 0x41;
    expect(await detectLocalFile(asFile("corrupt.zip", localNameTamper))).toMatchObject({ status: "refused", reason: "MALFORMED" });
    const methodTamper = ordinary.slice();
    const centralOffset = methodTamper.findIndex((v, i) => v===80 && methodTamper[i+1]===75 && methodTamper[i+2]===1 && methodTamper[i+3]===2);
    expect(centralOffset).toBeGreaterThan(0);
    methodTamper[centralOffset+10] = 99;
    expect(await detectLocalFile(asFile("unsupported.zip", methodTamper))).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    const office = officeZip("docx");
    const mismatchCrc = office.slice();
    const cd = mismatchCrc.findIndex((v,i) => v===80 && mismatchCrc[i+1]===75 && mismatchCrc[i+2]===1 && mismatchCrc[i+3]===2);
    expect(cd).toBeGreaterThan(0);
    mismatchCrc[cd+16] = (mismatchCrc[cd+16] ?? 0) ^ 1;
    expect(await detectLocalFile(asFile("bad.docx", mismatchCrc, OOXML_MIME.docx))).toMatchObject({ status:"refused",reason:"MALFORMED" });
  });

  it("refuses unexpected ZIP preambles and malformed file sizes instead of reading attacker-sized ranges", async () => {
    const zip = zipSync({ "x.txt": strToU8("x") });
    const prefixed = new Uint8Array([0, ...zip]);
    expect(await detectLocalFile(asFile("appended.zip", prefixed))).toMatchObject({ status: "refused" });
    const fake = { name:"file.zip",type:"application/zip",size:Number.MAX_SAFE_INTEGER+1,
      slice() { throw Error("Never read"); }};
    expect(await detectLocalFile(fake)).toMatchObject({ status:"refused",reason:"MALFORMED",readBytes:0 });
  });

  it("does not attempt any full-file read on giant files, or read outside total inspection budget", async () => {
    const slices: Array<readonly [number, number]> = [];
    const base = asFile("data.pdf", new TextEncoder().encode("%PDF-1.7\n%%EOF\n"), "application/pdf");
    const fake = {
      name: "giant.pdf", type: "application/pdf", size: FILE_DETECTION_LIMITS.maxFileBytes + 1,
      slice(start: number, end: number) { slices.push([start,end]); return base.slice(start,end); }
    };
    expect(await detectLocalFile(fake)).toMatchObject({ status: "refused", reason: "TOO_LARGE" });
    expect(slices).toEqual([]);

    const zip = asFile("a.docx", officeZip("docx"), OOXML_MIME.docx);
    let total = 0;
    const traced = { name:zip.name,type:zip.type,size:zip.size, slice(start:number,end:number) {
      if (start < 0 || end > zip.size) throw Error("Out-of-range read");
      total += end - start;
      if (end - start > FILE_DETECTION_LIMITS.maxReadBytes) throw Error("Unbounded read");
      return zip.slice(start,end);
    }};
    expect(await detectLocalFile(traced)).toMatchObject({ status: "supported", format: "docx" });
    expect(total).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
  });

  it("supports cancellation and treats read failures as refusals", async () => {
    const abort = new AbortController(); abort.abort();
    expect(await detectLocalFile(asFile("pic.png", png), { signal: abort.signal })).toMatchObject({ status: "refused", reason: "CANCELLED" });
    const bad = { name:"broken.png",type:"image/png",size:100,slice(){ return { arrayBuffer: async()=>{ throw Error("Permission error"); } } as unknown as Blob; }};
    expect(await detectLocalFile(bad)).toMatchObject({ status: "refused", reason: "READ_FAILED" });
  });
});
