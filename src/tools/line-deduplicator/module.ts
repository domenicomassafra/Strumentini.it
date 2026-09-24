import { deduplicateLines } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => deduplicateLines(input));
export default module;
