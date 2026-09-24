import { FilePrivacyTool } from "./FilePrivacyTool";

export function ChecksumVerifierTool() {
  return <FilePrivacyTool operation="checksum-verifier" title="Checksum verifier" description="Compare local SHA-256 digests with a checksum manifest." />;
}
