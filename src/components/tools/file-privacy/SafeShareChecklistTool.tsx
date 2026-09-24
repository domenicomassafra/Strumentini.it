import { FilePrivacyTool } from "./FilePrivacyTool";

export function SafeShareChecklistTool() {
  return <FilePrivacyTool operation="safe-share-checklist" title="Safe-share checklist" description="Run a bounded local pre-share checklist without promising safety." />;
}
