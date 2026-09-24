import { createDeveloperWebModule } from "../../engines/developer-web";
import type { TomlFormatterInput, TomlFormatterOutput } from "./types";

const module = createDeveloperWebModule("toml-formatter");
export default module;
export type { TomlFormatterInput, TomlFormatterOutput };
