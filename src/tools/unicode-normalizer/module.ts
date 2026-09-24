import { normalizeUnicode } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => normalizeUnicode(input));
export default module;
