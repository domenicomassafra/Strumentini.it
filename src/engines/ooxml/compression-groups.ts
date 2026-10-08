import type { OoxmlEntryClass, OoxmlPackageAnalysis } from "./package";

/** ZIP member size, not an estimate of final OOXML size: central/local headers
 * and ZIP directory are counted separately as container overhead. */
export const OOXML_ZIP_GROUPS = ["media", "xml", "font", "other"] as const satisfies readonly OoxmlEntryClass[];
export type OoxmlZipGroup = (typeof OOXML_ZIP_GROUPS)[number];
export interface OoxmlGroupSize {
  readonly members: number;
  readonly packedBytes: number;
  readonly expandedBytes: number;
}
export interface OoxmlZipGroupBreakdown {
  readonly fileBytes: number;
  readonly memberBytes: number;
  readonly expandedBytes: number;
  readonly containerOverheadBytes: number;
  readonly groups: Readonly<Record<OoxmlZipGroup, OoxmlGroupSize>>;
}
export interface OoxmlZipGroupDifference {
  readonly group: OoxmlZipGroup;
  readonly beforePackedBytes: number;
  readonly afterPackedBytes: number;
  readonly savedPackedBytes: number;
  readonly beforeExpandedBytes: number;
  readonly afterExpandedBytes: number;
  readonly members: number;
}

export function summarizeOoxmlZipGroups(analysis: OoxmlPackageAnalysis, fileBytes: number): OoxmlZipGroupBreakdown {
  if (!Number.isSafeInteger(fileBytes) || fileBytes < analysis.totalCompressedMemberBytes) {
    throw new RangeError("Actual ZIP file byte length is required; member bytes cannot exceed archive bytes.");
  }
  const mutable: Record<OoxmlZipGroup, { members: number; packedBytes: number; expandedBytes: number }> = {
    media: { members: 0, packedBytes: 0, expandedBytes: 0 },
    xml: { members: 0, packedBytes: 0, expandedBytes: 0 },
    font: { members: 0, packedBytes: 0, expandedBytes: 0 },
    other: { members: 0, packedBytes: 0, expandedBytes: 0 },
  };
  for (const part of analysis.entries) {
    const group = mutable[part.classification];
    group.members += 1;
    group.packedBytes += part.compressedSize;
    group.expandedBytes += part.uncompressedSize;
  }
  const memberBytes = OOXML_ZIP_GROUPS.reduce((sum, group) => sum + mutable[group].packedBytes, 0);
  const expandedBytes = OOXML_ZIP_GROUPS.reduce((sum, group) => sum + mutable[group].expandedBytes, 0);
  if (memberBytes !== analysis.totalCompressedMemberBytes || expandedBytes !== analysis.totalUncompressedBytes) {
    throw new Error("OOXML ZIP group totals disagree with bounded parser.");
  }
  return {
    fileBytes, memberBytes, expandedBytes, containerOverheadBytes: fileBytes - memberBytes,
    groups: mutable,
  };
}

export function compareOoxmlZipGroups(before: OoxmlZipGroupBreakdown, after: OoxmlZipGroupBreakdown): readonly OoxmlZipGroupDifference[] {
  return OOXML_ZIP_GROUPS.map((group) => {
    const a = before.groups[group];
    const b = after.groups[group];
    if (a.members !== b.members) throw new Error(`OOXML ZIP group membership changed: ${group}`);
    return {
      group, members: a.members,
      beforePackedBytes: a.packedBytes, afterPackedBytes: b.packedBytes,
      savedPackedBytes: a.packedBytes - b.packedBytes,
      beforeExpandedBytes: a.expandedBytes, afterExpandedBytes: b.expandedBytes,
    };
  });
}
