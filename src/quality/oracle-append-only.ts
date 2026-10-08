import { createHash } from "node:crypto";

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Evidence-based compatibility for *append-only* oracle authority revisions.
 *
 * A receipt tied to a previous registry hash remains valid only if removing
 * exclusively the trailing candidate(s), and decrementing `entry_count`,
 * reproduces its original authority bytes exactly. No historic hash is
 * trusted merely because it is listed: every legacy hash must be matched by
 * an actual SHA-256 preimage reconstructed from the current on-disk registry.
 * Existing entries, their truth sources, and all formatting are fingerprinted.
 * If the old authority was edited, even innocuously, the proof fails closed.
 */
export function oracleAppendOnlyIdentities(currentText: string): ReadonlyMap<string, ReadonlySet<string>> {
  const identities = new Map<string, ReadonlySet<string>>();
  let text = currentText;
  // Bounded 12-version append-only window: new verified tools may extend the
  // registry without invalidating historic receipts whose *exact original
  // bytes* can still be reconstructed. This does NOT whitelist old hashes or
  // permit changes to any historical entry. Beyond the window an explicitly
  // reviewed, byte-grounded authority snapshot would be needed.
  for (let removed = 0; removed < 12; removed += 1) {
    let parsed: unknown;
    try { parsed = JSON.parse(text) as unknown; } catch { break; }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) break;
    const record = parsed as { entry_count?: unknown; entries?: unknown };
    if (!Number.isSafeInteger(record.entry_count) || !Array.isArray(record.entries)
      || record.entry_count !== record.entries.length || record.entries.length < 1) break;
    const ids = record.entries.map((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry)
      ? (entry as { id?: unknown }).id : undefined);
    if (ids.some((id, index) => id !== `cand-${String(index + 1).padStart(3, "0")}`)) break;
    identities.set(digest(text), new Set(ids as string[]));
    if (record.entries.length === 1) break;

    // The registry's checked-in formatting places an entry header on its own
    // four-space-indented line. Undo only a final top-level addition.
    const matches = [...text.matchAll(/\n    \{\n      "id": "cand-(\d{3})",/gu)];
    const last = matches.at(-1);
    const lastId = ids.at(-1);
    if (last === undefined || last.index === undefined || last[1] !== String(ids.length).padStart(3, "0")
      || lastId !== `cand-${last[1]}`) break;
    const prefix = text.slice(0, last.index);
    const footerStart = text.lastIndexOf("\n  ]");
    if (!prefix.endsWith(",") || footerStart <= last.index) break;
    const appended = text.slice(last.index + 1, footerStart);
    try {
      if ((JSON.parse(appended) as { id?: unknown }).id !== lastId) break;
    } catch { break; }
    const countExpression = `  "entry_count": ${ids.length},`;
    if (text.split(countExpression).length !== 2) break;
    const candidate = (prefix.slice(0, -1) + text.slice(footerStart))
      .replace(countExpression, `  "entry_count": ${ids.length - 1},`);
    // Only recurse if the transformed prefix is itself a structurally valid
    // numbered registry; the SHA must still match the receipt's historic SHA.
    text = candidate;
  }
  return identities;
}

export function oracleIdentityIsCompatible(
  currentRegistryText: string,
  receiptSha256: string,
  referencedOracleIds: readonly string[],
): boolean {
  const matching = oracleAppendOnlyIdentities(currentRegistryText).get(receiptSha256);
  return matching !== undefined && referencedOracleIds.every((id) => matching.has(id));
}
