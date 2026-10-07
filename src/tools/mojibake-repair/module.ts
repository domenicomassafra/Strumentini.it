import { repairMojibake } from "../../engines/text-writing";
import { createTextWritingModule } from "../text-writing/create-module";

export default createTextWritingModule((input) => repairMojibake(input));
