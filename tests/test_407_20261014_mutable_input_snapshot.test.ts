import { describe, expect, it } from "vitest";
import { unzipSync, zipSync } from "fflate";
import { rebuildOoxmlPackage } from "../src/engines/ooxml/package-codec";
import { extractDocxSemantics } from "../src/engines/ooxml/office-semantics";
import { compressOoxmlEmbeddedMedia } from "../src/engines/ooxml/media-compress";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function mutableDocx(): { source: Uint8Array; offset: number } {
  const source = zipSync({
    "[Content_Types].xml": encoder.encode('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "_rels/.rels": encoder.encode('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": encoder.encode('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>AAAA</w:t></w:r></w:p></w:body></w:document>'),
  }, { level: 0 });
  const offset = Buffer.from(source).indexOf(Buffer.from("AAAA"));
  if (offset < 0) throw new Error("Expected stored fixture member is absent.");
  return { source, offset };
}

describe("#407 one input snapshot across asynchronous OOXML preflight/materialization", () => {
  it("rebuilds only the bytes that already passed CRC and bounded preflight", async () => {
    const { source, offset } = mutableDocx();
    const pending = rebuildOoxmlPackage(source);
    source[offset] = "Z".charCodeAt(0); // caller changes ZIP payload while async import is pending
    const result = await pending;
    const document = decoder.decode(unzipSync(new Uint8Array(result.bytes))["word/document.xml"]!);
    expect(document).toContain("AAAA");
    expect(document).not.toContain("ZAAA");
    expect(result.verification.memberBytesUnchanged).toBe(true);
  });

  it("semantic extraction does not consume a caller's unverified post-preflight mutation", async () => {
    const { source, offset } = mutableDocx();
    const pending = extractDocxSemantics(source);
    source[offset] = "Z".charCodeAt(0);
    const result = await pending;
    expect(JSON.stringify(result.blocks)).toContain("AAAA");
    expect(JSON.stringify(result.blocks)).not.toContain("ZAAA");
  });

  it("media-only compression cannot return a mutated unvalidated OOXML source", async () => {
    const { source, offset } = mutableDocx();
    const pending = compressOoxmlEmbeddedMedia(source);
    source[offset] = "Z".charCodeAt(0);
    const result = await pending;
    const document = decoder.decode(unzipSync(new Uint8Array(result.bytes))["word/document.xml"]!);
    expect(document).toContain("AAAA");
    expect(document).not.toContain("ZAAA");
  });
});
