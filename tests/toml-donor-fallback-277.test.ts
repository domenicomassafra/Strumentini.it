import { describe, expect, it, vi } from "vitest";

describe("STR-277: donor chunk unavailable", () => {
  it("uses the bounded legacy subset with an explicit warning", async () => {
    vi.resetModules();
    vi.doMock("smol-toml", () => {
      throw new Error("simulated offline dynamic chunk");
    });
    try {
      const { tomlFormatterOperation, TOML_LEGACY_FALLBACK_WARNING } = await import("../src/engines/developer-web/structured-data");
      const result = await tomlFormatterOperation("[owner]\nname = \"Ada\"\n");
      expect(result.value).toEqual({ owner: { name: "Ada" } });
      expect(result.warnings).toContain(TOML_LEGACY_FALLBACK_WARNING);
      await expect(tomlFormatterOperation("a = 1\na = 2\n")).rejects.toHaveProperty("code", "INVALID_TOML");
    } finally {
      vi.doUnmock("smol-toml");
      vi.resetModules();
    }
  });
});
