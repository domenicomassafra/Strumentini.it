import { FilePrivacyTool } from "./FilePrivacyTool";

export function CleanZipCreatorTool() {
  return <FilePrivacyTool operation="clean-zip-creator" title="Clean ZIP creator" description="Create a ZIP with sanitized portable paths and no server processing." />;
}
