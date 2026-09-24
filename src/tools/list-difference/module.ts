import { differenceLists } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => differenceLists(input));
export default module;
