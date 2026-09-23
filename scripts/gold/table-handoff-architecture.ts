import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { proposeHandoff, type TableHandoffEnvelope } from "../../src/runtime/handoff";
import { csvColumnMapManifest } from "../../src/tools/csv-column-map/manifest";
import { csvDedupeManifest } from "../../src/tools/csv-dedupe/manifest";

const root = resolve(import.meta.dirname, "../..");
const receiptRoot = resolve(root, "quality/receipts/table-ops");
const owners = [
  { id:"csv-cleaner", paths:["src/tools/csv-cleaner", "src/components/tools/csv-cleaner"] },
  { id:"csv-dedupe", paths:["src/tools/csv-dedupe", "src/components/tools/csv-dedupe"] },
  { id:"csv-column-map", paths:["src/tools/csv-column-map", "src/components/tools/csv-column-map"] },
] as const;
const crossImports:string[]=[];

async function walk(path:string):Promise<string[]> {
  const entries=await readdir(resolve(root,path),{withFileTypes:true});
  const files:string[]=[];
  for(const entry of entries){const child=`${path}/${entry.name}`;if(entry.isDirectory())files.push(...await walk(child));else if(/\.(?:ts|tsx)$/u.test(entry.name))files.push(child);}
  return files;
}

for(const owner of owners){
  for(const base of owner.paths){
    for(const file of await walk(base)){
      const text=await readFile(resolve(root,file),"utf8");
      for(const target of owners.map((entry)=>entry.id).filter((id)=>id!==owner.id)){
        if(text.includes(`/tools/${target}/`))crossImports.push(`${file} -> ${target}`);
      }
    }
  }
}
if(crossImports.length)throw new Error(`direct cross-tool imports found:\n${crossImports.join("\n")}`);

const sample="id,name\n1,Ada\n2,Grace";
const envelope:TableHandoffEnvelope={descriptor:{type:"table",format:"csv",version:1,encoding:"utf-8",bytes:new TextEncoder().encode(sample).byteLength,rowCount:2,columnCount:2,columns:["id","name"],duplicateHeaders:false,raggedRows:false},payload:sample};
for(const target of [csvDedupeManifest,csvColumnMapManifest]){const proposal=proposeHandoff(envelope,target);if(!proposal.compatible||proposal.lossy)throw new Error(`${target.id}: descriptor compatibility failed`);}

const assets=resolve(root,"dist/_astro");
const files=await readdir(assets);
let sharedEngine:string|undefined;
for(const file of files.filter((entry)=>entry.endsWith(".js"))){const text=await readFile(resolve(assets,file),"utf8");if(text.includes("INVALID_KEY_COLUMNS")&&text.includes("INVALID_COLUMN_MAP")&&text.includes("FILE_TOO_LARGE")){sharedEngine=file;break;}}
if(sharedEngine===undefined)throw new Error("shared CSV/table engine chunk not found");
const moduleChunks:Record<string,string>={};
for(const mapFile of files.filter((entry)=>entry.endsWith(".js.map"))){const map=JSON.parse(await readFile(resolve(assets,mapFile),"utf8")) as {sources?:string[]};for(const id of owners.map((entry)=>entry.id)){if(map.sources?.some((source)=>source.includes(`/src/tools/${id}/module.ts`)))moduleChunks[id]=mapFile.replace(/\.map$/u,"");}}
for(const id of owners.map((entry)=>entry.id)){const chunk=moduleChunks[id];if(chunk===undefined)throw new Error(`${id}: dynamic module chunk not found`);const text=await readFile(resolve(assets,chunk),"utf8");if(!text.includes(sharedEngine))throw new Error(`${id}: module does not reuse ${sharedEngine}`);const html=await readFile(resolve(root,`dist/tools/${id}/index.html`),"utf8");if(html.includes(sharedEngine))throw new Error(`${id}: table engine eagerly referenced in route HTML`);}

await mkdir(receiptRoot,{recursive:true});
await writeFile(resolve(receiptRoot,"architecture.json"),`${JSON.stringify({schemaVersion:1,status:"PASS",directCrossToolImports:crossImports,descriptorCompatibility:["csv-cleaner table/csv -> csv-dedupe","csv-cleaner table/csv -> csv-column-map"],sharedEngineChunk:sharedEngine,moduleChunks,eagerRouteReferences:0},null,2)}\n`);
console.log(`table handoff architecture PASS: no cross-tool imports; shared ${sharedEngine}`);
