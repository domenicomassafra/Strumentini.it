import { diffArrays } from "diff";

export type EqualityMode = "exact" | "trim" | "nfc" | "trim-nfc";

export interface ListComparison {
  intersection: string[];
  onlyLeft: string[];
  onlyRight: string[];
}

export interface DiffOperation {
  kind: "equal" | "add" | "remove";
  text: string;
}

export const TEXT_LIST_ENGINE_VERSION = "text-list-v1";
export const MAX_DIFF_CELLS = 1_000_000;
// Myers' edit frontier grows with edit distance. Cap donor work before taking
// the existing bounded path for mostly unrelated texts (STR #300 benchmarks).
const MAX_DONOR_EDIT_LENGTH = 64;

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n|\r/gu, "\n");
}

export function parseListText(text: string): string[] {
  if (text === "") return [];
  const normalized = normalizeLineEndings(text);
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) lines.pop();
  return lines;
}

function equalityKey(value: string, mode: EqualityMode): string {
  switch (mode) {
    case "trim":
      return value.trim();
    case "nfc":
      return value.normalize("NFC");
    case "trim-nfc":
      return value.trim().normalize("NFC");
    case "exact":
      return value;
  }
}

function uniqueBy(lines: readonly string[], mode: EqualityMode): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const line of lines) {
    const key = equalityKey(line, mode);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(line);
  }
  return output;
}

export function dedupeLines(
  lines: readonly string[],
  mode: EqualityMode = "exact",
): string[] {
  return uniqueBy(lines, mode);
}

export function compareLists(
  left: readonly string[],
  right: readonly string[],
  mode: EqualityMode = "exact",
): ListComparison {
  const leftUnique = uniqueBy(left, mode);
  const rightUnique = uniqueBy(right, mode);
  const leftKeys = new Set(leftUnique.map((value) => equalityKey(value, mode)));
  const rightKeys = new Set(rightUnique.map((value) => equalityKey(value, mode)));

  return {
    intersection: leftUnique.filter((value) => rightKeys.has(equalityKey(value, mode))),
    onlyLeft: leftUnique.filter((value) => !rightKeys.has(equalityKey(value, mode))),
    onlyRight: rightUnique.filter((value) => !leftKeys.has(equalityKey(value, mode))),
  };
}

function lineTokens(text: string): string[] {
  const normalized = normalizeLineEndings(text);
  if (normalized === "") return [];
  return normalized.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
}

function boundedLegacyDiff(left: string[], right: string[]): DiffOperation[] {
  const rows = Array.from(
    { length: left.length + 1 },
    () => new Uint32Array(right.length + 1),
  );
  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    const row = rows[leftIndex];
    const nextRow = rows[leftIndex + 1];
    if (row === undefined || nextRow === undefined) continue;
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      row[rightIndex] = left[leftIndex] === right[rightIndex]
        ? 1 + (nextRow[rightIndex + 1] ?? 0)
        : Math.max(nextRow[rightIndex] ?? 0, row[rightIndex + 1] ?? 0);
    }
  }

  const output: DiffOperation[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length || rightIndex < right.length) {
    if (leftIndex < left.length && rightIndex < right.length && left[leftIndex] === right[rightIndex]) {
      output.push({ kind: "equal", text: left[leftIndex] ?? "" });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    const removeScore = rows[leftIndex + 1]?.[rightIndex] ?? 0;
    const addScore = rows[leftIndex]?.[rightIndex + 1] ?? 0;
    if (leftIndex < left.length && (rightIndex >= right.length || removeScore >= addScore)) {
      output.push({ kind: "remove", text: left[leftIndex] ?? "" });
      leftIndex += 1;
    } else if (rightIndex < right.length) {
      output.push({ kind: "add", text: right[rightIndex] ?? "" });
      rightIndex += 1;
    }
  }
  return output;
}

export function diffText(before: string, after: string): DiffOperation[] {
  const left = lineTokens(before);
  const right = lineTokens(after);
  if ((left.length + 1) * (right.length + 1) > MAX_DIFF_CELLS) {
    throw new Error("DIFF_TOO_LARGE");
  }

  // Tool modules load on demand. Prefer the donor's edit script without a cell
  // matrix; preserve legacy bounded behavior if the edit distance is too high.
  // A near-disjoint large pair is known to be expensive for Myers O(ND);
  // preflight overlap is linear and avoids that regression.
  if (left.length > 64 && right.length > 64) {
    const rightTokens = new Set(right);
    const overlapping = left.reduce((count, token) => count + Number(rightTokens.has(token)), 0);
    if (overlapping * 4 < Math.min(left.length, right.length)) {
      return boundedLegacyDiff(left, right);
    }
  }
  const changes = diffArrays(left, right, { maxEditLength: MAX_DONOR_EDIT_LENGTH });
  if (changes === undefined) return boundedLegacyDiff(left, right);
  return changes.flatMap(({ added, removed, value }) => {
    const kind = added ? "add" : removed ? "remove" : "equal";
    return value.map((text) => ({ kind, text }));
  });
}
