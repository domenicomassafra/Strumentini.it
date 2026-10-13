/**
 * #415 offline, read-only per-tool claim/proof inventory.
 * Never interprets the historical expanded index's GOLD/PASS as current proof.
 * A positive current status requires a separately source-bound receipt whose
 * bytes, receipt hash, revision and source-wide fingerprint all still agree.
 * This is an audit of traceability, not certification or a release receipt.
 */
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolSummary } from "../src/catalog/manifest";
import { catalog } from "../src/generated/catalog";
import { qualityIndex } from "../src/generated/quality";
import { isEligibleGoldFlag, validateGoldReceipts } from "../src/release/validation";
import { currentEvidenceSourceFingerprint, currentRevision } from "./lib/current-revision";

const HEX256=/^[a-f0-9]{64}$/u;
const HEX160=/^[a-f0-9]{40}$/u;
const RECEIPT_PATH=/^quality\/receipts\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.json$/u;
const TOOL_ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const sha256=(data:Uint8Array | string) => createHash("sha256").update(data).digest("hex");

export interface ProofReceiptProbe415 {
  toolId:string; path:string; content:string; expectedSha256:string;
  fingerprint:string; revision:string;
  /** Independently SHA-256-hashed bytes of src/tools/<toolId>/manifest.ts. */
  // Explicit undefined is a valid negative-test input, but never a valid receipt.
  currentManifestSha256?:string|undefined;
  /** When auditing current Gold, bind every claimed family to its actual fixture-file bytes. */
  currentFixtureSha256ByFamily?:ReadonlyMap<string,string>|undefined;
  /** Independently hash the exact live oracle registry used to resolve the claimed oracle. */
  currentOracleRegistrySha256?:string|undefined;
}

/** Rejects tamper, alien path/identity, stale revision and source scope. */
export function probeReceipt415(p:ProofReceiptProbe415):boolean {
  // A correctly hashed receipt cannot be borrowed through another tool's
  // filename. The canonical Gold receipt leaf is always <toolId>.gold.json,
  // including when a family directory groups those files.
  if (!TOOL_ID.test(p.toolId) || !RECEIPT_PATH.test(p.path) ||
      p.path.split("/").at(-1)!==`${p.toolId}.gold.json` ||
      !HEX256.test(p.expectedSha256) ||
      !HEX256.test(p.fingerprint) || !HEX160.test(p.revision) ||
      !HEX256.test(p.currentManifestSha256??"") ||
      sha256(p.content)!==p.expectedSha256) return false;
  try {
    const raw=JSON.parse(p.content) as Record<string,unknown>;
    if (raw.toolId!==p.toolId || raw.schemaVersion!==1 || raw.status!=="GOLD" ||
        !isEligibleGoldFlag(raw) || raw.revision!==p.revision || raw.sourceFingerprint!==p.fingerprint ||
        !Array.isArray(raw.fixtureFamilies) || raw.fixtureFamilies.length===0 ||
        typeof raw.identities!=="object" || raw.identities===null || Object.keys(raw.identities).length===0 ||
        !raw.runtime) return false;
    // Receipt integrity/revision/global fingerprint alone cannot prove that
    // this route's job/runtime manifest is the source the receipt tested.
    if ((raw.identities as Record<string,unknown>).manifestSha256!==p.currentManifestSha256) return false;
    // A source-wide fingerprint does not independently authenticate the oracle
    // identity declared inside a receipt. Require current registry bytes for
    // the full on-disk audit; standalone manifest-only probes stay compatible.
    if(p.currentOracleRegistrySha256!==undefined &&
       (!HEX256.test(p.currentOracleRegistrySha256) ||
        (raw.identities as Record<string,unknown>).oracleRegistrySha256!==p.currentOracleRegistrySha256)) return false;
    // The manifest alone cannot bind the vectors that supplied expected
    // outputs. A receipt may be internally SHA-valid while naming withdrawn
    // fixture bytes under an otherwise current revision/source fingerprint.
    // The on-disk audit always supplies this map; omission is supported only
    // for existing callers probing manifest provenance in isolation.
    if (p.currentFixtureSha256ByFamily!==undefined) {
      const seen=new Set<string>();
      for (const family of raw.fixtureFamilies) {
        if(typeof family!=="string" || !TOOL_ID.test(family) || seen.has(family)) return false;
        seen.add(family);
        const sourceHash=p.currentFixtureSha256ByFamily.get(family);
        if(!sourceHash || !HEX256.test(sourceHash) ||
           (raw.identities as Record<string,unknown>)[`fixture:${family}:sha256`]!==sourceHash) return false;
      }
      if(p.currentFixtureSha256ByFamily.size!==seen.size) return false;
    }
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
    const registryBinding=registeredOracleIds.has(tool.gold.oracleEntryId) &&
      tool.gold.fixtureFamilies.every(f=>registeredFixtureIds.has(f))?"REGISTERED":"PENDING_REGISTRY_OR_FIXTURE";
    // Even a byte-valid receipt cannot be current proof for a withdrawn
    // oracle/fixture or a route whose current manifest/page is missing.
    // Source errors must never coexist with a VERIFIED route claim.
    const verified=current && source.manifestPresent && source.pagePresent &&
      registryBinding==="REGISTERED"?current:undefined;
    entries.push({
      toolId:tool.id,route:tool.route,jobs:[...tool.jobs],inputs:[...tool.inputTypes],
      resultClass:tool.result?.class ?? null,limits,
      limitsStatus:limits.length?"DECLARED_HANDOFF_LIMITS_ONLY":"PENDING_RUNTIME_LIMIT_ATTESTATION",
      oracleEntryId:tool.gold.oracleEntryId,fixtureFamilies:[...tool.gold.fixtureFamilies],
      registryBinding,
      source,historicalIndexReceipt: legacy?.certificationReceipt ?? null,
      historicalTestFiles:legacy?.implementation?.testFiles ?? [],
      currentProof:verified?"VERIFIED":"PENDING",currentReceipt:verified?.path ?? null,
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
interface Fixtures415 {families:{id:string;path:string}[]}
const safeRead=async (root:string,path:string):Promise<Uint8Array|null> => {
  if(!/^(?:src|tests|quality)\/[a-zA-Z0-9_.\/-]+$/u.test(path) || path.includes("..")) return null;
  try {
    // A lexical root-relative path may still be a symlink outside the tree.
    const [canonicalRoot,canonicalFile]=await Promise.all([realpath(root),realpath(resolve(root,path))]);
    const inside=relative(canonicalRoot,canonicalFile);
    if(!inside || inside===".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) return null;
    return await readFile(canonicalFile);
  }
  catch{return null;}
};

/** Resolve fixture-family claims to the independently read bytes of their
 * current indexed files, refusing withdrawn, missing and aliased-outside-root
 * fixtures. `null` means there is no current source proof for the whole set. */
export async function readCurrentFixtureHashes415(
  root:string,
  families:readonly string[],
  index:readonly {id:string;path:string}[],
):Promise<ReadonlyMap<string,string>|null> {
  const fileById=new Map<string,string>();
  const duplicated=new Set<string>();
  for(const entry of index) {
    if(fileById.has(entry.id)) duplicated.add(entry.id);
    fileById.set(entry.id,entry.path);
  }
  const hashes=new Map<string,string>();
  const byPath=new Map<string,string>();
  for(const family of families) {
    const file=fileById.get(family);
    if(!TOOL_ID.test(family) || hashes.has(family) || duplicated.has(family) ||
       !file || !/^quality\/fixtures\/[a-z0-9_-]+\/[a-z0-9_.-]+\.json$/u.test(file)) return null;
    let digest=byPath.get(file);
    if(digest===undefined) {
      const bytes=await safeRead(root,file);
      if(bytes===null) return null;
      digest=sha256(bytes);
      byPath.set(file,digest);
    }
    hashes.set(family,digest);
  }
  return hashes.size===families.length?hashes:null;
}

export async function auditCurrentProofMap415(root:string):Promise<ProofMap415> {
  const [legacy,registrySource,fixtures,fingerprint,revision]=await Promise.all([
    readFile(resolve(root,"quality/receipts/expanded-catalog-certification.json"),"utf8").then(t=>JSON.parse(t) as LegacyIndex415),
    readFile(resolve(root,"quality/oracles/registry.json")).then(bytes=>({
      value:JSON.parse(bytes.toString("utf8")) as Registry415,
      sha256:sha256(bytes),
    })),
    readFile(resolve(root,"quality/fixtures/index.json"),"utf8").then(t=>JSON.parse(t) as Fixtures415),
    currentEvidenceSourceFingerprint(root), currentRevision(root),
  ]);
  const registry=registrySource.value;
  const registeredOracleIds=new Set(registry.entries.map(entry=>entry.id));
  if(!Array.isArray(legacy.tools) || legacy.tools.length!==catalog.length) throw new Error("LEGACY_COVERAGE_MISMATCH_415");
  const legacyById=new Map(legacy.tools.map(row=>[row.id,row] as const));
  if(legacyById.size!==legacy.tools.length) throw new Error("DUPLICATE_HISTORICAL_415");
  const sources=new Map<string,SourceProbe415>();
  const manifestHashes=new Map<string,string>();
  const current=new Map<string,{path:string}>();
  for(const tool of catalog) {
    const old=legacyById.get(tool.id);
    const expectedManifest=`src/tools/${tool.id}/manifest.ts`;
    const expectedPage=`src/pages/tools/${tool.id}.astro`;
    const manifest=await safeRead(root,expectedManifest);
    const page=await safeRead(root,expectedPage);
    const identity=old?.implementation;
    if(manifest!==null) manifestHashes.set(tool.id,sha256(manifest));
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
    // A current oracle-registry digest authenticates the registry bytes, not
    // the existence of this particular oracle ID within those bytes.
    if(!registeredOracleIds.has(target.gold.oracleEntryId)) continue;
    let parsed:Record<string,unknown>;
    try {parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as Record<string,unknown>;}
    catch {continue;}
    if(parsed.oracleEntryId!==target.gold.oracleEntryId ||
       JSON.stringify(parsed.fixtureFamilies)!==JSON.stringify(target.gold.fixtureFamilies) ||
       JSON.stringify(parsed.runtime)!==JSON.stringify(target.runtime)) continue;
    const fixtureHashes=await readCurrentFixtureHashes415(root,target.gold.fixtureFamilies,fixtures.families);
    if(fixtureHashes===null) continue;
    const currentManifestSha256=manifestHashes.get(item.toolId);
    if(currentManifestSha256===undefined) continue; // Missing source identity can never certify a GOLD candidate.
    const probe={toolId:item.toolId,path:item.receiptPath,content:new TextDecoder("utf-8",{fatal:true}).decode(bytes),
      expectedSha256:item.receiptSha256!,fingerprint,revision,
      currentManifestSha256,currentFixtureSha256ByFamily:fixtureHashes,
      currentOracleRegistrySha256:registrySource.sha256};
    if(item.sourceFingerprint!==fingerprint || !probeReceipt415(probe)) continue;
    current.set(item.toolId,{path:item.receiptPath});
  }
  return createProofMap415(catalog,legacyById,current,sources,
    registeredOracleIds,new Set(fixtures.families.map(x=>x.id)));
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  auditCurrentProofMap415(resolve(import.meta.dirname,".."))
    .then(result=>console.log(JSON.stringify(process.argv.includes("--json")?result:result.summary,null,2)))
    .catch(error=>{console.error("PROOF_MAP_415_ERROR:",error instanceof Error?error.message:"unknown");process.exitCode=1;});
}
