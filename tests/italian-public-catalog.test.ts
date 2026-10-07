import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { TOOL_COPY_IT, missingItalianToolCopy } from "../src/i18n/it/tool-copy";
import { createDefaultWorkProfile } from "../src/profile/work-profile";

describe("catalogo pubblico italiano", () => {
  it("copre tutti gli strumenti pubblici con copy italiano esplicito", () => {
    expect(catalog.length).toBeGreaterThan(0);
    expect(Object.keys(TOOL_COPY_IT)).toHaveLength(catalog.length);
    expect(missingItalianToolCopy(catalog.map(({ id }) => id))).toEqual([]);
  });

  it("espone nome, descrizione e attività dalla sorgente italiana", () => {
    for (const tool of catalog) {
      const copy = TOOL_COPY_IT[tool.id];
      expect(copy).toBeDefined();
      expect(tool.name).toBe(copy?.name);
      expect(tool.summary).toBe(copy?.summary);
      expect(tool.jobs).toEqual([`Usa ${copy?.name}`]);
      expect(tool.aliases).toEqual([copy?.name]);
    }
  });

  it("usa Italia ed euro come valori applicativi predefiniti", () => {
    expect(createDefaultWorkProfile({ locale: "", timezone: "" })).toMatchObject({
      locale: "it-IT",
      currency: "EUR",
      timezone: "UTC",
    });
  });
});
