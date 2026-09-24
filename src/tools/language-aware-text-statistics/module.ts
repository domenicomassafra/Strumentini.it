import { languageStatistics } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => languageStatistics(input));
export default module;
