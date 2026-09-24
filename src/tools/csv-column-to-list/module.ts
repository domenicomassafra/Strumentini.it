import { csvColumnToList } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => csvColumnToList(input));
export default module;
