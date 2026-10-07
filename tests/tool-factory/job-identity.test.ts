import { describe, expect, it } from "vitest";
import {
  assertCanonicalJobIdentities,
  evaluateJobIdentityPolicy,
  type JobIdentityCandidate,
} from "../../src/tool-factory/job-identity";

const base: JobIdentityCandidate = {
  id: "compress-image",
  route: "/tools/compress-image",
  engine: "image-codec",
  intent: "comprimere un'immagine",
  jobs: ["comprimere immagine"],
  aliases: ["riduci peso immagine"],
  inputs: ["image"],
  outputs: ["image"],
};

describe("canonical job identity policy", () => {
  it("rejects equivalent intent without a material user-facing difference", () => {
    const duplicate: JobIdentityCandidate = {
      ...base,
      id: "image-compressor",
      route: "/tools/image-compressor",
      aliases: ["alleggerisci foto"],
      jobs: ["ottimizzare immagine"],
    };
    const report = evaluateJobIdentityPolicy([base, duplicate]);
    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.reason).join(" ")).toMatch(/equivalent intent/u);
  });

  it("rejects alias-only route duplication", () => {
    const duplicate: JobIdentityCandidate = {
      ...base,
      id: "reduce-image-size",
      route: "/tools/reduce-image-size",
      intent: "ottimizzare una foto",
      jobs: ["ottimizzare foto"],
      aliases: ["riduci peso immagine"],
    };
    expect(() => assertCanonicalJobIdentities([base, duplicate])).toThrow(/alias-only route split/u);
  });

  it("allows one shared engine when routes document a different default or result job", () => {
    const jpeg: JobIdentityCandidate = {
      ...base,
      id: "compress-jpeg",
      route: "/tools/compress-jpeg",
      intent: "comprimere un'immagine",
      jobs: ["comprimere jpeg"],
      aliases: ["riduci jpg"],
      routeDifferences: [{ kind: "default", description: "Defaults to JPEG-native lossy controls and preserves JPEG output." }],
    };
    const png: JobIdentityCandidate = {
      ...base,
      id: "compress-png",
      route: "/tools/compress-png",
      intent: "comprimere un'immagine",
      jobs: ["comprimere png"],
      aliases: ["riduci png"],
      routeDifferences: [{ kind: "result", description: "Uses lossless/palette PNG modes and preserves alpha." }],
    };
    expect(evaluateJobIdentityPolicy([jpeg, png])).toEqual({ ok: true, issues: [] });
  });

  it("works on unpublished synthetic future manifests", () => {
    const future: JobIdentityCandidate = {
      id: "future-heic-jpg",
      route: "/tools/heic-in-jpg",
      engine: "future-image-codec",
      intent: "convertire heic in jpg",
      jobs: ["convertire foto iphone in jpg"],
      aliases: ["heic to jpeg"],
      inputs: ["image/heic"],
      outputs: ["image/jpeg"],
    };
    expect(() => assertCanonicalJobIdentities([future])).not.toThrow();
  });
});
