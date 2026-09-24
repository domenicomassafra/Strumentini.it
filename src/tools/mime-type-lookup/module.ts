import { createDeveloperWebModule } from "../../engines/developer-web";
import type { MimeTypeLookupInput, MimeTypeLookupOutput } from "./types";

const module = createDeveloperWebModule("mime-type-lookup");
export default module;
export type { MimeTypeLookupInput, MimeTypeLookupOutput };
