import { convertTextMarkup, type TextMarkupConversionResult } from "./index";

const MAX_HTML_CHARACTERS = 1_000_000;

/** Browser-only boundary: normalize and sanitize first, then hand only safe HTML to the donor. */
export async function convertHtmlToMarkdownWithTurndown(
  html: string,
  signal?: AbortSignal,
): Promise<TextMarkupConversionResult> {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  if (typeof document === "undefined" || typeof document.implementation?.createHTMLDocument !== "function") {
    throw new Error("HTML_MARKDOWN_BROWSER_ONLY");
  }
  if (html.length > MAX_HTML_CHARACTERS) throw new Error("INPUT_TOO_LARGE");

  // The existing HTML parser discards executable content and unsafe URL destinations.
  // Its serializer emits only escaped text and allowlisted elements/attributes.
  const sanitized = convertTextMarkup({ mode: "html-to-markdown", text: html });
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const { default: TurndownService } = await import("turndown");
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  const converter = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    codeBlockStyle: "fenced",
    fence: "```",
    hr: "---",
    // Turndown's <br> rule itself appends the newline.
    br: "  ",
    linkStyle: "inlined",
  });
  converter.addRule("strikethrough", {
    filter: "del",
    replacement: (content) => `~~${content}~~`,
  });
  // Text such as &lt;tag&gt; must remain Markdown text, including on external readers.
  const donorEscape = converter.escape.bind(converter);
  converter.escape = (text) => donorEscape(text).replace(/[<>]/gu, "\\$&");
  converter.addRule("flatListItem", {
    filter: "li",
    replacement: (content, node) => {
      const list = node.parentElement;
      const position = list === null ? 1 : Array.from(list.children).indexOf(node) + 1;
      const prefix = list?.nodeName === "OL" ? `${position}. ` : "- ";
      const item = content.replace(/^\n+|\n+$/gu, "").replace(/\n/gu, `\n${" ".repeat(prefix.length)}`);
      return `${prefix}${item}${node.nextSibling ? "\n" : ""}`;
    },
  });
  const output = converter.turndown(sanitized.previewHtml);
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
  return { ...sanitized, output };
}
