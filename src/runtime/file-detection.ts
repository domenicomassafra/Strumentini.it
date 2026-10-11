import { inflateSync } from "fflate";
import { isBoundedCsvCandidate335 } from "./csv-candidate-335";
import {
  checkPdfBytes407,
  checkTextPart407,
  checkZipEntryType407,
  checkZipPath407,
  FILE_THREAT_LIMITS_407,
  textPartKind407,
  type FileThreatFinding407,
} from "./file-threat-gate-407";

/** #333: candidate routing only, never a file validator, sandbox or decoder. */
export const FILE_DETECTION_LIMITS = {
  maxFileBytes: 32 * 1024 * 1024,
  maxReadBytes: 256 * 1024,
  maxTotalReadBytes: 512 * 1024,
  maxZipEntries: 256,
  maxZipUncompressedBytes: 64 * 1024 * 1024,
  maxZipExpansionRatio: 100,
  maxOoxmlContentBytes: 32 * 1024,
  maxOoxmlContentCompressedBytes: 16 * 1024,
} as const;

export type LocalFileFormat = "pdf" | "png" | "jpeg" | "gif" | "webp" | "zip" | "docx" | "xlsx" | "pptx" | "csv";
export type LocalFileRefusalReason =
  | "EMPTY" | "TOO_LARGE" | "UNSUPPORTED" | "MALFORMED" | "POLYGLOT"
  | "MIME_MISMATCH" | "EXTENSION_MISMATCH" | "CANCELLED" | "READ_FAILED";

export interface LocalFileSource {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  slice(start?: number, end?: number): Blob;
}

export type LocalFileDetection =
  | {
      readonly status: "supported";
      readonly format: LocalFileFormat;
      readonly mime: string;
      readonly name: string;
      readonly bytes: number;
      readonly readBytes: number;
      readonly method: "bounded-signature-and-container-metadata";
      readonly note: "candidate only; decoding and content safety are not verified";
    }
  | {
      readonly status: "refused";
      readonly reason: LocalFileRefusalReason;
      readonly name: string;
      readonly bytes: number;
      readonly readBytes: number;
      readonly note: string;
    };

const MIME: Readonly<Record<LocalFileFormat, string>> = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
};

const EXT: Readonly<Record<string, LocalFileFormat>> = {
  pdf: "pdf", png: "png", jpg: "jpeg", jpeg: "jpeg", gif: "gif",
  webp: "webp", zip: "zip", docx: "docx", xlsx: "xlsx", pptx: "pptx", csv: "csv",
};
// Opaque binary extensions do not claim a parser. Named, unrecognized
// extensions (such as .exe, .svg or .txt) must not be offered to another engine.
const OPAQUE_EXTENSIONS = new Set(["bin", "dat", "blob"]);

const OOXML: Readonly<Record<"docx" | "xlsx" | "pptx", { root: string; contentType: string }>> = {
  docx: { root: "word/document.xml", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" },
  xlsx: { root: "xl/workbook.xml", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" },
  pptx: { root: "ppt/presentation.xml", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml" },
};

class Refusal extends Error {
  constructor(readonly reason: LocalFileRefusalReason, message: string) { super(message); }
}

function refuse(reason: LocalFileRefusalReason, message: string): never { throw new Refusal(reason, message); }
function refuseThreat(finding: FileThreatFinding407 | null): void {
  if (finding) refuse(finding.reason, finding.message);
}
function u16(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.byteLength) refuse("MALFORMED", "Truncated ZIP metadata.");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}
function u32(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.byteLength) refuse("MALFORMED", "Truncated ZIP metadata.");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}
function marker(bytes: Uint8Array, at: number, text: string): boolean {
  if (at < 0 || at + text.length > bytes.length) return false;
  for (let i=0; i<text.length; i++) if (bytes[at+i] !== text.charCodeAt(i)) return false;
  return true;
}
function signature(bytes: Uint8Array, at: number, sequence: readonly number[]): boolean {
  return sequence.every((b,i) => bytes[at+i] === b) && at+sequence.length <= bytes.length;
}

/** Check an observed contiguous window for an independently complete ZIP. */
function hasNestedZipContainer(bytes: Uint8Array): boolean {
  let local = false, central = false, end = false;
  for (let i=0; i+4<=bytes.length; i++) {
    if (bytes[i]!==0x50 || bytes[i+1]!==0x4b) continue;
    if (bytes[i+2]===3 && bytes[i+3]===4) local=true;
    if (bytes[i+2]===1 && bytes[i+3]===2) central=true;
    if (bytes[i+2]===5 && bytes[i+3]===6) end=true;
    if (local && central && end) return true;
  }
  return false;
}

function crc32(bytes: Uint8Array): number {
  let crc=0xffff_ffff;
  for (const b of bytes) {
    crc^=b;
    for(let j=0;j<8;j++) crc=(crc>>>1) ^ (crc&1 ? 0xedb8_8320 : 0);
  }
  return (crc^0xffff_ffff)>>>0;
}

class RangeReader {
  readBytes = 0;
  constructor(readonly file: LocalFileSource, readonly signal?: AbortSignal) {}
  async range(start: number, count: number): Promise<Uint8Array> {
    if (this.signal?.aborted) refuse("CANCELLED", "File inspection was cancelled.");
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || start < 0 || count < 0 || start+count > this.file.size) {
      refuse("MALFORMED", "Read range is outside the file.");
    }
    if (count > FILE_DETECTION_LIMITS.maxReadBytes || this.readBytes+count > FILE_DETECTION_LIMITS.maxTotalReadBytes) {
      refuse("TOO_LARGE", "Inspection exceeds the bounded local read budget.");
    }
    this.readBytes += count;
    try {
      const result = new Uint8Array(await this.file.slice(start,start+count).arrayBuffer());
      if (result.byteLength !== count) refuse("READ_FAILED", "File slice returned an incomplete range.");
      if (this.signal?.aborted) refuse("CANCELLED", "File inspection was cancelled.");
      return result;
    } catch (error) {
      if (error instanceof Refusal) throw error;
      refuse("READ_FAILED", "File slice could not be read locally.");
    }
  }
}

function requireDimensions(width: number, height: number) {
  if (width === 0 || height === 0 || width > 100_000 || height > 100_000) refuse("MALFORMED", "Image dimensions are invalid or outside this inspection profile.");
}

async function imageOrPdf(reader: RangeReader, first: Uint8Array, kind: "pdf"|"png"|"jpeg"|"gif"|"webp") {
  const size = reader.file.size;
  switch (kind) {
    case "pdf": {
      if (!/^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n)/u.test(new TextDecoder().decode(first.subarray(0,12)))) {
        refuse("MALFORMED", "PDF version header is incomplete or unsupported.");
      }
      const end = await reader.range(Math.max(0,size-1024),Math.min(size,1024));
      if (!/%%EOF\s*$/u.test(new TextDecoder().decode(end))) refuse("MALFORMED", "PDF has no final EOF marker.");
      // Entire PDFs up to 256 KiB are inspected. Larger ones are sampled at
      // the beginning and end; they remain candidates, never safety proofs.
      const window = FILE_THREAT_LIMITS_407.maxPdfWindowBytes;
      if (size <= 2*window) {
        const inspected = await reader.range(0,size);
        if (hasNestedZipContainer(inspected)) refuse("POLYGLOT", "PDF contains a second ZIP container within the inspected bytes.");
        refuseThreat(checkPdfBytes407(inspected));
      } else {
        for (const offset of [0,size-window]) {
          const inspected = await reader.range(offset,window);
          if (hasNestedZipContainer(inspected)) refuse("POLYGLOT", "PDF contains a second ZIP container within the inspected bytes.");
          refuseThreat(checkPdfBytes407(inspected));
        }
      }
      return;
    }
    case "png": {
      if (size < 45 || !marker(first,12,"IHDR") || u32be(first,8) !== 13) refuse("MALFORMED", "PNG IHDR is not well formed.");
      requireDimensions(u32be(first,16),u32be(first,20));
      const depths: Readonly<Record<number, readonly number[]>> = {
        0:[1,2,4,8,16], 2:[8,16], 3:[1,2,4,8], 4:[8,16], 6:[8,16],
      };
      if (!depths[first[25] ?? -1]?.includes(first[24] ?? -1) || first[26]!==0 || first[27]!==0 || (first[28]!==0 && first[28]!==1)) {
        refuse("MALFORMED", "PNG color/depth, compression or interlace header is not supported.");
      }
      if (crc32(first.subarray(12,29))!==u32be(first,29)) refuse("MALFORMED", "PNG IHDR CRC is invalid.");
      const end = await reader.range(size-12,12);
      if (!signature(end,0,[0,0,0,0,73,69,78,68,174,66,96,130])) refuse("MALFORMED", "PNG final IEND record is missing.");
      return;
    }
    case "jpeg": {
      if (size < 8 || !((first[3] ?? -1)>=0xe0 && (first[3] ?? -1)<=0xef) && ![0xdb,0xdd,0xc0,0xc1,0xc2,0xc3,0xc4,0xfe,0xda].includes(first[3] ?? -1)) {
        refuse("MALFORMED", "JPEG has no recognized initial marker.");
      }
      if (((first[4] ?? 0)<<8 | (first[5] ?? 0))<2) refuse("MALFORMED", "JPEG initial segment has an invalid length.");
      const end = await reader.range(size-2,2);
      if (!signature(end,0,[0xff,0xd9])) refuse("MALFORMED", "JPEG final EOI marker is missing.");
      // An independent ZIP within inspected JPEG bytes is not a supported
      // image candidate; image decoding still remains the downstream gate.
      const window=FILE_THREAT_LIMITS_407.maxPdfWindowBytes;
      if (size<=window*2) {
        if (hasNestedZipContainer(await reader.range(0,size))) refuse("POLYGLOT", "JPEG contains a ZIP container.");
      } else {
        if (hasNestedZipContainer(await reader.range(0,window)) ||
          hasNestedZipContainer(await reader.range(size-window,window))) refuse("POLYGLOT", "JPEG contains a ZIP container in inspected bytes.");
      }
      return;
    }
    case "gif": {
      if (size < 14 || (!marker(first,0,"GIF87a") && !marker(first,0,"GIF89a"))) refuse("MALFORMED", "Unsupported GIF version.");
      requireDimensions(u16(first,6),u16(first,8));
      const end = await reader.range(size-1,1);
      if (end[0] !== 0x3b) refuse("MALFORMED", "GIF trailer is missing.");
      return;
    }
    case "webp": {
      if (size < 20 || u32(first,4)+8 !== size || !["VP8 ","VP8L","VP8X"].some((type)=>marker(first,12,type))) {
        refuse("MALFORMED", "WebP RIFF bounds or codec chunk are invalid.");
      }
      if (20 + u32(first,16) + (u32(first,16)&1) > size) refuse("MALFORMED", "WebP first chunk exceeds RIFF bounds.");
    }
  }
}

function u32be(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.byteLength) refuse("MALFORMED", "Truncated big-endian field.");
  return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset,false);
}

interface ZipEntry {
  readonly name: string;
  readonly offset: number;
  readonly compression: number;
  readonly flags: number;
  readonly packed: number;
  readonly unpacked: number;
  readonly crc: number;
  dataStart?: number;
}

const textDecoder = new TextDecoder("utf-8", { fatal: true });

function zipPath(bytes: Uint8Array): string {
  let name: string;
  try { name = textDecoder.decode(bytes); } catch { refuse("MALFORMED", "ZIP name is not UTF-8."); }
  if (name.length===0 || name.includes("\\") || name.includes("\u0000") || name.startsWith("/") || /^[A-Za-z]:/u.test(name) || name.split("/").some((part)=>part===".." || part===".")) {
    refuse("MALFORMED", "ZIP contains an unsafe member name.");
  }
  refuseThreat(checkZipPath407(name));
  return name;
}

function noZip64(extra: Uint8Array) {
  let i=0;
  while(i < extra.length) {
    if (i+4>extra.length) refuse("MALFORMED", "Truncated ZIP extra field.");
    const id=u16(extra,i), length=u16(extra,i+2);
    i+=4;
    if (i+length>extra.length) refuse("MALFORMED", "ZIP extra field exceeds bounds.");
    if (id===1) refuse("UNSUPPORTED", "ZIP64 is outside the supported profile.");
    i+=length;
  }
}

async function inspectZip(reader: RangeReader): Promise<LocalFileFormat> {
  const size = reader.file.size;
  if (size < 22) refuse("MALFORMED", "ZIP has no central directory.");
  const tailSize=Math.min(size,65_557);
  const tailStart=size-tailSize;
  const tail=await reader.range(tailStart,tailSize);
  let eof=-1;
  for(let i=tail.length-22;i>=0;i--) {
    if (marker(tail,i,"PK\u0005\u0006") && i+22+u16(tail,i+20)===tail.length) { eof=i;break; }
  }
  if (eof < 0) refuse("MALFORMED", "ZIP end-of-central-directory is missing or truncated.");
  const disk=u16(tail,eof+4), centralDisk=u16(tail,eof+6);
  const countDisk=u16(tail,eof+8), count=u16(tail,eof+10);
  const centralSize=u32(tail,eof+12), centralOffset=u32(tail,eof+16);
  const eocdOffset=tailStart+eof;
  if (disk || centralDisk || count!==countDisk || count===65535 || centralOffset===0xffff_ffff || centralSize===0xffff_ffff) {
    refuse("UNSUPPORTED", "Multi-disk or ZIP64 archive is not supported.");
  }
  if (count > FILE_DETECTION_LIMITS.maxZipEntries || centralSize > FILE_DETECTION_LIMITS.maxReadBytes) {
    refuse("TOO_LARGE", "ZIP directory exceeds the inspection budget.");
  }
  if (centralOffset+centralSize!==eocdOffset || (count===0 && centralSize!==0) || (count!==0 && centralOffset===0)) {
    refuse("MALFORMED", "ZIP directory bounds are inconsistent or contain trailing content.");
  }
  const central=await reader.range(centralOffset,centralSize);
  const entries: ZipEntry[]=[];
  const unique=new Set<string>();
  let cursor=0,totalUnpacked=0;
  for(let i=0;i<count;i++) {
    if (!marker(central,cursor,"PK\u0001\u0002") || cursor+46>central.length) refuse("MALFORMED", "ZIP central entry is truncated.");
    const flags=u16(central,cursor+8), method=u16(central,cursor+10);
    const crc=u32(central,cursor+16), packed=u32(central,cursor+20), unpacked=u32(central,cursor+24);
    const n=u16(central,cursor+28),ex=u16(central,cursor+30),comment=u16(central,cursor+32);
    const offset=u32(central,cursor+42), end=cursor+46+n+ex+comment;
    if (end>central.length || !n) refuse("MALFORMED", "ZIP entry name/extra is truncated.");
    if (flags & (1 | 0x20 | 0x40 | 0x2000)) refuse("UNSUPPORTED", "Encrypted or modified ZIP entries are unsupported.");
    if (method!==0 && method!==8) refuse("UNSUPPORTED", "ZIP method is outside the supported profile.");
    if (packed===0xffff_ffff || unpacked===0xffff_ffff || offset===0xffff_ffff) refuse("UNSUPPORTED", "ZIP64 entry is unsupported.");
    noZip64(central.subarray(cursor+46+n,cursor+46+n+ex));
    const name=zipPath(central.subarray(cursor+46,cursor+46+n));
    if (u16(central,cursor+34)!==0) refuse("UNSUPPORTED", "ZIP entry references a different disk.");
    refuseThreat(checkZipEntryType407(u16(central,cursor+4),u32(central,cursor+38),name));
    if (/\.(?:zip|7z|rar|tar|gz|bz2|xz|svgz)$/iu.test(name)) {
      refuse("UNSUPPORTED", "Nested archives require a separate sandboxed resource check.");
    }
    // ZIP entry names may be normalized by the eventual extractor/filesystem.
    // Refuse collisions *before* materialization, not just bytewise duplicates.
    const canonicalName=name.normalize("NFKC").toLowerCase();
    if (unique.has(canonicalName)) refuse("MALFORMED", "Duplicate ZIP entry paths are ambiguous.");
    unique.add(canonicalName);
    if (offset>=centralOffset) refuse("MALFORMED", "ZIP local member offset is outside data area.");
    totalUnpacked+=unpacked;
    if (totalUnpacked>FILE_DETECTION_LIMITS.maxZipUncompressedBytes || (packed===0 ? unpacked>0 : unpacked/packed>FILE_DETECTION_LIMITS.maxZipExpansionRatio)) {
      refuse("TOO_LARGE", "ZIP declared decompression exceeds the supported resource limits.");
    }
    entries.push({name,offset,compression:method,flags,packed,unpacked,crc});
    cursor=end;
  }
  if (cursor!==central.length) refuse("MALFORMED", "ZIP directory has unused or unparsed bytes.");
  if (count===0) {
    if (eocdOffset!==0) refuse("POLYGLOT", "Empty ZIP has unexpected prefix bytes.");
    return "zip";
  }

  let firstOffset=Number.POSITIVE_INFINITY;
  const regions: Array<{start:number;end:number}>=[];
  for(const entry of entries) {
    firstOffset=Math.min(firstOffset,entry.offset);
    const local=await reader.range(entry.offset,30);
    if (!marker(local,0,"PK\u0003\u0004")) refuse("MALFORMED", "ZIP local header does not match central directory.");
    const flags=u16(local,6),method=u16(local,8),len=u16(local,26),extra=u16(local,28);
    if (flags!==entry.flags || method!==entry.compression) refuse("MALFORMED", "ZIP local entry flags or method mismatch.");
    if (len+extra>4_096) refuse("TOO_LARGE", "ZIP local header is outside the bounded profile.");
    const fields=await reader.range(entry.offset+30,len+extra);
    noZip64(fields.subarray(len));
    if (zipPath(fields.subarray(0,len))!==entry.name) refuse("MALFORMED", "ZIP local name differs from central name.");
    if (!(flags&8) && (u32(local,18)!==entry.packed || u32(local,22)!==entry.unpacked || u32(local,14)!==entry.crc)) {
      refuse("MALFORMED", "ZIP local sizes/CRC do not match central directory.");
    }
    const dataStart=entry.offset+30+len+extra;
    if (dataStart+entry.packed>centralOffset) refuse("MALFORMED", "ZIP member overlaps the central directory.");
    entry.dataStart=dataStart;
    let dataEnd=dataStart+entry.packed;
    if (flags&8) {
      // Data descriptors follow the compressed stream and may have a PK\x07\x08
      // signature. They must agree with the central directory, without gaps.
      const available=Math.min(16,centralOffset-dataEnd);
      if (available<12) refuse("MALFORMED", "ZIP data descriptor is incomplete.");
      const descriptor=await reader.range(dataEnd,available);
      const signed=marker(descriptor,0,"PK\u0007\u0008");
      const descriptorSize=signed?16:12;
      if (available<descriptorSize || u32(descriptor,signed?4:0)!==entry.crc ||
        u32(descriptor,signed?8:4)!==entry.packed || u32(descriptor,signed?12:8)!==entry.unpacked) {
        refuse("MALFORMED", "ZIP data descriptor and central directory disagree.");
      }
      dataEnd+=descriptorSize;
    }
    regions.push({start:entry.offset,end:dataEnd});
  }
  if (firstOffset!==0) refuse("POLYGLOT", "ZIP archive has an unexpected leading prefix.");
  regions.sort((a,b)=>a.start-b.start);
  for(let i=1;i<regions.length;i++) if (regions[i]!.start!==regions[i-1]!.end) refuse("POLYGLOT", "ZIP local entries overlap or hide unindexed data.");
  if (regions.at(-1)!.end!==centralOffset) refuse("POLYGLOT", "ZIP contains hidden data ahead of its central directory.");

  // Only a small and fully bounded subset of archive text can be safely
  // inspected inline. Refuse archives requiring unbounded XML/SVG processing.
  let textBytes=0,textParts=0;
  const parsedText=new Map<string,Uint8Array>();
  for (const entry of entries) {
    const kind=textPartKind407(entry.name);
    if (!kind) continue;
    if (reader.signal?.aborted) refuse("CANCELLED", "File inspection was cancelled.");
    if (++textParts>FILE_THREAT_LIMITS_407.maxTextParts ||
      entry.unpacked>FILE_THREAT_LIMITS_407.maxTextPartBytes ||
      (textBytes+=entry.unpacked)>FILE_THREAT_LIMITS_407.maxTotalTextBytes) {
      refuse("TOO_LARGE", "ZIP XML/SVG inspection exceeds the bounded text budget.");
    }
    const packed=await reader.range(entry.dataStart!,entry.packed);
    let extracted:Uint8Array;
    try { extracted=entry.compression===0?packed:inflateSync(packed,{out:new Uint8Array(entry.unpacked+1)}); }
    catch { refuse("MALFORMED", "ZIP XML/SVG stream could not be decoded."); }
    if (reader.signal?.aborted) refuse("CANCELLED", "File inspection was cancelled.");
    if (extracted.length!==entry.unpacked || crc32(extracted)!==entry.crc) {
      refuse("MALFORMED", "ZIP XML/SVG decompression or CRC mismatches the directory.");
    }
    let xml:string;
    try { xml=textDecoder.decode(extracted); }
    catch { refuse("MALFORMED", "ZIP XML/SVG is not valid UTF-8."); }
    refuseThreat(checkTextPart407(xml,kind));
    parsedText.set(entry.name,extracted);
  }

  const present=(path:string) => entries.some((entry)=>entry.name===path);
  const kinds=Object.entries(OOXML).filter(([,v])=>present(v.root)) as Array<["docx"|"xlsx"|"pptx",{root:string;contentType:string}]>;
  if (kinds.length>1) refuse("POLYGLOT", "ZIP has multiple conflicting OOXML package roots.");
  if (entries.some(({name})=>/(?:^|\/)vbaProject\.bin$|macroEnabled/iu.test(name))) refuse("UNSUPPORTED", "Macro-enabled OOXML package is unsupported.");
  if (kinds.length===0) return "zip";
  if (!present("[Content_Types].xml") || !present("_rels/.rels")) refuse("MALFORMED", "OOXML core content types or root relationship is absent.");
  const content=entries.find((entry)=>entry.name==="[Content_Types].xml")!;
  if (content.unpacked > FILE_DETECTION_LIMITS.maxOoxmlContentBytes || content.packed > FILE_DETECTION_LIMITS.maxOoxmlContentCompressedBytes) {
    refuse("TOO_LARGE", "OOXML content types are outside the bounded parse profile.");
  }
  let xmlBytes: Uint8Array;
  const source=parsedText.get(content.name) ?? await reader.range(content.dataStart!,content.packed);
  try {
    xmlBytes=parsedText.has(content.name) || content.compression===0 ? source : inflateSync(source, {
      // fflate's default output allocation follows the stream's claims;
      // fix the allocation to the declared (bounded) size plus one byte so
      // an adversarial expansion can be refused without unbounded output.
      out: new Uint8Array(content.unpacked+1),
    });
  }
  catch { refuse("MALFORMED", "OOXML content types could not be decoded."); }
  if (xmlBytes.byteLength!==content.unpacked || xmlBytes.byteLength>FILE_DETECTION_LIMITS.maxOoxmlContentBytes) {
    refuse("MALFORMED", "OOXML content types decompressed length is inconsistent.");
  }
  if (crc32(xmlBytes)!==content.crc) refuse("MALFORMED", "OOXML content types CRC differs from ZIP metadata.");
  let xml: string;
  try { xml=textDecoder.decode(xmlBytes); } catch { refuse("MALFORMED", "OOXML content types are not valid UTF-8."); }
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml) || !/<Types\b[^>]*xmlns\s*=\s*["']http:\/\/schemas\.openxmlformats\.org\/package\/2006\/content-types["']/u.test(xml)) {
    refuse("MALFORMED", "OOXML content types root is not supported.");
  }
  // Strip comments, then require one explicit main-part override matching the
  // real central-directory root. This is safe candidate classification only.
  const clean=xml.replace(/<!--[\s\S]*?-->/gu,"");
  const expected=kinds[0]!;
  const overrides=[...clean.matchAll(/<Override\b[^>]*\/?>/gu)].map((m)=>m[0]);
  const hasMain=overrides.some((line) =>
    new RegExp(`\\bPartName\\s*=\\s*["']/${expected[1].root.replaceAll(".","\\.")}["']`,"u").test(line)
      && line.includes(`ContentType="${expected[1].contentType}"`) ||
    new RegExp(`\\bPartName\\s*=\\s*'/${expected[1].root.replaceAll(".","\\.")}'`,"u").test(line)
      && line.includes(`ContentType='${expected[1].contentType}'`)
  );
  if (!hasMain) refuse("MALFORMED", "OOXML main-part content type disagrees with the central directory.");
  return expected[0];
}

function declaredMime(type: string): string {
  return type.trim().toLowerCase().split(";",1)[0] ?? "";
}

function recognized(first:Uint8Array): "pdf"|"png"|"jpeg"|"gif"|"webp"|"zip"|null {
  if (marker(first,0,"%PDF")) return "pdf";
  if (signature(first,0,[137,80,78,71,13,10,26,10])) return "png";
  if (signature(first,0,[255,216,255])) return "jpeg";
  if (marker(first,0,"GIF8")) return "gif";
  if (marker(first,0,"RIFF") && marker(first,8,"WEBP")) return "webp";
  if (marker(first,0,"PK\u0003\u0004") || marker(first,0,"PK\u0005\u0006")) return "zip";
  return null;
}

/**
 * No network, upload, eager file.arrayBuffer(), URL creation or active document rendering.
 * ZIP text-part inflation is bounded and inspected as untrusted bytes.
 * `File.type` and extension are never evidence sufficient for routing. Returns
 * a refusal for inconsistent claims and structural edge cases; success remains
 * explicitly a candidate requiring a downstream format-specific validation.
 */
export async function detectLocalFile(file: LocalFileSource, options: {readonly signal?:AbortSignal}={}): Promise<LocalFileDetection> {
  const reader=new RangeReader(file,options.signal);
  try {
    if (options.signal?.aborted) refuse("CANCELLED", "Inspection was cancelled.");
    if (!Number.isSafeInteger(file.size) || file.size<0 || typeof file.name!=="string" || typeof file.type!=="string") {
      refuse("MALFORMED", "File metadata is invalid.");
    }
    if (file.size===0) refuse("EMPTY", "Empty files cannot be classified.");
    if (file.size>FILE_DETECTION_LIMITS.maxFileBytes) refuse("TOO_LARGE", "File exceeds the local inspection limit.");
    const first=await reader.range(0,Math.min(64,file.size));
    const found=recognized(first);
    let format:LocalFileFormat;
    if (found===null) {
      // Unstructured text has no magic number. Do not infer CSV from just its
      // extension/MIME: require every byte of a bounded, consistent CSV body.
      const claimedCsv=/\.csv$/iu.test(file.name);
      const actual=declaredMime(file.type);
      if (!claimedCsv || (actual && actual!=="text/csv" && actual!=="application/octet-stream")) {
        refuse("UNSUPPORTED", "No supported file signature is present.");
      }
      if (file.size > FILE_DETECTION_LIMITS.maxReadBytes) {
        refuse("TOO_LARGE", "CSV cannot be checked completely within the local inspection budget.");
      }
      if (!isBoundedCsvCandidate335(await reader.range(0,file.size))) {
        refuse("MALFORMED", "CSV structure is incomplete or ambiguous.");
      }
      format="csv";
    } else {
      format=found;
      if (found==="zip") format=await inspectZip(reader);
      else await imageOrPdf(reader,first,found);
    }
    const mime=MIME[format];
    const actual=declaredMime(file.type);
    if (actual && actual!=="application/octet-stream" && actual!=="binary/octet-stream" &&
      !(format==="zip" && actual==="application/x-zip-compressed") && actual!==mime) {
      refuse("MIME_MISMATCH", "Declared MIME disagrees with locally inspected bytes.");
    }
    const match=/\.([^.\\/]+)$/u.exec(file.name);
    const extension=match?.[1]?.toLowerCase() ?? "";
    if (extension && (Object.hasOwn(EXT,extension) ? EXT[extension]!==format : !OPAQUE_EXTENSIONS.has(extension))) {
      refuse("EXTENSION_MISMATCH", "File extension disagrees with locally inspected bytes.");
    }
    return {status:"supported",format,mime,name:file.name,bytes:file.size,readBytes:reader.readBytes,
      method:"bounded-signature-and-container-metadata",note:"candidate only; decoding and content safety are not verified"};
  } catch(error) {
    const reason=error instanceof Refusal?error.reason:"READ_FAILED";
    return {status:"refused",reason,name:file.name,bytes:file.size,readBytes:reader.readBytes,
      note:error instanceof Refusal?error.message:"Local inspection failed."};
  }
}
