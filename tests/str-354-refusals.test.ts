import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog } from "../src/generated/catalog";
import { fileSuggestions335 } from "../src/components/home/file-suggestions-335";
import { detectLocalFile } from "../src/runtime/file-detection";

const published = new Set(
  readdirSync(new URL("../src/pages/tools/", import.meta.url))
    .filter((name) => name.endsWith(".astro"))
    .map((name) => "/tools/" + name.slice(0, -6)),
);

describe("#115 / STR-354: honest file refusals", () => {
  it("refuses unknown content instead of suggesting an unverified operation", async () => {
    const secret = "UNSUPPORTED_PRIVATE_CONTENT_354";
    const outcome = await detectLocalFile(new File([secret], "sconosciuto.xyz", { type: "application/octet-stream" }));
    expect(outcome.status).toBe("refused");
    if (outcome.status !== "refused") throw new Error("unexpected supported file");
    expect(outcome.reason).toBe("UNSUPPORTED");
    expect(fileSuggestions335(outcome, catalog, published)).toEqual([]);
  });

  it("recognizes an Office file as non-routable rather than offering the wrong local engine", () => {
    const outcome = {
      status: "supported" as const, format: "docx" as const,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: "private.docx", bytes: 800, readBytes: 800,
      method: "bounded-signature-and-container-metadata" as const,
      note: "candidate only; decoding and content safety are not verified",
    };
    expect(fileSuggestions335(outcome, catalog, published)).toEqual([]);
  });
});
