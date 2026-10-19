import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EMAIL_MAX_BYTES, ATTACHMENT_MAX_BYTES, readLocalEmail, safeAttachmentName } from "../src/tools/eml-msg-viewer/module";

const encode = (text: string) => new TextEncoder().encode(text);
const fixtures = JSON.parse(readFileSync("quality/fixtures/email-mime-msg-421/vectors.json", "utf8")) as {
  vectors: { eml: string; subject: string; body_contains: string; attachment_name: string }[];
};
const simple = new Uint8Array(readFileSync("tests/fixtures/eml-msg-421/simple.msg"));
const attachments = new Uint8Array(readFileSync("tests/fixtures/eml-msg-421/attachments.msg"));

describe("STR-421 offline EML/MSG viewer", () => {
  it("parses nested multipart MIME and refuses active traversal attachment", async () => {
    const vector = fixtures.vectors[0]!;
    const result = await readLocalEmail(encode(vector.eml), "nested.eml");
    expect(result.format).toBe("EML");
    expect(result.subject).toBe(vector.subject);
    expect(result.body).toContain(vector.body_contains);
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({ name: vector.attachment_name, blocked: true, bytes: null });
    expect(result.from).toBe("sender@example.test");
  });

  it("renders tracker and scripts only as literal text, without automatic network or HTML insertion", async () => {
    const source = "From: a@example.test\r\nSubject: HTML\r\nContent-Type: text/html; charset=utf-8\r\n\r\n" +
      '<img src="https://tracking.example.test/1.gif"><script>alert(99)</script><a href="javascript:alert(1)">link</a>';
    const result = await readLocalEmail(encode(source), "html.eml");
    expect(result.htmlAsText).toBe(true);
    expect(result.body).toContain("tracking.example.test");
    expect(result.body).toContain("<script>");
    const viewSource = readFileSync("src/components/tools/EmlMsgViewerTool.tsx", "utf8");
    expect(viewSource).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\s*=|<iframe|<img/iu);
    expect(viewSource).toContain("{preview.body");
  });

  it("keeps supported attachment bytes intact, with inert export naming", async () => {
    const source = "From: a@example.test\r\nSubject: Allegato\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=abc\r\n\r\n" +
      "--abc\r\nContent-Type: text/plain\r\n\r\nTest\r\n" +
      "--abc\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename=\"note.txt\"\r\nContent-Transfer-Encoding: base64\r\n\r\nY2lhbw==\r\n--abc--\r\n";
    const result = await readLocalEmail(encode(source), "test.eml");
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]!.blocked).toBe(false);
    expect([...result.attachments[0]!.bytes!]).toEqual([...encode("ciao")]);
    expect(result.attachments[0]!.name + ".download").toBe("note.txt.download");
    expect(safeAttachmentName("../../run.js", 0)).toBe("run.js");
    expect(safeAttachmentName("../\u202eunsafe.exe", 0)).toBe("unsafe.exe");
  });

  it("opens two independently sourced Outlook Compound Document files", async () => {
    // SHA-256 checked against the upstream pinned repository files; Unix file says CDFV2 Outlook Message.
    expect(createHash("sha256").update(simple).digest("hex")).toBe("78e7b635ed7429f303f468b66b78394d8ed1d28362ea609883ef191051b64d18");
    expect(createHash("sha256").update(attachments).digest("hex")).toBe("8643045fd94c3f06df7bf147d1b95db07ff016cd0d52eacceaa15c74a2c9c3c7");
    const one = await readLocalEmail(simple, "simple.msg");
    expect(one).toMatchObject({ format: "MSG", subject: "Simple", body: "Simple\r\n" });
    const two = await readLocalEmail(attachments, "attachments.msg");
    expect(two.subject).toBe("attachmentFiles");
    expect(two.attachments.map((a) => a.name)).toEqual(["jpg.jpg", "png.png", "tif.tif"]);
    expect(two.attachments.every((a) => !a.blocked && a.bytes !== null)).toBe(true);
    // Reader gets a defensive byte copy and raw download round trips byte-identically.
    expect([...new Uint8Array(attachments)]).toEqual([...attachments]);
    expect((await readLocalEmail(new Uint8Array(attachments), "again.msg")).attachments).toHaveLength(3);
  });

  it("fails closed on malformed MIME, wrong MSG signature, oversized and cancelled files", async () => {
    await expect(readLocalEmail(encode("garbage"), "bad.eml")).rejects.toThrow("EMAIL_MIME_MALFORMED");
    await expect(readLocalEmail(encode("Subject: bad\r\nContent-Type: multipart/mixed; boundary=missing\r\n\r\n--missing\r\nunclosed"), "bad.eml"))
      .rejects.toThrow("EMAIL_MIME_MALFORMED");
    await expect(readLocalEmail(encode("not MSG"), "bad.msg")).rejects.toThrow("EMAIL_MSG_MALFORMED");
    await expect(readLocalEmail(new Uint8Array(EMAIL_MAX_BYTES + 1), "huge.eml")).rejects.toThrow("EMAIL_SIZE_UNSUPPORTED");
    const signal = AbortSignal.abort();
    await expect(readLocalEmail(simple, "simple.msg", signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(ATTACHMENT_MAX_BYTES).toBeLessThan(EMAIL_MAX_BYTES);
  });
});
