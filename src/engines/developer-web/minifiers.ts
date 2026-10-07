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

export function cssMinifyOperation(css: string) {
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
  const output = cssTree.generate(ast);
  const inputBytes = utf8Bytes(css);
  const outputBytes = utf8Bytes(output);
  return withVersion({
    valid: true,
    output,
    inputBytes,
    outputBytes,
    savedBytes: inputBytes - outputBytes,
    savedPercent: inputBytes === 0 ? 0 : Math.round(((inputBytes - outputBytes) / inputBytes) * 10_000) / 100,
    parser: `css-tree ${cssTree.version}`,
    semantics: "AST parse/serialize removes representation-only whitespace/comments while preserving strings, escapes and custom-property token content.",
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

function minifyHtmlTree(node: HtmlNode, mode: "safe" | "advanced", warnings: Set<string>): void {
  const children = node.childNodes;
  if (children === undefined) return;
  for (const child of [...children]) minifyHtmlTree(child, mode, warnings);
  node.childNodes = children.filter((child, index, siblings) => {
    if (child.nodeName === "#comment") {
      if (conditionalComment(child)) {
        warnings.add("Commento condizionale conservato perché la sua semantica dipende dal consumer.");
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
  if (mode !== "safe" && mode !== "advanced") invalid("INVALID_MODE", "HTML mode must be safe or advanced.");
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
  minifyHtmlTree(document as unknown as HtmlNode, mode, warnings);
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
    whitespacePolicy: mode === "safe"
      ? "Preserve every HTML text node exactly as parsed; only ordinary comments are removed. pre/textarea/script/style are untouched."
      : "Preserve all non-whitespace text and sensitive elements; remove additional whitespace-only nodes adjacent to block elements.",
    scriptStylePolicy: "script and style contents are parsed as HTML raw-text elements and are never regex-rewritten by this minifier.",
  });
}
