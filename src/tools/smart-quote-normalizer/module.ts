import { normalizeQuotes } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => normalizeQuotes(input));
export default module;
