import * as cssTree from "css-tree";
import { parse, parseFragment, serialize, type ParserError } from "parse5";
import { assertInputSize, invalid, withVersion } from "./types";

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function lineColumnAt(text: string, offset: number): { line: number; column: number; character: number } {
  const prefix = text.slice(0, Math.max(0, offset));
  const lines = prefix.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1, character: offset };
}

function validateCssDelimiters(css: string): void {
  const stack: Array<{ character: string; offset: number }> = [];
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let comment = false;
  for (let index = 0; index < css.length; index += 1) {
    const character = css[index] ?? "";
    const next = css[index + 1] ?? "";
    if (comment) {
      if (character === "*" && next === "/") { comment = false; index += 1; }
      continue;
    }
    if (quote !== null) {
      if (escaped) { escaped = false; continue; }
      if (character === "\\") { escaped = true; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "*") { comment = true; index += 1; continue; }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === "{" || character === "(" || character === "[") stack.push({ character, offset: index });
    else if (character === "}" || character === ")" || character === "]") {
      const expected = character === "}" ? "{" : character === ")" ? "(" : "[";
      const opening = stack.pop();
      if (opening?.character !== expected) invalid("INVALID_CSS", "Unbalanced CSS delimiter.", lineColumnAt(css, index));
    }
  }
  if (comment) invalid("INVALID_CSS", "Unclosed CSS comment.", lineColumnAt(css, Math.max(0, css.lastIndexOf("/*"))));
  if (quote !== null) invalid("INVALID_CSS", "Unclosed CSS string.", lineColumnAt(css, Math.max(0, css.length - 1)));
  const opening = stack.at(-1);
  if (opening !== undefined) invalid("INVALID_CSS", "Unclosed CSS delimiter.", lineColumnAt(css, opening.offset));
}

function parsedCss(css: string) {
  assertInputSize(css);
  validateCssDelimiters(css);
  let ast: ReturnType<typeof cssTree.parse>;
  try {
    ast = cssTree.parse(css, { positions: true, parseCustomProperty: true });
  } catch (error) {
    const candidate = error as { line?: number; column?: number; offset?: number; message?: string };
    invalid("INVALID_CSS", candidate.message ?? "CSS parse failed.", {
      ...(candidate.line === undefined ? {} : { line: candidate.line }),
      ...(candidate.column === undefined ? {} : { column: candidate.column }),
      ...(candidate.offset === undefined ? {} : { character: candidate.offset }),
    });
  }
  const invalidNodes: Array<{ line: number | undefined; column: number | undefined; offset: number | undefined }> = [];
  cssTree.walk(ast, (node) => {
    if (node.type === "Raw" || (node.type === "Declaration" && cssTree.generate(node.value).trim() === "")) {
      invalidNodes.push({ line: node.loc?.start.line, column: node.loc?.start.column, offset: node.loc?.start.offset });
    }
  });
  const invalidNode = invalidNodes[0];
  if (invalidNode !== undefined) {
    invalid("INVALID_CSS", "CSS contains syntax the parser could not represent safely.", {
      ...(invalidNode.line === undefined ? {} : { line: invalidNode.line }),
      ...(invalidNode.column === undefined ? {} : { column: invalidNode.column }),
      ...(invalidNode.offset === undefined ? {} : { character: invalidNode.offset }),
    });
  }
  if (ast.type !== "StyleSheet") invalid("INVALID_CSS", "Expected a parsed CSS stylesheet.");
  return ast;
}

/** Format only syntax understood by css-tree; do not regex-rewrite CSS strings. */
function prettyCssNode(node: cssTree.CssNode, level: number): string {
  if (node.type !== "Rule" && node.type !== "Atrule") return cssTree.generate(node);
  const indent = "  ".repeat(level);
  const prefix = node.type === "Rule"
    ? cssTree.generate(node.prelude)
    : `@${node.name}${node.prelude === null ? "" : ` ${cssTree.generate(node.prelude)}`}`;
  if (node.block === null || node.block === undefined) return cssTree.generate(node);
  const children = node.block.children.toArray();
  if (children.length === 0) return `${prefix} {}`;
  const body = children.map((child) => {
    let line: string;
    if (child.type === "Rule" || child.type === "Atrule") {
      line = prettyCssNode(child, level + 1);
    } else if (child.type === "Declaration") {
      // Split at the syntax node's leading property separator, never in a
      // quoted value or a custom-property value's opaque token sequence.
      const declaration = cssTree.generate(child);
      const separator = declaration.indexOf(":");
      line = `${declaration.slice(0, separator + 1)} ${declaration.slice(separator + 1).replace(/;$/u, "")};`;
    } else {
      line = cssTree.generate(child);
    }
    return `${indent}  ${line}`;
  }).join("\n");
  return `${prefix} {\n${body}\n${indent}}`;
}

export function cssMinifyOperation(css: string, mode: "minify" | "prettify" = "minify") {
  if (mode !== "minify" && mode !== "prettify") invalid("INVALID_MODE", "CSS mode must be minify or prettify.");
  const ast = parsedCss(css);
  const output = mode === "prettify" ? ast.children.toArray().map((node) => prettyCssNode(node, 0)).join("\n") : cssTree.generate(ast);
  const inputBytes = utf8Bytes(css);
  const outputBytes = utf8Bytes(output);
  return withVersion({
    valid: true,
    output,
    mode,
    inputBytes,
    outputBytes,
    savedBytes: inputBytes - outputBytes,
    savedPercent: inputBytes === 0 ? 0 : Math.round(((inputBytes - outputBytes) / inputBytes) * 10_000) / 100,
    parser: `css-tree ${cssTree.version}`,
    semantics: mode === "minify"
      ? "AST parse/serialize removes representation-only whitespace/comments while preserving strings, escapes and custom-property token content."
      : "AST-based readable indentation preserves CSS tokens, strings and custom properties; formatting is not CSS optimization or minification.",
  });
}

interface HtmlNode {
  nodeName?: string;
  tagName?: string;
  data?: string;
  value?: string;
  childNodes?: HtmlNode[];
  parentNode?: HtmlNode | null;
}

const SENSITIVE_HTML = new Set(["pre", "textarea", "script", "style"]);
const BLOCK_HTML = new Set([
  "address", "article", "aside", "blockquote", "body", "dd", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "html", "li", "main", "nav", "ol", "p", "section", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

function isSensitiveContext(node: HtmlNode | null | undefined): boolean {
  let current = node;
  while (current !== null && current !== undefined) {
    if (current.tagName !== undefined && SENSITIVE_HTML.has(current.tagName)) return true;
    current = current.parentNode;
  }
  return false;
}

function isBlockNode(node: HtmlNode | undefined): boolean {
  return node?.tagName !== undefined && BLOCK_HTML.has(node.tagName);
}

function conditionalComment(node: HtmlNode): boolean {
  return node.nodeName === "#comment" && /\[if\s|\[endif\]/iu.test(node.data ?? "");
}

/** HTML comments can be live template/rendering delimiters. Never discard a
 * known directive in the opt-in advanced mode; preserve ALL comments in safe.
 * Unknown comment-based template grammars still require caller review. */
function functionalComment(node: HtmlNode): boolean {
  if (conditionalComment(node)) return true;
  const value = (node.data ?? "").trim();
  return /^(?:\/?ko(?:\s|:|$)|\/?ng[A-Za-z0-9_-]*(?:\s|:|$)|#|\/?\$|[!?@]|astro(?:\s|:|-|$)|prettier-ignore(?:\s|$)|\{\{|\{%|<%)/iu.test(value);
}

function isForeignHtmlContext(node: HtmlNode | null | undefined): boolean {
  let current = node;
  while (current !== null && current !== undefined) {
    if (current.tagName === "svg" || current.tagName === "math" || current.tagName === "template") return true;
    current = current.parentNode;
  }
  return false;
}

function minifyHtmlTree(node: HtmlNode, mode: "safe" | "advanced", warnings: Set<string>): void {
  const children = node.childNodes;
  if (children === undefined) return;
  for (const child of [...children]) minifyHtmlTree(child, mode, warnings);
  node.childNodes = children.filter((child, index, siblings) => {
    if (child.nodeName === "#comment") {
      if (mode === "safe" || isForeignHtmlContext(child.parentNode)) return true;
      if (functionalComment(child)) {
        warnings.add("Direttiva in un commento HTML conservata: marker condizionali, template/SSR e riferimenti esterni non sono commenti decorativi.");
        return true;
      }
      return false;
    }
    if (child.nodeName !== "#text" || isSensitiveContext(child.parentNode)) return true;
    if (mode === "safe") return true;
    const value = child.value ?? "";
    if (!/^\s+$/u.test(value)) return true;
    const previous = siblings[index - 1];
    const next = siblings[index + 1];
    return !(previous === undefined || next === undefined || isBlockNode(previous) || isBlockNode(next));
  });
}

/**
 * Pretty-print only structural block containers without non-whitespace text,
 * comments, or unknown inline children. Do not insert formatting whitespace
 * inside mixed content, pre, textarea, script, style or foreign content.
 * Changes to whitespace-only text nodes are disclosed to callers.
 */
function prettifyHtmlTree(node: HtmlNode, level: number): boolean {
  if (isSensitiveContext(node) || node.tagName === "svg" || node.tagName === "math" || node.tagName === "template") return false;
  const children = node.childNodes;
  if (children === undefined) return false;
  let changed = false;
  const fragmentRoot = node.nodeName === "#document-fragment" || node.nodeName === "#document";
  for (const child of children) {
    if (prettifyHtmlTree(child, level + (fragmentRoot ? 0 : 1))) changed = true;
  }
  const structural = node.tagName !== undefined && new Set([
    "html", "head", "body", "div", "ul", "ol", "table", "tbody", "thead", "tfoot", "section", "article", "main", "header", "footer", "nav", "aside",
  ]).has(node.tagName);
  if (!structural) return changed;
  if (!children.every((child) => isBlockNode(child) || (child.nodeName === "#text" && /^\s*$/u.test(child.value ?? "")))) return changed;
  const blocks = children.filter(isBlockNode);
  if (blocks.length === 0) return changed;
  const indent = (depth: number): HtmlNode => ({ nodeName: "#text", value: `\n${"  ".repeat(depth)}`, parentNode: node });
  node.childNodes = [indent(level + 1)];
  for (let i = 0; i < blocks.length; i += 1) {
    node.childNodes.push(blocks[i]!);
    if (i < blocks.length - 1) node.childNodes.push(indent(level + 1));
  }
  node.childNodes.push(indent(level));
  return true;
}

function parseErrorDiagnostic(error: ParserError) {
  return {
    ...(error.startLine === undefined ? {} : { line: error.startLine }),
    ...(error.startCol === undefined ? {} : { column: error.startCol }),
    ...(error.startOffset === undefined ? {} : { character: error.startOffset }),
    context: error.code,
  };
}

export function htmlMinifyOperation(html: string, mode: string = "safe") {
  assertInputSize(html);
  if (mode !== "safe" && mode !== "advanced" && mode !== "prettify") invalid("INVALID_MODE", "HTML mode must be safe, advanced or prettify.");
  const errors: ParserError[] = [];
  const looksLikeDocument = /<!doctype\s|<html(?:\s|>)/iu.test(html);
  const document = looksLikeDocument
    ? parse(html, { sourceCodeLocationInfo: true, onParseError: (error) => errors.push(error) })
    : parseFragment(html, { sourceCodeLocationInfo: true, onParseError: (error) => errors.push(error) });
  if (errors.length > 0) {
    const first = errors[0]!;
    invalid("INVALID_HTML", `HTML parser reported ${first.code}.`, parseErrorDiagnostic(first));
  }
  const warnings = new Set<string>();
  if (mode === "prettify") {
    if (prettifyHtmlTree(document as unknown as HtmlNode, 0)) {
      warnings.add("La formattazione introduce solo spazi e a-capo tra elementi di blocco strutturali; CSS e codice che osservano nodi di testo/spazi potrebbero comportarsi diversamente. Verifica il risultato.");
    }
  } else {
    minifyHtmlTree(document as unknown as HtmlNode, mode, warnings);
  }
  const output = serialize(document);
  const inputBytes = utf8Bytes(html);
  const outputBytes = utf8Bytes(output);
  return withVersion({
    valid: true,
    output,
    mode,
    inputBytes,
    outputBytes,
    savedBytes: inputBytes - outputBytes,
    savedPercent: inputBytes === 0 ? 0 : Math.round(((inputBytes - outputBytes) / inputBytes) * 10_000) / 100,
    warnings: [...warnings],
    parser: "parse5",
    whitespacePolicy: mode === "prettify"
      ? "Indent only block-only containers: whitespace-only nodes between blocks may be replaced. Preserve mixed text and pre/textarea/script/style/foreign markup; CSS whitespace selectors may be affected."
      : mode === "safe"
        ? "Preserve every HTML text and comment node as parsed; pre/textarea/script/style and foreign markup are untouched. Parser serialization can still normalize source markup."
        : "Preserve all non-whitespace text and sensitive elements; remove additional whitespace-only nodes adjacent to block elements.",
    commentPolicy: mode === "advanced"
      ? "Remove ordinary HTML comments (lossy for unknown comment-based frameworks), preserve known template/SSR/SSI/conditional directives and comments within foreign markup; review consumer semantics."
      : "Preserve all comments from the parser tree; no scripts or embedded references are executed during serialization.",
    scriptStylePolicy: "script and style contents are parsed as HTML raw-text elements and are never regex-rewritten by this minifier.",
  });
}
