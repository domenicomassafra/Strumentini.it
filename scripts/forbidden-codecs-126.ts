/** #126 owner option B: fail if an abandoned codec re-enters product inputs. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const packages = ["heic-to", "mediabunny", "pdfstudio"] as const;
const donors = [
  "src/engines/pdf/vendor/pdfstudio",
  "src/engines/video/vendor/mediabunny-mpl-1.61.3",
] as const;

export function auditForbiddenCodecs126(
  root: string,
  lock: { packages?: Record<string, unknown> },
  manifest: { dependencies?: Record<string, unknown> },
): string[] {
  return [
    ...packages.filter((name) => !!lock.packages?.[`node_modules/${name}`] || !!manifest.dependencies?.[name])
      .map((name) => `FORBIDDEN_CODEC_DEPENDENCY ${name}`),
    ...donors.filter((path) => existsSync(resolve(root, path)))
      .map((path) => `FORBIDDEN_CODEC_ASSET ${path}`),
  ];
}
