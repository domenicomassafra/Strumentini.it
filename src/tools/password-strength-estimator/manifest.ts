import type { ToolManifest } from "../../catalog/manifest";

export const passwordStrengthEstimatorManifest = {
  id: "password-strength-estimator",
  route: "/tools/password-strength-estimator",
  name: "Explainable Password Strength Estimator",
  summary: "Estimate password strength offline from length and observable patterns, with deterministic factor explanations and explicit limits.",
  aliases: ["password strength checker", "offline password estimator", "password pattern checker"],
  jobs: ["estimate password strength", "explain password strength factors", "inspect password patterns locally"],
  category: "developer",
  inputTypes: ["secret"],
  implementation: "../tools/password-strength-estimator/module.ts",
  engine: "developer-web",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "validator", capabilities: ["retry", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-225", fixtureFamilies: ["password-security"] },
  page: { component: "PasswordStrengthEstimatorTool", clientDirective: "load" },
} as const satisfies ToolManifest & { readonly page: { readonly component: string; readonly clientDirective: "load" } };

export default passwordStrengthEstimatorManifest;
