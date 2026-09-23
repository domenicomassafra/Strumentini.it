import { describe, expect, it } from "vitest";
import { createDefaultWorkProfile, profileValuesForTool, updateWorkProfile } from "../src/profile/work-profile";
import { resolveToolDefaults } from "../src/runtime/profile";
import { businessDayManifest } from "../src/tools/business-day/manifest";
import { marginMarkupManifest } from "../src/tools/margin-markup/manifest";
import { rateConverterManifest } from "../src/tools/rate-converter/manifest";
import { timezoneOverlapManifest } from "../src/tools/timezone-overlap/manifest";

describe("client/time/math Work Profile declared-field seam", () => {
  const profile = updateWorkProfile(
    createDefaultWorkProfile({ locale: "it-IT", timezone: "Europe/Rome" }),
    { currency: "EUR", workweek: ["MON", "TUE", "WED", "THU"] },
  );

  it("projects only the fields each tool declares across the four-tool family", () => {
    expect(profileValuesForTool(businessDayManifest, profile)).toEqual({
      workweek: ["MON", "TUE", "WED", "THU"],
      locale: "it-IT",
    });
    expect(profileValuesForTool(timezoneOverlapManifest, profile)).toEqual({ timezone: "Europe/Rome" });
    expect(profileValuesForTool(rateConverterManifest, profile)).toEqual({ currency: "EUR" });
    expect(profileValuesForTool(marginMarkupManifest, profile)).toEqual({ currency: "EUR" });
  });

  it("combines declared profile values with visible tool defaults and no unrelated profile state", () => {
    expect(resolveToolDefaults(timezoneOverlapManifest, {
      profile: profileValuesForTool(timezoneOverlapManifest, profile),
    })).toEqual([
      { field: "timezone", value: "Europe/Rome", provenance: "profile" },
      { field: "workingHours", value: { start: "09:00", end: "17:00" }, provenance: "tool-default" },
    ]);

    expect(resolveToolDefaults(rateConverterManifest, {
      profile: profileValuesForTool(rateConverterManifest, profile),
    })).toEqual([
      { field: "currency", value: "EUR", provenance: "profile" },
      { field: "hoursPerDay", value: "8", provenance: "tool-default" },
    ]);
  });

  it("keeps explicit current-task overrides authoritative", () => {
    expect(resolveToolDefaults(timezoneOverlapManifest, {
      explicit: { timezone: "America/New_York", workingHours: { start: "10:00", end: "18:00" } },
      profile: profileValuesForTool(timezoneOverlapManifest, profile),
    })).toEqual([
      { field: "timezone", value: "America/New_York", provenance: "explicit" },
      { field: "workingHours", value: { start: "10:00", end: "18:00" }, provenance: "explicit" },
    ]);
  });
});
