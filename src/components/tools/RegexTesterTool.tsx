import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function RegexTesterTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["regex-tester"]} />;
}
