import type { SupportedHashAlgorithm } from "../../engines/file-hash";

export interface FileHashInput {
  blob: Blob;
  algorithm?: string;
  expectedChecksum?: string;
}

export interface FileHashOutput {
  algorithm: SupportedHashAlgorithm;
  digestHex: string;
  bytesHashed: number;
  expectedChecksum: string | null;
  matchesExpected: boolean | null;
}
