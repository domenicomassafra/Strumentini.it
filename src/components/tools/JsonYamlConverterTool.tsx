import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function JsonYamlConverterTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["json-yaml-converter"]} />;
}
