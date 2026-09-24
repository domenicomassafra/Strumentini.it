import { normalizeWhitespace } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => normalizeWhitespace(input));
export default module;
