import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function MimeTypeLookupTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["mime-type-lookup"]} />;
}
