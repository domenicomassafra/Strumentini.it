/** #397 offline audit of pinned sources; no network or inferred validity. */
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { VERIFIED_IRPEF_EXCERPTS_117, VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117, INVOICE_STAMP_REFERENCE_2024_117 } from "../../src/reference-data/italy/fiscal-annual-117";
import { ANNUAL_VAT_2025_WINDOW_117 } from "../../src/reference-data/italy/fiscal-annual-vat-117";
import { INPS_CONTRIBUTIONS_2026 } from "../../src/reference-data/italy/annual-2026";
import { ITALY_SOURCE_PACK_DECISIONS } from "../../src/reference-data/italy/source-packs";

const DEFAULT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MAX_BYTES = 16 * 1024 * 1024;
type SourcePin397 = { authority: string; title: string; url: string; path: string; sha256: string; checkedAt?: string };
type Evidence397 = { ticket: number; datasetId: string; checkedAt: string; artifacts: SourcePin397[]; frozenOfficialBulkArtifacts?: SourcePin397[] };
export type AuditedSource397 = SourcePin397 & {
  checkedHash: boolean;
  /** Present only when this exact URL, authority and SHA are in the authenticated evidence manifest. */
  manifestCheckedAt: string | null;
  manifestIndex: "MATCHED" | "UNLISTED";
  liveUrlCheck: "NOT_RUN";
};
export type AuditedRule397 = {
  ruleId: string; authority: string; taxYear: number | null;
  validFrom: string; validTo: string; scope: string; sources: AuditedSource397[];
};
export type Reference397 = {
  ruleId: string; authority: string; validFrom: null; validTo: null;
  scope: string; sources: AuditedSource397[];
};
export type Gap397 = { ruleId: string; reason: string; scope: string };
export type Violation397 = {
  code: "HASH_MISMATCH" | "MISSING_SNAPSHOT" | "UNSAFE_PATH" | "UNTRUSTED_URL" | "MALFORMED_EVIDENCE" | "UNPINNED_SOURCE" | "MANIFEST_SOURCE_CONFLICT";
  path: string; message: string;
};
export type AnnualAudit397 = {
  status: "PARTIAL_NO_GO"; mode: "OFFLINE_PINNED_BYTES_ONLY";
  verified: AuditedRule397[]; references: Reference397[]; gaps: Gap397[]; violations: Violation397[];
};
export type AuditOptions397 = {
  root?: string;
  /** Test-only byte substitution; never writes to checked-in reference files. */
  readBytes?: (path: string) => Promise<Uint8Array>;
};
type Candidate397 = {
  ruleId: string; authority: string; taxYear: number | null;
  validFrom: string | null; validTo: string | null; scope: string;
  tickets: number[]; sources: SourcePin397[];
};

const KNOWN_GAPS: Gap397[] = [
  { ruleId: "italy.annual-full-fiscal", reason: "INCOMPLETE_YEAR_COVERAGE",
    scope: "2025/2026 IVA, national IRPEF and forfettario are not all supported across each whole fiscal year; #117 remains BLOCKED." },
  { ruleId: "italy.istat-historical-birth-date", reason: "MISSING_HISTORICAL_VALIDITY",
    scope: "Current ISTAT municipalities are known at one snapshot date, not every birth date. SITUAS has 16 municipality identities without codes, 23 uncoded foreign rows and incomplete historical intervals." },
  { ruleId: "italy.inps-general-employee", reason: "UNSUPPORTED_PROFILE",
    scope: "Only explicit 2026 Gestione Separata, artisan/merchant and one agricultural-worker profile are implemented; generic employee and special-case rates unsupported." },
  { ruleId: "italy.ade-complete-tax-year", reason: "NO_COMPLETE_AGENCY_ANNUAL_SNAPSHOT",
    scope: "The 2024 AdE invoice-stamp archive is not a 2025/2026 general tax-law source. Redditi PF 2026 declaration material concerns income year 2025." },
  { ruleId: "italy.vat-annual-all-dates", reason: "PARTIAL_EFFECTIVE_RANGE",
    scope: "MEF Table A source version begins 2025-12-13; no assertion about earlier 2025 or automatic transaction classification." },
];

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function hash(bytes: Uint8Array): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}
function officialUrl(authority: string, raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const hosts: Record<string, string[]> = {
      INPS: ["www.inps.it"],
      ISTAT: ["www.istat.it", "situas-servizi.istat.it"],
      "ISTAT / SITUAS": ["situas-servizi.istat.it"],
      "Agenzia delle Entrate": ["www1.agenziaentrate.gov.it", "www.agenziaentrate.gov.it"],
      Normattiva: ["www.normattiva.it"],
      "Gazzetta Ufficiale": ["www.gazzettaufficiale.it"],
      "Ministero dell'Economia e delle Finanze — Documentazione Economica e Finanziaria": ["def.giustiziatributaria.gov.it"],
      "European Commission / Access2Markets": ["trade.ec.europa.eu"],
    };
    return hosts[authority]?.includes(u.hostname.toLowerCase()) === true;
  } catch { return false; }
}

function scopedPath397(root: string, path: unknown): string | null {
  if (typeof path !== "string" || isAbsolute(path) || path.includes("\\") ||
    !path.startsWith("quality/reference-data/italy/")) return null;
  const allowed = resolve(root, "quality/reference-data/italy");
  const full = resolve(root, path);
  return full.startsWith(allowed + sep) ? full : null;
}

export function validOfficialEvidence397(
  data: unknown, ticket: number, datasetId: string, checkedAt: string,
): data is Evidence397 {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
  const value = data as Partial<Evidence397>;
  if (value.ticket !== ticket || value.datasetId !== datasetId || value.checkedAt !== checkedAt ||
    !Array.isArray(value.artifacts) ||
    (value.frozenOfficialBulkArtifacts !== undefined && !Array.isArray(value.frozenOfficialBulkArtifacts))) return false;
  const entries: unknown[] = [...value.artifacts, ...(value.frozenOfficialBulkArtifacts ?? [])];
  if (entries.length === 0 || entries.length > 100) return false;
  const paths = new Set<string>();
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
    const entry = raw as Partial<SourcePin397>;
    if (typeof entry.authority !== "string" || typeof entry.title !== "string" || !entry.title.trim() ||
      typeof entry.url !== "string" || !officialUrl(entry.authority, entry.url) ||
      scopedPath397(DEFAULT_ROOT, entry.path) === null ||
      typeof entry.sha256 !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(entry.sha256) ||
      (entry.checkedAt !== undefined && (!validDate(entry.checkedAt) || entry.checkedAt < checkedAt))) return false;
    if (paths.has(entry.path!)) return false;
    paths.add(entry.path!);
  }
  return true;
}

/** Reject symlinks in source paths and ancestor directories. */
export async function inspectOfficialSnapshotPath397(root: string, path: unknown): Promise<boolean> {
  if (scopedPath397(root, path) === null || typeof path !== "string") return false;
  const parts = path.split("/");
  let at = resolve(root);
  try {
    for (let i = 0; i < parts.length; i++) {
      at = resolve(at, parts[i]!);
      const entry = await lstat(at);
      if (entry.isSymbolicLink()) return false;
      if (i === parts.length - 1 ? !entry.isFile() : !entry.isDirectory()) return false;
    }
    return true;
  } catch { return false; }
}

export async function auditAnnualOfficialSources397(options: AuditOptions397 = {}): Promise<AnnualAudit397> {
  const root = resolve(options.root ?? DEFAULT_ROOT);
  const violations: Violation397[] = [];
  const verified: AuditedRule397[] = [];
  const references: Reference397[] = [];
  const gaps = [...KNOWN_GAPS];
  const report = (code: Violation397["code"], path: string, message: string) => {
    if (!violations.some(v => v.code === code && v.path === path)) violations.push({ code, path, message });
  };
  const bytesOf = async (path: string): Promise<Uint8Array | null> => {
    const packed = /^quality\/reference-data\/italy\/artifacts\/115-administrative-geography\/istat-situas-(?:128-suppressed|469-foreign)-2026-10-09\.json$/u.test(path);
    const diskPath = packed ? `${path}.gz` : path;
    const full = scopedPath397(root, diskPath);
    if (full === null) {
      report("UNSAFE_PATH", String(path), "Non-string path or path outside reference-data allowlist");
      return null;
    }
    try {
      if (!options.readBytes && !await inspectOfficialSnapshotPath397(root, diskPath)) {
        report("UNSAFE_PATH", path, "Symlink or invalid ancestor/source path");
        return null;
      }
      if (!options.readBytes) {
        const stat = await lstat(full);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > MAX_BYTES) {
          report("UNSAFE_PATH", path, "Not a bounded regular non-symlink snapshot");
          return null;
        }
      }
      const data = options.readBytes ? await options.readBytes(path) : packed
        ? gunzipSync(await readFile(full), { maxOutputLength: MAX_BYTES + 1 }) : await readFile(full);
      if (data.byteLength === 0 || data.byteLength > MAX_BYTES) {
        report("UNSAFE_PATH", path, "Artifact exceeds size policy");
        return null;
      }
      return data;
    } catch {
      report("MISSING_SNAPSHOT", path, "Physical snapshot not available");
      return null;
    }
  };
  const authenticate = async (path: string, sha256: string): Promise<boolean> => {
    if (!/^sha256:[0-9a-f]{64}$/u.test(sha256)) {
      report("UNPINNED_SOURCE", path, "No valid SHA256");
      return false;
    }
    const bytes = await bytesOf(path);
    if (!bytes) return false;
    if (hash(bytes) === sha256) return true;
    report("HASH_MISMATCH", path, "Physical bytes differ from checked-in canonical pin");
    return false;
  };
  const evidence = new Map<number, Evidence397>();
  for (const ticket of [115, 117, 118]) {
    const decision = ITALY_SOURCE_PACK_DECISIONS.find(p => p.ticket === ticket);
    if (!decision) continue;
    // One read, one hash, then parse THESE SAME bytes. Never authenticate a
    // prior version and parse a second version after an intervening rewrite.
    const raw = await bytesOf(decision.evidenceSnapshot.path);
    if (!raw) continue;
    if (!/^sha256:[0-9a-f]{64}$/u.test(decision.evidenceSnapshot.sha256)) {
      report("UNPINNED_SOURCE", decision.evidenceSnapshot.path, "Manifest SHA256 not pinned");
      continue;
    }
    if (hash(raw) !== decision.evidenceSnapshot.sha256) {
      report("HASH_MISMATCH", decision.evidenceSnapshot.path, "Evidence bytes differ from canonical checked-in decision");
      continue;
    }
    try {
      const item: unknown = JSON.parse(Buffer.from(raw).toString("utf8"));
      if (!validOfficialEvidence397(item, ticket, decision.datasetId, decision.checkedAt)) throw Error("Metadata mismatch");
      evidence.set(ticket, item);
    } catch {
      report("MALFORMED_EVIDENCE", decision.evidenceSnapshot.path, "Evidence schema/identity mismatch");
    }
  }
  const findArtifact = (ticket: number, predicate: (source: SourcePin397) => boolean): SourcePin397[] => {
    const ev = evidence.get(ticket);
    const selected = [...(ev?.artifacts ?? []), ...(ev?.frozenOfficialBulkArtifacts ?? [])].filter(predicate);
    return selected.length === 1 ? selected : [];
  };
  const candidates: Candidate397[] = [];
  for (const pack of VERIFIED_IRPEF_EXCERPTS_117) candidates.push({
    ruleId: "italy.irpef-national-gross", authority: "Normattiva", taxYear: pack.taxYear,
    validFrom: pack.effectiveFrom, validTo: pack.effectiveTo, tickets: [117],
    scope: "Only national gross IRPEF brackets; no credits, deductions, surtaxes, exemptions or eligibility",
    sources: pack.sources.map(s => ({ authority: s.authority, title: "IRPEF legislation", url: s.url, path: s.artifactPath, sha256: s.sha256 })),
  });
  candidates.push({
    ruleId: "italy.vat-declared-2025-window", authority: "Ministero dell'Economia e delle Finanze — Documentazione Economica e Finanziaria",
    taxYear: 2025, validFrom: ANNUAL_VAT_2025_WINDOW_117.validFrom, validTo: ANNUAL_VAT_2025_WINDOW_117.validTo,
    tickets: [117], scope: "Only user-confirmed exact printed VAT categories during the 2025 last-19-days source window",
    sources: ANNUAL_VAT_2025_WINDOW_117.sources.map(s => ({
      authority: s.authority, title: s.title, url: s.url, path: s.artifactPath, sha256: s.sha256,
    })),
  });
  const f = VERIFIED_FORFETTARIO_COEFFICIENTS_2025_117;
  candidates.push({
    ruleId: "italy.forfettario-ateco2007-coefficients", authority: "Gazzetta Ufficiale",
    taxYear: 2025, validFrom: f.effectiveFrom, validTo: f.effectiveTo, tickets: [117],
    scope: "Official ATECO2007 table only; not full forfettario/INPS eligibility or ATECO2025 mapping",
    sources: f.sources.map(s => ({ authority: s.authority, title: "ATECO2007 coefficients", url: s.url, path: s.artifactPath, sha256: s.sha256 })),
  });
  for (const item of [
    { ruleId: "italy.inps-gestione-separata", part: "Circolare numero 8", scope: "Two named 2026 professional profiles only" },
    { ruleId: "italy.inps-artigiani-commercianti", part: "Circolare numero 14", scope: "Standard 2026 adult artisan and merchant rates only" },
    { ruleId: "italy.inps-agricultural-worker", part: "Circolare numero 43", scope: "2026 OTD/OTI general agricultural worker below bounded base only" },
  ]) {
    const source = findArtifact(118, s => s.authority === "INPS" && s.title.includes(item.part));
    const engine = INPS_CONTRIBUTIONS_2026.metadata;
    const expectedPin = ITALY_SOURCE_PACK_DECISIONS.find(s => s.ticket === 118)?.evidenceSnapshot.sha256;
    const matchesEngine = engine.snapshotHash === expectedPin && engine.year === 2026 &&
      source.length === 1 && engine.sources.some(s => s.authority === source[0]!.authority &&
        s.title === source[0]!.title && s.url === source[0]!.url);
    candidates.push({
      ruleId: item.ruleId, authority: "INPS", taxYear: 2026,
      validFrom: engine.validity.from, validTo: engine.validity.to,
      tickets: [118], scope: item.scope,
      sources: matchesEngine ? source : [],
    });
  }
  candidates.push({
    ruleId: "italy.istat-current-municipalities", authority: "ISTAT", taxYear: null,
    validFrom: "2026-02-21", validTo: "2026-02-21", tickets: [115],
    scope: "Current municipalities on the exact ISTAT 2026-02-21 snapshot day ONLY, no historical birth-date validity",
    sources: findArtifact(115, s => s.authority === "ISTAT" && s.title.includes("Elenco dei comuni italiani")),
  });
  const ade = INVOICE_STAMP_REFERENCE_2024_117.source;
  candidates.push({
    ruleId: "italy.ade-invoice-stamp-2024", authority: "Agenzia delle Entrate",
    taxYear: 2024, validFrom: null, validTo: null, tickets: [117],
    scope: "Archived 2024 agency guidance. Not a proved effective date range or subsequent-year authority",
    sources: [{ authority: ade.authority, title: "2024 invoice stamp archive", url: ade.url, path: ade.artifactPath, sha256: ade.sha256 }],
  });
  for (const item of [
    { ruleId: "italy.istat-suppressed-reference", part: "Elenco comuni soppressi" },
    { ruleId: "italy.istat-foreign-reference", part: "Storico Paesi esteri" },
  ]) candidates.push({
    ruleId: item.ruleId, authority: "ISTAT / SITUAS", taxYear: null,
    validFrom: null, validTo: null, tickets: [115],
    scope: "Partial historical event/candidate records; per-person historical validity unproven",
    sources: findArtifact(115, s => s.authority === "ISTAT / SITUAS" && s.title.includes(item.part)),
  });

  for (const row of candidates) {
    let trusted = row.sources.length > 0 && row.tickets.every(ticket => evidence.has(ticket));
    if (row.sources.length === 0) report("UNPINNED_SOURCE", row.ruleId, "No unique official artifact in canonical snapshot");
    const unlistedPaths: string[] = [];
    const checked: AuditedSource397[] = [];
    for (const source of row.sources) {
      const samePath = row.tickets.flatMap(ticket => {
        const item = evidence.get(ticket);
        const artifacts = [...(item?.artifacts ?? []), ...(item?.frozenOfficialBulkArtifacts ?? [])];
        const checkedAt = ITALY_SOURCE_PACK_DECISIONS.find(pack => pack.ticket === ticket)?.checkedAt;
        return artifacts.filter(entry => entry.path === source.path).map(entry => ({ entry, checkedAt: entry.checkedAt ?? checkedAt }));
      });
      const manifestMatch = samePath.filter(({ entry }) => entry.authority === source.authority &&
        entry.url === source.url && entry.sha256 === source.sha256);
      // An engine-local hash is insufficient to certify an annual official rule
      // unless the same URL, authority and bytes are in the authenticated ledger.
      if (samePath.length === 0) {
        trusted = false;
        unlistedPaths.push(source.path);
      }
      if (samePath.length !== 0 && manifestMatch.length !== 1) {
        report("MANIFEST_SOURCE_CONFLICT", source.path, "Source URL/authority/hash conflicts with authenticated manifest");
        trusted = false;
      }
      const manifestCheckedAt = manifestMatch.length === 1 ? manifestMatch[0]!.checkedAt ?? null : null;
      const urlTrusted = officialUrl(source.authority, source.url);
      if (!urlTrusted) report("UNTRUSTED_URL", source.path, "Host does not match official authority allowlist");
      const checkedHash = urlTrusted && await authenticate(source.path, source.sha256);
      if (!checkedHash) trusted = false;
      checked.push({ ...source, checkedHash, manifestCheckedAt,
        manifestIndex: manifestMatch.length === 1 ? "MATCHED" : "UNLISTED", liveUrlCheck: "NOT_RUN" });
    }
    if (trusted && row.validFrom && row.validTo && validDate(row.validFrom) && validDate(row.validTo) &&
      row.validFrom <= row.validTo &&
      (row.taxYear === null || (Number(row.validFrom.slice(0, 4)) === row.taxYear && Number(row.validTo.slice(0, 4)) === row.taxYear))) {
      verified.push({ ruleId: row.ruleId, authority: row.authority, taxYear: row.taxYear,
        validFrom: row.validFrom, validTo: row.validTo, scope: row.scope, sources: checked });
    } else if (trusted && row.validFrom === null && row.validTo === null) {
      references.push({ ruleId: row.ruleId, authority: row.authority, validFrom: null, validTo: null,
        scope: row.scope, sources: checked });
    } else {
      gaps.push({ ruleId: row.ruleId,
        reason: unlistedPaths.length ? "SOURCE_MISSING_FROM_AUTHENTICATED_LEDGER" : "SOURCE_BYTES_NOT_AUTHENTICATED_OR_RANGE_INVALID",
        scope: unlistedPaths.length
          ? `Missing annual source provenance: ${unlistedPaths.join(", ")}; no rule promoted`
          : "Untrusted source/evidence or invalid interval; no rule promoted: " + row.scope });
    }
  }
  return { status: "PARTIAL_NO_GO", mode: "OFFLINE_PINNED_BYTES_ONLY", verified, references, gaps, violations };
}

/** No nearest-year or last-known-rate fallback: exactly one pinned date match. */
export function resolveAnnualOfficialRule397(ledger: AnnualAudit397, ruleId: string, date: string) {
  const gap = (reason: string, explanation: string) => ({ status: "GAP" as const, reason, explanation });
  if (!validDate(date)) return gap("INVALID_DATE", "Not a real ISO Gregorian date");
  const matches = ledger.verified.filter(r => r.ruleId === ruleId && r.validFrom <= date && date <= r.validTo);
  if (matches.length > 1) return gap("AMBIGUOUS_OVERLAP", "Overlapping periods must not silently prefer latest");
  if (matches.length === 1) return { status: "VERIFIED_SUBSET" as const, record: matches[0]! };
  const explicit = ledger.gaps.filter(g => g.ruleId === ruleId);
  if (explicit.length > 0) return gap("KNOWN_GAP", explicit.map(g => g.scope).join("; "));
  if (ledger.references.some(r => r.ruleId === ruleId)) return gap("REFERENCE_ONLY", "No official effective range proven");
  if (ledger.verified.some(r => r.ruleId === ruleId)) return gap("OUT_OF_VALIDITY", "Date or year outside pinned periods");
  return gap("UNKNOWN_UNSOURCED", "No canonical rule or official source for requested identifier");
}

// Read-only audit CLI, no on-disk output or network.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  auditAnnualOfficialSources397().then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.violations.length !== 0) process.exitCode = 2;
  }, error => {
    process.stderr.write(String(error) + "\n");
    process.exitCode = 2;
  });
}
