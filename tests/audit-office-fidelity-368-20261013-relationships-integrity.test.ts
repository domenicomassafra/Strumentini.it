import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICE_368_FIXTURES, inspectOoxml368 } from "../scripts/audit-office-fidelity-368";

const root = resolve(import.meta.dirname, "..");
const spike = resolve(root, "spikes/heavy-local-feasibility");
const donor = createRequire(resolve(spike, "package.json"));
const Zip = donor("jszip") as {
  loadAsync: (bytes: Buffer) => Promise<{
    file: (name: string, content?: string | Buffer) => { async: (type: "string") => Promise<string> } | null;
    generateAsync: (options: { type: "nodebuffer"; compression: "DEFLATE" }) => Promise<Buffer>;
  }>;
};
const { DOMParser } = donor("@xmldom/xmldom") as {
  DOMParser: new () => { parseFromString: (source: string, mime: string) => Document };
};

async function original(kind: keyof typeof OFFICE_368_FIXTURES): Promise<Buffer> {
  return readFile(resolve(root, OFFICE_368_FIXTURES[kind].relativePath));
}

describe("#368 OOXML independent evidence cannot silently undercount or accept invalid parts", () => {
  it("counts a genuine XLSX external relationship with legal whitespace around the XML equals sign", async () => {
    const zip = await Zip.loadAsync(await original("xlsx"));
    const name = "xl/worksheets/_rels/sheet1.xml.rels";
    const rels = await zip.file(name)!.async("string");
    expect(rels).toContain('TargetMode="External"');
    const altered = rels.replace('TargetMode="External"', 'TargetMode = "External"');
    zip.file(name, altered);
    const relDoc = new DOMParser().parseFromString(altered, "text/xml");
    const external = Array.from(relDoc.getElementsByTagName("Relationship"))
      .filter((rel) => rel.getAttribute("TargetMode") === "External");
    expect(external).toHaveLength(1);
    const source = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    expect((await inspectOoxml368(source, "xlsx", spike)).externalRelationshipCount).toBe(1);
  });

  it("rejects a DOCX whose main part is declared macro enabled using normal XML whitespace", async () => {
    const zip = await Zip.loadAsync(await original("docx"));
    const name = "[Content_Types].xml";
    const types = await zip.file(name)!.async("string");
    const ordinary = 'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"';
    expect(types).toContain(ordinary);
    const malicious = types.replace(ordinary,
      'ContentType = "application/vnd.ms-word.document.macroEnabled.main+xml"');
    zip.file(name, malicious);
    const doc = new DOMParser().parseFromString(malicious, "text/xml");
    expect(Array.from(doc.getElementsByTagName("Override"))
      .some((element) => element.getAttribute("ContentType")?.includes("macroEnabled"))).toBe(true);
    await expect(inspectOoxml368(
      await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), "docx", spike,
    )).rejects.toThrow(/ACTIVE_CONTENT_REFUSED/u);
  });

  it("rejects a valid DOCX payload with deliberately corrupted ZIP central-directory CRC", async () => {
    const source = Buffer.from(await original("docx"));
    let mutated = false;
    for (let i = 0; i + 46 < source.length; i++) {
      if (source.readUInt32LE(i) !== 0x02014b50) continue;
      const nameLength = source.readUInt16LE(i + 28);
      const name = source.toString("utf8", i + 46, i + 46 + nameLength);
      if (name !== "word/document.xml") continue;
      source[i + 16] = source[i + 16]! ^ 0x01;
      mutated = true;
      break;
    }
    expect(mutated).toBe(true);
    await expect(inspectOoxml368(source, "docx", spike)).rejects.toThrow(/INVALID_ZIP/u);
  });

  it("bounds actual decompression when the ZIP central directory understates the real byte size", async () => {
    const zip = await Zip.loadAsync(await original("docx"));
    const block = randomBytes(16 * 1024);
    const oversized = Buffer.alloc(18 * 1024 * 1024);
    for (let offset = 0; offset < oversized.length; offset += block.length) block.copy(oversized, offset);
    const name = "word/oversized.xml";
    zip.file(name, oversized);
    const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    expect(archive.length).toBeLessThan(2_097_152);
    let changed = false;
    for (let i = 0; i + 46 < archive.length; i++) {
      if (archive.readUInt32LE(i) !== 0x02014b50) continue;
      const nameLength = archive.readUInt16LE(i + 28);
      if (archive.toString("utf8", i + 46, i + 46 + nameLength) !== name) continue;
      const local = archive.readUInt32LE(i + 42);
      expect(archive.readUInt32LE(local)).toBe(0x04034b50);
      archive.writeUInt32LE(1024, i + 24);
      archive.writeUInt32LE(1024, local + 22);
      changed = true;
      break;
    }
    expect(changed).toBe(true);
    await expect(inspectOoxml368(archive, "docx", spike)).rejects.toThrow(/ZIP_EXPANSION_LIMIT/u);
  }, 30_000);
});
