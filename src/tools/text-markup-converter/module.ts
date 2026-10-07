import { convertTextMarkup, type TextMarkupConversionMode } from "../../engines/text-markup-conversion";
import { createTextWritingModule, requireObjectInput } from "../text-writing/create-module";

const MODES = new Set<TextMarkupConversionMode>([
  "markdown-to-html",
  "html-to-markdown",
  "markdown-to-text",
  "text-to-html",
  "html-to-text",
]);

const module = createTextWritingModule((value) => {
  const input = requireObjectInput(value);
  if (typeof input.mode !== "string" || !MODES.has(input.mode as TextMarkupConversionMode) || typeof input.text !== "string") {
    throw new Error("INVALID_INPUT");
  }
  return convertTextMarkup({ mode: input.mode as TextMarkupConversionMode, text: input.text });
});

export default module;
