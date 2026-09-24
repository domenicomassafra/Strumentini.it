import { convertTextCase } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

const module = createTextWritingModule((input) => convertTextCase(input));
export default module;
