import { resolve } from "node:path";
import { materializeRouteWrappers } from "../../src/tool-factory/route-wrappers";

const root = resolve(import.meta.dirname, "../..");
const check = process.argv.includes("--check");
const count = await materializeRouteWrappers(root, check);
console.log(`tool routes: ${count} generated wrappers ${check ? "current" : "materialized"}`);
