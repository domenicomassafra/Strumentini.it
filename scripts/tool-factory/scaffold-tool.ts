import { parseArgs } from "node:util";
import { createToolScaffold, writeToolScaffold, type ToolScaffoldSpec } from "../../src/tool-factory/scaffold";

const values = parseArgs({
  options: {
    id: { type: "string" },
    name: { type: "string" },
    summary: { type: "string" },
    category: { type: "string" },
    engine: { type: "string" },
    job: { type: "string", multiple: true },
    alias: { type: "string", multiple: true },
    oracle: { type: "string" },
    fixture: { type: "string", multiple: true },
    force: { type: "boolean" },
  },
  strict: true,
  allowPositionals: false,
});

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") throw new Error(`--${name} is required`);
  return value;
}

const spec: ToolScaffoldSpec = {
  id: required(values.values.id, "id"),
  name: required(values.values.name, "name"),
  summary: required(values.values.summary, "summary"),
  category: required(values.values.category, "category"),
  engine: required(values.values.engine, "engine"),
  jobs: values.values.job ?? [],
  aliases: values.values.alias ?? [],
  gold: {
    maintenanceClass: "E",
    oracleEntryId: required(values.values.oracle, "oracle"),
    fixtureFamilies: values.values.fixture ?? [],
  },
};
const result = createToolScaffold(spec);
await writeToolScaffold(result, values.values.force === true ? { force: true } : {});
console.log(`scaffolded ${result.manifest.id} (${result.files.length} files)`);
