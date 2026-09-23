import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCampaignName, buildUtmUrl, CAMPAIGN_URL_ENGINE_VERSION, cleanTrackingParameters } from "../../src/engines/campaign-url";
import { utmBuilderManifest } from "../../src/tools/utm-builder/manifest";
import { trackingCleanerManifest } from "../../src/tools/tracking-cleaner/manifest";
import { campaignNameManifest } from "../../src/tools/campaign-name/manifest";

const root = resolve(import.meta.dirname, "../..");
const indexText = await readFile(resolve(root, "quality/fixtures/index.json"), "utf8");
const registryText = await readFile(resolve(root, "quality/oracles/registry.json"), "utf8");
const index = JSON.parse(indexText) as { schema_version:number; families:Array<{id:string;path:string;truth_sources:string[]}> };
const registry = JSON.parse(registryText) as { schema_version:number; entries:Array<{id:string;truth_sources:string[]}> };
const fixtureEntry = index.families.find((entry) => entry.id === "utm-roundtrip");
if (!fixtureEntry) throw new Error("missing utm-roundtrip fixture");
const fixtureText = await readFile(resolve(root, fixtureEntry.path), "utf8");
const fixture = JSON.parse(fixtureText) as { vectors:Array<Record<string, unknown>> };
const issues:string[]=[];
let utmVectors=0; let cleanVectors=0;
for (const vector of fixture.vectors) {
  if (vector.base && vector.params && vector.built) {
    const params = Object.fromEntries(vector.params as Array<[string,string]>);
    const source = params.utm_source;
    const medium = params.utm_medium;
    const campaign = params.utm_campaign;
    if (source === undefined || medium === undefined || campaign === undefined) {
      issues.push(`UTM fixture missing required fields: ${JSON.stringify(vector)}`);
      continue;
    }
    const optional = {
      ...(params.utm_term === undefined ? {} : { term: params.utm_term }),
      ...(params.utm_content === undefined ? {} : { content: params.utm_content }),
    };
    const actual = buildUtmUrl(String(vector.base), { source, medium, campaign, ...optional });
    if (actual !== vector.built) issues.push(`UTM mismatch ${actual}`); utmVectors++;
  }
  if (vector.url && vector.cleaned) {
    const actual = cleanTrackingParameters(String(vector.url));
    if (actual.url !== vector.cleaned || JSON.stringify(actual.dropped)!==JSON.stringify(vector.dropped)) issues.push(`clean mismatch ${JSON.stringify(actual)}`); cleanVectors++;
  }
}
const campaignVectors = [
  { preset:{fields:["client","channel","campaign"] as const,separator:"-" as const,lowercase:true}, values:{client:"Acme",channel:"Paid Social",campaign:"Spring Launch"}, expected:"acme-paid-social-spring-launch" },
  { preset:{fields:["market","campaign"] as const,separator:"_" as const,lowercase:false}, values:{market:"IT",campaign:"Café Promo"}, expected:"IT_Café-Promo" },
];
for (const vector of campaignVectors) if (buildCampaignName(vector.preset, vector.values)!==vector.expected) issues.push("campaign naming vector mismatch");
if (issues.length) { console.error(issues.join("\n")); process.exit(1); }
await mkdir(resolve(root,"quality/receipts/campaign-url"),{recursive:true});
const engineText=await readFile(resolve(root,"src/engines/campaign-url/index.ts"),"utf8"); const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
for (const [manifest,count] of [[utmBuilderManifest,utmVectors],[trackingCleanerManifest,cleanVectors],[campaignNameManifest,campaignVectors.length]] as const) {
  const oracle=registry.entries.find((entry)=>entry.id===manifest.gold.oracleEntryId); if(!oracle) throw new Error(`missing oracle ${manifest.gold.oracleEntryId}`);
  const receipt={schemaVersion:1,status:"GOLD",toolId:manifest.id,runtime:manifest.runtime,engineVersion:CAMPAIGN_URL_ENGINE_VERSION,oracleEntryId:manifest.gold.oracleEntryId,fixtureFamilies:manifest.gold.fixtureFamilies,exactVectors:count,truthSources:[...new Set([...oracle.truth_sources,...fixtureEntry.truth_sources])].sort(),identities:{engineSha256:sha(engineText),fixtureSha256:sha(fixtureText),fixtureIndexSha256:sha(indexText),oracleRegistrySha256:sha(registryText)}};
  await writeFile(resolve(root,`quality/receipts/campaign-url/${manifest.id}.gold.json`),`${JSON.stringify(receipt,null,2)}\n`);
  console.log(`Gold PASS: ${manifest.id}, ${count} exact vector(s)`);
}
