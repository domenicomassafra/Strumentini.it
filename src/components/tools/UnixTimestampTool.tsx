import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function UnixTimestampTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["unix-timestamp"]} />;
}
