import { FilePrivacyTool } from "./FilePrivacyTool";

export function SecretTokenPatternScannerTool() {
  return <FilePrivacyTool operation="secret-token-pattern-scanner" title="Secret and token scanner" description="Scan text-like local files for common secret patterns with redacted previews." />;
}
