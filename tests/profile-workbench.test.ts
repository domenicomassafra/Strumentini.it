import { describe, expect, it } from "vitest";
import { businessDayManifest } from "../src/tools/business-day/manifest";
import { resolveToolDefaults } from "../src/runtime/profile";
import {
  createDefaultWorkProfile,
  profileValuesForTool,
  updateWorkProfile,
} from "../src/profile/work-profile";

const summary = (({ implementation: _implementation, ...rest }) => rest)(businessDayManifest);

describe("persistent Work Profile seam", () => {
  it("contains only canonical safe fields and gives a tool only declared values", () => {
    const profile = updateWorkProfile(
      createDefaultWorkProfile({ locale: "it-IT", timezone: "Europe/Rome" }),
      { currency: "EUR", workweek: ["MON", "TUE", "WED", "THU"] },
    );
    expect(Object.keys(profile).sort()).toEqual([
      "currency",
      "dateFormat",
      "locale",
      "numberFormat",
      "preferredUnits",
      "timezone",
      "workweek",
    ]);
    expect(profileValuesForTool(summary, profile)).toEqual({
      workweek: ["MON", "TUE", "WED", "THU"],
      locale: "it-IT",
    });
  });

  it("keeps an explicit current-task override authoritative", () => {
    const profile = updateWorkProfile(
      createDefaultWorkProfile({ locale: "it-IT", timezone: "Europe/Rome" }),
      { workweek: ["MON", "TUE", "WED", "THU"] },
    );
    const resolved = resolveToolDefaults(summary, {
      explicit: { workweek: ["SUN"] },
      profile: profileValuesForTool(summary, profile),
    });
    expect(resolved[0]).toEqual({ field: "workweek", value: ["SUN"], provenance: "explicit" });
  });
});
