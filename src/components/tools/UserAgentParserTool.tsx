import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function UserAgentParserTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["user-agent-parser"]} />;
}
