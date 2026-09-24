import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function JsonFormatterTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["json-formatter"]} />;
}
