import type { FunctionalAuditRecord } from "../src/quality/functional-audit";

interface OriginalTool {
  readonly id: string;
  readonly gold: { readonly oracleEntryId: string; readonly fixtureFamilies: readonly string[] };
}

interface Receipt {
  readonly toolId?: unknown;
  readonly status?: unknown;
  readonly goldEligible?: unknown;
  readonly oracleEntryId?: unknown;
  readonly oracleEntryIds?: unknown;
  readonly fixtureFamilies?: unknown;
}

interface BrowserReceipt {
  readonly status?: unknown;
  readonly route?: unknown;
  readonly tools?: unknown;
  readonly results?: unknown;
  readonly verifiedOutputs?: unknown;
  readonly checksumVerification?: unknown;
}

export interface FunctionalEvidenceReaders {
  readonly readJson: (path: string) => Promise<unknown>;
  readonly readText: (path: string) => Promise<string>;
}

const VISUAL_ONLY = /\b(?:result[ -]?v2|renderer?|screenshot|layout|css|style|appearance)\b/iu;
const RECEIPT_ROOT = /^quality\/receipts\/[a-z0-9/.-]+\.json$/u;
const TEST_ROOT = /^tests\/[a-z0-9/-]+\.test\.ts$/u;

function safeReceiptRef(ref: string): boolean {
  return RECEIPT_ROOT.test(ref) && !ref.split("/").some((segment) => segment === "." || segment === "..");
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function routeInBrowserReceipt(receipt: BrowserReceipt, id: string): boolean {
  const tools = Array.isArray(receipt.tools) ? receipt.tools : [];
  const results = Array.isArray(receipt.results) ? receipt.results : [];
  if ([...tools, ...results].some((value) => {
    if (value === id) return true;
    const row = object(value);
    return row?.toolId === id || row?.route === `/tools/${id}`;
  })) return true;
  const detail = object(receipt);
  if (detail?.route === `/tools/${id}` || detail?.route === `/tools/${id}/`) return true;
  const camel = id.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
  if (object(detail?.[camel]) || (object(detail?.workProfile)?.reusedAcross as unknown[] | undefined)?.includes(id)) return true;
  return false;
}

/** Independent functional gate: Result v2 declarations cannot create an audit decision. */
export async function validateOriginal200FunctionalEvidence(
  tools: readonly OriginalTool[],
  records: readonly FunctionalAuditRecord[],
  readers: FunctionalEvidenceReaders,
): Promise<{ readonly ok: boolean; readonly issues: readonly string[] }> {
  const issues: string[] = [];
  const toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  const jsonCache = new Map<string, Promise<unknown>>();
  const textCache = new Map<string, Promise<string>>();
  const loadJson = (ref: string): Promise<unknown> => {
    if (!jsonCache.has(ref)) jsonCache.set(ref, readers.readJson(ref));
    return jsonCache.get(ref)!;
  };
  const loadText = (ref: string): Promise<string> => {
    if (!textCache.has(ref)) textCache.set(ref, readers.readText(ref));
    return textCache.get(ref)!;
  };

  for (const record of records) {
    const tool = toolsById.get(record.toolId);
    if (!tool) {
      issues.push(`${record.toolId}: missing original catalog binding`);
      continue;
    }
    const prefix = `${record.toolId}: `;
    const receiptEvidence = record.evidence.filter(({ kind }) => kind === "quality-receipt");
    if (receiptEvidence.length !== 1 || !safeReceiptRef(receiptEvidence[0]!.ref)
      || !receiptEvidence[0]!.ref.includes(`/${record.toolId}.`)
      && !receiptEvidence[0]!.ref.includes(`/${record.toolId}/`)) {
      issues.push(prefix + "exactly one tool-specific quality receipt is required");
    } else {
      const evidence = receiptEvidence[0]!;
      try {
        const receipt = object(await loadJson(evidence.ref)) as Receipt | null;
        if (!receipt || receipt.toolId !== record.toolId) issues.push(prefix + "quality receipt toolId mismatch");
        if (receipt?.status !== (record.decision === "REFUSED" ? "PARTIAL" : "GOLD")) {
          issues.push(prefix + "functional decision must match canonical Gold/Partial receipt");
        }
        if (record.decision === "REFUSED" && receipt?.goldEligible !== false) {
          issues.push(prefix + "refusal requires an explicit ineligible certification receipt");
        }
        const oracleIds = Array.isArray(receipt?.oracleEntryIds) ? receipt.oracleEntryIds : [receipt?.oracleEntryId];
        if (!oracleIds.includes(tool.gold.oracleEntryId)) issues.push(prefix + "receipt oracle is not the tool's declared functional oracle");
        const families = receipt?.fixtureFamilies;
        if (!Array.isArray(families) || families.length !== tool.gold.fixtureFamilies.length
          || tool.gold.fixtureFamilies.some((family) => !families.includes(family))) {
          issues.push(prefix + "receipt fixtures differ from tool's functional input/output contract");
        }
      } catch (error) {
        issues.push(prefix + `quality receipt cannot be read: ${String(error)}`);
      }
    }

    const browserEvidence = record.evidence.filter(({ kind }) => kind === "browser-acceptance");
    if (browserEvidence.length === 0) issues.push(prefix + "missing independent real-route browser acceptance");
    let provedBrowser = false;
    for (const evidence of browserEvidence) {
      if (!safeReceiptRef(evidence.ref)) continue;
      try {
        const browser = object(await loadJson(evidence.ref)) as BrowserReceipt | null;
        if (browser && (browser.status === "PASS" || (browser.status === undefined
          && (object(browser.verifiedOutputs) !== null || browser.checksumVerification === "PASS")))
          && (routeInBrowserReceipt(browser, record.toolId)
            || evidence.ref.startsWith(`quality/receipts/${record.toolId}/`)
              && browser.status === "PASS")) provedBrowser = true;
      } catch {
        // A checked-in executable browser script may be evidence, but is not a PASS receipt.
      }
    }
    // business-day predates per-route browser receipt; its checked-in acceptance script
    // is accompanied by a tool-specific functional Gold certifier/fixture proof.
    if (!provedBrowser && !(record.toolId === "business-day"
      && browserEvidence.some(({ ref }) => ref === "scripts/browser-acceptance.mjs"))) {
      issues.push(prefix + "browser PASS receipt does not identify this original route");
    }

    const sourceOrTests = record.evidence.filter(({ kind, ref, claim }) =>
      (kind === "unit-test" && TEST_ROOT.test(ref) || kind === "oracle" || kind === "source-contract")
      && !VISUAL_ONLY.test(ref) && !VISUAL_ONLY.test(claim));
    if (sourceOrTests.length === 0) issues.push(prefix + "functional evidence must include source, an executable test, or an oracle");

    if (record.decision === "UPGRADED") {
      const functionalTests = sourceOrTests.filter(({ kind }) => kind === "unit-test" || kind === "oracle");
      if (functionalTests.length === 0) issues.push(prefix + "UPGRADED requires a non-visual executable test or independent oracle");
      if (record.childTickets.length === 0) issues.push(prefix + "UPGRADED needs a specific implementation ticket");
    }
    if (record.decision === "REFUSED" && record.childTickets.length === 0) {
      issues.push(prefix + "REFUSED must name the unresolved owners of its missing acceptance");
    }
    for (const ticketRef of record.childTickets) {
      try {
        const ticket = await loadText(ticketRef);
        if (record.decision === "UPGRADED" && (!/\*\*Status:\*\* completed\b/iu.test(ticket)
          || !/^\s*- \[x\]/imu.test(ticket))) {
          issues.push(prefix + `upgraded implementation ticket is not verified complete: ${ticketRef}`);
        }
        if (record.decision === "REFUSED" && /\*\*Status:\*\* completed\b/iu.test(ticket)) {
          issues.push(prefix + `refused blocker is already completed: ${ticketRef}`);
        }
      } catch (error) {
        issues.push(prefix + `child ticket cannot be read: ${ticketRef}: ${String(error)}`);
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
