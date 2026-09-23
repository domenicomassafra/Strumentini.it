export type DefaultProvenance =
  | "explicit"
  | "profile"
  | "tool-default"
  | "system-derived";

export interface DefaultSources<K extends PropertyKey, V> {
  explicit?: Readonly<Partial<Record<K, V>>>;
  profile?: Readonly<Partial<Record<K, V>>>;
  toolDefaults?: Readonly<Partial<Record<K, V>>>;
  systemDerived?: Readonly<Partial<Record<K, V>>>;
  sensitiveFields?: ReadonlySet<K>;
}

export interface ResolvedDefault<K extends PropertyKey, V> {
  field: K;
  value: V;
  provenance: DefaultProvenance;
}

function readValue<K extends PropertyKey, V>(
  field: K,
  source: Readonly<Partial<Record<K, V>>> | undefined,
  provenance: DefaultProvenance,
): ResolvedDefault<K, V> | undefined {
  if (
    source === undefined || !Object.prototype.hasOwnProperty.call(source, field)
  ) return undefined;
  const value = source[field];
  return value === undefined ? undefined : { field, value, provenance };
}

export function resolveDefaults<K extends PropertyKey, V>(
  requestedFields: readonly K[],
  sources: DefaultSources<K, V>,
): Array<ResolvedDefault<K, V>> {
  const output: Array<ResolvedDefault<K, V>> = [];
  const seen = new Set<K>();

  for (const field of requestedFields) {
    if (seen.has(field)) continue;
    seen.add(field);

    const explicit = readValue(field, sources.explicit, "explicit");
    if (explicit !== undefined) {
      output.push(explicit);
      continue;
    }
    if (sources.sensitiveFields?.has(field)) continue;

    const resolved = readValue(field, sources.profile, "profile") ??
      readValue(field, sources.toolDefaults, "tool-default") ??
      readValue(field, sources.systemDerived, "system-derived");
    if (resolved !== undefined) output.push(resolved);
  }
  return output;
}
