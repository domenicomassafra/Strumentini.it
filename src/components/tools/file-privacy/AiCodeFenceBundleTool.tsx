import { FilePrivacyTool } from "./FilePrivacyTool";

export function AiCodeFenceBundleTool() {
  return <FilePrivacyTool operation="ai-code-fence-bundle" title="Code fence AI → file ZIP" description="Incolla una risposta con blocchi di codice: anteprima nomi sicuri e scarica esattamente quei byte in uno ZIP locale store-only." />;
}
