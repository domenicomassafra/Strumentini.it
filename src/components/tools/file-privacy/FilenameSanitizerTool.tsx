import { FilePrivacyTool } from "./FilePrivacyTool";

export function FilenameSanitizerTool() {
  return <FilePrivacyTool operation="filename-sanitizer" title="Filename sanitizer" description="Preview safe, portable names without changing the original files." />;
}
