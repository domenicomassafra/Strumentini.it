import { parseFragment } from "parse5";
import { extractZip416, ARCHIVE_416_LIMITS } from "../archive-safe";

export const EPUB_LIMITS_422 = {
  maxFileBytes: 8 * 1024 * 1024,
  maxTextBytes: 256 * 1024,
  maxChapters: 32,
  maxEntries: ARCHIVE_416_LIMITS.maxFiles,
} as const;

export interface EpubChapter422 {
  id: string;
  title: string;
  text: string;
}
export interface EpubBook422 {
  title: string;
  chapters: EpubChapter422[];
  allText: string;
  source: "EPUB3 locale · solo testo · nessuna risorsa eseguita";
}

type Node422 = {
  nodeName: string;
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: Node422[];
  value?: string;
};
const XML_OR_HTML_422 = /(?:\.opf|\.ncx|\.xml|\.xhtml|\.html|\.css)$/iu;
const ACTIVE_PATH_422 = /\.(?:svg|svgz|js|mjs|wasm|swf)$/iu;
const UNSAFE_ELEMENT_422 = new Set(["script", "svg", "style", "iframe", "object", "embed", "foreignobject", "video", "audio", "source", "track", "form", "input", "button", "canvas", "math", "base"]);
const BLOCK_422 = new Set(["p", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br", "blockquote", "tr", "nav"]);

function reject(code: string): never { throw new Error("EPUB_" + code); }
function attr(node: Node422, key: string): string | undefined {
  return node.attrs?.find((item) => item.name.toLowerCase() === key)?.value;
}
function walk(node: Node422, visit: (item: Node422) => void): void {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}
function findTags(root: Node422, tag: string): Node422[] {
  const found: Node422[] = [];
  walk(root, (node) => { if (node.tagName?.toLowerCase() === tag) found.push(node); });
  return found;
}
function normalizedPath(base: string, link: string): string {
  const value = link.split("#", 1)[0] ?? "";
  if (!value || value.startsWith("/") || value.startsWith("//") || value.includes("\\") ||
      /^(?:[a-z][a-z0-9+.-]*:|#)/iu.test(value) || /%(?:2e|2f|5c|3a|00)/iu.test(value) ||
      /[?#]/u.test(value)) reject("EXTERNAL_OR_UNSAFE_RESOURCE");
  const segments = base.split("/").slice(0, -1);
  for (const segment of value.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") {
      if (!segments.length) reject("UNSAFE_PATH");
      segments.pop();
    } else segments.push(segment);
  }
  return segments.join("/");
}
function checkMarkup(source: string, kind: "package" | "chapter" | "navigation"): Node422 {
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/iu.test(source)) reject("ACTIVE_MARKUP");
  const doc = parseFragment(source) as Node422;
  walk(doc, (node) => {
    const tag = node.tagName?.toLowerCase();
    if (tag && UNSAFE_ELEMENT_422.has(tag)) reject("ACTIVE_MARKUP");
    for (const item of node.attrs ?? []) {
      const name = item.name.toLowerCase();
      const value = item.value.trim();
      if (name.startsWith("on") || name === "style" || name === "srcdoc" || name === "xml:base" ||
          (name === "http-equiv" && value.toLowerCase() === "refresh") ||
          ((name === "srcset" || name === "imagesrcset") && value !== "")) reject("ACTIVE_MARKUP");
      if (["href", "src", "xlink:href", "data", "poster", "action", "formaction", "background"].includes(name)) {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|\\)/iu.test(value) ||
            /%(?:2e|2f|5c|3a|00)/iu.test(value)) reject("EXTERNAL_OR_UNSAFE_RESOURCE");
      }
      if (/url\s*\(|@import/iu.test(value)) reject("EXTERNAL_OR_UNSAFE_RESOURCE");
    }
  });
  if (kind === "package" && (!/<package\b/iu.test(source) || !/http:\/\/www\.idpf\.org\/2007\/opf/iu.test(source) || !/\bversion\s*=\s*["']3(?:\.\d+)?["']/iu.test(source))) reject("NOT_EPUB3");
  return doc;
}
function textOf(node: Node422): string {
  const parts: string[] = [];
  function visit(n: Node422): void {
    if (n.nodeName === "#text") parts.push(n.value ?? "");
    if (n.tagName && BLOCK_422.has(n.tagName.toLowerCase())) parts.push("\n");
    for (const child of n.childNodes ?? []) visit(child);
    if (n.tagName && BLOCK_422.has(n.tagName.toLowerCase())) parts.push("\n");
  }
  visit(node);
  return parts.join("").replace(/\r\n?/gu, "\n").replace(/[ \t\f]+/gu, " ").replace(/[ \t]*\n[ \t]*/gu, "\n").replace(/\n{3,}/gu, "\n\n").trim();
}
function decode(input: Uint8Array): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(input); }
  catch { return reject("ENCODING"); }
}
function cssSafe(input: string): void {
  if (/@import|url\s*\(|expression\s*\(|-moz-binding|javascript\s*:|\\/iu.test(input)) reject("EXTERNAL_OR_UNSAFE_RESOURCE");
}
function chapterTitle(node: Node422, fallback: string): string {
  for (const heading of ["h1", "h2", "h3", "h4", "h5", "h6", "title"]) {
    const found = findTags(node, heading)[0];
    if (found) {
      const value = textOf(found).trim();
      if (value) return value.slice(0, 160);
    }
  }
  return fallback;
}

/** No fetch, URL creation, DOM injection, HTML rendering, or dynamic script execution. */
export async function readEpub422(file: File, signal?: AbortSignal): Promise<EpubBook422> {
  if (signal?.aborted) reject("CANCELLED");
  if (file.size === 0 || file.size > EPUB_LIMITS_422.maxFileBytes || !/\.epub$/iu.test(file.name)) reject("INPUT_LIMIT");
  if (file.type && !["application/epub+zip", "application/octet-stream", "application/zip"].includes(file.type)) reject("INPUT_MIME");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal?.aborted) reject("CANCELLED");
  // The STR-416 ZIP parser independently enforces central/local headers,
  // CRC32 of every member, symlink/path rules, bounded streaming inflation
  // (32 members, 24 MiB total), ZIP64/encryption refusal and nesting checks.
  const members = extractZip416(bytes, signal);
  if (members.length > EPUB_LIMITS_422.maxEntries) reject("ZIP_LIMIT");
  if (members[0]?.path !== "mimetype" || members[0].method !== "store") reject("MIMETYPE_ORDER");
  const content = new Map<string, string>();
  let totalText = 0;
  const available = new Set(members.map((part) => part.path));
  for (const member of members) {
    if (ACTIVE_PATH_422.test(member.path) || /META-INF\/(?:encryption|rights)\.xml$/iu.test(member.path)) {
      reject("ACTIVE_RESOURCE");
    }
    if (member.path !== "mimetype" && !XML_OR_HTML_422.test(member.path)) continue;
    if (member.bytes.length > EPUB_LIMITS_422.maxTextBytes - totalText) reject("TEXT_LIMIT");
    totalText += member.bytes.length;
    const decoded = decode(member.bytes);
    content.set(member.path, decoded);
    if (member.path.endsWith(".css")) cssSafe(decoded);
    else if (member.path !== "mimetype") checkMarkup(decoded, "navigation");
  }
  if (content.get("mimetype") !== "application/epub+zip") reject("MIMETYPE");
  const container = content.get("META-INF/container.xml");
  if (!container) reject("CONTAINER_MISSING");
  const rootfiles = findTags(checkMarkup(container, "navigation"), "rootfile");
  const rootfile = rootfiles.find((n) => attr(n, "media-type") === "application/oebps-package+xml");
  if (!rootfile) reject("PACKAGE_MISSING");
  const opfPath = normalizedPath("container.xml", attr(rootfile, "full-path") ?? "");
  const opf = content.get(opfPath);
  if (!opf) reject("PACKAGE_MISSING");
  const packageTree = checkMarkup(opf, "package");
  const manifest = new Map<string, { path: string; properties: string }>();
  for (const item of findTags(packageTree, "item")) {
    const id = attr(item, "id");
    const href = attr(item, "href");
    if (!id || !href || manifest.has(id)) reject("MANIFEST");
    const path = normalizedPath(opfPath, href);
    if (!available.has(path)) reject("MISSING_RESOURCE");
    if (ACTIVE_PATH_422.test(path)) reject("ACTIVE_RESOURCE");
    manifest.set(id, { path, properties: attr(item, "properties") ?? "" });
  }
  const titleNode = findTags(packageTree, "dc:title")[0] ?? findTags(packageTree, "title")[0];
  const title = (titleNode ? textOf(titleNode) : "").slice(0, 200) || file.name;
  const navEntry = [...manifest.values()].find((part) => part.properties.split(/\s+/u).includes("nav"));
  const navTitles = new Map<string, string>();
  if (!navEntry) reject("NAVIGATION_MISSING");
  if (navEntry) {
    const navText = content.get(navEntry.path);
    if (!navText) reject("NAVIGATION_MISSING");
    const navTree = checkMarkup(navText, "navigation");
    for (const anchor of findTags(navTree, "a")) {
      const href = attr(anchor, "href");
      if (!href || href.startsWith("#")) continue;
      const path = normalizedPath(navEntry.path, href);
      const label = textOf(anchor);
      if (label) navTitles.set(path, label.slice(0, 160));
    }
  }
  const chapters: EpubChapter422[] = [];
  const refs = findTags(packageTree, "itemref");
  if (refs.length === 0 || refs.length > EPUB_LIMITS_422.maxChapters) reject("SPINE_LIMIT");
  for (const itemref of refs) {
    const idref = attr(itemref, "idref");
    const entry = idref ? manifest.get(idref) : undefined;
    if (!entry || !/\.(?:xhtml|html)$/iu.test(entry.path)) reject("SPINE_RESOURCE");
    const chapter = content.get(entry.path);
    if (!chapter) reject("CHAPTER_MISSING");
    const tree = checkMarkup(chapter, "chapter");
    const body = findTags(tree, "body")[0] ?? tree;
    const text = textOf(body);
    chapters.push({ id: idref!, title: navTitles.get(entry.path) ?? chapterTitle(tree, "Capitolo " + (chapters.length + 1)), text });
  }
  if (!chapters.some((part) => part.text)) reject("NO_TEXT");
  return {
    title, chapters, allText: chapters.map((part) => part.title + "\n\n" + part.text).join("\n\n"),
    source: "EPUB3 locale · solo testo · nessuna risorsa eseguita",
  };
}
