import type { ToolSummary } from "../catalog/manifest";
import type { ResolvedDefault } from "./types";

export interface ProfileResolutionInput {
  explicit?: Readonly<Record<string, unknown>>;
  profile?: Readonly<Record<string, unknown>>;
  systemDerived?: Readonly<Record<string, unknown>>;
}

function hasOwn(
  source: Readonly<Record<string, unknown>> | undefined,
  key: string,
): boolean {
  return source !== undefined && Object.prototype.hasOwnProperty.call(source, key);
}

export function resolveToolDefaults(
  manifest: Pick<ToolSummary, "profileFields">,
  input: ProfileResolutionInput,
): ResolvedDefault[] {
  const resolved: ResolvedDefault[] = [];

  for (const declaration of manifest.profileFields) {
    const key = declaration.key;
    if (hasOwn(input.explicit, key)) {
      resolved.push({ field: key, value: input.explicit?.[key], provenance: "explicit" });
      continue;
    }

    if (declaration.sensitive === true) continue;

    if (hasOwn(input.profile, key)) {
      resolved.push({ field: key, value: input.profile?.[key], provenance: "profile" });
      continue;
    }

    if (declaration.defaultValue !== undefined) {
      resolved.push({
        field: key,
        value: declaration.defaultValue,
        provenance: "tool-default",
      });
      continue;
    }

    if (hasOwn(input.systemDerived, key)) {
      resolved.push({
        field: key,
        value: input.systemDerived?.[key],
        provenance: "system-derived",
      });
    }
  }

  return resolved;
}
