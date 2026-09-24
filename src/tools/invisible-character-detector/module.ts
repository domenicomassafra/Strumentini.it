import { findInvisibleCharacters } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => findInvisibleCharacters(input));
export default module;
