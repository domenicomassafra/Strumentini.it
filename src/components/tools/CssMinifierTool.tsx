import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function CssMinifierTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["css-minifier"]} />;
}
