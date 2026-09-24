import { previewFindReplace } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => previewFindReplace(input));
export default module;
