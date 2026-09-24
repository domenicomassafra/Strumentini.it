import { createDeveloperWebModule } from "../../engines/developer-web";
import type { YamlFormatterInput, YamlFormatterOutput } from "./types";

const module = createDeveloperWebModule("yaml-formatter");
export default module;
export type { YamlFormatterInput, YamlFormatterOutput };
