import { FilePrivacyTool } from "./FilePrivacyTool";

export function ClientHandoffIndexGeneratorTool() {
  return <FilePrivacyTool operation="client-handoff-index-generator" title="Client handoff index" description="Generate a local Markdown and JSON handoff index for selected files." />;
}
