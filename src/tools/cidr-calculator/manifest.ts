import { defineDeveloperWebManifest } from "../../engines/developer-web/manifest";

export const cidrCalculatorManifest = defineDeveloperWebManifest({
  id: "cidr-calculator",
  name: "IPv4 & IPv6 CIDR Calculator",
  summary: "Calculate IPv4 and IPv6 network ranges exactly with BigInt-safe address arithmetic and explicit IPv4 broadcast semantics.",
  aliases: ["subnet calculator", "ipv4 cidr calculator", "ipv6 cidr calculator"],
  jobs: ["calculate CIDR network", "calculate IPv4 subnet", "calculate IPv6 subnet"],
  inputTypes: ["ip-address", "cidr", "text"],
  oracleEntryId: "cand-201",
  fixtureFamilies: ["developer-network-numeric"],
});
export default cidrCalculatorManifest;
