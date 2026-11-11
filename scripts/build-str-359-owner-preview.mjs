import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Copies the isolated design-only source to a local build artifact. The Astro
// application and published routes do not import the owner-choice prototype.
const source = resolve("design/str-359-owner-preview");
const target = resolve("dist/str-359-owner-preview");
await mkdir(target, { recursive: true });
for (const file of ["index.html", "preview.css", "preview.js"]) {
  await copyFile(resolve(source, file), resolve(target, file));
}
console.log(`STR-359 design preview built locally: ${target}/index.html`);
