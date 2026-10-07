import type { ToolManifest } from "../../catalog/manifest";

export const passwordPinPassphraseGeneratorManifest = {
  id: "password-pin-passphrase-generator",
  route: "/tools/password-pin-passphrase-generator",
  name: "Secure Password, PIN & Italian Passphrase Generator",
  summary: "Generate passwords, numeric PINs and Italian passphrases locally with WebCrypto and unbiased rejection sampling.",
  aliases: ["secure password generator", "pin generator", "italian passphrase generator"],
  jobs: ["generate secure password", "generate numeric PIN", "generate Italian passphrase"],
  category: "developer",
  inputTypes: ["secret", "number"],
  capabilities: ["clipboard"],
  implementation: "../tools/password-pin-passphrase-generator/module.ts",
  engine: "developer-web",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "retry", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-224", fixtureFamilies: ["password-security"] },
  deterministic: false,
  page: { component: "PasswordPinPassphraseGeneratorTool", clientDirective: "load" },
} as const satisfies ToolManifest & { readonly deterministic: false; readonly page: { readonly component: string; readonly clientDirective: "load" } };

export default passwordPinPassphraseGeneratorManifest;
