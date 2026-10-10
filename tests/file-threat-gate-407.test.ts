import { describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";
import { checkZipPath407, FILE_THREAT_LIMITS_407 } from "../src/runtime/file-threat-gate-407";

const asFile = (name: string, bytes: Uint8Array, mime = ""): File => new File([new Uint8Array(bytes)], name, {type:mime});
const bytes = (s: string): Uint8Array => strToU8(s);
const pdf = (body: string): File => asFile("sample.pdf",bytes(`%PDF-1.7\n1 0 obj\n${body}\nendobj\n%%EOF\n`),"application/pdf");
const pack = (members: Record<string,Uint8Array>): Uint8Array => zipSync(members,{level:6});

function centralOffset(data: Uint8Array): number {
  for (let i=0;i<data.length-4;i++) {
    if (data[i]===80 && data[i+1]===75 && data[i+2]===1 && data[i+3]===2) return i;
  }
  throw Error("Missing fixture central directory");
}

function withSymlink(data: Uint8Array): Uint8Array {
  const copy=data.slice();
  const central=centralOffset(copy);
  const view=new DataView(copy.buffer);
  view.setUint16(central+4,(3<<8)|20,true); // UNIX central entry
  view.setUint32(central+38,0xa1ff_0000,true); // 0120777 symlink
  return copy;
}

function withUnindexedGap(data: Uint8Array): Uint8Array {
  const cd=centralOffset(data);
  const injected=bytes("INJECTED-BYTES");
  const out=new Uint8Array(data.length+injected.length);
  out.set(data.subarray(0,cd));
  out.set(injected,cd);
  out.set(data.subarray(cd),cd+injected.length);
  const eocd=out.length-22;
  expect(String.fromCharCode(...out.subarray(eocd,eocd+4))).toBe("PK\u0005\u0006");
  new DataView(out.buffer).setUint32(eocd+16,cd+injected.length,true);
  return out;
}

describe("#407 bounded hostile-format preflight in the actual detector", () => {
  it("accepts ordinary document, archive and small inert PDF candidates", async () => {
    const safe = pack({"hello.txt":bytes("data"),"readme.xml":bytes("<root><item>Hello</item></root>"),"assets/shape.svg":bytes('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')});
    expect(await detectLocalFile(asFile("safe.zip",safe))).toMatchObject({status:"supported",format:"zip"});
    expect(await detectLocalFile(pdf("<< /Type /Catalog >>"))).toMatchObject({status:"supported",format:"pdf"});
    const xml='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
    const office=pack({"[Content_Types].xml":bytes(xml),"_rels/.rels":bytes("<Relationships/>"),"word/document.xml":bytes("<document>Hi</document>")});
    expect(await detectLocalFile(asFile("good.docx",office))).toMatchObject({status:"supported",format:"docx"});
  });

  it.each([
    ["XML entity",{"word/document.xml":bytes('<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><x>&secret;</x>')}],
    ["XML stylesheet",{"docs/info.xml":bytes('<?xml-stylesheet href="https://bad.test/a.xsl"?><root/>')}],
    ["external OOXML link",{"word/_rels/document.xml.rels":bytes('<Relationships><Relationship TargetMode="External" Target="file:///etc/passwd"/></Relationships>')}],
    ["SVG javascript",{"images/logo.svg":bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')}],
    ["SVG external image",{"images/logo.svg":bytes('<svg><image href="https://bad.test/a.svg"/></svg>')}],
    ["SVG entity obfuscation",{"images/logo.svg":bytes('<svg><a href="&#x6a;avascript:alert(1)">x</a></svg>')}],
    ["HTML active markup",{"assets/x.html":bytes('<html><script>alert(1)</script></html>')}],
  ] as const)("refuses %s within compressed archive members without parsing them into a DOM", async (_, members) => {
    const file=asFile("payload.zip",pack(members));
    expect(await detectLocalFile(file)).toMatchObject({status:"refused",reason:"UNSUPPORTED"});
  });

  it("refuses dangerous member names, normalization traversal, device attributes, nested archives and gaps", async () => {
    for (const name of ["../evil", "a/../evil", "a//evil", "a/./b", "a/C:/evil", "a\\b", "a/\u202eevil", "\uff0e\uff0e/evil", "a/evil. ", "a/evil\u0000name"]) {
      expect(checkZipPath407(name)).not.toBeNull();
      const result=await detectLocalFile(asFile("name.zip",pack({[name]:bytes("x")})));
      expect(result).toMatchObject({status:"refused",reason:"MALFORMED"});
    }
    expect(await detectLocalFile(asFile("link.zip",withSymlink(pack({"link":bytes("target")}))))).toMatchObject({status:"refused",reason:"UNSUPPORTED"});
    expect(await detectLocalFile(asFile("inner.zip",pack({"nested.zip":pack({"file":bytes("a")})})))).toMatchObject({status:"refused",reason:"UNSUPPORTED"});
    expect(await detectLocalFile(asFile("gap.zip",withUnindexedGap(pack({"ok.txt":bytes("ok")}))))).toMatchObject({status:"refused",reason:"POLYGLOT"});
  });

  it("refuses inflated XML beyond the bounded budget and highly compressed zip bombs", async () => {
    // Deterministic printable pseudo-random payload avoids accidentally failing
    // only the expansion-ratio check; XML is larger than the configured cap.
    let seed=0x12345678;
    const over=new Uint8Array(FILE_THREAT_LIMITS_407.maxTextPartBytes+1);
    for (let i=0;i<over.length;i++) {
      seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
      over[i]=33+(seed>>>0)%94;
    }
    const large=await detectLocalFile(asFile("big.zip",pack({"text.xml":over})));
    expect(large).toMatchObject({status:"refused",reason:"TOO_LARGE"});
    const bomb=await detectLocalFile(asFile("bomb.zip",pack({"payload.txt":new Uint8Array(512*1024)})));
    expect(bomb).toMatchObject({status:"refused",reason:"TOO_LARGE"});
    const many: Record<string,Uint8Array>={};
    for(let i=0;i<FILE_THREAT_LIMITS_407.maxTextParts+1;i++) many[`x${i}.xml`]=bytes(`<r n="${i}"/>`);
    expect(await detectLocalFile(asFile("many.zip",pack(many)))).toMatchObject({status:"refused",reason:"TOO_LARGE"});
  });

  it("blocks observed PDF actions including hex-encoded PDF names, while retaining structural failures", async () => {
    for (const token of ["/JavaScript", "/J#61vaScript", "/JS", "/OpenAction", "/Launch", "/EmbeddedFile", "/AA", "/RichMedia"]) {
      expect(await detectLocalFile(pdf(`<< ${token} (danger) >>`))).toMatchObject({status:"refused",reason:"UNSUPPORTED"});
    }
    const trailing=bytes("%PDF-1.7\n"+".".repeat(300*1024)+"\n/JavaScript (danger)\n%%EOF\n");
    expect(await detectLocalFile(asFile("trailing.pdf",trailing))).toMatchObject({status:"refused",reason:"UNSUPPORTED"});
    const harmless=bytes("%PDF-1.7\n"+".".repeat(300*1024)+"\n%%EOF\n");
    expect(await detectLocalFile(asFile("large.pdf",harmless))).toMatchObject({status:"supported",format:"pdf",note:"candidate only; decoding and content safety are not verified"});
    expect(await detectLocalFile(asFile("truncated.pdf",bytes("%PDF-1.7\n1 0 obj\n")))).toMatchObject({status:"refused",reason:"MALFORMED"});
  });

  it("never fetches, obeys aggregate read limits and aborts while scanning archive text", async () => {
    const fetchSpy=vi.spyOn(globalThis,"fetch");
    try {
      const many=pack({"a.xml":bytes("<a/>"),"b.xml":bytes("<b/>"),"c.xml":bytes("<c/>")});
      const input=asFile("cancel.zip",many);
      const controller=new AbortController();
      let total=0,reads=0;
      const traced={name:input.name,type:input.type,size:input.size,slice(start=0,end=input.size) {
        if (end-start>FILE_DETECTION_LIMITS.maxReadBytes) throw Error("Oversized range");
        total+=end-start;
        reads++;
        if (reads===5) controller.abort();
        return input.slice(start,end);
      }};
      expect(await detectLocalFile(traced,{signal:controller.signal})).toMatchObject({status:"refused",reason:"CANCELLED"});
      expect(reads).toBeGreaterThanOrEqual(5);
      expect(total).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {fetchSpy.mockRestore();}
  });
});
