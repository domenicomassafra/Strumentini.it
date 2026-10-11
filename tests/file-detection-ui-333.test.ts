import { describe, expect, it, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";

const b = (text: string) => new TextEncoder().encode(text);
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aRAAAAAASUVORK5CYII=", "base64"));
const file = (name:string, bytes:Uint8Array, type="") => new File([new Uint8Array(bytes)],name,{type});

describe("#333 real picker candidate type boundary", () => {
  it("refuses a genuine PNG masquerading as executable/script/text while keeping opaque .bin and no extension", async () => {
    for (const ext of ["exe", "js", "html", "svg", "txt", "pdf"]) {
      const actual=await detectLocalFile(file(`disguised.${ext}`,png));
      expect(actual,`for .${ext}`).toMatchObject({status:"refused",reason:"EXTENSION_MISMATCH"});
    }
    expect(await detectLocalFile(file("image.bin",png))).toMatchObject({status:"supported",format:"png"});
    expect(await detectLocalFile(file("image",png))).toMatchObject({status:"supported",format:"png"});
  });

  it("refuses PDF/ZIP and JPEG/ZIP polyglots even when PDF EOF or JPEG EOI is restored", async () => {
    const packed=zipSync({"embedded.txt":strToU8("independent container")});
    const pdfHybrid=new Uint8Array([...b("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"),...packed,...b("\n%%EOF\n")]);
    const jpegHybrid=new Uint8Array([0xff,0xd8,0xff,0xe0,0,2,...packed,0xff,0xd9]);
    expect(await detectLocalFile(file("hybrid.pdf",pdfHybrid,"application/pdf"))).toMatchObject({status:"refused",reason:"POLYGLOT"});
    expect(await detectLocalFile(file("hybrid.jpg",jpegHybrid,"image/jpeg"))).toMatchObject({status:"refused",reason:"POLYGLOT"});
  });

  it("never reads oversized content or sends a network request when MIME disagrees", async () => {
    const fetchSpy=vi.spyOn(globalThis,"fetch");
    try {
      const ranges:Array<[number,number]>=[];
      const fake={name:"claimed.png",type:"application/pdf",size:png.length,slice(start=0,end=png.length){ranges.push([start,end]);return file("actual.png",png).slice(start,end);}};
      expect(await detectLocalFile(fake)).toMatchObject({status:"refused",reason:"MIME_MISMATCH"});
      expect(ranges.reduce((total,[start,end])=>total+(end-start),0)).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {fetchSpy.mockRestore();}
  });
});
