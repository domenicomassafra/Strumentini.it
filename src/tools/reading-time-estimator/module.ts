import { estimateReadingTime } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => estimateReadingTime(input));
export default module;
