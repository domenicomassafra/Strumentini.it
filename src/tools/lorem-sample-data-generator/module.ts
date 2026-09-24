import { generateSampleData } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => generateSampleData(input));
export default module;
