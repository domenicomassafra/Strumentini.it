import type { ToolManifest } from "../../catalog/manifest";

export const randomPickerTeamCouponGeneratorManifest = {
  id: "random-picker-team-coupon-generator",
  route: "/tools/random-picker-team-coupon-generator",
  name: "Secure Random Number, Picker, Team Splitter & Coupon Generator",
  summary: "Generate random integers, list draws, balanced teams and unique coupon codes locally with secure WebCrypto or an explicitly non-secure seed.",
  aliases: ["random number generator", "random picker", "team splitter", "coupon code generator", "estrazione casuale"],
  jobs: ["generate random number", "draw random list entries", "split balanced teams", "generate unique coupon codes"],
  category: "developer",
  inputTypes: ["number", "text"],
  capabilities: ["clipboard"],
  implementation: "../tools/random-picker-team-coupon-generator/module.ts",
  engine: "developer-web",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "retry", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-243", fixtureFamilies: ["random-utilities"] },
  deterministic: false,
  page: { component: "RandomPickerTeamCouponGeneratorTool", clientDirective: "load" },
} as const satisfies ToolManifest & { readonly deterministic: false; readonly page: { readonly component: string; readonly clientDirective: "load" } };

export default randomPickerTeamCouponGeneratorManifest;
