/** Fail before source tests when the pinned independent PDF/A validator cannot run. */
import { spawnSync } from "node:child_process";
import { VERAPDF_IMAGE_419 } from "./pdfa-419.mjs";

for (const args of [
  ["info", "--format", "{{.ServerVersion}}"],
  ["pull", VERAPDF_IMAGE_419],
  ["image", "inspect", VERAPDF_IMAGE_419],
]) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 120000 });
  if (result.error || result.status !== 0) {
    process.stderr.write(`PDF/A preflight failed: docker ${args[0]}: ${result.error?.message ?? result.stderr.trim() ?? "unknown error"}\n`);
    process.exit(1);
  }
}
console.log(`PDF/A independent validator ready: ${VERAPDF_IMAGE_419}`);
