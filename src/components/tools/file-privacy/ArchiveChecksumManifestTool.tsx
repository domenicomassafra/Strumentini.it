import { FilePrivacyTool } from "./FilePrivacyTool";

export function ArchiveChecksumManifestTool() {
  return <FilePrivacyTool operation="archive-checksum-manifest" title="Archive checksum manifest" description="Hash a ZIP or selected files and emit a portable checksum manifest." />;
}
