/** Explicit, deliberately small Excel formula subset. No evaluation or network APIs. */
export type WorkbookCellKind389 = "blank" | "text" | "number" | "formula";
export interface WorkbookCell389 {
  readonly kind: WorkbookCellKind389;
  readonly input: string;
  readonly value: string;
}
export interface Workbook389 {
  readonly sheetName: string;
  readonly cells: readonly (readonly WorkbookCell389[])[];
}

export const WORKBOOK_389_LIMITS = { rows: 200, columns: 32, bytes: 10 * 1024 * 1024 } as const;

export class WorkbookError389 extends Error {
  constructor(readonly code: "UNSUPPORTED_WORKBOOK" | "INVALID_CELL" | "INVALID_FORMULA" | "FORMULA_CYCLE" | "FILE_TOO_LARGE", message: string) {
    super(`${code}: ${message}`);
    this.name = "WorkbookError389";
  }
}

export function cellAddress389(row: number, column: number): string {
  let n = column + 1;
  let letters = "";
  while (n > 0) { n -= 1; letters = String.fromCharCode(65 + n % 26) + letters; n = Math.floor(n / 26); }
  return letters + String(row + 1);
}

export function cellIndex389(address: string): readonly [number, number] {
  const match = /^\$?([A-Z]{1,3})\$?([1-9]\d{0,6})$/u.exec(address.toUpperCase());
  if (!match) throw new WorkbookError389("INVALID_FORMULA", `Riferimento di cella non valido: ${address}`);
  let column = 0;
  for (const letter of match[1]!) column = column * 26 + letter.charCodeAt(0) - 64;
  const row = Number(match[2]) - 1;
  if (row >= WORKBOOK_389_LIMITS.rows || column > WORKBOOK_389_LIMITS.columns) {
    throw new WorkbookError389("INVALID_FORMULA", `Riferimento fuori dal foglio supportato: ${address}`);
  }
  return [row, column - 1];
}

export function strictWorkbookNumber389(raw: string): number {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(raw)) {
    throw new WorkbookError389("INVALID_CELL", `Numero non rappresentabile esattamente nel formato consentito: ${raw}`);
  }
  const value = Number(raw);
  const significant = raw.replace(/^-|\./gu, "").replace(/^0+|0+$/gu, "").length;
  if (!Number.isFinite(value) || significant > 15 || (Number.isInteger(value) && !Number.isSafeInteger(value)) ||
      (/[1-9]/u.test(raw) && (value === 0 || Math.abs(value) < 2.2251e-308))) {
    throw new WorkbookError389("INVALID_CELL", `Numero oltre la precisione Excel: ${raw}`);
  }
  return value;
}

type NumericReader = (address: string) => number;

/** Recursive descent grammar: arithmetic, parentheses, local cell references and SUM ranges. */
export function computeFormula389(formula: string, read: NumericReader): number {
  if (!formula.startsWith("=")) throw new WorkbookError389("INVALID_FORMULA", "Una formula deve iniziare con =.");
  const source = formula.slice(1).replace(/\s+/gu, "").toUpperCase();
  if (source.length === 0 || source.length > 512) throw new WorkbookError389("INVALID_FORMULA", "Formula vuota o troppo lunga.");
  const tokens = source.match(/SUM|\$?[A-Z]{1,3}\$?[1-9]\d{0,6}|(?:\d+(?:\.\d+)?|\.\d+)|[()+*/:\-]/gu) ?? [];
  if (tokens.join("") !== source || tokens.length > 200) {
    throw new WorkbookError389("INVALID_FORMULA", "Sono supportati soltanto numeri, riferimenti locali, + - * /, parentesi e SUM(intervallo).");
  }
  let cursor = 0;
  function consume(token: string) {
    if (tokens[cursor] !== token) throw new WorkbookError389("INVALID_FORMULA", `Atteso ${token} nella formula.`);
    cursor++;
  }
  function primary(): number {
    const token = tokens[cursor++];
    if (token === "-") return -primary();
    if (token === "+") return primary();
    if (token === "(") { const result = addition(); consume(")"); return result; }
    if (token === "SUM") {
      consume("(");
      const first = tokens[cursor++]; consume(":"); const last = tokens[cursor++]; consume(")");
      if (!first || !last) throw new WorkbookError389("INVALID_FORMULA", "SUM richiede un intervallo di celle.");
      const [rowA, colA] = cellIndex389(first), [rowB, colB] = cellIndex389(last);
      if (rowB < rowA || colB < colA) throw new WorkbookError389("INVALID_FORMULA", "Intervallo SUM invertito.");
      let result = 0;
      for (let r = rowA; r <= rowB; r++) for (let c = colA; c <= colB; c++) result += read(cellAddress389(r, c));
      return result;
    }
    if (token && /^\$?[A-Z]/u.test(token)) { cellIndex389(token); return read(token.replaceAll("$", "")); }
    if (token && /^(?:\d|\.)/u.test(token)) {
      const value = Number(token);
      if (Number.isFinite(value)) return value;
    }
    throw new WorkbookError389("INVALID_FORMULA", "Espressione Excel non supportata.");
  }
  function product(): number {
    let result = primary();
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const op = tokens[cursor++]; const right = primary();
      if (op === "/" && right === 0) throw new WorkbookError389("INVALID_FORMULA", "Divisione per zero.");
      result = op === "*" ? result * right : result / right;
    }
    return result;
  }
  function addition(): number {
    let result = product();
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const op = tokens[cursor++]; const right = product();
      result = op === "+" ? result + right : result - right;
    }
    return result;
  }
  const result = addition();
  if (cursor !== tokens.length || !Number.isFinite(result)) throw new WorkbookError389("INVALID_FORMULA", "Formula incompleta o risultato non finito.");
  return result;
}

export function recalculateWorkbook389(workbook: Workbook389): Workbook389 {
  const rows = workbook.cells.length;
  const cols = workbook.cells[0]?.length ?? 0;
  if (rows === 0 || rows > WORKBOOK_389_LIMITS.rows || cols === 0 || cols > WORKBOOK_389_LIMITS.columns ||
      workbook.cells.some((row) => row.length !== cols)) {
    throw new WorkbookError389("UNSUPPORTED_WORKBOOK", "Dimensioni foglio non supportate (massimo 200 × 32). ");
  }
  const state = new Map<string, "active" | "done">();
  const cached = new Map<string, string>();
  function calculate(address: string): number {
    const [r, c] = cellIndex389(address);
    const cell = workbook.cells[r]?.[c];
    if (!cell || cell.kind === "blank") return 0;
    if (cell.kind === "text") throw new WorkbookError389("INVALID_FORMULA", `La formula usa testo in ${address}.`);
    if (state.get(address) === "active") throw new WorkbookError389("FORMULA_CYCLE", `Riferimento circolare da ${address}.`);
    if (state.get(address) === "done") return Number(cached.get(address));
    state.set(address, "active");
    const value = cell.kind === "number" ? strictWorkbookNumber389(cell.input) : computeFormula389(cell.input, calculate);
    cached.set(address, String(value)); state.set(address, "done");
    return value;
  }
  const cells = workbook.cells.map((row, r) => row.map((cell, c) => {
    if (cell.kind === "blank") return { ...cell, input: "", value: "" };
    if (cell.kind === "text") return { ...cell, value: cell.input };
    return { ...cell, value: String(calculate(cellAddress389(r, c))) };
  }));
  return { sheetName: workbook.sheetName, cells };
}

export function editWorkbookCell389(workbook: Workbook389, row: number, column: number, input: string, kind?: WorkbookCellKind389): Workbook389 {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 ||
      row >= workbook.cells.length || column >= (workbook.cells[0]?.length ?? 0) || input.length > 1024) {
    throw new WorkbookError389("INVALID_CELL", "Cella fuori dal foglio o testo oltre 1024 caratteri.");
  }
  const current = workbook.cells[row]![column]!;
  const nextKind = input === "" ? "blank" : input.startsWith("=") ? "formula" : kind ?? (current.kind === "formula" ? "text" : current.kind === "blank" ? "text" : current.kind);
  const rows = workbook.cells.map((cells) => [...cells]);
  rows[row]![column] = { kind: nextKind, input, value: "" };
  return recalculateWorkbook389({ sheetName: workbook.sheetName, cells: rows });
}

export function expandWorkbook389(workbook: Workbook389, axis: "row" | "column"): Workbook389 {
  const rows = workbook.cells.map((row) => [...row]);
  const cols = rows[0]?.length ?? 0;
  const empty: WorkbookCell389 = { kind: "blank", input: "", value: "" };
  if (axis === "row") {
    if (rows.length >= WORKBOOK_389_LIMITS.rows) throw new WorkbookError389("INVALID_CELL", "Limite righe raggiunto.");
    rows.push(Array.from({ length: cols }, () => ({ ...empty })));
  } else {
    if (cols >= WORKBOOK_389_LIMITS.columns) throw new WorkbookError389("INVALID_CELL", "Limite colonne raggiunto.");
    for (const row of rows) row.push({ ...empty });
  }
  return recalculateWorkbook389({ sheetName: workbook.sheetName, cells: rows });
}
