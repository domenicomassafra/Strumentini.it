import { FilePrivacyTool } from "./FilePrivacyTool";

export function MetadataRiskInspectorTool() {
  return <FilePrivacyTool operation="metadata-risk-inspector" title="Metadata risk inspector" description="Inspect bounded metadata-like markers and name risks locally." />;
}
