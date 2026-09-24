import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function UuidGeneratorTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["uuid-generator"]} />;
}
