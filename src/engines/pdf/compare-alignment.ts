export interface PdfComparePageEvidence {
  readonly page: number;
  readonly text: string;
  readonly truncated: boolean;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly imageCount: number;
  readonly annotationCount: number;
}

export type PdfAlignedKind = "unchanged" | "modified" | "added" | "removed" | "reordered";
export interface PdfAlignedPage {
  readonly kind: PdfAlignedKind;
  readonly firstPage: number | null;
  readonly secondPage: number | null;
  readonly geometryChanged: boolean;
  readonly textChanged: boolean;
  readonly resourceCountChanged: boolean;
}

export interface PdfAlignmentSummary {
  readonly entries: readonly PdfAlignedPage[];
  readonly addedPages: readonly number[];
  readonly removedPages: readonly number[];
  readonly reorderedPairs: readonly { firstPage: number; secondPage: number }[];
  readonly modifiedPairs: readonly { firstPage: number; secondPage: number }[];
  readonly unchangedPairs: readonly { firstPage: number; secondPage: number }[];
  readonly ambiguousEmptyText: boolean;
}

function geometry(a: PdfComparePageEvidence, b: PdfComparePageEvidence): boolean {
  return a.width === b.width && a.height === b.height && a.rotation === b.rotation;
}

function counts(a: PdfComparePageEvidence, b: PdfComparePageEvidence): boolean {
  return a.imageCount === b.imageCount && a.annotationCount === b.annotationCount;
}

/** Exact text is a *possible alignment anchor*, not proof of visual identity. */
function anchor(a: PdfComparePageEvidence, b: PdfComparePageEvidence): boolean {
  return a.text.length > 0 && !a.truncated && !b.truncated
    && a.text === b.text && geometry(a, b) && counts(a, b);
}

const COST_REPLACE = 1.5;

/** Bounded <=200×200 global alignment, then conservatively detect a moved unique page. */
export function alignPdfEvidence(left: readonly PdfComparePageEvidence[], right: readonly PdfComparePageEvidence[]): PdfAlignmentSummary {
  if (left.length > 200 || right.length > 200) throw new Error("PDF_LIMIT: Troppi elementi nel confronto");
  const n = left.length;
  const m = right.length;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 0; i <= n; i++) dp[i]![0] = i;
  for (let j = 0; j <= m; j++) dp[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (anchor(left[i - 1]!, right[j - 1]!) ? 0 : COST_REPLACE),
      );
    }
  }
  const operations: Array<{ first: number | null; second: number | null }> = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const replacement = i > 0 && j > 0 ? (anchor(left[i - 1]!, right[j - 1]!) ? 0 : COST_REPLACE) : Infinity;
    if (i > 0 && j > 0 && Math.abs(dp[i]![j]! - (dp[i - 1]![j - 1]! + replacement)) < 0.0001) {
      operations.push({ first: --i, second: --j });
    } else if (i > 0 && Math.abs(dp[i]![j]! - (dp[i - 1]![j]! + 1)) < 0.0001) {
      operations.push({ first: --i, second: null });
    } else if (j > 0) {
      operations.push({ first: null, second: --j });
    } else {
      throw new Error("PDF_COMPARE_ALIGNMENT_INVALID");
    }
  }
  operations.reverse();

  // Pair only *uniquely identifiable*, unpaired removed/added anchors as a move.
  // Duplicate text or textless scan pages are not reliable page identities.
  const removed = operations.filter((op) => op.first !== null && op.second === null);
  const added = operations.filter((op) => op.first === null && op.second !== null);
  const moved = new Map<number, number>();
  const usedAdded = new Set<number>();
  for (const candidate of removed) {
    const from = candidate.first!;
    const matches = added.filter((item) => anchor(left[from]!, right[item.second!]!));
    if (matches.length !== 1) continue;
    const to = matches[0]!.second!;
    if (usedAdded.has(to)) continue;
    if (removed.filter((item) => anchor(left[item.first!]!, right[to]!)).length !== 1) continue;
    moved.set(from, to);
    usedAdded.add(to);
  }
  const entries: PdfAlignedPage[] = [];
  for (const operation of operations) {
    if (operation.first === null && usedAdded.has(operation.second!)) continue;
    if (operation.first !== null && operation.second === null && moved.has(operation.first)) {
      operation.second = moved.get(operation.first)!;
    }
    const a = operation.first === null ? undefined : left[operation.first];
    const b = operation.second === null ? undefined : right[operation.second];
    const sameGeometry = a !== undefined && b !== undefined && geometry(a, b);
    const sameText = a !== undefined && b !== undefined && a.text === b.text && !a.truncated && !b.truncated;
    const sameResources = a !== undefined && b !== undefined && counts(a, b);
    entries.push({
      kind: a === undefined ? "added" : b === undefined ? "removed" : moved.has(operation.first!)
        ? "reordered" : sameGeometry && sameText && sameResources ? "unchanged" : "modified",
      firstPage: a?.page ?? null,
      secondPage: b?.page ?? null,
      geometryChanged: a !== undefined && b !== undefined && !sameGeometry,
      textChanged: a !== undefined && b !== undefined && !sameText,
      resourceCountChanged: a !== undefined && b !== undefined && !sameResources,
    });
  }
  const pairs = (kind: PdfAlignedKind) => entries.filter((entry) => entry.kind === kind)
    .map((entry) => ({ firstPage: entry.firstPage!, secondPage: entry.secondPage! }));
  return {
    entries,
    addedPages: entries.filter((entry) => entry.kind === "added").map((entry) => entry.secondPage!),
    removedPages: entries.filter((entry) => entry.kind === "removed").map((entry) => entry.firstPage!),
    reorderedPairs: pairs("reordered"),
    modifiedPairs: pairs("modified"),
    unchangedPairs: pairs("unchanged"),
    ambiguousEmptyText: left.some((page) => page.text.length === 0 || page.truncated)
      || right.some((page) => page.text.length === 0 || page.truncated),
  };
}
