import { FilePrivacyTool } from "./FilePrivacyTool";

export function FolderSizeTypeSummaryTool() {
  return <FilePrivacyTool operation="folder-size-type-summary" title="Folder size and type summary" description="Summarize selected local files by extension and declared type." directory />;
}
