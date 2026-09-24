import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function JsonPathPlaygroundTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["json-path-playground"]} />;
}
