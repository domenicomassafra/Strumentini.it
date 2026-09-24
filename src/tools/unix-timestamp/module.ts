import { createDeveloperWebModule } from "../../engines/developer-web";
import type { UnixTimestampInput, UnixTimestampOutput } from "./types";

const module = createDeveloperWebModule("unix-timestamp");
export default module;
export type { UnixTimestampInput, UnixTimestampOutput };
