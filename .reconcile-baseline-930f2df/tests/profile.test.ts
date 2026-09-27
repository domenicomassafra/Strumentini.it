import { describe, expect, it } from "vitest";
import { businessDayManifest } from "../src/tools/business-day/manifest";
import { resolveToolDefaults } from "../src/runtime/profile";

const summary = (({ implementation: _implementation, ...rest }) => rest)(businessDayManifest);

describe("Work Profile resolution seam", () => {
  it("injects only declared fields and exposes provenance", () => {
    expect(
      resolveToolDefaults(summary, {
        profile: { workweek: ["MON", "TUE"], locale: "it-IT", secret: "must-not-pass" },
      }),
    ).toEqual([
      { field: "workweek", value: ["MON", "TUE"], provenance: "profile" },
      { field: "locale", value: "it-IT", provenance: "profile" },
    ]);
  });

  it("lets explicit task context override the profile", () => {
    const resolved = resolveToolDefaults(summary, {
      explicit: { workweek: ["SUN"] },
      profile: { workweek: ["MON", "TUE", "WED", "THU", "FRI"] },
    });
    expect(resolved[0]).toEqual({ field: "workweek", value: ["SUN"], provenance: "explicit" });
  });
});
