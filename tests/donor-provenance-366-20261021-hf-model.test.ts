/** #274/#126: a same-origin model weight must be bound to an immutable
 * Hugging Face repository and revision, never to a filename that merely looks
 * plausible. No new donor is adopted by these cases. */
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditVendoredAssets366, parseAssetPins366, type AssetPin366 } from "../scripts/donor-provenance-366";

const registry = parseAssetPins366(readFileSync(resolve("docs/donor-provenance-366-2026-10-11.md"), "utf8"));
const MODEL_PATH = "public/models/portrait-modnet/config.json";
const REVISION = "fa2fa546052fba4c08921230a26cc69a333fca12";

function withPin(altered: Partial<AssetPin366>) {
  const actual = registry.find((item) => item.path === MODEL_PATH);
  if (!actual) throw new Error(`Missing pinned model asset: ${MODEL_PATH}`);
  const root = mkdtempSync(join(tmpdir(), "donor-366-model-"));
  try {
    mkdirSync(join(root, dirname(MODEL_PATH)), { recursive: true });
    copyFileSync(resolve(MODEL_PATH), join(root, MODEL_PATH));
    return auditVendoredAssets366(root, [{ ...actual, ...altered }], ["public/models"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("#366 pinned Hugging Face model assets", () => {
  it("accepts the exact repository, revision and file path", () => {
    expect(registry.find((item) => item.path === MODEL_PATH)?.source).toBe(
      `https://huggingface.co/Xenova/modnet/resolve/${REVISION}/config.json`,
    );
    expect(withPin({}).status).toBe("VERIFIED_METADATA");
  });

  it.each([
    ["another repository", "https://huggingface.co/attacker/modnet/resolve/" + REVISION + "/config.json"],
    ["another revision", "https://huggingface.co/Xenova/modnet/resolve/" + "0".repeat(40) + "/config.json"],
    ["another file in the same revision", "https://huggingface.co/Xenova/modnet/resolve/" + REVISION + "/onnx/model.onnx"],
    ["a credentialed URL", "https://user:pass@huggingface.co/Xenova/modnet/resolve/" + REVISION + "/config.json"],
    ["a query string", "https://huggingface.co/Xenova/modnet/resolve/" + REVISION + "/config.json?download=1"],
    ["a non-HTTPS mirror", "http://huggingface.co/Xenova/modnet/resolve/" + REVISION + "/config.json"],
    ["an unrelated npm tarball", "https://registry.npmjs.org/config.json/-/config.json-1.0.0.tgz"],
  ])("refuses %s", (_label, source) => {
    const result = withPin({ source });
    expect(result.status).toBe("NO_GO");
    expect(result.failures).toContain(`UNKNOWN_ASSET_SOURCE ${MODEL_PATH}`);
  });

  it("refuses a semver version used instead of the pinned revision", () => {
    const result = withPin({ version: "1.0.0" });
    expect(result.status).toBe("NO_GO");
    expect(result.failures).toContain(`UNKNOWN_ASSET_SOURCE ${MODEL_PATH}`);
  });

  it("refuses a model file that is not registered", () => {
    const root = mkdtempSync(join(tmpdir(), "donor-366-model-extra-"));
    try {
      mkdirSync(join(root, "public/models/portrait-modnet/onnx"), { recursive: true });
      copyFileSync(resolve(MODEL_PATH), join(root, "public/models/portrait-modnet/config.json"));
      copyFileSync(resolve("public/models/portrait-modnet/onnx/model_quantized.onnx"),
        join(root, "public/models/portrait-modnet/onnx/model_fp32.onnx"));
      const result = auditVendoredAssets366(root, registry, ["public/models"]);
      expect(result.failures).toContain("UNPINNED_ASSET public/models/portrait-modnet/onnx/model_fp32.onnx");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
