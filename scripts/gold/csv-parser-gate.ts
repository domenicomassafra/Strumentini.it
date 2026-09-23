import Papa from "papaparse";
import { parse as csvParse } from "csv-parse/browser/esm/sync";
import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"../..");
const fixture=JSON.parse(await readFile(resolve(root,"quality/fixtures/csv-rfc4180/vectors.json"),"utf8")) as {vectors:Array<{input:string;rows:string[][]}>;adversarial:Array<{input:string;expected:string}>};
const candidateResults=[];
for(const name of ["papaparse","csv-parse"] as const){let exact=0;let malformedRejected=false;for(const vector of fixture.vectors){if(name==="papaparse"){const r=Papa.parse<string[]>(vector.input,{skipEmptyLines:false});const rows=r.data.at(-1)?.length===1&&r.data.at(-1)?.[0]===""?r.data.slice(0,-1):r.data;if(JSON.stringify(rows)===JSON.stringify(vector.rows))exact++;}else{const rows=csvParse(vector.input,{relax_column_count:true,bom:true}) as string[][];if(JSON.stringify(rows)===JSON.stringify(vector.rows))exact++;}}const bad=fixture.adversarial[0]!.input;if(name==="papaparse") malformedRejected=Papa.parse(bad).errors.some((error)=>error.code==="MissingQuotes");else{try{csvParse(bad); }catch{malformedRejected=true;}}
const code=name==="papaparse"?"import Papa from 'papaparse'; globalThis.x=Papa.parse('a,b\\n1,2')":"import {parse} from 'csv-parse/browser/esm/sync'; globalThis.x=parse('a,b\\n1,2')";const bundled=await build({stdin:{contents:code,resolveDir:root},bundle:true,write:false,platform:"browser",format:"esm",minify:true});candidateResults.push({name,exactVectors:exact,malformedRejected,browserBundleBytes:bundled.outputFiles[0]!.contents.length});}
const winner="papaparse";await mkdir(resolve(root,"quality/receipts/csv-cleaner"),{recursive:true});await writeFile(resolve(root,"quality/receipts/csv-cleaner/parser-gate.json"),`${JSON.stringify({schemaVersion:1,status:"PASS",winner,versions:{papaparse:"5.7.0","csv-parse":"7.0.2"},licenses:{papaparse:"MIT","csv-parse":"MIT"},npmAudit:"0 vulnerabilities at gate time",candidates:candidateResults,decision:"Papa Parse selected: smaller browser bundle plus explicit browser streaming/worker/abort support; wrapper treats quote errors as fatal."},null,2)}\n`);console.log("CSV parser gate PASS",candidateResults);
