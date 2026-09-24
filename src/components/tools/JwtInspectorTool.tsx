import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function JwtInspectorTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["jwt-inspector"]} />;
}
