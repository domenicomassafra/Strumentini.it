import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { viesUnavailableMessage } from "../src/components/tools/research-knowledge/vies-unavailable-message";

const project = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(project, path), "utf8");

const BOUNDED_REASONS = [
  "VIES_TIMEOUT",
  "VIES_RESPONSE_TOO_LARGE",
  "VIES_RESPONSE_UNREADABLE",
  "VIES_RESPONSE_INVALID",
  "VIES_NETWORK_UNAVAILABLE",
] as const;

describe("#556 VIES unavailable reason is a user-facing Italian sentence", () => {
  it.each(BOUNDED_REASONS)("explains %s in plain Italian instead of echoing the code", (reason) => {
    const message = viesUnavailableMessage(reason);
    expect(message).not.toBe(reason);
    expect(message).not.toMatch(/^[A-Z0-9_]+$/u);
    expect(message).not.toContain(reason);
    expect(message).toMatch(/VIES/iu);
    expect(message).toMatch(/checksum locale resta valido/iu);
    expect(message).toMatch(/[.!]$/u);
  });

  it("names the timeout and the response ceiling explicitly", () => {
    expect(viesUnavailableMessage("VIES_TIMEOUT")).toMatch(/10 secondi/iu);
    expect(viesUnavailableMessage("VIES_RESPONSE_TOO_LARGE")).toMatch(/64 KiB/iu);
  });

  it("never attributes a remote validity for an unavailable reason", () => {
    for (const reason of [...BOUNDED_REASONS, "MS_UNAVAILABLE", "", "VIES_HTTP_503"]) {
      const message = viesUnavailableMessage(reason);
      expect(message).not.toMatch(/risulta valida|validità remota attribuita|valido secondo/iu);
      expect(message).toMatch(/verifica remota|checksum locale/iu);
    }
  });

  it("keeps an unknown service code visible only as a labelled diagnostic", () => {
    const message = viesUnavailableMessage("MS_UNAVAILABLE");
    expect(message).toContain("codice MS_UNAVAILABLE");
    expect(message).toMatch(/verifica remota non è disponibile/iu);
    expect(viesUnavailableMessage("VIES_HTTP_503")).toContain("codice VIES_HTTP_503");
  });

  it("stays understandable when the Worker omits the reason", () => {
    for (const missing of [undefined, "", "   "]) {
      const message = viesUnavailableMessage(missing);
      expect(message).toMatch(/VIES non ha fornito una risposta utilizzabile/iu);
      expect(message).toMatch(/checksum locale resta valido/iu);
    }
  });

  it("is the only path the panel uses to render an unavailable VIES result", () => {
    const panel = source("src/components/tools/research-knowledge/ViesVerificationPanel.tsx");
    expect(panel).toContain('import { viesUnavailableMessage } from "./vies-unavailable-message";');
    expect(panel).toContain("message: viesUnavailableMessage(payload.reason),");
    expect(panel).not.toMatch(/VIES non disponibile \(\$\{payload\.reason/u);
  });

  it("keeps the Worker transport bounds the messages describe", () => {
    const worker = source("worker/vies.ts");
    expect(worker).toContain("AbortSignal.timeout(options.timeoutMs ?? VIES_TIMEOUT_MS)");
    expect(worker).toContain("const VIES_TIMEOUT_MS = 10_000;");
    expect(worker).toContain("const VIES_RESPONSE_MAX_BYTES = 64 * 1024;");
    expect(worker).toContain("await reader.cancel().catch(() => undefined);");
    expect(worker).toContain('return unavailable(vatNumber, retrievedAt, "VIES_RESPONSE_TOO_LARGE");');
  });
});
