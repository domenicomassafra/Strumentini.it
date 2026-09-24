import { createDeveloperWebModule } from "../../engines/developer-web";
import type { UserAgentParserInput, UserAgentParserOutput } from "./types";

const module = createDeveloperWebModule("user-agent-parser");
export default module;
export type { UserAgentParserInput, UserAgentParserOutput };
