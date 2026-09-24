import { FilePrivacyTool } from "./FilePrivacyTool";

export function ZipContentsInspectorTool() {
  return <FilePrivacyTool operation="zip-contents-inspector" title="ZIP contents inspector" description="Read a ZIP central directory and flag path or encryption risks." />;
}
