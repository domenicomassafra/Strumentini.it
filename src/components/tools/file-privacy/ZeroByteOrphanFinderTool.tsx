import { FilePrivacyTool } from "./FilePrivacyTool";

export function ZeroByteOrphanFinderTool() {
  return <FilePrivacyTool operation="zero-byte-orphan-finder" title="Zero-byte and orphan finder" description="Find empty files and referenced paths missing from a local file list." directory />;
}
