import { DeveloperWebTool, DEVELOPER_WEB_CONFIGS } from "./DeveloperWebTool";

export function CronNextRunTool() {
  return <DeveloperWebTool config={DEVELOPER_WEB_CONFIGS["cron-next-run"]} />;
}
