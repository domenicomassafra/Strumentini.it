/** Required STR-375 browser acceptance: built UI, offline local save and independent renderers. */
import { spawnSync } from "node:child_process";
import "../scripts/acceptance-str-375.browser.mjs";

const crop = spawnSync(process.execPath, ["--import", "tsx", "scripts/acceptance-str-375-crop.ts"],
  { stdio: "inherit", timeout: 120_000 });
if (crop.error) throw crop.error;
if (crop.status !== 0) throw new Error("Independent PDF.js/Poppler rotated-crop comparison failed: " + crop.status);
console.log("STR-375 consumer PASS: interactive build + independent rotated-crop renderers");
