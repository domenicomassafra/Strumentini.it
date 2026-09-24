import { createDeveloperWebModule } from "../../engines/developer-web";
import type { UuidGeneratorInput, UuidGeneratorOutput } from "./types";

const module = createDeveloperWebModule("uuid-generator");
export default module;
export type { UuidGeneratorInput, UuidGeneratorOutput };
