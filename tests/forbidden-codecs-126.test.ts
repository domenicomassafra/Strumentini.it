import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { auditForbiddenCodecs126 } from "../scripts/forbidden-codecs-126";

const root = mkdtempSync(join(tmpdir(), "strume126-donors-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("#126 owner option B: prevent removed codecs from re-entering production", () => {
  it("accepts a tree with no forbidden donors or locked production codecs", () => {
    expect(auditForbiddenCodecs126(root, { packages: {} }, { dependencies: {} })).toEqual([]);
  });

  it("refuses direct and transitive package reinstalls", () => {
    const failures = auditForbiddenCodecs126(
      root,
      { packages: { "node_modules/mediabunny": { version: "1.61.3" }, "node_modules/pdfstudio": { version: "0.4.0" } } },
      { dependencies: { "heic-to": "^1.6.5" } },
    );
    expect(failures).toEqual([
      "FORBIDDEN_CODEC_DEPENDENCY heic-to",
      "FORBIDDEN_CODEC_DEPENDENCY mediabunny",
      "FORBIDDEN_CODEC_DEPENDENCY pdfstudio",
    ]);
  });

  it("refuses donor payload directories even with an otherwise empty lockfile", () => {
    mkdirSync(join(root, "src/engines/pdf/vendor/pdfstudio"), { recursive: true });
    mkdirSync(join(root, "src/engines/video/vendor/mediabunny-mpl-1.61.3"), { recursive: true });
    expect(auditForbiddenCodecs126(root, {}, {})).toEqual([
      "FORBIDDEN_CODEC_ASSET src/engines/pdf/vendor/pdfstudio",
      "FORBIDDEN_CODEC_ASSET src/engines/video/vendor/mediabunny-mpl-1.61.3",
    ]);
  });
});
