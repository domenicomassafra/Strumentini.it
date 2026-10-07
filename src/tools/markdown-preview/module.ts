import { convertTextMarkup } from "../../engines/text-markup-conversion";
import { createTextWritingModule, requireObjectInput } from "../text-writing/create-module";

const module = createTextWritingModule((input) => {
  const candidate = requireObjectInput(input);
  const text = typeof candidate.markdown === "string" ? candidate.markdown : typeof candidate.text === "string" ? candidate.text : null;
  if (text === null) throw new Error("INVALID_INPUT");
  const converted = convertTextMarkup({ mode: "markdown-to-html", text });
  const escapedRawHtml = converted.droppedConstructs.some((item) => item.includes("Raw HTML in Markdown"));
  return {
    html: converted.output,
    warnings: [
      ...converted.warnings,
      ...(escapedRawHtml ? ["Raw HTML is escaped for safety."] : []),
    ],
    escapedRawHtml,
    engineVersion: converted.engineVersion,
  };
});
export default module;
