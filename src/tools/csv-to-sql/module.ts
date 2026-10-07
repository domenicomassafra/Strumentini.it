import { csvTextToSql, type SqlColumnType, type SqlDialect } from "../../engines/table/advanced";
import { optionalBoolean, requiredEnum, requiredText, tableModule, inputObject } from "../table/helpers";
import type { CsvToSqlOutput } from "./types";

const DIALECTS: readonly SqlDialect[] = ["postgresql", "mysql", "sqlite"];
const TYPES = new Set<SqlColumnType>(["text", "integer", "real", "boolean", "date"]);

function typeOverrides(value: unknown): Readonly<Record<number, SqlColumnType>> | undefined {
  const candidate = inputObject(value).typeOverrides;
  if (candidate === undefined) return undefined;
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) throw new Error("INVALID_SQL_TYPE_OVERRIDE");
  const output: Record<number, SqlColumnType> = {};
  for (const [key, type] of Object.entries(candidate)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || typeof type !== "string" || !TYPES.has(type as SqlColumnType)) throw new Error("INVALID_SQL_TYPE_OVERRIDE");
    output[index] = type as SqlColumnType;
  }
  return output;
}

function nullTokens(value: unknown): readonly string[] | undefined {
  const candidate = inputObject(value).nullTokens;
  if (candidate === undefined) return undefined;
  if (!Array.isArray(candidate) || candidate.some((entry) => typeof entry !== "string")) throw new Error("INVALID_NULL_POLICY");
  return candidate as string[];
}

export default tableModule((value): CsvToSqlOutput => csvTextToSql(requiredText(value), {
  dialect: requiredEnum(value, "dialect", DIALECTS),
  tableName: requiredText(value, "tableName"),
  ...(typeOverrides(value) === undefined ? {} : { typeOverrides: typeOverrides(value)! }),
  ...(nullTokens(value) === undefined ? {} : { nullTokens: nullTokens(value)! }),
  emptyAsNull: optionalBoolean(value, "emptyAsNull", false),
  includeCreateTable: optionalBoolean(value, "includeCreateTable", true),
}));
