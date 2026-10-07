export const TEXT_MARKUP_CONVERSION_ENGINE_VERSION = "text-markup-conversion-v1";
export const TEXT_MARKUP_DOCUMENT_MODEL_VERSION = "normalized-document-v1";

export type TextMarkupConversionMode =
  | "markdown-to-html"
  | "html-to-markdown"
  | "markdown-to-text"
  | "text-to-html"
  | "html-to-text";

type SourceFormat = "markdown" | "html" | "text";
type TargetFormat = SourceFormat;

type InlineNode =
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "strong"; readonly children: readonly InlineNode[] }
  | { readonly type: "emphasis"; readonly children: readonly InlineNode[] }
  | { readonly type: "delete"; readonly children: readonly InlineNode[] }
  | { readonly type: "code"; readonly value: string }
  | { readonly type: "link"; readonly href: string; readonly children: readonly InlineNode[] }
  | { readonly type: "break" };

type BlockNode =
  | { readonly type: "paragraph"; readonly children: readonly InlineNode[] }
  | { readonly type: "heading"; readonly level: 1 | 2 | 3 | 4 | 5 | 6; readonly children: readonly InlineNode[] }
  | { readonly type: "blockquote"; readonly children: readonly BlockNode[] }
  | { readonly type: "list"; readonly ordered: boolean; readonly items: readonly (readonly BlockNode[])[] }
  | { readonly type: "code-block"; readonly value: string; readonly info: string | null }
  | { readonly type: "thematic-break" };

interface NormalizedDocument {
  readonly blocks: readonly BlockNode[];
}

export interface TextMarkupConversionInput {
  readonly mode: TextMarkupConversionMode;
  readonly text: string;
}

export interface TextMarkupConversionResult {
  readonly mode: TextMarkupConversionMode;
  readonly sourceFormat: SourceFormat;
  readonly targetFormat: TargetFormat;
  readonly sourceNormalized: string;
  readonly output: string;
  readonly previewHtml: string;
  readonly filename: string;
  readonly mime: "text/html" | "text/markdown" | "text/plain";
  readonly preservedConstructs: readonly string[];
  readonly droppedConstructs: readonly string[];
  readonly warnings: readonly string[];
  readonly newlinePolicy: string;
  readonly unicodePolicy: string;
  readonly dialectPolicy: string;
  readonly modelVersion: string;
  readonly engineVersion: string;
}

interface ParseContext {
  readonly warnings: Set<string>;
  readonly dropped: Set<string>;
}

interface HtmlTextNode {
  readonly type: "text";
  readonly value: string;
}

interface HtmlElementNode {
  readonly type: "element";
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: HtmlTreeNode[];
}

interface HtmlRootNode {
  readonly type: "root";
  readonly children: HtmlTreeNode[];
}

type HtmlTreeNode = HtmlTextNode | HtmlElementNode;

const VOID_HTML_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const SKIPPED_HTML_TAGS = new Set(["script", "style", "template", "iframe", "object", "embed"]);
const BLOCK_HTML_TAGS = new Set(["address", "article", "aside", "blockquote", "div", "footer", "header", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul"]);

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/gu, "\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function decodeHtmlEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: "\u00a0",
    quot: '"',
  };
  return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]+));/giu, (match, decimal: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (decimal !== undefined) {
      const point = Number.parseInt(decimal, 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    if (hex !== undefined) {
      const point = Number.parseInt(hex, 16);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return name === undefined ? match : named[name.toLowerCase()] ?? match;
  });
}

function safeHref(value: string): string | null {
  const decoded = decodeHtmlEntities(value).trim();
  if (decoded === "" || /[\u0000-\u0020\\]/u.test(decoded) || decoded.startsWith("//")) return null;
  return /^(?:https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/iu.test(decoded) ? decoded : null;
}

function textNode(value: string): InlineNode {
  return { type: "text", value };
}

function mergeAdjacentText(nodes: readonly InlineNode[]): readonly InlineNode[] {
  const merged: InlineNode[] = [];
  for (const node of nodes) {
    const previous = merged.at(-1);
    if (node.type === "text" && previous?.type === "text") {
      merged[merged.length - 1] = { type: "text", value: previous.value + node.value };
    } else {
      merged.push(node);
    }
  }
  return merged;
}

function findClosingDelimiter(value: string, delimiter: string, start: number): number {
  let index = start;
  while (index < value.length) {
    const found = value.indexOf(delimiter, index);
    if (found < 0) return -1;
    let backslashes = 0;
    for (let cursor = found - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) backslashes += 1;
    if (backslashes % 2 === 0) return found;
    index = found + delimiter.length;
  }
  return -1;
}

function findClosingParenthesis(value: string, start: number): number {
  let depth = 1;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index] ?? "";
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "(") depth += 1;
    if (char !== ")") continue;
    depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function maxBacktickRun(value: string): number {
  let max = 0;
  for (const match of value.matchAll(/`+/gu)) max = Math.max(max, match[0].length);
  return max;
}

function parseMarkdownInline(value: string, context: ParseContext): readonly InlineNode[] {
  const nodes: InlineNode[] = [];
  let plain = "";
  const flushPlain = (): void => {
    if (plain !== "") nodes.push(textNode(plain));
    plain = "";
  };
  for (let index = 0; index < value.length;) {
    const char = value[index] ?? "";
    if (char === "\\" && index + 1 < value.length) {
      plain += value[index + 1] ?? "";
      index += 2;
      continue;
    }
    if (char === "`" ) {
      const run = /^`+/u.exec(value.slice(index))?.[0] ?? "`";
      const close = value.indexOf(run, index + run.length);
      if (close >= 0) {
        flushPlain();
        let code = value.slice(index + run.length, close).replace(/\n/gu, " ");
        if (/^\s.*\s$/su.test(code) && !/^\s+$/u.test(code)) code = code.slice(1, -1);
        nodes.push({ type: "code", value: code });
        index = close + run.length;
        continue;
      }
    }
    if (value.startsWith("![", index)) {
      context.dropped.add("Immagini Markdown: la sintassi è conservata come testo; non vengono caricate né incorporate risorse.");
    }
    if (char === "[" && !value.startsWith("![", Math.max(0, index - 1))) {
      const labelEnd = findClosingDelimiter(value, "]", index + 1);
      if (labelEnd >= 0 && value[labelEnd + 1] === "(") {
        const destinationEnd = findClosingParenthesis(value, labelEnd + 2);
        if (destinationEnd >= 0) {
          const href = safeHref(value.slice(labelEnd + 2, destinationEnd));
          flushPlain();
          const children = parseMarkdownInline(value.slice(index + 1, labelEnd), context);
          if (href === null) {
            context.dropped.add("Link Markdown con schema non sicuro: destinazione rimossa, etichetta preservata.");
            nodes.push(...children);
          } else {
            nodes.push({ type: "link", href, children });
          }
          index = destinationEnd + 1;
          continue;
        }
      }
    }
    const strongDelimiter = value.startsWith("**", index) ? "**" : value.startsWith("__", index) ? "__" : null;
    if (strongDelimiter !== null) {
      const close = findClosingDelimiter(value, strongDelimiter, index + 2);
      if (close >= 0) {
        flushPlain();
        nodes.push({ type: "strong", children: parseMarkdownInline(value.slice(index + 2, close), context) });
        index = close + 2;
        continue;
      }
    }
    if (value.startsWith("~~", index)) {
      const close = findClosingDelimiter(value, "~~", index + 2);
      if (close >= 0) {
        flushPlain();
        nodes.push({ type: "delete", children: parseMarkdownInline(value.slice(index + 2, close), context) });
        index = close + 2;
        continue;
      }
    }
    if (char === "*" || char === "_") {
      const close = findClosingDelimiter(value, char, index + 1);
      if (close > index + 1) {
        flushPlain();
        nodes.push({ type: "emphasis", children: parseMarkdownInline(value.slice(index + 1, close), context) });
        index = close + 1;
        continue;
      }
    }
    plain += char;
    index += 1;
  }
  flushPlain();
  return mergeAdjacentText(nodes);
}

function paragraphInlines(lines: readonly string[], context: ParseContext): readonly InlineNode[] {
  const nodes: InlineNode[] = [];
  lines.forEach((line, index) => {
    const hardBreak = /(?: {2,}|\\)$/u.test(line);
    const content = hardBreak ? line.replace(/(?: {2,}|\\)$/u, "") : line;
    nodes.push(...parseMarkdownInline(content, context));
    if (index < lines.length - 1) nodes.push(hardBreak ? { type: "break" } : textNode(" "));
  });
  return mergeAdjacentText(nodes);
}

function isMarkdownBlockStart(line: string): boolean {
  return /^(?:\s{0,3}#{1,6}\s+|\s{0,3}([-*_])(?:\s*\1){2,}\s*$|\s*>|\s*(?:[-*+]\s+|\d+[.)]\s+)|\s*`{3,}|\s*~{3,})/u.test(line);
}

function parseMarkdown(value: string, context: ParseContext): NormalizedDocument {
  const lines = normalizeNewlines(value).split("\n");
  if (/^\s*[-*+]\s+\[[ xX]\]\s+/mu.test(value)) context.dropped.add("GFM task list: checkbox semantics are not interpreted; marker text is preserved.");
  if (/^\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/mu.test(value)) context.dropped.add("GFM table: table structure is outside this core and remains plain paragraph text.");
  if (/^\s*\[\^[^\]]+\]:/mu.test(value)) context.dropped.add("Footnotes: extension syntax is outside the supported Markdown subset and remains text.");
  if (/<(?:https?:\/\/|mailto:)[^>]+>/iu.test(value)) context.dropped.add("GFM autolinks: angle-bracket autolinks are not interpreted automatically.");
  if (/<\/?[a-z][^>]*>/iu.test(value)) context.dropped.add("Raw HTML in Markdown is never interpreted; angle-bracket markup is escaped as text.");

  const blocks: BlockNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    const fence = /^\s{0,3}(`{3,}|~{3,})\s*(.*)$/u.exec(line);
    if (fence !== null) {
      const marker = fence[1] ?? "```";
      const info = (fence[2] ?? "").trim();
      const collected: string[] = [];
      index += 1;
      let closed = false;
      while (index < lines.length) {
        const candidate = lines[index] ?? "";
        const closePattern = marker[0] === "`" ? /^\s{0,3}`{3,}\s*$/u : /^\s{0,3}~{3,}\s*$/u;
        if (closePattern.test(candidate) && candidate.trim().length >= marker.length) {
          closed = true;
          index += 1;
          break;
        }
        collected.push(candidate);
        index += 1;
      }
      if (!closed) context.warnings.add("Blocco di codice Markdown non chiuso: il contenuto fino a fine input è trattato come codice.");
      blocks.push({ type: "code-block", value: collected.join("\n"), info: info === "" ? null : info });
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(line);
    if (heading !== null) {
      const level = Math.min(6, heading[1]?.length ?? 1) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: "heading", level, children: parseMarkdownInline(heading[2] ?? "", context) });
      index += 1;
      continue;
    }
    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/u.test(line)) {
      blocks.push({ type: "thematic-break" });
      index += 1;
      continue;
    }
    if (/^\s*>/u.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^\s*>/u.test(lines[index] ?? "")) {
        quoted.push((lines[index] ?? "").replace(/^\s*>\s?/u, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", children: parseMarkdown(quoted.join("\n"), context).blocks });
      continue;
    }
    const listMatch = /^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/u.exec(line);
    if (listMatch !== null) {
      const ordered = listMatch[2] !== undefined;
      const items: BlockNode[][] = [];
      while (index < lines.length) {
        const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/u.exec(lines[index] ?? "");
        if (item === null || (item[2] !== undefined) !== ordered) break;
        if (/^\s{2,}/u.test(lines[index] ?? "")) context.dropped.add("Nested-list indentation is flattened to one list level.");
        items.push([{ type: "paragraph", children: parseMarkdownInline(item[3] ?? "", context) }]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? "").trim() !== "" && !isMarkdownBlockStart(lines[index] ?? "")) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push({ type: "paragraph", children: paragraphInlines(paragraph, context) });
  }
  return { blocks };
}

function parseHtmlAttributes(value: string): Readonly<Record<string, string>> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;
  for (const match of value.matchAll(pattern)) {
    const name = (match[1] ?? "").toLowerCase();
    if (name === "") continue;
    attributes[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function findHtmlTagEnd(value: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return index;
  }
  return -1;
}

function parseHtmlTree(value: string, context: ParseContext): HtmlRootNode {
  const source = normalizeNewlines(value);
  const root: HtmlRootNode = { type: "root", children: [] };
  const stack: Array<HtmlRootNode | HtmlElementNode> = [root];
  const appendText = (text: string): void => {
    if (text === "") return;
    stack.at(-1)?.children.push({ type: "text", value: decodeHtmlEntities(text) });
  };
  for (let index = 0; index < source.length;) {
    if (source.startsWith("<!--", index)) {
      const close = source.indexOf("-->", index + 4);
      context.dropped.add("Commenti HTML rimossi.");
      index = close < 0 ? source.length : close + 3;
      continue;
    }
    if (source[index] !== "<") {
      const next = source.indexOf("<", index);
      const end = next < 0 ? source.length : next;
      appendText(source.slice(index, end));
      index = end;
      continue;
    }
    const end = findHtmlTagEnd(source, index + 1);
    if (end < 0) {
      appendText("<");
      index += 1;
      continue;
    }
    const token = source.slice(index + 1, end).trim();
    if (/^!/u.test(token) || /^\?/u.test(token)) {
      context.dropped.add("Doctype/processing instruction HTML rimossi dal modello locale.");
      index = end + 1;
      continue;
    }
    const closing = /^\/\s*([a-z][a-z0-9:-]*)/iu.exec(token);
    if (closing !== null) {
      const tag = (closing[1] ?? "").toLowerCase();
      for (let cursor = stack.length - 1; cursor > 0; cursor -= 1) {
        const candidate = stack[cursor];
        if (candidate?.type === "element" && candidate.tag === tag) {
          stack.length = cursor;
          break;
        }
      }
      index = end + 1;
      continue;
    }
    const opening = /^([a-z][a-z0-9:-]*)([\s\S]*)$/iu.exec(token.replace(/\/$/u, ""));
    if (opening === null) {
      appendText(source.slice(index, end + 1));
      index = end + 1;
      continue;
    }
    const tag = (opening[1] ?? "").toLowerCase();
    if (SKIPPED_HTML_TAGS.has(tag)) {
      context.dropped.add(`<${tag}> e contenuto rimossi dalla conversione.`);
      const closePattern = new RegExp(`<\\/\\s*${tag}\\s*>`, "igu");
      closePattern.lastIndex = end + 1;
      const match = closePattern.exec(source);
      index = match === null ? source.length : closePattern.lastIndex;
      continue;
    }
    if (tag === "textarea") {
      const closePattern = /<\/\s*textarea\s*>/igu;
      closePattern.lastIndex = end + 1;
      const match = closePattern.exec(source);
      const rawEnd = match?.index ?? source.length;
      const element: HtmlElementNode = {
        type: "element",
        tag,
        attributes: parseHtmlAttributes(opening[2] ?? ""),
        children: [{ type: "text", value: decodeHtmlEntities(source.slice(end + 1, rawEnd)) }],
      };
      stack.at(-1)?.children.push(element);
      index = match === null ? source.length : closePattern.lastIndex;
      continue;
    }
    const element: HtmlElementNode = {
      type: "element",
      tag,
      attributes: parseHtmlAttributes(opening[2] ?? ""),
      children: [],
    };
    stack.at(-1)?.children.push(element);
    const selfClosing = /\/\s*$/u.test(token) || VOID_HTML_TAGS.has(tag);
    if (!selfClosing) stack.push(element);
    index = end + 1;
  }
  return root;
}

function collapseHtmlWhitespace(value: string): string {
  return value.replace(/[\t\n\f\r ]+/gu, " ");
}

function htmlTextContent(node: HtmlTreeNode | HtmlRootNode): string {
  if (node.type === "text") return node.value;
  return node.children.map((child) => htmlTextContent(child)).join("");
}

function inlineFromHtml(node: HtmlTreeNode, context: ParseContext): readonly InlineNode[] {
  if (node.type === "text") return [textNode(collapseHtmlWhitespace(node.value))];
  const childInlines = (): readonly InlineNode[] => mergeAdjacentText(node.children.flatMap((child) => inlineFromHtml(child, context)));
  if (node.tag === "br") return [{ type: "break" }];
  if (node.tag === "strong" || node.tag === "b") return [{ type: "strong", children: childInlines() }];
  if (node.tag === "em" || node.tag === "i") return [{ type: "emphasis", children: childInlines() }];
  if (node.tag === "del" || node.tag === "s" || node.tag === "strike") return [{ type: "delete", children: childInlines() }];
  if (node.tag === "code") return [{ type: "code", value: htmlTextContent(node) }];
  if (node.tag === "a") {
    const href = safeHref(node.attributes.href ?? "");
    if (href === null) {
      if (node.attributes.href !== undefined) context.dropped.add("Link HTML con schema non sicuro: href rimosso, testo preservato.");
      return childInlines();
    }
    return [{ type: "link", href, children: childInlines() }];
  }
  if (node.tag === "img") {
    context.dropped.add("Immagini HTML non incorporate; solo eventuale testo alt è preservato.");
    const alt = node.attributes.alt ?? "";
    return alt === "" ? [] : [textNode(alt)];
  }
  if (BLOCK_HTML_TAGS.has(node.tag)) {
    return childInlines();
  }
  context.dropped.add(`Elemento HTML <${node.tag}> non supportato: tag/attributi rimossi, testo discendente preservato.`);
  return childInlines();
}

function blocksFromHtmlChildren(children: readonly HtmlTreeNode[], context: ParseContext): readonly BlockNode[] {
  const blocks: BlockNode[] = [];
  let pending: InlineNode[] = [];
  const flushPending = (): void => {
    const normalized = mergeAdjacentText(pending);
    const visible = normalized.some((node) => node.type !== "text" || node.value.trim() !== "");
    if (visible) blocks.push({ type: "paragraph", children: normalized });
    pending = [];
  };
  for (const node of children) {
    if (node.type === "text") {
      pending.push(...inlineFromHtml(node, context));
      continue;
    }
    const heading = /^h([1-6])$/u.exec(node.tag);
    if (heading !== null) {
      flushPending();
      blocks.push({ type: "heading", level: Number(heading[1]) as 1 | 2 | 3 | 4 | 5 | 6, children: mergeAdjacentText(node.children.flatMap((child) => inlineFromHtml(child, context))) });
      continue;
    }
    if (node.tag === "p") {
      flushPending();
      blocks.push({ type: "paragraph", children: mergeAdjacentText(node.children.flatMap((child) => inlineFromHtml(child, context))) });
      continue;
    }
    if (node.tag === "pre") {
      flushPending();
      blocks.push({ type: "code-block", value: htmlTextContent(node), info: null });
      continue;
    }
    if (node.tag === "textarea") {
      flushPending();
      context.dropped.add("Elemento HTML <textarea>: semantica di controllo modulo rimossa, contenuto RCDATA preservato come blocco preformattato.");
      blocks.push({ type: "code-block", value: htmlTextContent(node), info: null });
      continue;
    }
    if (node.tag === "blockquote") {
      flushPending();
      blocks.push({ type: "blockquote", children: blocksFromHtmlChildren(node.children, context) });
      continue;
    }
    if (node.tag === "ul" || node.tag === "ol") {
      flushPending();
      const items = node.children
        .filter((child): child is HtmlElementNode => child.type === "element" && child.tag === "li")
        .map((item) => {
          const nested = item.children.some((child) => child.type === "element" && (child.tag === "ul" || child.tag === "ol"));
          if (nested) context.dropped.add("Liste HTML annidate: il livello interno viene appiattito nel contenuto dell'elemento padre.");
          const inlines = mergeAdjacentText(item.children.flatMap((child) => inlineFromHtml(child, context)));
          return [{ type: "paragraph", children: inlines } as BlockNode];
        });
      blocks.push({ type: "list", ordered: node.tag === "ol", items });
      continue;
    }
    if (node.tag === "hr") {
      flushPending();
      blocks.push({ type: "thematic-break" });
      continue;
    }
    if (node.tag === "table") {
      flushPending();
      context.dropped.add("Tabelle HTML: struttura tabellare e attributi vengono appiattiti in testo separato da tab/newline.");
      const rows = node.children.flatMap((child) => child.type === "element" && ["thead", "tbody", "tfoot"].includes(child.tag) ? child.children : [child]);
      const rowText = rows
        .filter((child): child is HtmlElementNode => child.type === "element" && child.tag === "tr")
        .map((row) => row.children
          .filter((cell): cell is HtmlElementNode => cell.type === "element" && (cell.tag === "td" || cell.tag === "th"))
          .map((cell) => collapseHtmlWhitespace(htmlTextContent(cell)).trim())
          .join("\t"))
        .filter((row) => row !== "")
        .join("\n");
      if (rowText !== "") blocks.push({ type: "code-block", value: rowText, info: null });
      continue;
    }
    if (["div", "section", "article", "main", "header", "footer", "aside", "nav", "address"].includes(node.tag)) {
      flushPending();
      context.dropped.add(`Contenitore HTML <${node.tag}>: semantica del contenitore rimossa, contenuto preservato.`);
      blocks.push(...blocksFromHtmlChildren(node.children, context));
      continue;
    }
    pending.push(...inlineFromHtml(node, context));
  }
  flushPending();
  return blocks;
}

function parseHtml(value: string, context: ParseContext): NormalizedDocument {
  const tree = parseHtmlTree(value, context);
  return { blocks: blocksFromHtmlChildren(tree.children, context) };
}

function parseText(value: string): NormalizedDocument {
  const normalized = normalizeNewlines(value);
  const paragraphs = normalized.split(/\n{2,}/u);
  const blocks: BlockNode[] = paragraphs
    .filter((paragraph) => paragraph !== "")
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      const inlines: InlineNode[] = [];
      lines.forEach((line, index) => {
        inlines.push(textNode(line));
        if (index < lines.length - 1) inlines.push({ type: "break" });
      });
      return { type: "paragraph", children: inlines } as BlockNode;
    });
  return { blocks };
}

function inlineToHtml(nodes: readonly InlineNode[]): string {
  return nodes.map((node) => {
    if (node.type === "text") return escapeHtml(node.value);
    if (node.type === "break") return "<br />";
    if (node.type === "code") return `<code>${escapeHtml(node.value)}</code>`;
    if (node.type === "strong") return `<strong>${inlineToHtml(node.children)}</strong>`;
    if (node.type === "emphasis") return `<em>${inlineToHtml(node.children)}</em>`;
    if (node.type === "delete") return `<del>${inlineToHtml(node.children)}</del>`;
    const href = safeHref(node.href);
    return href === null ? inlineToHtml(node.children) : `<a href="${escapeHtml(href)}" rel="noreferrer noopener">${inlineToHtml(node.children)}</a>`;
  }).join("");
}

function blocksToHtml(blocks: readonly BlockNode[]): string {
  return blocks.map((block) => {
    if (block.type === "paragraph") return `<p>${inlineToHtml(block.children)}</p>`;
    if (block.type === "heading") return `<h${block.level}>${inlineToHtml(block.children)}</h${block.level}>`;
    if (block.type === "blockquote") return `<blockquote>\n${blocksToHtml(block.children)}\n</blockquote>`;
    if (block.type === "code-block") return `<pre><code>${escapeHtml(block.value)}</code></pre>`;
    if (block.type === "thematic-break") return "<hr />";
    const tag = block.ordered ? "ol" : "ul";
    const items = block.items.map((item) => `<li>${item.map((child) => child.type === "paragraph" ? inlineToHtml(child.children) : blocksToHtml([child])).join("\n")}</li>`).join("\n");
    return `<${tag}>\n${items}\n</${tag}>`;
  }).join("\n");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\`*_[\]<>#~])/gu, "\\$1");
}

function inlineToMarkdown(nodes: readonly InlineNode[]): string {
  return nodes.map((node) => {
    if (node.type === "text") return escapeMarkdownText(node.value);
    if (node.type === "break") return "  \n";
    if (node.type === "strong") return `**${inlineToMarkdown(node.children)}**`;
    if (node.type === "emphasis") return `*${inlineToMarkdown(node.children)}*`;
    if (node.type === "delete") return `~~${inlineToMarkdown(node.children)}~~`;
    if (node.type === "code") {
      const fence = "`".repeat(Math.max(1, maxBacktickRun(node.value) + 1));
      const padded = node.value.startsWith(" ") || node.value.endsWith(" ") ? ` ${node.value} ` : node.value;
      return `${fence}${padded}${fence}`;
    }
    const href = safeHref(node.href);
    return href === null ? inlineToMarkdown(node.children) : `[${inlineToMarkdown(node.children)}](${href.replace(/\)/gu, "\\)")})`;
  }).join("");
}

function blocksToMarkdown(blocks: readonly BlockNode[], depth = 0): string {
  return blocks.map((block) => {
    if (block.type === "paragraph") return inlineToMarkdown(block.children);
    if (block.type === "heading") return `${"#".repeat(block.level)} ${inlineToMarkdown(block.children)}`;
    if (block.type === "thematic-break") return "---";
    if (block.type === "code-block") {
      const fence = "`".repeat(Math.max(3, maxBacktickRun(block.value) + 1));
      return `${fence}${block.info ?? ""}\n${block.value}\n${fence}`;
    }
    if (block.type === "blockquote") return blocksToMarkdown(block.children, depth + 1).split("\n").map((line) => `> ${line}`).join("\n");
    return block.items.map((item, index) => {
      const marker = block.ordered ? `${index + 1}.` : "-";
      const content = blocksToMarkdown(item, depth + 1).replace(/\n/gu, "\n  ");
      return `${"  ".repeat(depth)}${marker} ${content}`;
    }).join("\n");
  }).join("\n\n");
}

function inlineToText(nodes: readonly InlineNode[]): string {
  return nodes.map((node) => {
    if (node.type === "text" || node.type === "code") return node.value;
    if (node.type === "break") return "\n";
    if (node.type === "strong" || node.type === "emphasis" || node.type === "delete") return inlineToText(node.children);
    const label = inlineToText(node.children);
    const href = safeHref(node.href);
    return href === null || label === href ? label : `${label} (${href})`;
  }).join("");
}

function blocksToText(blocks: readonly BlockNode[], depth = 0): string {
  return blocks.map((block) => {
    if (block.type === "paragraph" || block.type === "heading") return inlineToText(block.children);
    if (block.type === "code-block") return block.value;
    if (block.type === "thematic-break") return "---";
    if (block.type === "blockquote") return blocksToText(block.children, depth + 1).split("\n").map((line) => `> ${line}`).join("\n");
    return block.items.map((item, index) => {
      const marker = block.ordered ? `${index + 1}.` : "-";
      return `${"  ".repeat(depth)}${marker} ${blocksToText(item, depth + 1).replace(/\n/gu, "\n  ")}`;
    }).join("\n");
  }).join("\n\n");
}

function formatsFor(mode: TextMarkupConversionMode): { source: SourceFormat; target: TargetFormat } {
  if (mode === "markdown-to-html") return { source: "markdown", target: "html" };
  if (mode === "html-to-markdown") return { source: "html", target: "markdown" };
  if (mode === "markdown-to-text") return { source: "markdown", target: "text" };
  if (mode === "text-to-html") return { source: "text", target: "html" };
  return { source: "html", target: "text" };
}

function staticPolicy(mode: TextMarkupConversionMode): { preserved: readonly string[]; dropped: readonly string[] } {
  if (mode === "markdown-to-html") return {
    preserved: ["ATX headings 1–6", "paragraphs and CommonMark soft/hard line-break intent", "strong/emphasis/strikethrough", "inline and fenced code", "flat ordered/unordered lists", "blockquotes", "thematic breaks", "safe links"],
    dropped: ["Raw HTML is escaped as text", "GFM tables/task-list semantics/autolink extension/footnotes are outside the supported subset", "nested-list indentation is flattened", "fenced-code info strings are not emitted as HTML attributes"],
  };
  if (mode === "markdown-to-text") return {
    preserved: ["Unicode text", "paragraph and hard-break boundaries", "list markers", "blockquote markers", "code text", "safe link labels and destinations"],
    dropped: ["Heading level", "strong/emphasis/strikethrough styling", "thematic styling", "raw HTML interpretation", "unsupported GFM extension semantics"],
  };
  if (mode === "html-to-markdown") return {
    preserved: ["h1–h6", "paragraphs and br", "strong/em/del", "inline code and pre/textarea whitespace", "flat lists", "blockquotes", "hr", "safe links"],
    dropped: ["Scripts/styles/templates/embedded active content", "CSS/classes/ids/event handlers and non-href attributes", "textarea form-control semantics (content becomes preformatted text)", "unknown element semantics (text is retained)", "nested-list levels", "table structure (flattened)", "images except alt text"],
  };
  if (mode === "html-to-text") return {
    preserved: ["Unicode text", "block/line boundaries", "pre/code/textarea whitespace", "list/blockquote markers", "safe link labels and destinations", "image alt text"],
    dropped: ["All visual styling", "heading levels", "scripts/styles/templates/embedded active content", "CSS/classes/ids/event handlers", "textarea form-control semantics", "unknown element semantics", "table structure beyond flattened cell text"],
  };
  return {
    preserved: ["Unicode code points", "paragraph boundaries", "explicit line breaks"],
    dropped: ["No headings/lists/emphasis are invented from plain text", "Runs of two or more blank lines become one paragraph boundary and leading/trailing empty paragraphs are omitted", "Consecutive horizontal spaces remain source spaces and can visually collapse under normal HTML rendering"],
  };
}

function filenameFor(target: TargetFormat): string {
  if (target === "html") return "documento-convertito.html";
  if (target === "markdown") return "documento-convertito.md";
  return "documento-convertito.txt";
}

function mimeFor(target: TargetFormat): TextMarkupConversionResult["mime"] {
  if (target === "html") return "text/html";
  if (target === "markdown") return "text/markdown";
  return "text/plain";
}

export function convertTextMarkup(input: TextMarkupConversionInput): TextMarkupConversionResult {
  if (typeof input.text !== "string") throw new Error("INVALID_INPUT");
  const formats = formatsFor(input.mode);
  const sourceNormalized = normalizeNewlines(input.text);
  const context: ParseContext = { warnings: new Set(), dropped: new Set() };
  const document = formats.source === "markdown"
    ? parseMarkdown(sourceNormalized, context)
    : formats.source === "html"
      ? parseHtml(sourceNormalized, context)
      : parseText(sourceNormalized);
  const output = formats.target === "html"
    ? blocksToHtml(document.blocks)
    : formats.target === "markdown"
      ? blocksToMarkdown(document.blocks)
      : blocksToText(document.blocks);
  const previewHtml = blocksToHtml(document.blocks);
  const policy = staticPolicy(input.mode);
  return {
    mode: input.mode,
    sourceFormat: formats.source,
    targetFormat: formats.target,
    sourceNormalized,
    output,
    previewHtml,
    filename: filenameFor(formats.target),
    mime: mimeFor(formats.target),
    preservedConstructs: policy.preserved,
    droppedConstructs: [...policy.dropped, ...context.dropped],
    warnings: [...context.warnings],
    newlinePolicy: "CRLF e CR sono normalizzati a LF; i serializer non aggiungono un newline terminale sintetico. Il contenuto di pre/code preserva i newline interni normalizzati.",
    unicodePolicy: "I code point Unicode sono preservati senza normalizzazione NFC/NFKC; copy e download serializzano UTF-8.",
    dialectPolicy: "Subset conservativo ispirato a CommonMark 0.31.2. Strikethrough è accettato come estensione GFM mirata; tabelle, task list, autolink extension e footnote GFM non sono interpretati.",
    modelVersion: TEXT_MARKUP_DOCUMENT_MODEL_VERSION,
    engineVersion: TEXT_MARKUP_CONVERSION_ENGINE_VERSION,
  };
}
