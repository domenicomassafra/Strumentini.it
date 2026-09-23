import { describe, expect, it } from "vitest";
import { buildCampaignName, buildUtmUrl, cleanTrackingParameters, parseCampaignFieldOrder } from "../src/engines/campaign-url";

describe("campaign URL engine", () => {
  it("builds canonical UTM URLs while preserving unrelated URL semantics", () => {
    expect(buildUtmUrl("https://example.com/landing?ref=site#frag", { source: "newsletter", medium: "email", campaign: "fall sale" })).toBe("https://example.com/landing?ref=site&utm_source=newsletter&utm_medium=email&utm_campaign=fall+sale#frag");
  });
  it("preserves repeated unrelated params and is cleaner-idempotent", () => {
    const once = cleanTrackingParameters("https://example.com/?a=1&a=2&utm_source=x&GCLID=t#frag");
    expect(once).toEqual({ url: "https://example.com/?a=1&a=2#frag", dropped: ["utm_source", "GCLID"] });
    expect(cleanTrackingParameters(once.url).url).toBe(once.url);
  });
  it("normalizes Unicode campaign parts under an explicit preset", () => {
    expect(buildCampaignName({ fields: ["client", "campaign", "market"], separator: "_", lowercase: true }, { client: "Café", campaign: "Fall Sale", market: "IT" })).toBe("café_fall-sale_it");
  });
  it("rejects invalid urls and naming schemas", () => {
    expect(() => buildUtmUrl("not a url", { source: "a", medium: "b", campaign: "c" })).toThrow();
    expect(() => parseCampaignFieldOrder("client,nope")).toThrow("INVALID_NAMING_PRESET");
    expect(() => buildCampaignName({ fields: ["client"], separator: "-", lowercase: true }, {})).toThrow("MISSING_NAMING_VALUE");
  });
});
