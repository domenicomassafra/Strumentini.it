import { compareCsvTables, type TableCompareOptions } from "./advanced";
import { parseCsvTable, serializeCsvTable, type CsvTable } from "./csv";
import { assertBoundedTable, joinCsvTables, TABLE_MAX_CELLS, TABLE_MAX_ROWS, type TableJoinOptions } from "./operations";

/** No binary floats, locale-dependent collation or implicit rounding of identifiers. */
export type KeyPrecision390 = "text" | "decimal-exact" | "decimal-scale";
export interface KeyPolicy390 {
  readonly keyPrecision?: KeyPrecision390;
  readonly decimalPlaces?: number;
  readonly nullTokens?: readonly string[];
  readonly emptyAsNull?: boolean;
  readonly caseSensitive?: boolean;
}

function isNull(value: string, policy: KeyPolicy390, trimEmpty = false): boolean {
  return (policy.emptyAsNull === true && (trimEmpty ? value.trim() === "" : value === ""))
    || (policy.nullTokens ?? ["NULL"]).includes(value);
}

function decimalKey(value: string, policy: KeyPolicy390): string {
  if (policy.keyPrecision === undefined || policy.keyPrecision === "text") return value;
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/u.exec(value);
  if (match === null || value.length > 128) throw new Error(`INVALID_DECIMAL_KEY: ${JSON.stringify(value)} must be a finite base-10 decimal without exponent`);
  const fraction = (match[3] ?? "").replace(/0+$/u, "");
  if (policy.keyPrecision === "decimal-scale") {
    const digits = policy.decimalPlaces;
    if (!Number.isInteger(digits) || digits === undefined || digits < 0 || digits > 12) throw new Error("INVALID_DECIMAL_SCALE: choose 0–12 decimal places");
    if (fraction.length > digits) throw new Error(`KEY_PRECISION_LOSS: ${JSON.stringify(value)} exceeds the selected ${digits} decimal places; no rounding is applied`);
  }
  const integer = (match[2] ?? "0").replace(/^0+(?=\d)/u, "");
  const zero = integer === "0" && fraction.length === 0;
  return `${match[1] === "-" && !zero ? "-" : ""}${integer}${fraction === "" ? "" : `.${fraction}`}`;
}

function validateShape(table: CsvTable, side: string): void {
  assertBoundedTable(table);
  if (table.header.length === 0 || new Set(table.header).size !== table.header.length || table.header.some((value) => value === "")) {
    throw new Error(`INVALID_${side}_HEADERS: headers must be non-empty and unique`);
  }
  if (table.rows.some((row) => row.length !== table.header.length)) throw new Error(`RAGGED_${side}_ROWS: all records must match the header width`);
}

function makeKeyTable(table: CsvTable, columns: readonly number[], policy: KeyPolicy390, side: string, trimEmpty = false): CsvTable {
  validateShape(table, side);
  if (columns.length === 0 || new Set(columns).size !== columns.length || columns.some((column) => !Number.isInteger(column) || column < 0 || column >= table.header.length)) {
    throw new Error(`INVALID_${side}_KEY_COLUMNS`);
  }
  const keys = new Set(columns);
  // A decimal such as "00" may normalize to a configured NULL token ("0").
  // Use a collision-free internal namespace for non-NULL decimal identities;
  // the existing join/compare engines still classify original NULL tokens.
  const nullTokens = policy.nullTokens ?? ["NULL"];
  let suffix = 0;
  while (nullTokens.some((token) => token.startsWith(`\u0000str390:${suffix}:`))) suffix += 1;
  const prefix = `\u0000str390:${suffix}:`;
  return { ...table, rows: table.rows.map((row) => row.map((value, index) =>
    keys.has(index) && !isNull(value, policy, trimEmpty) && (policy.keyPrecision ?? "text") !== "text"
      ? prefix + decimalKey(value, policy) : value)) };
}

function keyedDuplicates(table: CsvTable, columns: readonly number[], policy: KeyPolicy390, nullKeyPolicy: "match" | "never-match", trimEmpty = false) {
  const seen = new Map<string, number[]>();
  table.rows.forEach((row, offset) => {
    const values = columns.map((column) => row[column] ?? "");
    if (nullKeyPolicy === "never-match" && values.some((value) => isNull(value, policy, trimEmpty))) return;
    const key = JSON.stringify(values.map((value) => isNull(value, policy, trimEmpty) ? null : policy.caseSensitive === false ? value.toLowerCase() : value));
    const entries = seen.get(key) ?? [];
    entries.push(offset + 2);
    seen.set(key, entries);
  });
  return [...seen.entries()].filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({ key, rows }));
}

export interface JoinOptions390 extends TableJoinOptions, KeyPolicy390 {
  readonly duplicatePolicy?: "reject" | "expand";
}

export function joinTables390(left: CsvTable, right: CsvTable, options: JoinOptions390) {
  // The native join trims empty keys but defaults nullTokens to []. Apply the
  // adapter's explicit default to both preflight and materialization.
  const policy = { ...options, nullTokens: options.nullTokens ?? ["NULL"] };
  const transformedLeft = makeKeyTable(left, policy.leftKeyColumns, policy, "LEFT", true);
  const transformedRight = makeKeyTable(right, policy.rightKeyColumns, policy, "RIGHT", true);
  const nullKeyPolicy = options.nullKeyPolicy ?? "never-match";
  const duplicateLeft = keyedDuplicates(transformedLeft, policy.leftKeyColumns, policy, nullKeyPolicy, true);
  const duplicateRight = keyedDuplicates(transformedRight, policy.rightKeyColumns, policy, nullKeyPolicy, true);
  if ((options.duplicatePolicy ?? "reject") === "reject" && (duplicateLeft.length > 0 || duplicateRight.length > 0)) {
    throw new Error(`AMBIGUOUS_JOIN_KEYS: ${duplicateLeft.length} duplicate keys on the left and ${duplicateRight.length} on the right. Select Cartesian expansion explicitly or remove duplicates.`);
  }
  if (!(["reject", "expand"] as const).includes(options.duplicatePolicy ?? "reject")) throw new Error("INVALID_DUPLICATE_POLICY");
  if ((options.keyPrecision ?? "text") === "text") {
    return { ...joinCsvTables(left, right, { ...policy, nullKeyPolicy }), duplicateLeft, duplicateRight, duplicatePolicy: options.duplicatePolicy ?? "reject", keyPrecision: "text" as const };
  }

  // Reuse the bounded join engine and restore every original key and cell using source
  // row ordinals; normalized comparison keys never leak into the exported table.
  const leftMarker = `__str390_left_row_${left.header.length}`;
  const rightMarker = `__str390_right_row_${right.header.length}`;
  const mark = (table: CsvTable, name: string): CsvTable => ({
    ...table, header: [...table.header, name], rows: table.rows.map((row, index) => [...row, String(index + 1)]),
  });
  const joined = joinCsvTables(mark(transformedLeft, leftMarker), mark(transformedRight, rightMarker), { ...policy, nullKeyPolicy });
  const leftWidth = left.header.length;
  const rightWidth = right.header.length;
  const header = joined.table.header.filter((_, index) => index !== leftWidth && index !== leftWidth + 1 + rightWidth);
  const rows = joined.table.rows.map((row) => {
    const leftPosition = Number(row[leftWidth] ?? "0");
    const rightPosition = Number(row[leftWidth + 1 + rightWidth] ?? "0");
    return [
      ...(leftPosition > 0 ? left.rows[leftPosition - 1]! : left.header.map(() => "")),
      ...(rightPosition > 0 ? right.rows[rightPosition - 1]! : right.header.map(() => "")),
    ];
  });
  const table = assertBoundedTable({ ...joined.table, header, rows });
  return { ...joined, table, output: serializeCsvTable(table), duplicateLeft, duplicateRight,
    duplicatePolicy: options.duplicatePolicy ?? "reject", keyPrecision: options.keyPrecision };
}

export interface CompareOptions390 extends TableCompareOptions, KeyPolicy390 {
  readonly nullKeyPolicy?: "reject" | "match";
}

export function compareTables390(left: CsvTable, right: CsvTable, options: CompareOptions390) {
  const policy = { ...options, emptyAsNull: options.emptyAsNull ?? true };
  const leftPrepared = makeKeyTable(left, policy.leftKeyColumns, policy, "LEFT");
  const rightPrepared = makeKeyTable(right, policy.rightKeyColumns, policy, "RIGHT");
  if ((options.nullKeyPolicy ?? "reject") === "reject" && [
    ...left.rows.map((row) => options.leftKeyColumns.map((column) => row[column] ?? "")),
    ...right.rows.map((row) => options.rightKeyColumns.map((column) => row[column] ?? "")),
  ].some((key) => key.some((value) => isNull(value, policy)))) {
    throw new Error("NULL_COMPARE_KEY: row identity is unknown for NULL keys; choose NULL matching explicitly or provide non-NULL identifiers");
  }
  const result = compareCsvTables(leftPrepared, rightPrepared, policy);
  if ((options.keyPrecision ?? "text") === "text") return { ...result, keyPrecision: "text" as const };
  const originalKey = (leftRow: number, rightRow: number) => {
    const row = leftRow > 0 ? left.rows[leftRow - 2] : right.rows[rightRow - 2];
    const columns = leftRow > 0 ? options.leftKeyColumns : options.rightKeyColumns;
    return columns.map((column) => row?.[column] ?? "");
  };
  const changedCells = result.changedCells.map((cell) => ({ ...cell, key: originalKey(cell.leftRow, cell.rightRow) }));
  const ambiguousKeys = result.ambiguousKeys.map((entry) => ({ ...entry,
    key: originalKey(entry.leftRows[0] ?? 0, entry.rightRows[0] ?? 0),
  }));
  const rows = result.table.rows.map((row) => {
    const leftRow = Number((row[3] ?? "").split("|")[0] ?? 0);
    const rightRow = Number((row[4] ?? "").split("|")[0] ?? 0);
    const leftValue = row[0] === "removed" ? JSON.stringify(left.rows[leftRow - 2] ?? []) : row[5] ?? "";
    const rightValue = row[0] === "added" ? JSON.stringify(right.rows[rightRow - 2] ?? []) : row[6] ?? "";
    return [row[0] ?? "", JSON.stringify(originalKey(leftRow, rightRow)), ...row.slice(2, 5), leftValue, rightValue];
  });
  const warnings = result.warnings.map((warning, index) => {
    const before = result.ambiguousKeys[index];
    const after = ambiguousKeys[index];
    return before === undefined || after === undefined ? warning : {
      ...warning, message: warning.message.replace(JSON.stringify(before.key), JSON.stringify(after.key)),
    };
  });
  const table = { ...result.table, rows, warnings };
  return { ...result, changedCells, ambiguousKeys, warnings, table, output: serializeCsvTable(table), keyPrecision: options.keyPrecision };
}

export function mergeCsvParts390(parts: readonly CsvTable[]) {
  if (parts.length < 2 || parts.length > 500) throw new Error("INVALID_MERGE_PARTS: choose 2–500 tables");
  parts.forEach((part, index) => validateShape(part, `PART_${index + 1}`));
  const header = parts[0]!.header;
  if (parts.some((part) => part.header.length !== header.length || part.header.some((name, index) => name !== header[index]))) {
    throw new Error("MERGE_SCHEMA_MISMATCH: every part must have identical ordered headers; no column mapping is assumed");
  }
  let totalRows = 0;
  for (const part of parts) {
    totalRows += part.rows.length;
    if (totalRows > TABLE_MAX_ROWS) throw new Error("TABLE_TOO_MANY_ROWS: sum of all parts exceeds the supported output");
    if (header.length * (totalRows + 1) > TABLE_MAX_CELLS) throw new Error("TABLE_TOO_MANY_CELLS: sum of all parts exceeds the supported output");
  }
  const table = assertBoundedTable({ header: [...header], delimiter: parts[0]!.delimiter,
    rows: parts.flatMap((part) => part.rows), warnings: parts.flatMap((part) => part.warnings) });
  return { table, output: serializeCsvTable(table), rowCount: table.rows.length,
    partCounts: parts.map((part) => part.rows.length), preservedDuplicates: true, engineVersion: "table-relations-390-v1" };
}

export function joinCsvTexts390(left: string, right: string, options: JoinOptions390) {
  return joinTables390(parseCsvTable(left), parseCsvTable(right), options);
}
