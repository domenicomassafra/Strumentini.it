import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function YamlFormatterTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["yaml-formatter"]} />;
}
