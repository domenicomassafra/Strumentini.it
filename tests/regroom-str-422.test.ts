import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync, type Zippable } from "fflate";
import { readEpub422 } from "../src/engines/epub/reader-422";

const utf8 = (text: string) => strToU8(text);
const container = '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
const opf = '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Libro di prova</dc:title></metadata><manifest><item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/><item id="toc" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>';
const nav = '<html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="text/c1.xhtml">Inizio</a></li><li><a href="text/c2.xhtml">Fine</a></li></ol></nav></body></html>';
const chapter1 = '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Primo</h1><p>Città &amp; montagna.</p></body></html>';
const chapter2 = '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Secondo</h1><p>Testo offline.</p></body></html>';
const defaultEntries: Record<string, Uint8Array> = {
  "META-INF/container.xml": utf8(container),
  "OEBPS/package.opf": utf8(opf),
  "OEBPS/nav.xhtml": utf8(nav),
  "OEBPS/text/c1.xhtml": utf8(chapter1),
  "OEBPS/text/c2.xhtml": utf8(chapter2),
};
function makeEpub(changes: Record<string, Uint8Array> = {}): File {
  const entries: Zippable = { mimetype: [utf8("application/epub+zip"), { level: 0 }] };
  for (const [name, bytes] of Object.entries({ ...defaultEntries, ...changes })) entries[name] = bytes;
  return new File([zipSync(entries, { level: 6 })], "sample.epub", { type: "application/epub+zip" });
}
afterEach(() => { vi.unstubAllGlobals(); });
describe("STR-422 EPUB3 offline text reader and unsafe export refusal", () => {
  it("reopens an independently packed Python zipfile EPUB3 corpus and refuses a scripted book", async () => {
    const root = "quality/fixtures/epub3-local-safe/";
    const good = await readFile(root + "sample.epub");
    const book = await readEpub422(new File([new Uint8Array(good)], "sample.epub", { type: "application/epub+zip" }));
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(["Apertura", "Chiusura"]);
    expect(book.chapters[0]?.text).toContain("Vento e città, senza rete.");
    expect(book.chapters[1]?.text).toContain("Le parole restano sul dispositivo.");
    const malicious = await readFile(root + "script-rejected.epub");
    await expect(readEpub422(new File([new Uint8Array(malicious)], "script-rejected.epub", { type: "application/epub+zip" }))).rejects.toThrow();
  });
  it("reopens an EPUB3 package and returns navigable spine-order chapters with decoded UTF-8 text", async () => {
    const book = await readEpub422(makeEpub());
    expect(book.title).toContain("Libro di prova");
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(["Inizio", "Fine"]);
    expect(book.chapters.map((chapter) => chapter.id)).toEqual(["c1", "c2"]);
    expect(book.chapters[0]?.text).toContain("Città & montagna.");
    expect(book.allText).toContain("Testo offline.");
    expect(book.allText).not.toContain("<script");
  });

  it.each([
    ["script", { "OEBPS/text/c1.xhtml": utf8('<html><body><script>fetch("https://bad.example/")</script><p>Hello</p></body></html>') }],
    ["remote image", { "OEBPS/text/c1.xhtml": utf8('<html><body><img src="https://bad.example/image.png"/><p>Hello</p></body></html>') }],
    ["responsive remote image", { "OEBPS/text/c1.xhtml": utf8('<html><body><img srcset="safe.png 1x, https://bad.example/evil.png 2x"/><p>Hello</p></body></html>') }],
    ["meta refresh remote", { "OEBPS/text/c1.xhtml": utf8('<html><head><meta http-equiv="refresh" content="0;url=https://bad.example"/></head><body>foo</body></html>') }],
    ["remote nav", { "OEBPS/nav.xhtml": utf8('<html><body><nav><a href="https://bad.example/">remote</a></nav></body></html>') }],
    ["active SVG", { "OEBPS/images/picture.svg": utf8('<svg onload="fetch(\'https://bad.example\')"/>') }],
    ["javascript asset", { "OEBPS/scripts/init.js": utf8("alert(1)") }],
    ["external CSS", { "OEBPS/main.css": utf8("@import url('https://bad.example/style.css')") }],
    ["XML entities", { "OEBPS/package.opf": utf8('<!DOCTYPE package [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + opf) }],
    ["path traversal", { "../remote.xhtml": utf8("<html>bad</html>") }],
    ["unbounded ZIP expansion", { "OEBPS/huge.css": utf8("A".repeat(600_000)) }],
  ] as const)("refuses %s before any network request or text export", async (_case, changes) => {
    const network = vi.fn(() => { throw new Error("NETWORK_CALLED"); });
    vi.stubGlobal("fetch", network);
    await expect(readEpub422(makeEpub(changes))).rejects.toThrow();
    expect(network).not.toHaveBeenCalled();
  });

  it("rejects missing chapters, broken MIME and aborted operations", async () => {
    await expect(readEpub422(makeEpub({ "mimetype": utf8("not an epub") }))).rejects.toThrow(/MIMETYPE/u);
    const fakeSpine = opf.replace('idref="c2"', 'idref="missing"');
    await expect(readEpub422(makeEpub({ "OEBPS/package.opf": utf8(fakeSpine) }))).rejects.toThrow(/SPINE_RESOURCE/u);
    const abort = new AbortController();
    abort.abort();
    await expect(readEpub422(makeEpub(), abort.signal)).rejects.toThrow(/CANCELLED/u);
  });
});
