import type { CsvToSqlResult, SqlColumnType, SqlDialect } from "../../engines/table/advanced";

export interface CsvToSqlInput {
  readonly text: string;
  readonly dialect: SqlDialect;
  readonly tableName: string;
  readonly typeOverrides?: Readonly<Record<number, SqlColumnType>>;
  readonly nullTokens?: readonly string[];
  readonly emptyAsNull?: boolean;
  readonly includeCreateTable?: boolean;
}

export type CsvToSqlOutput = CsvToSqlResult;
