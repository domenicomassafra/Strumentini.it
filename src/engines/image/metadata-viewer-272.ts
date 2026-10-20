/** Metadata enrichment is intentionally used only by the single-file viewer. */
import { inspectImageMetadataLocal, type MetadataResult } from "./visual-tools";
import { readExifrDetails272, type ExifrDetails272 } from "./exifr-reader-272";
import { assertFile, abortIfNeeded } from "./visual";

export interface MetadataViewerResult extends MetadataResult, ExifrDetails272 {}

export async function inspectImageMetadataViewer272Local(
  input: unknown, signal?: AbortSignal,
): Promise<MetadataViewerResult> {
  const header = await inspectImageMetadataLocal(input, signal);
  const file = assertFile(input);
  const details = await readExifrDetails272(file.blob, signal);
  abortIfNeeded(signal);
  return { ...header, ...details };
}
