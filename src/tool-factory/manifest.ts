import { z } from "zod";

export const TOOL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const TOOL_ROUTE_PATTERN = /^\/tools\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const PRIVACY_CLASSES = ["LOCAL", "REFERENCE", "REMOTE", "AI"] as const;
export const RUNTIME_LOCATIONS = ["LOCAL", "REFERENCE", "REMOTE", "AI"] as const;
export const NETWORK_POLICIES = ["forbidden", "reference-only", "required"] as const;
export const MAINTENANCE_CLASSES = ["E", "D", "R", "H", "S"] as const;
export const OFFLINE_MODES = ["FULL", "SHELL_ONLY", "NONE"] as const;
export const CAPABILITIES = [
  "clipboard",
  "share",
  "file-read",
  "file-write",
  "image-decode",
  "worker",
  "wasm",
  "local-db",
  "opfs",
  "reference-network",
  "content-network",
  "ai-provider",
] as const;

export type PrivacyClass = (typeof PRIVACY_CLASSES)[number];
export type RuntimeLocation = (typeof RUNTIME_LOCATIONS)[number];
export type NetworkPolicy = (typeof NETWORK_POLICIES)[number];
export type MaintenanceClass = (typeof MAINTENANCE_CLASSES)[number];
export type OfflineMode = (typeof OFFLINE_MODES)[number];
export type Capability = (typeof CAPABILITIES)[number];

const idSchema = z.string().regex(TOOL_ID_PATTERN, "must be a lowercase kebab-case identifier");
const routeSchema = z.string().regex(TOOL_ROUTE_PATTERN, "must be /tools/<tool-id>");
const packageNameSchema = z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u, "must be a package name");
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u, "must be an exact semantic version");
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u, "must be a semantic version");

export const profileFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9.-]*$/u),
  defaultValue: z.unknown().optional(),
  sensitive: z.boolean().optional(),
}).strict();

export const handoffDescriptorSchema = z.object({
  type: z.enum(["text", "lines", "number", "date-time", "url", "table", "structured", "file", "image", "bytes", "none"]),
  format: z.string().min(1).optional(),
  maxBytes: z.number().int().positive().optional(),
  requiresUniqueHeaders: z.boolean().optional(),
  acceptsRaggedRows: z.boolean().optional(),
}).strict();

export const handoffSchema = z.object({
  accepts: z.array(handoffDescriptorSchema).readonly().optional(),
  emits: z.array(handoffDescriptorSchema).readonly().optional(),
}).strict();

export const dependencySchema = z.object({
  name: packageNameSchema,
  version: versionSchema,
  license: z.string().min(1),
  optional: z.boolean().optional(),
}).strict();

export const lazyDependencySchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    import: z.string().min(1),
    required: z.boolean().optional(),
  }).strict(),
]);

export const bundleSchema = z.object({
  eager: z.boolean().optional(),
  lazy: z.boolean().optional(),
  initialBytes: z.number().int().nonnegative().optional(),
  maxBytes: z.number().int().positive().optional(),
}).strict();

export const acceptanceSchema = z.object({
  independentOracle: z.boolean(),
  fixtureFamilies: z.array(z.string().min(1)).min(1).readonly(),
  privacy: z.boolean(),
  accessibility: z.boolean(),
  bundle: z.boolean(),
}).strict();

export const privacySchema = z.union([
  z.enum(PRIVACY_CLASSES),
  z.object({
    class: z.enum(PRIVACY_CLASSES),
    disclosure: z.string().min(1),
  }).strict(),
]);

export const toolManifestSchema = z.object({
  id: idSchema,
  route: routeSchema,
  name: z.string().min(1),
  summary: z.string().min(1).max(160),
  aliases: z.array(z.string().min(1)).readonly(),
  keywords: z.array(z.string().min(1)).readonly().optional(),
  jobs: z.array(z.string().min(1)).min(1).readonly(),
  category: idSchema,
  inputTypes: z.array(z.string().min(1)).min(1).readonly(),
  packIds: z.array(idSchema).readonly().optional(),
  roleTags: z.array(z.string().min(1)).readonly().optional(),
  implementation: z.string().regex(/^\.\.\/tools\/[a-z0-9]+(?:-[a-z0-9]+)*\/module\.ts$/u),
  engine: z.string().min(1),
  runtime: z.object({
    location: z.enum(RUNTIME_LOCATIONS),
    network: z.enum(NETWORK_POLICIES),
  }).strict(),
  privacy: privacySchema.optional(),
  privacyClass: z.enum(PRIVACY_CLASSES).optional(),
  capabilities: z.array(z.enum(CAPABILITIES)).readonly().optional(),
  profileFields: z.array(profileFieldSchema).readonly(),
  handoff: handoffSchema.optional(),
  gold: z.object({
    maintenanceClass: z.enum(MAINTENANCE_CLASSES),
    oracleEntryId: z.string().regex(/^cand-\d{3}$/u),
    fixtureFamilies: z.array(z.string().min(1)).min(1).readonly(),
  }).strict(),
  version: semverSchema.optional(),
  deterministic: z.boolean().optional(),
  dependencies: z.array(dependencySchema).readonly().optional(),
  lazyDependencies: z.array(lazyDependencySchema).readonly().optional(),
  bundle: bundleSchema.optional(),
  offline: z.enum(OFFLINE_MODES).optional(),
  acceptance: acceptanceSchema.optional(),
  page: z.object({
    component: z.string().regex(/^[A-Z][A-Za-z0-9]*$/u),
    clientDirective: z.enum(["load", "idle", "visible"]).optional(),
  }).strict().optional(),
}).strict();

export type ToolManifestInput = z.input<typeof toolManifestSchema>;
export type ParsedToolManifest = z.output<typeof toolManifestSchema>;

export interface FactoryToolDependency {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly optional?: boolean;
}

export interface FactoryBundlePolicy {
  readonly eager: boolean;
  readonly lazy: boolean;
  readonly initialBytes: number;
  readonly maxBytes?: number;
}

export interface FactoryAcceptanceContract {
  readonly independentOracle: boolean;
  readonly fixtureFamilies: readonly string[];
  readonly privacy: boolean;
  readonly accessibility: boolean;
  readonly bundle: boolean;
}

export interface FactoryToolManifest {
  readonly id: string;
  readonly route: string;
  readonly name: string;
  readonly summary: string;
  readonly aliases: readonly string[];
  readonly keywords: readonly string[];
  readonly jobs: readonly string[];
  readonly category: string;
  readonly inputTypes: readonly string[];
  readonly packIds: readonly string[];
  readonly roleTags: readonly string[];
  readonly implementation: string;
  readonly engine: string;
  readonly runtime: {
    readonly location: RuntimeLocation;
    readonly network: NetworkPolicy;
  };
  readonly privacyClass: PrivacyClass;
  readonly privacyDisclosure?: string;
  readonly capabilities: readonly Capability[];
  readonly profileFields: readonly z.infer<typeof profileFieldSchema>[];
  readonly handoff?: z.infer<typeof handoffSchema>;
  readonly gold: {
    readonly maintenanceClass: MaintenanceClass;
    readonly oracleEntryId: string;
    readonly fixtureFamilies: readonly string[];
  };
  readonly version: string;
  readonly deterministic: boolean;
  readonly dependencies: readonly FactoryToolDependency[];
  readonly lazyDependencies: readonly (string | { readonly id: string; readonly import: string; readonly required?: boolean })[];
  readonly bundle: FactoryBundlePolicy;
  readonly offline: OfflineMode;
  readonly acceptance: FactoryAcceptanceContract;
  readonly page?: {
    readonly component: string;
    readonly clientDirective?: "load" | "idle" | "visible";
  };
}

export interface OracleRegistryEntry {
  readonly id: string;
  readonly candidate?: string;
  readonly truth_sources?: readonly string[];
}

export interface OracleRegistry {
  readonly schema_version?: number;
  readonly schemaVersion?: number;
  readonly entries: readonly OracleRegistryEntry[];
}

export interface FixtureFamily {
  readonly id: string;
  readonly path: string;
  readonly format?: string;
  readonly truth_sources?: readonly string[];
}

export interface FixtureIndex {
  readonly schema_version?: number;
  readonly schemaVersion?: number;
  readonly families: readonly FixtureFamily[];
}

export interface FactoryValidationContext {
  readonly oracleRegistry?: OracleRegistry;
  readonly fixtureIndex?: FixtureIndex;
  readonly requireOracleBindings?: boolean;
  readonly requireAcceptance?: boolean;
  readonly requireBundleDeclaration?: boolean;
  readonly requireDependencyDeclaration?: boolean;
}

export class ToolFactoryValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(issues.join("\n"));
    this.name = "ToolFactoryValidationError";
  }
}

export type FactoryValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly string[] };

function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length === 0 ? "manifest" : issue.path.join(".");
    return `${path}: ${issue.message}`;
  });
}

function privacyInput(value: ParsedToolManifest): { readonly value?: PrivacyClass; readonly disclosure?: string } {
  if (value.privacyClass !== undefined) {
    const disclosure = typeof value.privacy === "object" ? value.privacy.disclosure : undefined;
    return { value: value.privacyClass, ...(disclosure === undefined ? {} : { disclosure }) };
  }
  if (typeof value.privacy === "string") return { value: value.privacy };
  if (value.privacy !== undefined) return { value: value.privacy.class, disclosure: value.privacy.disclosure };
  return {};
}

function normalizeManifest(parsed: ParsedToolManifest): FactoryToolManifest {
  const privacy = privacyInput(parsed);
  const inferredPrivacy: PrivacyClass = parsed.runtime.location === "AI"
    ? "AI"
    : parsed.runtime.location;
  const privacyClass = privacy.value ?? inferredPrivacy;
  const acceptance = parsed.acceptance ?? {
    independentOracle: true,
    fixtureFamilies: parsed.gold.fixtureFamilies,
    privacy: true,
    accessibility: true,
    bundle: true,
  };
  const bundle = parsed.bundle ?? { eager: false };
  return {
    id: parsed.id,
    route: parsed.route,
    name: parsed.name,
    summary: parsed.summary,
    aliases: [...parsed.aliases],
    keywords: [...(parsed.keywords ?? [])],
    jobs: [...parsed.jobs],
    category: parsed.category,
    inputTypes: [...parsed.inputTypes],
    packIds: [...(parsed.packIds ?? [])],
    roleTags: [...(parsed.roleTags ?? [])],
    implementation: parsed.implementation,
    engine: parsed.engine,
    runtime: { ...parsed.runtime },
    privacyClass,
    ...(privacy.disclosure === undefined ? {} : { privacyDisclosure: privacy.disclosure }),
    capabilities: [...(parsed.capabilities ?? [])],
    profileFields: parsed.profileFields.map((field) => ({ ...field })),
    ...(parsed.handoff === undefined ? {} : { handoff: parsed.handoff }),
    gold: { ...parsed.gold, fixtureFamilies: [...parsed.gold.fixtureFamilies] },
    version: parsed.version ?? "0.0.0",
    deterministic: parsed.deterministic ?? true,
    dependencies: (parsed.dependencies ?? []).map((dependency) => ({
      name: dependency.name,
      version: dependency.version,
      license: dependency.license,
      ...(dependency.optional === undefined ? {} : { optional: dependency.optional }),
    })),
    lazyDependencies: (parsed.lazyDependencies ?? []).map((dependency) => {
      if (typeof dependency === "string") return dependency;
      return {
        id: dependency.id,
        import: dependency.import,
        ...(dependency.required === undefined ? {} : { required: dependency.required }),
      };
    }),
    bundle: {
      eager: bundle.eager ?? false,
      lazy: bundle.lazy ?? !(bundle.eager ?? false),
      initialBytes: bundle.initialBytes ?? 0,
      ...(bundle.maxBytes === undefined ? {} : { maxBytes: bundle.maxBytes }),
    },
    offline: parsed.offline ?? (parsed.runtime.location === "LOCAL" ? "FULL" : "SHELL_ONLY"),
    acceptance: {
      independentOracle: acceptance.independentOracle,
      fixtureFamilies: [...acceptance.fixtureFamilies],
      privacy: acceptance.privacy,
      accessibility: acceptance.accessibility,
      bundle: acceptance.bundle,
    },
    ...(parsed.page === undefined ? {} : {
      page: {
        component: parsed.page.component,
        ...(parsed.page.clientDirective === undefined ? {} : { clientDirective: parsed.page.clientDirective }),
      },
    }),
  };
}

const DISALLOWED_LICENSE_PREFIXES = ["AGPL-", "GPL-", "SSPL-", "BUSL-", "UNLICENSED"];
const SENSITIVE_PROFILE_FIELDS = new Set([
  "email",
  "phone",
  "address",
  "name",
  "fullname",
  "full-name",
  "organization",
  "company",
  "ssn",
  "tax-id",
]);

function descriptorKey(descriptor: z.infer<typeof handoffDescriptorSchema>): string {
  return JSON.stringify([
    descriptor.type,
    descriptor.format ?? null,
    descriptor.maxBytes ?? null,
    descriptor.requiresUniqueHeaders ?? null,
    descriptor.acceptsRaggedRows ?? null,
  ]);
}

function collectDuplicateValues(values: readonly string[], label: string): string[] {
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const value of values) {
    if (seen.has(value)) issues.push(`${label}: duplicate value ${JSON.stringify(value)}`);
    seen.add(value);
  }
  return issues;
}

function expectedNetwork(privacyClass: PrivacyClass): NetworkPolicy {
  if (privacyClass === "LOCAL") return "forbidden";
  if (privacyClass === "REFERENCE") return "reference-only";
  return "required";
}

export function collectManifestIssues(
  manifest: FactoryToolManifest,
  context: FactoryValidationContext = {},
): string[] {
  const issues: string[] = [];
  if (manifest.route !== `/tools/${manifest.id}`) {
    issues.push(`${manifest.id}: route must be /tools/${manifest.id}`);
  }
  const expectedImplementation = `../tools/${manifest.id}/module.ts`;
  if (manifest.implementation !== expectedImplementation) {
    issues.push(`${manifest.id}: implementation must be ${expectedImplementation}`);
  }
  issues.push(...collectDuplicateValues(manifest.aliases, `${manifest.id}: aliases`));
  issues.push(...collectDuplicateValues(manifest.keywords, `${manifest.id}: keywords`));
  issues.push(...collectDuplicateValues(manifest.jobs, `${manifest.id}: jobs`));
  issues.push(...collectDuplicateValues(manifest.inputTypes, `${manifest.id}: inputTypes`));
  issues.push(...collectDuplicateValues(manifest.packIds, `${manifest.id}: packIds`));
  issues.push(...collectDuplicateValues(manifest.roleTags, `${manifest.id}: roleTags`));
  issues.push(...collectDuplicateValues(manifest.profileFields.map((field) => field.key), `${manifest.id}: profileFields`));
  issues.push(...collectDuplicateValues(manifest.gold.fixtureFamilies, `${manifest.id}: gold.fixtureFamilies`));
  issues.push(...collectDuplicateValues(manifest.dependencies.map((dependency) => dependency.name), `${manifest.id}: dependencies`));
  issues.push(...collectDuplicateValues(
    manifest.lazyDependencies.map((dependency) => typeof dependency === "string" ? dependency : dependency.id),
    `${manifest.id}: lazyDependencies`,
  ));

  if (manifest.runtime.location !== manifest.privacyClass) {
    issues.push(`${manifest.id}: runtime location and privacy class must agree`);
  }
  if (manifest.runtime.network !== expectedNetwork(manifest.privacyClass)) {
    issues.push(`${manifest.id}: ${manifest.privacyClass} tools must declare network=${expectedNetwork(manifest.privacyClass)}`);
  }
  if (manifest.privacyClass !== "LOCAL" && manifest.privacyDisclosure === undefined) {
    issues.push(`${manifest.id}: non-LOCAL tools must declare a privacy disclosure`);
  }
  if (manifest.privacyClass === "LOCAL" && manifest.capabilities.some((capability) => capability.includes("network"))) {
    issues.push(`${manifest.id}: LOCAL tools cannot declare network capabilities`);
  }
  if (manifest.capabilities.includes("content-network") && !["REMOTE", "AI"].includes(manifest.privacyClass)) {
    issues.push(`${manifest.id}: content-network requires REMOTE or AI privacy`);
  }
  if (manifest.capabilities.includes("ai-provider") && manifest.privacyClass !== "AI") {
    issues.push(`${manifest.id}: ai-provider requires AI privacy`);
  }
  if (manifest.privacyClass !== "LOCAL" && manifest.acceptance.privacy !== true) {
    issues.push(`${manifest.id}: non-LOCAL tools must require privacy acceptance`);
  }
  if (manifest.bundle.eager || manifest.bundle.lazy === false || manifest.bundle.initialBytes > 0) {
    issues.push(`${manifest.id}: tool implementations must remain lazy with zero initial bundle bytes`);
  }
  if (context.requireBundleDeclaration === true && manifest.bundle.initialBytes === 0 && manifest.bundle.maxBytes === undefined) {
    issues.push(`${manifest.id}: bundle policy must declare maxBytes`);
  }
  if (context.requireDependencyDeclaration === true && manifest.dependencies.length === 0) {
    issues.push(`${manifest.id}: dependency declaration is required`);
  }
  for (const dependency of manifest.dependencies) {
    if (DISALLOWED_LICENSE_PREFIXES.some((prefix) => dependency.license.toUpperCase().startsWith(prefix))) {
      issues.push(`${manifest.id}: dependency ${dependency.name} uses disallowed license ${dependency.license}`);
    }
  }
  for (const dependency of manifest.lazyDependencies) {
    const importPath = typeof dependency === "string" ? dependency : dependency.import;
    if (/^(?:[a-z]+:|\/\/)/iu.test(importPath) || importPath.startsWith("/")) {
      issues.push(`${manifest.id}: lazy dependency must use a local import path`);
    }
  }
  for (const field of manifest.profileFields) {
    if (SENSITIVE_PROFILE_FIELDS.has(field.key.toLowerCase()) && field.sensitive !== true) {
      issues.push(`${manifest.id}: sensitive profile field ${field.key} must be marked sensitive`);
    }
    if (field.sensitive === true && field.defaultValue !== undefined) {
      issues.push(`${manifest.id}: sensitive profile field ${field.key} cannot have a silent default`);
    }
  }

  for (const direction of ["accepts", "emits"] as const) {
    const descriptors = manifest.handoff?.[direction] ?? [];
    const seen = new Set<string>();
    for (const descriptor of descriptors) {
      const key = descriptorKey(descriptor);
      if (seen.has(key)) issues.push(`${manifest.id}: duplicate handoff ${direction} descriptor ${key}`);
      seen.add(key);
      if (descriptor.type === "none" && descriptors.length > 1) {
        issues.push(`${manifest.id}: handoff ${direction} descriptor none cannot be combined with another descriptor`);
      }
    }
  }

  if (context.requireAcceptance === true && manifest.acceptance.independentOracle !== true) {
    issues.push(`${manifest.id}: Gold acceptance requires an independent oracle`);
  }
  if (context.oracleRegistry !== undefined) {
    const ids = new Set(context.oracleRegistry.entries.map((entry) => entry.id));
    if (!ids.has(manifest.gold.oracleEntryId)) {
      issues.push(`${manifest.id}: oracle registry entry not found: ${manifest.gold.oracleEntryId}`);
    }
  }
  if (context.fixtureIndex !== undefined) {
    const ids = new Set(context.fixtureIndex.families.map((family) => family.id));
    for (const family of manifest.gold.fixtureFamilies) {
      if (!ids.has(family)) issues.push(`${manifest.id}: fixture family not found: ${family}`);
    }
  }
  if (context.requireOracleBindings === true && context.oracleRegistry === undefined) {
    issues.push(`${manifest.id}: oracle registry is required`);
  }
  if (context.requireOracleBindings === true && context.fixtureIndex === undefined) {
    issues.push(`${manifest.id}: fixture index is required`);
  }
  return issues;
}

export function safeParseToolManifest(raw: unknown): FactoryValidationResult<FactoryToolManifest> {
  const parsed = toolManifestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const declared = parsed.data.privacyClass === undefined
    ? []
    : [parsed.data.privacyClass, ...(typeof parsed.data.privacy === "string" ? [parsed.data.privacy] : parsed.data.privacy === undefined ? [] : [parsed.data.privacy.class])];
  if (new Set(declared).size > 1) {
    return { ok: false, issues: ["manifest: privacyClass and privacy must declare the same class"] };
  }
  const manifest = normalizeManifest(parsed.data);
  const issues = collectManifestIssues(manifest);
  return issues.length === 0
    ? { ok: true, value: manifest }
    : { ok: false, issues };
}

export function parseToolManifest(raw: unknown): FactoryToolManifest {
  const result = safeParseToolManifest(raw);
  if (!result.ok) throw new ToolFactoryValidationError(result.issues);
  return result.value;
}

export function normalizeToolManifest(raw: unknown): FactoryToolManifest {
  const parsed = toolManifestSchema.parse(raw);
  return normalizeManifest(parsed);
}

export function validateToolManifest(
  raw: unknown,
  context: FactoryValidationContext = {},
): FactoryToolManifest {
  const manifest = parseToolManifest(raw);
  const issues = collectManifestIssues(manifest, context);
  if (issues.length > 0) throw new ToolFactoryValidationError(issues);
  return manifest;
}

export const validateManifest = validateToolManifest;
