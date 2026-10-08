import { FilePrivacyTool } from "./FilePrivacyTool";

export function FileSizeAnalyzerTool() {
  return <FilePrivacyTool operation="file-size-analyzer" title="Analizzatore dimensione file" description="Misura le dimensioni di immagini, ZIP, Office, MP4 e WAV, distinguendo dati verificati da incognite e senza promettere risparmi prima della compressione." />;
}
