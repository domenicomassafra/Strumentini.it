import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseToml, tomlFormatterOperation } from "../src/engines/developer-web";

interface Fixture { readonly id: string; readonly source: string; readonly legacy: "accepted" | "refused"; readonly donor: "accepted" | "refused"; readonly compare?: string }
const tomlCorpus = JSON.parse(await readFile(new URL("./fixtures/toml-277/corpus.json", import.meta.url), "utf8")) as { fixtures: Fixture[] };

describe("STR-277 smol-toml differential corpus", () => {
  it("formats full TOML documents through the pinned smol-toml donor", async () => {
    const cargo = tomlCorpus.fixtures.find((fixture) => fixture.id === "cargo-manifest");
    expect(cargo).toBeDefined();
    const result = await tomlFormatterOperation(cargo!.source);
    const value = result.value as Record<string, any>;
    expect(value.package.name).toBe("strumentini-core");
    expect(value.package.description).toContain("Utility local-first");
    expect(value.dependencies.serde).toEqual({ version: "1.0", features: ["derive"] });
    expect(value.dependencies.tokio.features).toEqual(["rt-multi-thread"]);
    expect(value.bin).toEqual([{ name: "strumentini", path: "src/main.rs" }]);
    expect(result.formatted).toContain("[[bin]]");
    expect(result.formatted).toContain("[profile.release]");
    expect(value.profile.release.incremental).toBe(false);
  });

  it("matches the legacy accepted TOML subset and refuses the same invalid documents", async () => {
    for (const fixture of tomlCorpus.fixtures) {
      let legacyValue: unknown;
      let legacyError: unknown;
      try {
        legacyValue = parseToml(fixture.source).value;
      } catch (error) {
        legacyError = error;
      }
      expect(legacyError === undefined, `${fixture.id}: legacy outcome`).toBe(fixture.legacy === "accepted");
      if (fixture.donor === "refused") {
        await expect(tomlFormatterOperation(fixture.source)).rejects.toMatchObject({ code: "INVALID_TOML" });
        continue;
      }
      const result = await tomlFormatterOperation(fixture.source);
      if (fixture.legacy === "accepted" && fixture.compare !== "date-precision") {
        expect(result.value, `${fixture.id}: donor value`).toEqual(legacyValue);
      }
      // Canonical output must round-trip through the donor without losing keys or values.
      const roundTrip = await tomlFormatterOperation(String(result.formatted));
      expect(roundTrip.value, `${fixture.id}: round trip`).toEqual(result.value);
    }
  });

  it("preserves typed TOML diagnostics and the local safety limits", async () => {
    await expect(tomlFormatterOperation("a = 1\na = 2\n")).rejects.toMatchObject({
      code: "INVALID_TOML",
      diagnostic: { line: 2, column: 1 },
    });
    await expect(tomlFormatterOperation(`a = ${"[".repeat(17)}1${"]".repeat(17)}`)).rejects.toMatchObject({ code: "INVALID_TOML" });
    await expect(tomlFormatterOperation("a".repeat(1_000_001))).rejects.toMatchObject({ code: "INPUT_TOO_LARGE" });
    const controller = new AbortController();
    controller.abort();
    await expect(tomlFormatterOperation("a = 1\n", controller.signal)).rejects.toHaveProperty("name", "AbortError");
  });

  it("keeps donor-parsed TOML keys from traversing object prototypes", async () => {
    const prototype = Object.prototype as Record<string, unknown>;
    delete prototype.polluted;
    try {
      const result = await tomlFormatterOperation("__proto__.polluted = true\n[constructor.prototype.x]\ny = 1\n");
      expect(Object.hasOwn(result.value as object, "__proto__")).toBe(true);
      expect(prototype.polluted).toBeUndefined();
    } finally {
      delete prototype.polluted;
    }
  });

});
