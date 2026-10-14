/** #407 next: actual HTML5 SVG namespace + PDF actions in local preflight.
 * Only local, bounded synthetic ZIP/PDF bytes; no browser navigation/network.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parse } from "parse5";
import { strToU8, unzipSync, zipSync } from "fflate";
import { detectLocalFile, FILE_DETECTION_LIMITS } from "../src/runtime/file-detection";
import { checkPdfBytes407, checkTextPart407 } from "../src/runtime/file-threat-gate-407";

type HtmlNode = { tagName?: string; attrs?: Array<{ name: string; value: string; prefix?: string; namespace?: string }>; childNodes?: HtmlNode[] };
function nodeWithTag(root: HtmlNode, tag: string): HtmlNode | undefined {
  if (root.tagName === tag) return root;
  for (const child of root.childNodes ?? []) {
    const matched = nodeWithTag(child, tag);
    if (matched) return matched;
  }
  return undefined;
}

async function checkZippedHtml(body: string) {
  const zipped = zipSync({ "pages/view.html": strToU8(body) }, { level: 6 });
  expect(new TextDecoder("utf-8", { fatal: true }).decode(unzipSync(zipped)["pages/view.html"])).toBe(body);
  const file = new File([Uint8Array.from(zipped)], "untrusted.zip", { type: "application/zip" });
  let total = 0;
  const decision = await detectLocalFile({
    name: file.name, type: file.type, size: file.size,
    slice(start = 0, end = file.size) {
      expect(end - start).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxReadBytes);
      total += end - start;
      expect(total).toBeLessThanOrEqual(FILE_DETECTION_LIMITS.maxTotalReadBytes);
      return file.slice(start, end);
    },
  });
  expect(decision.readBytes).toBe(total);
  return decision;
}

function actualPdf(action: string): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Annots [4 0 R] >>",
    "<< /Type /Annot /Subtype /Link /Rect [72 72 120 96] /Border [0 0 0] /A 5 0 R >>",
    action,
  ];
  let pdf = "%PDF-1.7\n";
  const offsets: number[] = [0];
  for (const [index, body] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Root 1 0 R /Size ${offsets.length} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

function strictPdfAction(bytes: Uint8Array): { pageCount: number; action: string; named: string | null } {
  const script = [
    "import io,json,sys",
    "from pypdf import PdfReader",
    "reader=PdfReader(io.BytesIO(sys.stdin.buffer.read()),strict=True)",
    "action=reader.pages[0]['/Annots'][0].get_object()['/A'].get_object()",
    "print(json.dumps({'pageCount':len(reader.pages),'action':str(action['/S']),'named':str(action['/N']) if '/N' in action else None}))",
  ].join("\n");
  return JSON.parse(execFileSync("python3", ["-c", script], { input: Buffer.from(bytes), encoding: "utf8", timeout: 6_000, maxBuffer: 1024 })) as {
    pageCount: number; action: string; named: string | null;
  };
}

describe("#407 source-bound SVG/HTML namespace and PDF action corpus", () => {
  it.each([
    ["textarea with form", '<textarea>Example: <form action=https://outside.invalid/submit></form></textarea>', "form"],
    ["textarea with button", '<textarea><button formaction=https://outside.invalid/submit>Submit</button></textarea>', "button"],
    ["title with SVG XLink", '<title>Example: <svg><a xlink:href=https://outside.invalid/link>Go</a></svg></title>', "svg"],
    ["mixed-case textarea close", '<TeXtArEa><form action=https://outside.invalid/submit></form></tExTaReA>', "form"],
  ] as const)("preserves inert HTML5 RCDATA %s", async (_label, body, absentTag) => {
    expect(nodeWithTag(parse(body) as HtmlNode, absentTag)).toBeUndefined();
    expect(checkTextPart407(body, "html")).toBeNull();
    expect(await checkZippedHtml(body)).toMatchObject({ status: "supported", format: "zip" });
  });

  it.each([
    ["textarea end-tag attributes", '<html><body><textarea>Memo plain text</textarea class="note"><p>After</p></body></html>', "textarea"],
    ["title end-tag attributes", '<html><head><title>Report</title id="reference"></head><body><p>After</p></body></html>', "title"],
    ["mixed-case close with quoted >", '<html><body><textarea>Memo</TeXtArEa data-note="literal > sign" class=note><p>After</p></body></html>', "textarea"],
    ["recovered slash close", '<html><body><textarea>Memo</textarea/><p>After</p></body></html>', "textarea"],
    ["recovered slash with attributes", '<html><body><textarea>Memo</textarea /class=note><p>After</p></body></html>', "textarea"],
  ] as const)("preserves valid HTML5 recovered %s in a real ZIP", async (_label, html, tag) => {
    const parsed = parse(html) as HtmlNode;
    expect(nodeWithTag(parsed, tag)).toBeDefined();
    expect(nodeWithTag(parsed, "p")).toBeDefined();
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await checkZippedHtml(html)).toMatchObject({ status: "supported", format: "zip" });
  });

  it("refuses live form after a recovered textarea closing tag with ignored attributes", async () => {
    const html = '<textarea>Inert <form action=https://outside.invalid/inert></form></textarea class="note">'
      + '<form action=https://outside.invalid/active></form>';
    expect(nodeWithTag(parse(html) as HtmlNode, "form")?.attrs?.find((attribute) => attribute.name === "action")?.value)
      .toBe("https://outside.invalid/active");
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it.each([
    '<textarea>Memo</textarea class="note"',
    '<title>Memo</title id="unterminated>',
    '<textarea>Memo</textareaX><p>not an appropriate end-tag</p>',
  ])("refuses ambiguous/unclosed recovered RCDATA end tag: %s", async (html) => {
    expect(parse(html)).toBeDefined();
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it.each([
    "<textarea>Unterminated benign text",
    "<title>Unterminated benign text",
  ])("refuses unclosed HTML5 RCDATA rather than guessing: %s", async (body) => {
    expect(parse(body)).toBeDefined();
    expect(checkTextPart407(body, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(body)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("refuses a live form following a complete HTML5 textarea", async () => {
    const html = '<textarea>inert <form action=https://outside.invalid/inert></form></textarea>'
      + '<form action=https://outside.invalid/real></form>';
    const activeForm = nodeWithTag(parse(html) as HtmlNode, "form");
    expect(activeForm?.attrs?.find((attribute) => attribute.name === "action")?.value).toBe("https://outside.invalid/real");
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("never masks an SVG foreign-content title as HTML RCDATA", async () => {
    const html = '<svg><title><a xlink:href=https://outside.invalid/live.svg>live</a></title></svg>';
    const link = nodeWithTag(parse(html) as HtmlNode, "a");
    expect(link?.attrs?.find((attribute) => attribute.name === "xlink:href" ||
      (attribute.name === "href" && attribute.prefix === "xlink"))?.value)
      .toBe("https://outside.invalid/live.svg");
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it.each([
    ["form action", "<!-- <form action=https://outside.invalid/submit><button>Submit</button></form> -->", "form"],
    ["button formaction", "<!-- <form><button formaction=https://outside.invalid/submit>Submit</button></form> -->", "button"],
    ["SVG xlink:href", "<!-- <svg><a xlink:href=https://outside.invalid/tracker.svg>go</a></svg> -->", "svg"],
    ["quoted external SVG href", '<!-- <svg><a xlink:href="https://outside.invalid/a">go</a></svg> -->', "svg"],
  ] as const)("keeps inert valid HTML comment containing %s eligible", async (_label, comment, absentTag) => {
    const html = `<html><body>${comment}<p>ordinary text</p></body></html>`;
    expect(nodeWithTag(parse(html) as HtmlNode, absentTag)).toBeUndefined();
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await checkZippedHtml(html)).toMatchObject({ status: "supported", format: "zip" });
  });

  it.each([
    "<!-- <form action=https://outside.invalid/submit>",
    "<!-- <button formaction=https://outside.invalid/submit> --!>",
    "<!- <svg><a xlink:href=https://outside.invalid/tracker.svg> -->",
    "<!-- benign <!-- <form action=https://outside.invalid/submit> -->",
    "<!-- unfinished plain text without an active tag",
    "<!- malformed harmless-looking comment >",
    "<!--><form action=https://outside.invalid/submit></form> -->",
    "<!-- harmless --!><button formaction=https://outside.invalid/submit>Go</button> -->",
  ])("refuses malformed or unterminated HTML comment fail-closed: %s", async (comment) => {
    const html = `<html><body>${comment}`;
    // parse5 is independent evidence that the input is browser HTML5 material;
    // ambiguity in comment recovery is conservatively refused before rendering.
    expect(parse(html)).toBeDefined();
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("still refuses a real form after a valid inert comment", async () => {
    const html = '<!-- <form action=https://outside.invalid/inert></form> --><form action=https://outside.invalid/active></form>';
    expect(nodeWithTag(parse(html) as HtmlNode, "form")?.attrs?.find((item) => item.name === "action")?.value)
      .toBe("https://outside.invalid/active");
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("preserves HTML5 unquoted apostrophe recovery alongside an inert comment", async () => {
    const html = '<!-- <form action=https://outside.invalid/inert></form> -->'
      + '<meta data-x=a\' http-equiv=content-type content="text/html; charset=UTF-8">';
    const meta = nodeWithTag(parse(html) as HtmlNode, "meta");
    expect(meta?.attrs?.find((attribute) => attribute.name === "data-x")?.value).toBe("a'");
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await checkZippedHtml(html)).toMatchObject({ status: "supported", format: "zip" });
  });

  it("does not mistake a literal <!-- in an HTML attribute for a comment masking an active form", async () => {
    const html = '<div title="<!-- bogus opening marker">note</div><form action=https://outside.invalid/active></form>';
    expect(nodeWithTag(parse(html) as HtmlNode, "form")?.attrs?.find((attribute) => attribute.name === "action")?.value)
      .toBe("https://outside.invalid/active");
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("rejects HTML5 SVG unquoted xlink:href that a real parser resolves to a navigation URL", async () => {
    const remote = "https://outside.invalid/tracker.svg";
    const html = `<html><body><svg><a xlink:href=${remote}>leave</a></svg></body></html>`;
    const attr = nodeWithTag(parse(html) as HtmlNode, "a")?.attrs?.find((a) => a.name === "href" && a.prefix === "xlink");
    expect(attr?.namespace).toBe("http://www.w3.org/1999/xlink");
    expect(attr?.value).toBe(remote);
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it.each([
    ["form action", "form", "action", "<form action=https://outside.invalid/submit method=get><button>Send</button></form>"],
    ["button formaction", "button", "formaction", "<form><button formaction=https://outside.invalid/submit>Send</button></form>"],
  ] as const)("rejects HTML5 %s browser navigation target", async (_label, tag, key, body) => {
    const html = `<html><body>${body}</body></html>`;
    const value = nodeWithTag(parse(html) as HtmlNode, tag)?.attrs?.find((a) => a.name === key)?.value;
    expect(value).toBe("https://outside.invalid/submit");
    expect(checkTextPart407(html, "html")).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await checkZippedHtml(html)).toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it.each([
    ["named print", "<< /Type /Action /S /Named /N /Print >>", "/Named", "/Print"],
    ["hide annotation", "<< /Type /Action /S /Hide /T 4 0 R /H true >>", "/Hide", null],
  ] as const)("rejects active PDF %s annotation with strict independent object parser", async (_label, action, expected, named) => {
    const bytes = actualPdf(action);
    expect(strictPdfAction(bytes)).toEqual({ pageCount: 1, action: expected, named });
    expect(checkPdfBytes407(bytes)).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await detectLocalFile(new File([Uint8Array.from(bytes)], "action.pdf", { type: "application/pdf" })))
      .toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("rejects PDF /Named with legal PDF comment whitespace and #hex-encoded action name", async () => {
    const pdf = actualPdf("<< /Type /Action /S % comment before subtype\n/N#61med /N /Print >>");
    expect(strictPdfAction(pdf)).toEqual({ pageCount: 1, action: "/Named", named: "/Print" });
    expect(checkPdfBytes407(pdf)).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await detectLocalFile(new File([Uint8Array.from(pdf)], "comment.pdf", { type: "application/pdf" })))
      .toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("rejects actual /Named /Print after unrelated /SafeKey /a#25b: escaped percent is name data, NEVER a comment", async () => {
    const pdf = actualPdf("<< /Type /Action /SafeKey /a#25b /S /Named /N /Print >>");
    expect(strictPdfAction(pdf)).toEqual({ pageCount: 1, action: "/Named", named: "/Print" });
    const source = [
      "import io,sys", "from pypdf import PdfReader",
      "a=PdfReader(io.BytesIO(sys.stdin.buffer.read()),strict=True).pages[0]['/Annots'][0].get_object()['/A'].get_object()",
      "print(str(a['/SafeKey']))",
    ].join("\n");
    expect(execFileSync("python3", ["-c", source], { input: Buffer.from(pdf), encoding: "utf8", timeout: 6_000 }).trim()).toBe("/a%b");
    expect(checkPdfBytes407(pdf)).toMatchObject({ reason: "UNSUPPORTED" });
    expect(await detectLocalFile(new File([Uint8Array.from(pdf)], "safe-key-named.pdf", { type: "application/pdf" })))
      .toMatchObject({ status: "refused", reason: "UNSUPPORTED" });
  });

  it("does not treat /SafeKey /a#25b as a comment or a PDF action when followed by valid /GoTo", async () => {
    const pdf = actualPdf("<< /Type /Action /SafeKey /a#25b /S /GoTo /D [3 0 R /Fit] >>");
    expect(strictPdfAction(pdf).action).toBe("/GoTo");
    expect(checkPdfBytes407(pdf)).toBeNull();
    expect(await detectLocalFile(new File([Uint8Array.from(pdf)], "safe-key-inert.pdf", { type: "application/pdf" })))
      .toMatchObject({ status: "supported", format: "pdf" });
  });

  it("preserves inert HTML and internal-only PDF GoTo annotation", async () => {
    const html = '<html><body><svg><a href="#shape">internal</a></svg><form><button type="button">inert</button></form></body></html>';
    expect(checkTextPart407(html, "html")).toBeNull();
    expect(await checkZippedHtml(html)).toMatchObject({ status: "supported", format: "zip" });
    const pdf = actualPdf("<< /Type /Action /S /GoTo /D [3 0 R /Fit] >>");
    expect(strictPdfAction(pdf).action).toBe("/GoTo");
    expect(checkPdfBytes407(pdf)).toBeNull();
    expect(await detectLocalFile(new File([Uint8Array.from(pdf)], "internal.pdf", { type: "application/pdf" })))
      .toMatchObject({ status: "supported", format: "pdf" });
  });

  it("does not confuse inert PDF string contents mentioning action names with real /S actions", async () => {
    // These are literal text, not PDF name tokens: broad /Named|Hide/ scanning
    // would deny an ordinary internal-only GoTo annotation by mistake.
    const pdf = actualPdf("<< /Type /Action /S /GoTo /D [3 0 R /Fit] /Contents (ordinary text /Named /Hide /ResetForm /SetOCGState /Sound /Movie) >>");
    expect(strictPdfAction(pdf).action).toBe("/GoTo");
    expect(checkPdfBytes407(pdf)).toBeNull();
    expect(await detectLocalFile(new File([Uint8Array.from(pdf)], "inert.pdf", { type: "application/pdf" })))
      .toMatchObject({ status: "supported", format: "pdf" });
  });

  it("does not confuse an inert, strictly parsed literal PDF string '/S /Named' with an action", async () => {
    const pdf = actualPdf("<< /Type /Action /S /GoTo /D [3 0 R /Fit] /Contents (This tutorial writes /S /Named and /S /Hide as plain text) >>");
    expect(strictPdfAction(pdf).action).toBe("/GoTo");
    expect(checkPdfBytes407(pdf)).toBeNull();
    expect(await detectLocalFile(new File([Uint8Array.from(pdf)], "literal.pdf", { type: "application/pdf" })))
      .toMatchObject({ status: "supported", format: "pdf" });
  });
});
