import { convertTextMarkup, type TextMarkupConversionMode } from "../../engines/text-markup-conversion";
import { createTextWritingModule, requireObjectInput } from "../text-writing/create-module";

const MODES = new Set<TextMarkupConversionMode>([
  "markdown-to-html",
  "html-to-markdown",
  "markdown-to-text",
  "text-to-html",
  "html-to-text",
]);

const module = createTextWritingModule((value, signal) => {
  const input = requireObjectInput(value);
  if (typeof input.mode !== "string" || !MODES.has(input.mode as TextMarkupConversionMode) || typeof input.text !== "string") {
    throw new Error("INVALID_INPUT");
  }
  if (input.mode === "html-to-markdown") {
    if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError");
    if (typeof document === "undefined") return Promise.reject(new Error("HTML_MARKDOWN_BROWSER_ONLY"));
    const html = input.text;
    return import("../../engines/text-markup-conversion/turndown-adapter")
      .then(({ convertHtmlToMarkdownWithTurndown }) => convertHtmlToMarkdownWithTurndown(html, signal));
  }
  return convertTextMarkup({ mode: input.mode as TextMarkupConversionMode, text: input.text });
});

export default module;
