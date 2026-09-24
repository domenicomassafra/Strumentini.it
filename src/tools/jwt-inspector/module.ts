import { createDeveloperWebModule } from "../../engines/developer-web";
import type { JwtInspectorInput, JwtInspectorOutput } from "./types";

const module = createDeveloperWebModule("jwt-inspector");
export default module;
export type { JwtInspectorInput, JwtInspectorOutput };
