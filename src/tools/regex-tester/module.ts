import { createDeveloperWebModule } from "../../engines/developer-web";
import type { RegexTesterInput, RegexTesterOutput } from "./types";

const module = createDeveloperWebModule("regex-tester");
export default module;
export type { RegexTesterInput, RegexTesterOutput };
