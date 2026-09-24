import { createDeveloperWebModule } from "../../engines/developer-web";
import type { HmacGeneratorInput, HmacGeneratorOutput } from "./types";

const module = createDeveloperWebModule("hmac-generator");
export default module;
export type { HmacGeneratorInput, HmacGeneratorOutput };
