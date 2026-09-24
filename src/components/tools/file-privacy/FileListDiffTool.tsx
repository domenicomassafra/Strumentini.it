import { FilePrivacyTool } from "./FilePrivacyTool";

export function FileListDiffTool() {
  return <FilePrivacyTool operation="file-list-diff" title="File-list diff" description="Compare two local file selections by path and optional SHA-256." />;
}
