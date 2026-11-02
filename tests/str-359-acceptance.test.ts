import { describe, expect, it } from "vitest";
import render from "preact-render-to-string";
import { h } from "preact";
import { runFilePrivacyOperation } from "../src/engines/file-privacy";
import { ToolResultPanel } from "../src/components/tools/shared/ToolResultPanel";

describe("STR-359 stati veritieri nel pannello risultati", () => {
  it("distingue vuoto, elaborazione, annullamento, errore e successo accessibili", () => {
    for (const [state, label] of [
      ["idle", "In attesa"], ["running", "In elaborazione"],
      ["cancelled", "Annullata"], ["error", "Errore"], ["success", "Completato"],
    ] as const) {
      const html = render(h(ToolResultPanel, {
        eyebrow: "Nomi file — risultato", placeholder: state === "idle" ? "In attesa" : "Nessun risultato prodotto",
        state, busy: state === "running",
      }));
      expect(html).toContain(`data-state="${state}"`);
      expect(html).toContain(label);
      if (state !== "idle") expect(html).toContain(`data-result-state="${state}"`);
      if (state !== "success") expect(html).not.toContain("data-result-class=");
    }
  });

  it("produce un risultato solo per input validi, senza alterare i nomi originali", async () => {
    const names = ["report?.txt", "foto 2026.png"];
    const before = names.slice();
    const result = await runFilePrivacyOperation("filename-sanitizer", { names });
    expect(result.operation).toBe("filename-sanitizer");
    expect(Array.isArray(result.entries)).toBe(true);
    expect((result.entries as Array<{ sanitized: string }>).map((entry) => entry.sanitized)).toEqual(["report-.txt", "foto 2026.png"]);
    expect(names).toEqual(before);
  });
});
