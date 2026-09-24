import { FilePrivacyTool } from "./FilePrivacyTool";

export function BatchChecksumManifestTool() {
  return <FilePrivacyTool operation="batch-checksum-manifest" title="Batch checksum manifest" description="Choose files to create a local SHA-256 manifest." />;
}
