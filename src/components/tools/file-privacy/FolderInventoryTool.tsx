import { FilePrivacyTool } from "./FilePrivacyTool";

export function FolderInventoryTool() {
  return <FilePrivacyTool operation="folder-inventory" title="Folder inventory" description="List selected local files and bounded size metadata." directory />;
}
