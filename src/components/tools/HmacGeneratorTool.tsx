import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function HmacGeneratorTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["hmac-generator"]} />;
}
