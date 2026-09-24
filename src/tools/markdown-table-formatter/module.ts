import { formatMarkdownTable } from "../../engines/text-writing";
import { createTextWritingModule, requireObjectInput } from "../text-writing/create-module";

const module = createTextWritingModule((input) => {
  const candidate = requireObjectInput(input);
  return formatMarkdownTable(typeof candidate.markdown === "string" ? { text: candidate.markdown } : input);
});
export default module;
