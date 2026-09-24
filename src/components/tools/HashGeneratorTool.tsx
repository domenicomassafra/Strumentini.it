import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function HashGeneratorTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["hash-generator"]} />;
}
