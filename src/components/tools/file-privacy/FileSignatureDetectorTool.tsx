import { FilePrivacyTool } from "./FilePrivacyTool";

export function FileSignatureDetectorTool() {
  return <FilePrivacyTool operation="file-signature-detector" title="File signature detector" description="Inspect bounded file signatures without trusting extensions." />;
}
