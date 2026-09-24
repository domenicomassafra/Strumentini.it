import type { DeveloperWebResult } from "../../engines/developer-web";

export interface UserAgentParserInput { userAgent: string }
export interface UserAgentParserOutput extends DeveloperWebResult { browser: string; os: string; device: string; bot: boolean }
