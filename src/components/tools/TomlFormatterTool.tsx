import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function TomlFormatterTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["toml-formatter"]} />;
}
