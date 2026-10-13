/**
 * #378: independent, local-only forensic acceptance gate for actual exported
 * PDF bytes. It never imports the #237 writer/parser/verifier and never grants
 * a Gold or release approval. Requires Python pypdf AND native macOS PDFKit;
 * absence, timeout, malformed input or disagreement is a refusal.
 *
 * CLI: node --import tsx scripts/forensic-redaction-378.ts
 *      --source source.pdf --output redacted.pdf --plan plan.json
 */
import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export interface ForensicRect378 {
  readonly page: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}
export interface ForensicPage378 {
  readonly page: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly regions: readonly ForensicRect378[];
}
export interface ForensicPlan378 {
  /** Explicit source witness tokens; none may survive anywhere in the output. */
  readonly sourceWitnesses: readonly string[];
  readonly pages: readonly ForensicPage378[];
}
export interface ForensicGateReceipt378 {
  readonly status: "INDEPENDENT_SAMPLE_PASS_NOT_RELEASE";
  readonly pages: number;
  readonly blackPixels: number;
  readonly outputBytes: number;
  readonly witnessesChecked: number;
  readonly parsers: readonly ["pypdf-strict", "macOS-PDFKit"];
}
export interface GateDependencies378 {
  /** Test-only fault injection for missing executables; defaults are strict. */
  readonly python?: string;
  readonly swift?: string;
}

function refuse(reason: string): never {
  throw new Error(`FORENSIC_378_REFUSED: ${reason}`);
}

function validatePlan(source: Uint8Array, output: Uint8Array, plan: ForensicPlan378): void {
  if (!source.length || source.length > 8 * 1024 * 1024 || !output.length || output.length > 24 * 1024 * 1024) {
    refuse("bounded PDF source/output size exceeded");
  }
  if (!source.subarray(0, 5).every((byte, index) => byte === [37, 80, 68, 70, 45][index])
    || !output.subarray(0, 5).every((byte, index) => byte === [37, 80, 68, 70, 45][index])) {
    refuse("PDF signature missing");
  }
  if (!Array.isArray(plan.pages) || plan.pages.length < 1 || plan.pages.length > 4
    || !Array.isArray(plan.sourceWitnesses) || plan.sourceWitnesses.length < 1 || plan.sourceWitnesses.length > 16) {
    refuse("missing explicit pages or source witnesses");
  }
  for (const marker of plan.sourceWitnesses) {
    if (typeof marker !== "string" || marker.length < 8 || marker.length > 128
      || !/^[\x20-\x7e]+$/u.test(marker)) refuse("unsafe source witness");
    if (!Buffer.from(source).includes(Buffer.from(marker, "utf8"))) refuse("source witness not present in original bytes");
  }
  for (const [index, page] of plan.pages.entries()) {
    if (page.page !== index + 1 || !Number.isSafeInteger(page.pixelWidth) || !Number.isSafeInteger(page.pixelHeight)
      || page.pixelWidth < 1 || page.pixelHeight < 1 || page.pixelWidth * page.pixelHeight > 1_600_000
      || !Number.isFinite(page.pageWidth) || !Number.isFinite(page.pageHeight)
      || page.pageWidth < 1 || page.pageHeight < 1 || page.pageWidth > 1200 || page.pageHeight > 1200
      || !Array.isArray(page.regions)) refuse("unsupported plan geometry");
    for (const region of page.regions) {
      if (region.page !== page.page || ![region.left, region.top, region.width, region.height].every(Number.isFinite)
        || region.left < 0 || region.top < 0 || region.width <= 0 || region.height <= 0
        || region.left + region.width > 1 || region.top + region.height > 1) refuse("invalid redaction region");
    }
  }
  if (!plan.pages.some((page) => page.regions.length > 0)) refuse("no redacted area");
}

// Self-contained Python, deliberately independent of src/engines/pdf and of
// the existing #237 fixtures, so it can be run against arbitrary real output.
const PYTHON_INSPECTOR_378 = String.raw`
import base64, io, json, math, re, sys, zlib
from pypdf import PdfReader
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, StreamObject

def deny(msg): raise RuntimeError("pypdf-378: " + msg)
payload=json.loads(sys.stdin.buffer.read())
source=base64.b64decode(payload["source"],validate=True)
raw=base64.b64decode(payload["output"],validate=True)
plan=payload["plan"]
for token in plan["sourceWitnesses"]:
    needle=token.encode("ascii")
    if needle not in source: deny("original witness absent")
    if needle in raw: deny("raw source witness survived")
if not re.search(rb"\n%%EOF\n?$",raw) or raw.count(b"startxref")!=1 or raw.count(b"%%EOF")!=1:
    deny("noncanonical footer/revision/trailing bytes")
pdf=PdfReader(io.BytesIO(raw),strict=True)
if pdf.is_encrypted or pdf.metadata is not None: deny("encryption or recovered document metadata")
root=pdf.trailer["/Root"]
if set(root.keys())!={"/Type","/Pages"}: deny("catalog extras/embedded metadata")
if set(pdf.trailer.keys())-{"/Size","/Root"}: deny("trailer metadata or extra keys")
if len(pdf.pages)!=len(plan["pages"]): deny("page count mismatch")
# A reachable /Pages dictionary is not visible in pdf.pages' per-page key
# checks. Reject private values or metadata hidden in parent/intermediate tree
# nodes, and verify the exact parent/child/count structure of this raster subset.
page_tree_seen=set()
def assert_page_tree(tree_ref,parent_ref=None,depth=0):
    if not isinstance(tree_ref,IndirectObject) or depth>8:
        deny("invalid Pages tree reference or depth")
    key=(tree_ref.idnum,tree_ref.generation)
    if key in page_tree_seen: deny("cyclic or shared Pages tree")
    page_tree_seen.add(key)
    node=tree_ref.get_object()
    keys={"/Type","/Kids","/Count"}
    if parent_ref is not None: keys.add("/Parent")
    if not isinstance(node,DictionaryObject) or set(node.keys())!=keys or node.get("/Type")!="/Pages":
        deny("unexpected Pages tree dictionary or private fields")
    if parent_ref is not None:
        parent=node.raw_get("/Parent")
        if not isinstance(parent,IndirectObject) or (parent.idnum,parent.generation)!=(parent_ref.idnum,parent_ref.generation):
            deny("invalid Pages tree parent")
    kids=node.raw_get("/Kids")
    count=node.raw_get("/Count")
    if not isinstance(kids,ArrayObject) or not 1<=len(kids)<=len(plan["pages"]) \
            or not isinstance(count,int) or not 1<=count<=len(plan["pages"]):
        deny("invalid Pages tree kids or count")
    actual=0
    for child_ref in kids:
        if not isinstance(child_ref,IndirectObject): deny("non-indirect Pages child")
        child=child_ref.get_object()
        if not isinstance(child,DictionaryObject): deny("invalid Pages child")
        if child.get("/Type")=="/Pages":
            actual+=assert_page_tree(child_ref,tree_ref,depth+1)
        elif child.get("/Type")=="/Page":
            parent=child.raw_get("/Parent")
            if not isinstance(parent,IndirectObject) or (parent.idnum,parent.generation)!=key:
                deny("invalid Page parent link")
            actual+=1
        else:
            deny("unexpected Pages child type")
    if actual!=count: deny("Pages tree count mismatch")
    return actual
if assert_page_tree(root.raw_get("/Pages"))!=len(plan["pages"]):
    deny("Pages tree does not match redaction plan")
# This is deliberately separate from the product's in-house object list and
# from page-only extraction. A recoverable stream with a real xref entry but
# no path from /Root is a privacy failure even when no viewer renders it.
reachable=set()
def visit(obj, depth=0):
    if depth>48: deny("object reference graph too deep")
    if isinstance(obj,IndirectObject):
        key=(obj.idnum,obj.generation)
        if key in reachable: return
        reachable.add(key)
        visit(obj.get_object(),depth+1)
    elif isinstance(obj,DictionaryObject):
        for value in obj.values(): visit(value,depth+1)
    elif isinstance(obj,ArrayObject):
        for value in obj: visit(value,depth+1)
visit(pdf.trailer.raw_get("/Root"))
declared={(number,generation) for generation,entries in pdf.xref.items()
          for number,offset in entries.items() if number>0 and offset>0}
if not declared or reachable!=declared:
    deny("orphan/unreachable xref object(s) or ambiguous reachability")
# A PDF can also carry recoverable private bytes that have *no xref entry*:
# comments, stray objects or arbitrary padding between the last object and
# xref still reopen in strict pypdf and native PDFKit. Check the physical
# intervals as well as the parser's logical graph. This gate intentionally
# accepts only the simple classic-xref, contiguous-object raster subset.
footer=re.search(rb"startxref\n([0-9]+)\n%%EOF\n$",raw)
if footer is None: deny("unsupported physical PDF footer")
xref_start=int(footer.group(1))
if xref_start<1 or raw[xref_start:xref_start+5]!=b"xref\n":
    deny("incorrect physical xref offset")
physical=sorted((offset,number,generation) for generation,entries in pdf.xref.items()
                for number,offset in entries.items() if number>0 and offset>0)
if len({offset for offset,_,_ in physical})!=len(physical):
    deny("overlapping physical xref offsets")
if not re.fullmatch(rb"%PDF-(?:1\.[0-7]|2\.0)\n%[\x80-\xff]{4,32}\n",raw[:physical[0][0]]):
    deny("unexpected bytes outside indexed objects before first object")
for index,(offset,number,generation) in enumerate(physical):
    stop=physical[index+1][0] if index+1<len(physical) else xref_start
    part=raw[offset:stop]
    prefix=f"{number} {generation} obj\n".encode("ascii")
    if offset>=stop or not part.startswith(prefix) or not part.endswith(b"endobj\n"):
        deny("unindexed recoverable bytes between xref objects")
    body=part[len(prefix):]
    if b"\nstream\n" in body:
        dictionary,remaining=body.split(b"\nstream\n",1)
        end=b"\nendstream\nendobj\n"
        if not re.fullmatch(rb"<<[^\r\n%]*>>",dictionary) or not remaining.endswith(end):
            deny("unindexed comments or bytes in physical stream wrapper")
        encoded=remaining[:-len(end)]
        stream=pdf.get_object(IndirectObject(number,generation,pdf))
        if not isinstance(stream,StreamObject) or encoded!=stream._data:
            deny("unindexed bytes disagree with parsed stream payload")
    elif not re.fullmatch(rb"<<[^\r\n%]*>>\nendobj\n",body):
        deny("unindexed comments or bytes inside physical object")
xref_tail=raw[xref_start:]
xref_table=re.fullmatch(
    rb"xref\n0 ([0-9]+)\n((?:[0-9]{10} [0-9]{5} [nf] \n)+)"
    rb"trailer\n<<[^\r\n%]*>>\nstartxref\n([0-9]+)\n%%EOF\n",
    xref_tail,
)
if xref_table is None or int(xref_table.group(1))!=len(xref_table.group(2).splitlines()) \
        or int(xref_table.group(3))!=xref_start:
    deny("unindexed recoverable bytes in physical xref/trailer")
verified=0
for page,expected in zip(pdf.pages,plan["pages"]):
    if set(page.keys())!={"/Type","/Parent","/MediaBox","/Resources","/Contents"}:
        deny("page extras, annotations or embedded content")
    media=list(page.mediabox)
    if [float(v) for v in media]!=[0.,0.,float(expected["pageWidth"]),float(expected["pageHeight"])]:
        deny("geometry mismatch")
    if (page.extract_text() or "").strip(): deny("recoverable output text")
    resources=page["/Resources"]
    if set(resources.keys())!={"/XObject"} or set(resources["/XObject"].keys())!={"/Im0"}:
        deny("unexpected page resources")
    image=resources["/XObject"]["/Im0"].get_object()
    if set(image.keys())!={"/Type","/Subtype","/Width","/Height","/ColorSpace","/BitsPerComponent","/Filter"}:
        # pypdf may expose /Length in a stream dictionary depending on parser
        if set(image.keys())!={"/Type","/Subtype","/Width","/Height","/ColorSpace","/BitsPerComponent","/Filter","/Length"}:
            deny("image dictionary extras/hidden payload")
    if image.get("/Type")!="/XObject" or image.get("/Subtype")!="/Image" or image.get("/ColorSpace")!="/DeviceRGB" or image.get("/Filter")!="/FlateDecode" or int(image.get("/BitsPerComponent",0))!=8:
        deny("non-RGB or encoded image metadata")
    w=int(image["/Width"]); h=int(image["/Height"])
    if (w,h)!=(expected["pixelWidth"],expected["pixelHeight"]): deny("raster dimensions mismatch")
    # FlateDecode commonly ignores bytes after the zlib end marker. Those
    # discarded bytes are still recoverable from the PDF stream (including
    # plaintext secrets), even if both independent viewers display only RGB.
    # Decompress under the declared pixel bound and require full consumption.
    try:
        decompressor=zlib.decompressobj()
        exact_rgb=decompressor.decompress(image._data,3*w*h+1)
    except zlib.error:
        deny("invalid RGB FlateDecode payload")
    # Do not call decompressobj.flush(): it has no max-output bound and may
    # materialize an enormous remainder even after bounded decompress().
    # EOF proves there is no further decoded data waiting in this stream.
    if len(exact_rgb)!=3*w*h or not decompressor.eof or decompressor.unused_data or decompressor.unconsumed_tail:
        deny("trailing/unconsumed/oversize private image stream data")
    rgb=image.get_data()
    if rgb!=exact_rgb: deny("decoded image or independent FlateDecode mismatch")
    for token in plan["sourceWitnesses"]:
        if token.encode("ascii") in rgb: deny("source marker inside decoded RGB")
    expected_content=("q\n"+str(expected["pageWidth"])+" 0 0 "+str(expected["pageHeight"])+" 0 0 cm\n/Im0 Do\nQ\n").encode("ascii")
    # The image must be the only drawable content. Fail closed on transforms/text.
    if page.get_contents().get_data()!=expected_content: deny("noncanonical page draw stream")
    visited=bytearray(w*h)
    for r in expected["regions"]:
        x0=math.floor(r["left"]*w); y0=math.floor(r["top"]*h)
        x1=math.ceil((r["left"]+r["width"])*w); y1=math.ceil((r["top"]+r["height"])*h)
        for y in range(y0,y1):
            for x in range(x0,x1):
                at=y*w+x
                if not visited[at]: visited[at]=1; verified+=1
                if rgb[at*3:at*3+3]!=b"\x00\x00\x00": deny("recoverable nonblack redacted pixel")
if verified<1: deny("no verified black pixels")
print(json.dumps({"pages":len(pdf.pages),"blackPixels":verified},separators=(",",":")))
`;

const SWIFT_PDFKIT_378 = String.raw`
import Foundation
import PDFKit
import AppKit
func deny(_ s: String) -> Never { fputs("PDFKit-378: " + s + "\n", stderr); exit(2) }
let data = FileHandle.standardInput.readDataToEndOfFile()
guard let pdf = PDFDocument(data: data), let src = ProcessInfo.processInfo.environment["FORENSIC_378_PLAN"],
  let json = src.data(using: .utf8), let plan = try? JSONSerialization.jsonObject(with: json) as? [String: Any],
  let pages = plan["pages"] as? [[String: Any]] else { deny("renderer/parser unavailable") }
if pdf.pageCount != pages.count { deny("PDFKit page count mismatch") }
if !(pdf.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { deny("PDFKit copy-extract found text") }
for (number,spec) in pages.enumerated() {
  guard let page = pdf.page(at: number), page.annotations.isEmpty else { deny("annotation/reopen failure") }
  guard let w = spec["pageWidth"] as? Double, let h = spec["pageHeight"] as? Double else { deny("plan geometry") }
  let size = page.bounds(for: .mediaBox)
  if abs(size.width-w)>0.02 || abs(size.height-h)>0.02 { deny("PDFKit geometry changed") }
  guard let tiff = page.thumbnail(of: NSSize(width: 512, height: 512*h/w), for: .mediaBox).tiffRepresentation,
        let bitmap = NSBitmapImageRep(data:tiff) else { deny("PDFKit render not available") }
  let regions = spec["regions"] as? [[String: Any]] ?? []
  for region in regions {
    guard let l=region["left"] as? Double, let t=region["top"] as? Double,
          let rw=region["width"] as? Double, let rh=region["height"] as? Double else { deny("region plan") }
    let x = max(0,min(bitmap.pixelsWide-1,Int((l+rw/2)*Double(bitmap.pixelsWide))))
    let y = max(0,min(bitmap.pixelsHigh-1,Int((t+rh/2)*Double(bitmap.pixelsHigh))))
    guard let pixel=bitmap.colorAt(x:x,y:y)?.usingColorSpace(.deviceRGB) else { deny("pixel readback") }
    if max(pixel.redComponent,pixel.greenComponent,pixel.blueComponent)>0.04 { deny("rendered redaction not black") }
  }
}
print("PASS PDFKit-378")
`;

function runBounded(name: string, args: readonly string[], input: Buffer, environment = process.env): string {
  const result = spawnSync(name, [...args], {
    input, encoding: "utf8", timeout: 20_000, maxBuffer: 512_000,
    env: environment, windowsHide: true,
  });
  if (result.error || result.status !== 0 || result.signal) {
    // Keep the decisive diagnostic, not a Python traceback that may include
    // irrelevant source paths and bury the actual orphan/xref refusal.
    const detail = result.error?.message
      ?? String(result.stderr ?? result.signal ?? result.status).trim().split("\n").at(-1)
      ?? "unknown independent parser failure";
    refuse(`${name} independent parser/renderer unavailable or rejected: ${detail.slice(0, 250)}`);
  }
  return result.stdout.trim();
}

export function forensicRedactionGate378(
  source: Uint8Array,
  output: Uint8Array,
  plan: ForensicPlan378,
  deps: GateDependencies378 = {},
): ForensicGateReceipt378 {
  validatePlan(source, output, plan);
  // Never write source/output to a temp file, shell command or cloud endpoint.
  const packet = Buffer.from(JSON.stringify({
    source: Buffer.from(source).toString("base64"),
    output: Buffer.from(output).toString("base64"), plan,
  }));
  const py = runBounded(deps.python ?? "python3", ["-c", PYTHON_INSPECTOR_378], packet);
  let proof: { pages: number; blackPixels: number };
  try { proof = JSON.parse(py) as typeof proof; }
  catch { refuse("pypdf invalid attestation"); }
  if (proof.pages !== plan.pages.length || !Number.isSafeInteger(proof.blackPixels) || proof.blackPixels < 1) {
    refuse("pypdf evidence incomplete");
  }
  const swift = runBounded(deps.swift ?? "/usr/bin/swift", ["-e", SWIFT_PDFKIT_378], Buffer.from(output), {
    // Source witnesses can themselves identify the user; do not pass them in
    // environment variables or process arguments to the native renderer.
    ...process.env, FORENSIC_378_PLAN: JSON.stringify({ pages: plan.pages }),
  });
  if (swift !== "PASS PDFKit-378") refuse("PDFKit evidence incomplete");
  return {
    status: "INDEPENDENT_SAMPLE_PASS_NOT_RELEASE",
    pages: proof.pages, blackPixels: proof.blackPixels, outputBytes: output.length,
    witnessesChecked: plan.sourceWitnesses.length, parsers: ["pypdf-strict", "macOS-PDFKit"],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags = process.argv.slice(2);
  const pathFor = (flag: string): string => {
    const at = flags.indexOf(flag);
    if (at < 0 || at + 1 >= flags.length) refuse(`missing ${flag} path`);
    return flags[at + 1]!;
  };
  try {
    const sourcePath = pathFor("--source");
    const outputPath = pathFor("--output");
    const planPath = pathFor("--plan");
    if (statSync(sourcePath).size > 8 * 1024 * 1024
      || statSync(outputPath).size > 24 * 1024 * 1024
      || statSync(planPath).size > 64 * 1024) {
      refuse("CLI source/output/plan exceeds bounded input limits");
    }
    const plan = JSON.parse(readFileSync(planPath, "utf8")) as ForensicPlan378;
    const receipt = forensicRedactionGate378(
      new Uint8Array(readFileSync(sourcePath)),
      new Uint8Array(readFileSync(outputPath)),
      plan,
    );
    process.stdout.write(JSON.stringify(receipt) + "\n");
  } catch (error) {
    process.stderr.write(`#378 NO_GO: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
