import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";

/** A real, byte-offset-correct PDF with a clickable annotation/action graph. */
function pdfWithAction(action: string, nextAction?: string, inertStreamBytes = 0): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Annots [4 0 R] >>",
    "<< /Type /Annot /Subtype /Link /Rect [72 72 120 96] /Border [0 0 0] /A 5 0 R >>",
    action,
    ...(nextAction === undefined ? [] : [nextAction]),
    ...(inertStreamBytes === 0 ? [] : [`<< /Length ${inertStreamBytes} >>\nstream\n${".".repeat(inertStreamBytes)}\nendstream`]),
  ];
  let data = "%PDF-1.7\n";
  const offsets = [0];
  for (const [index, body] of objects.entries()) {
    offsets.push(data.length);
    data += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const startxref = data.length;
  data += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) data += `${String(offset).padStart(10, "0")} 00000 n \n`;
  data += `trailer\n<< /Root 1 0 R /Size ${offsets.length} >>\nstartxref\n${startxref}\n%%EOF\n`;
  return new TextEncoder().encode(data);
}

function independentlyObservedPdfAction(bytes: Uint8Array): { pages: number; action: string; next: string | null; uri: string | null } {
  const script = [
    "import io,json,sys",
    "from pypdf import PdfReader",
    "pdf=PdfReader(io.BytesIO(sys.stdin.buffer.read()), strict=True)",
    "a=pdf.pages[0]['/Annots'][0].get_object()['/A'].get_object()",
    "next_action=a.get('/Next')",
    "next_action=next_action.get_object() if next_action else None",
    "print(json.dumps({'pages':len(pdf.pages),'action':str(a['/S']),'next':str(next_action['/S']) if next_action else None,'uri':str(a['/URI']) if '/URI' in a else None}))",
  ].join("\n");
  return JSON.parse(execFileSync("python3", ["-c", script], {
    input: Buffer.from(bytes), encoding: "utf8", timeout: 6_000, maxBuffer: 4096,
  })) as { pages: number; action: string; next: string | null; uri: string | null };
}

async function inspect(bytes: Uint8Array) {
  return detectLocalFile(new File([new Uint8Array(bytes)], "active-annotation.pdf", { type: "application/pdf" }));
}

describe("#407 observed PDF annotation action safety — operational regression", () => {
  it("refuses an externally navigating /URI action independently parsed from a valid PDF", async () => {
    const bytes = pdfWithAction("<< /Type /Action /S /URI /URI (https://example.test/outbound) >>");
    expect(independentlyObservedPdfAction(bytes)).toEqual({ pages: 1, action: "/URI", next: null, uri: "https://example.test/outbound" });
    expect(await inspect(bytes)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("refuses /Rendition reached through a referenced /Next action, including escaped PDF names", async () => {
    const bytes = pdfWithAction(
      "<< /Type /Action /S /GoTo /D [3 0 R /Fit] /Next 6 0 R >>",
      "<< /Type /Action /S /R#65ndition /OP 0 /AN 4 0 R /R << /S /MR /C << /S /MCD /D (https://example.test/clip.mp4) /CT (video/mp4) >> >> >>",
    );
    expect(independentlyObservedPdfAction(bytes)).toEqual({ pages: 1, action: "/GoTo", next: "/Rendition", uri: null });
    expect(await inspect(bytes)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("continues to accept a bounded real PDF with an internal-only GoTo annotation", async () => {
    const bytes = pdfWithAction("<< /Type /Action /S /GoTo /D [3 0 R /Fit] >>");
    expect(independentlyObservedPdfAction(bytes)).toEqual({ pages: 1, action: "/GoTo", next: null, uri: null });
    expect(await inspect(bytes)).toMatchObject({ status: "supported", format: "pdf", note: "candidate only; decoding and content safety are not verified" });
  });

  it("refuses observed active PDF actions within bounded initial and trailing read windows", async () => {
    const bytes = pdfWithAction("<< /Type /Action /S /URI /URI (https://example.test/outbound) >>", undefined, 300 * 1024);
    expect(independentlyObservedPdfAction(bytes)).toMatchObject({ pages: 1, action: "/URI" });
    const safeLarge = pdfWithAction("<< /Type /Action /S /GoTo /D [3 0 R /Fit] >>", undefined, 300 * 1024);
    expect(independentlyObservedPdfAction(safeLarge)).toMatchObject({ pages: 1, action: "/GoTo" });
    expect(await inspect(safeLarge)).toMatchObject({ status: "supported", format: "pdf" });
    // The active annotation is in the first 128 KiB, with a large inert stream
    // after it; the detector may read only bounded head/tail windows.
    const input = new File([new Uint8Array(bytes)], "active-annotation.pdf", { type: "application/pdf" });
    let readTotal = 0;
    const tracked = {
      name: input.name, type: input.type, size: input.size,
      slice(start = 0, end = input.size) {
        readTotal += end - start;
        return input.slice(start, end);
      },
    };
    expect(await detectLocalFile(tracked)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
    expect(readTotal).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
  });
});
