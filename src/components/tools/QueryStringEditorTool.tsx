import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function QueryStringEditorTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["query-string-editor"]} />;
}
