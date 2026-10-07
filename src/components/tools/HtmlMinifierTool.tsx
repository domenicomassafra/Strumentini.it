import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function HtmlMinifierTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["html-minifier"]} />;
}
