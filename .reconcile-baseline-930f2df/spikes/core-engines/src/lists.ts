export type LineNormalization = "none" | "trim" | "nfc" | "trim-nfc";

export interface ListComparison {
  intersection: string[];
  onlyLeft: string[];
  onlyRight: string[];
}

export interface DiffLine {
  kind: "equal" | "add" | "remove";
  value: string;
}

const MAX_DIFF_CELLS = 1_000_000;

function keyFor(line: string, normalization: LineNormalization): string {
  switch (normalization) {
    case "trim":
      return line.trim();
    case "nfc":
      return line.normalize("NFC");
    case "trim-nfc":
      return line.trim().normalize("NFC");
    case "none":
      return line;
  }
}

function uniqueBy(
  lines: readonly string[],
  normalization: LineNormalization,
): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const line of lines) {
    const key = keyFor(line, normalization);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(line);
    }
  }
  return output;
}

export function sortLines(lines: readonly string[]): string[] {
  return [...lines].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  );
}

export function dedupeLines(
  lines: readonly string[],
  normalization: LineNormalization = "none",
): string[] {
  return uniqueBy(lines, normalization);
}

export function compareLists(
  left: readonly string[],
  right: readonly string[],
  normalization: LineNormalization = "none",
): ListComparison {
  const leftUnique = uniqueBy(left, normalization);
  const rightUnique = uniqueBy(right, normalization);
  const leftKeys = new Set(
    leftUnique.map((line) => keyFor(line, normalization)),
  );
  const rightKeys = new Set(
    rightUnique.map((line) => keyFor(line, normalization)),
  );

  return {
    intersection: leftUnique.filter((line) =>
      rightKeys.has(keyFor(line, normalization))
    ),
    onlyLeft: leftUnique.filter((line) =>
      !rightKeys.has(keyFor(line, normalization))
    ),
    onlyRight: rightUnique.filter((line) =>
      !leftKeys.has(keyFor(line, normalization))
    ),
  };
}

function linesOf(text: string): string[] {
  return text === "" ? [] : text.replace(/\r\n|\r/gu, "\n").split("\n");
}

export function diffText(before: string, after: string): DiffLine[] {
  const left = linesOf(before);
  const right = linesOf(after);
  if ((left.length + 1) * (right.length + 1) > MAX_DIFF_CELLS) {
    throw new Error("DIFF_TOO_LARGE");
  }
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

  const output: DiffLine[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length || rightIndex < right.length) {
    if (
      leftIndex < left.length && rightIndex < right.length &&
      left[leftIndex] === right[rightIndex]
    ) {
      output.push({ kind: "equal", value: left[leftIndex] ?? "" });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    const removeScore = rows[leftIndex + 1]?.[rightIndex] ?? 0;
    const addScore = rows[leftIndex]?.[rightIndex + 1] ?? 0;
    if (
      leftIndex < left.length &&
      (rightIndex >= right.length || removeScore >= addScore)
    ) {
      output.push({ kind: "remove", value: left[leftIndex] ?? "" });
      leftIndex += 1;
    } else if (rightIndex < right.length) {
      output.push({ kind: "add", value: right[rightIndex] ?? "" });
      rightIndex += 1;
    }
  }
  return output;
}
