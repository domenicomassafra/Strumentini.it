import { FilePrivacyTool } from "./FilePrivacyTool";

export function BatchRenamePreviewTool() {
  return <FilePrivacyTool operation="batch-rename-preview" title="Batch rename preview" description="Preview deterministic name changes and collision suffixes." />;
}
