import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function HttpStatusReferenceTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["http-status-reference"]} />;
}
