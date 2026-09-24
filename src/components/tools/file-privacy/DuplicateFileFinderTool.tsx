import { FilePrivacyTool } from "./FilePrivacyTool";

export function DuplicateFileFinderTool() {
  return <FilePrivacyTool operation="duplicate-file-finder" title="Duplicate file finder" description="Find exact duplicates by size and local SHA-256 content." directory />;
}
