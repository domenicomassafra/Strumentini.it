import { z } from "zod";
import type { ToolManifest, ToolSummary } from "../../src/catalog/manifest";

const profileFieldSchema = z.object({
  key: z.string().min(1),
  defaultValue: z.unknown().optional(),
  sensitive: z.boolean().optional(),
});

const handoffDescriptorSchema = z.object({
  type: z.enum(["text", "lines", "number", "date-time", "url", "table", "structured", "file", "image", "bytes", "none"]),
  format: z.string().min(1).optional(),
  maxBytes: z.number().int().positive().optional(),
  requiresUniqueHeaders: z.boolean().optional(),
  acceptsRaggedRows: z.boolean().optional(),
});

const handoffSchema = z.object({
  accepts: z.array(handoffDescriptorSchema).readonly().optional(),
  emits: z.array(handoffDescriptorSchema).readonly().optional(),
});

const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  route: z.string().regex(/^\/tools\/[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  name: z.string().min(1),
  summary: z.string().min(1),
  aliases: z.array(z.string()).readonly(),
  jobs: z.array(z.string()).min(1).readonly(),
  category: z.string().min(1),
  inputTypes: z.array(z.string()).min(1).readonly(),
  implementation: z.string().regex(/^\.\.\/tools\//u),
  engine: z.string().min(1),
  runtime: z.object({
    location: z.enum(["LOCAL", "REFERENCE", "REMOTE"]),
    network: z.enum(["forbidden", "reference-only", "required"]),
  }),
  profileFields: z.array(profileFieldSchema).readonly(),
  handoff: handoffSchema.optional(),
  gold: z.object({
    maintenanceClass: z.enum(["E", "D", "R", "H", "S"]),
    oracleEntryId: z.string().min(1),
    fixtureFamilies: z.array(z.string().min(1)).min(1).readonly(),
  }),
});

export class CatalogCompileError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(issues.join("\n"));
    this.name = "CatalogCompileError";
  }
}

export interface CatalogArtifacts {
  summaries: ToolSummary[];
  loaders: Array<{ id: string; implementation: string }>;
}

export function compileCatalog(rawManifests: readonly unknown[]): CatalogArtifacts {
  const issues: string[] = [];
  const manifests: ToolManifest[] = [];

  rawManifests.forEach((raw, index) => {
    const parsed = manifestSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(`manifest[${index}]: ${z.prettifyError(parsed.error)}`);
      return;
    }

    const manifest = parsed.data as ToolManifest;
    if (manifest.runtime.location === "LOCAL" && manifest.runtime.network !== "forbidden") {
      issues.push(`${manifest.id}: LOCAL tools must declare network=forbidden`);
    }
    manifests.push(manifest);
  });

  const seenIds = new Set<string>();
  const seenRoutes = new Set<string>();
  for (const manifest of manifests) {
    if (seenIds.has(manifest.id)) issues.push(`${manifest.id}: duplicate tool id`);
    if (seenRoutes.has(manifest.route)) issues.push(`${manifest.route}: duplicate tool route`);
    seenIds.add(manifest.id);
    seenRoutes.add(manifest.route);
    for (const direction of ["accepts", "emits"] as const) {
      const descriptors = manifest.handoff?.[direction] ?? [];
      const seenDescriptors = new Set<string>();
      for (const descriptor of descriptors) {
        const key = `${descriptor.type}:${descriptor.format ?? "*"}`;
        if (seenDescriptors.has(key)) issues.push(`${manifest.id}: duplicate handoff ${direction} descriptor ${key}`);
        seenDescriptors.add(key);
      }
    }
  }

  if (issues.length > 0) throw new CatalogCompileError(issues);

  manifests.sort((left, right) => left.id.localeCompare(right.id));
  return {
    summaries: manifests.map(({ implementation: _implementation, ...summary }) => summary),
    loaders: manifests.map(({ id, implementation }) => ({ id, implementation })),
  };
}
