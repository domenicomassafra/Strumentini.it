import { sortLines } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => sortLines(input));
export default module;
