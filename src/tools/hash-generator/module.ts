import { createDeveloperWebModule } from "../../engines/developer-web";
import type { HashGeneratorInput, HashGeneratorOutput } from "./types";

const module = createDeveloperWebModule("hash-generator");
export default module;
export type { HashGeneratorInput, HashGeneratorOutput };
