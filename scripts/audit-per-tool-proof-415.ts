/**
 * #415 offline, read-only per-tool claim/proof inventory.
 * Never interprets the historical expanded index's GOLD/PASS as current proof.
 * A positive current status requires a separately source-bound receipt whose
 * bytes, receipt hash, revision and source-wide fingerprint all still agree.
 * This is an audit of traceability, not certification or a release receipt.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolSummary } from "../src/catalog/manifest";
import { catalog } from "../src/generated/catalog";
import { qualityIndex } from "../src/generated/quality";
import { validateGoldReceipts } from "../src/release/validation";
import { currentEvidenceSourceFingerprint, currentRevision } from "./lib/current-revision";

const HEX256=/^[a-f0-9]{64}$/u;
const HEX160=/^[a-f0-9]{40}$/u;
const RECEIPT_PATH=/^quality\/receipts\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.json$/u;
const sha256=(data:Uint8Array | string) => createHash("sha256").update(data).digest("hex");

export interface ProofReceiptProbe415 {
  toolId:string; path:string; content:string; expectedSha256:string;
  fingerprint:string; revision:string;
}

/** Rejects tamper, alien path/identity, stale revision and source scope. */
export function probeReceipt415(p:ProofReceiptProbe415):boolean {
  if (!RECEIPT_PATH.test(p.path) || !HEX256.test(p.expectedSha256) ||
      !HEX256.test(p.fingerprint) || !HEX160.test(p.revision) ||
      sha256(p.content)!==p.expectedSha256) return false;
  try {
    const raw=JSON.parse(p.content) as Record<string,unknown>;
    if (raw.toolId!==p.toolId || raw.schemaVersion!==1 || raw.status!=="GOLD" ||
        raw.goldEligible===false || raw.revision!==p.revision || raw.sourceFingerprint!==p.fingerprint ||
        !Array.isArray(raw.fixtureFamilies) || raw.fixtureFamilies.length===0 ||
        typeof raw.identities!=="object" || raw.identities===null || Object.keys(raw.identities).length===0 ||
        !raw.runtime) return false;
    const entry={id:p.toolId,route:`/tools/${p.toolId}`};
    return validateGoldReceipts([entry],[raw as unknown as Parameters<typeof validateGoldReceipts>[1][number]],p.revision,p.fingerprint).length===0;
  } catch { return false; }
}

interface SourceProbe415 {
  readonly manifestPresent:boolean;
  readonly pagePresent:boolean;
  readonly historicalHashMatches:boolean;
}
interface LegacyTool415 {
  readonly id:string;
  readonly route:string;
  readonly certificationReceipt?:string;
  readonly implementation?: {
    readonly manifest?:{readonly path:string;readonly sha256:string};
    readonly module?:{readonly path:string;readonly sha256:string};
    readonly page?:{readonly path:string;readonly sha256:string};
    readonly testFiles?:readonly string[];
  };
}

export interface ToolProof415 {
  readonly toolId:string;
  readonly route:string;
  readonly jobs:readonly string[];
  readonly inputs:readonly string[];
  readonly resultClass:string | null;
  readonly limits:readonly {kind:"handoff-accepts"|"handoff-emits";format:string|null;maxBytes:number}[];
  readonly limitsStatus:"DECLARED_HANDOFF_LIMITS_ONLY"|"PENDING_RUNTIME_LIMIT_ATTESTATION";
  readonly oracleEntryId:string;
  readonly fixtureFamilies:readonly string[];
  readonly registryBinding:"REGISTERED"|"PENDING_REGISTRY_OR_FIXTURE";
  readonly source:SourceProbe415;
  readonly historicalIndexReceipt:string|null;
  readonly historicalTestFiles:readonly string[];
  readonly currentProof:"VERIFIED"|"PENDING";
  readonly currentReceipt:string|null;
}

export interface ProofMap415 {
  readonly schemaVersion:1;
  readonly scope:"source-local-readonly-no-release";
  readonly summary:{tools:number;verified:number;pending:number;sourceErrors:number;runtimeLimitsPending:number;registryBindingsPending:number};
  readonly entries:readonly ToolProof415[];
}

/** The map is strict about identity and source existence, permissive about
 * gaps: gaps become PENDING fields rather than fabricated proof. */
export function createProofMap415(
  tools:readonly ToolSummary[],
  legacyById:ReadonlyMap<string,LegacyTool415>,
  currentReceiptById:ReadonlyMap<string,{path:string}>,
  sources:ReadonlyMap<string,SourceProbe415>=new Map(),
  registeredOracleIds:ReadonlySet<string>=new Set(),
  registeredFixtureIds:ReadonlySet<string>=new Set(),
):ProofMap415 {
  const ids=new Set<string>();
  const routes=new Set<string>();
  const entries:ToolProof415[]=[];
  for(const tool of tools) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tool.id) || tool.route!==`/tools/${tool.id}` ||
      ids.has(tool.id) || routes.has(tool.route) || tool.jobs.length===0 ||
      tool.jobs.some(job=>typeof job!=="string" || job.trim()==="") || tool.inputTypes.length===0 ||
      !tool.gold.oracleEntryId || tool.gold.fixtureFamilies.length===0) throw new Error(`INVALID_TOOL_DECLARATION_415:${tool.id}`);
    ids.add(tool.id);
    routes.add(tool.route);
    const legacy=legacyById.get(tool.id);
    if(legacy && (legacy.id!==tool.id || legacy.route!==tool.route)) throw new Error(`ALIEN_HISTORICAL_ROUTE_415:${tool.id}`);
    const accept=tool.handoff?.accepts ?? [];
    const emit=tool.handoff?.emits ?? [];
    const limits=[
      ...accept.filter(x=>Number.isSafeInteger(x.maxBytes) && (x.maxBytes ?? 0)>0).map(x=>({kind:"handoff-accepts" as const,format:x.format ?? null,maxBytes:x.maxBytes!})),
      ...emit.filter(x=>Number.isSafeInteger(x.maxBytes) && (x.maxBytes ?? 0)>0).map(x=>({kind:"handoff-emits" as const,format:x.format ?? null,maxBytes:x.maxBytes!})),
    ];
    const current=currentReceiptById.get(tool.id);
    const source=sources.get(tool.id) ?? {manifestPresent:false,pagePresent:false,historicalHashMatches:false};
    entries.push({
      toolId:tool.id,route:tool.route,jobs:[...tool.jobs],inputs:[...tool.inputTypes],
      resultClass:tool.result?.class ?? null,limits,
      limitsStatus:limits.length?"DECLARED_HANDOFF_LIMITS_ONLY":"PENDING_RUNTIME_LIMIT_ATTESTATION",
      oracleEntryId:tool.gold.oracleEntryId,fixtureFamilies:[...tool.gold.fixtureFamilies],
      registryBinding:registeredOracleIds.has(tool.gold.oracleEntryId) && tool.gold.fixtureFamilies.every(f=>registeredFixtureIds.has(f))?"REGISTERED":"PENDING_REGISTRY_OR_FIXTURE",
      source,historicalIndexReceipt: legacy?.certificationReceipt ?? null,
      historicalTestFiles:legacy?.implementation?.testFiles ?? [],
      currentProof:current?"VERIFIED":"PENDING",currentReceipt:current?.path ?? null,
    });
  }
  entries.sort((a,b)=>a.toolId.localeCompare(b.toolId));
  const verified=entries.filter(x=>x.currentProof==="VERIFIED").length;
  return {schemaVersion:1,scope:"source-local-readonly-no-release",
    summary:{tools:entries.length,verified,pending:entries.length-verified,
      sourceErrors:entries.filter(x=>!x.source.manifestPresent || !x.source.pagePresent).length,
      runtimeLimitsPending:entries.filter(x=>x.limitsStatus==="PENDING_RUNTIME_LIMIT_ATTESTATION").length,
      registryBindingsPending:entries.filter(x=>x.registryBinding!=="REGISTERED").length},entries};
}

interface LegacyIndex415 {tools:LegacyTool415[]}
interface Registry415 {entries:{id:string}[]}
interface Fixtures415 {families:{id:string}[]}
const safeRead=async (root:string,path:string):Promise<Uint8Array|null> => {
  if(!/^(?:src|tests|quality)\/[a-zA-Z0-9_.\/-]+$/u.test(path) || path.includes("..")) return null;
  try {const bytes=await readFile(resolve(root,path));return bytes;}
  catch{return null;}
};

export async function auditCurrentProofMap415(root:string):Promise<ProofMap415> {
  const [legacy,registry,fixtures,fingerprint,revision]=await Promise.all([
    readFile(resolve(root,"quality/receipts/expanded-catalog-certification.json"),"utf8").then(t=>JSON.parse(t) as LegacyIndex415),
    readFile(resolve(root,"quality/oracles/registry.json"),"utf8").then(t=>JSON.parse(t) as Registry415),
    readFile(resolve(root,"quality/fixtures/index.json"),"utf8").then(t=>JSON.parse(t) as Fixtures415),
    currentEvidenceSourceFingerprint(root), currentRevision(root),
  ]);
  if(!Array.isArray(legacy.tools) || legacy.tools.length!==catalog.length) throw new Error("LEGACY_COVERAGE_MISMATCH_415");
  const legacyById=new Map(legacy.tools.map(row=>[row.id,row] as const));
  if(legacyById.size!==legacy.tools.length) throw new Error("DUPLICATE_HISTORICAL_415");
  const sources=new Map<string,SourceProbe415>();
  const current=new Map<string,{path:string}>();
  for(const tool of catalog) {
    const old=legacyById.get(tool.id);
    const expectedManifest=`src/tools/${tool.id}/manifest.ts`;
    const expectedPage=`src/pages/tools/${tool.id}.astro`;
    const manifest=await safeRead(root,expectedManifest);
    const page=await safeRead(root,expectedPage);
    const identity=old?.implementation;
    let historicalHashMatches=!!(manifest && page && identity?.manifest?.sha256 && identity?.page?.sha256 &&
      identity.manifest.path===expectedManifest && identity.page.path===expectedPage &&
      sha256(manifest)===identity.manifest.sha256 && sha256(page)===identity.page.sha256);
    if(identity?.module) {
      const moduleBytes=await safeRead(root,identity.module.path);
      historicalHashMatches=historicalHashMatches && !!moduleBytes && sha256(moduleBytes)===identity.module.sha256;
    }
    sources.set(tool.id,{manifestPresent:manifest!==null,pagePresent:page!==null,historicalHashMatches});
  }
  // A generated positive entry is only a *candidate*; independently re-read
  // and validate its exact receipt bytes. No positive entry is manufactured by
  // the historical 269-tool index's GOLD status.
  // The generated public projection currently has `tools: [] as const`; its
  // literal element type is `never`. Use the stable receipt interface here so
  // future valid entries remain type-checked instead of being unreachable.
  const projectedCandidates:readonly {toolId:string;receiptPath:string;receiptSha256?:string;sourceFingerprint?:string}[]=qualityIndex.tools;
  for(const item of projectedCandidates) {
    const bytes=await safeRead(root,item.receiptPath);
    if(!bytes) continue;
    const target=catalog.find(tool=>tool.id===item.toolId);
    if(!target) continue;
    let parsed:Record<string,unknown>;
    try {parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as Record<string,unknown>;}
    catch {continue;}
    if(parsed.oracleEntryId!==target.gold.oracleEntryId ||
       JSON.stringify(parsed.fixtureFamilies)!==JSON.stringify(target.gold.fixtureFamilies) ||
       JSON.stringify(parsed.runtime)!==JSON.stringify(target.runtime)) continue;
    const probe={toolId:item.toolId,path:item.receiptPath,content:new TextDecoder("utf-8",{fatal:true}).decode(bytes),
      expectedSha256:item.receiptSha256!,fingerprint,revision};
    if(item.sourceFingerprint!==fingerprint || !probeReceipt415(probe)) continue;
    current.set(item.toolId,{path:item.receiptPath});
  }
  return createProofMap415(catalog,legacyById,current,sources,
    new Set(registry.entries.map(x=>x.id)),new Set(fixtures.families.map(x=>x.id)));
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  auditCurrentProofMap415(resolve(import.meta.dirname,".."))
    .then(result=>console.log(JSON.stringify(process.argv.includes("--json")?result:result.summary,null,2)))
    .catch(error=>{console.error("PROOF_MAP_415_ERROR:",error instanceof Error?error.message:"unknown");process.exitCode=1;});
}
