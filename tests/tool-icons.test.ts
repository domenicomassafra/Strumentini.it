import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { categoryIconKey, toolIconKey, toolIconSvg } from "../src/ui/tool-icons";

describe("tool icon vocabulary", () => {
  it("assigns a stable semantic icon to every public tool", () => {
    expect(catalog.length).toBeGreaterThan(0);
    for (const tool of catalog) {
      expect(toolIconKey(tool)).toBeTruthy();
      expect(toolIconSvg(tool)).toMatch(/^<svg /u);
      expect(toolIconSvg(tool)).not.toContain(tool.name);
    }
  });

  it("uses specific semantics before the category fallback", () => {
    expect(toolIconKey({ id: "pdf-merge", category: "documents" })).toBe("document");
    expect(toolIconKey({ id: "utm-builder", category: "marketing" })).toBe("link");
    expect(toolIconKey({ id: "margin-markup", category: "client-work-math" })).toBe("calculator");
    expect(toolIconKey({ id: "qr-generator", category: "marketing" })).toBe("qr");
    expect(toolIconKey({ id: "barcode-generator", category: "marketing" })).toBe("qr");
    expect(categoryIconKey("research")).toBe("research");
  });
});
