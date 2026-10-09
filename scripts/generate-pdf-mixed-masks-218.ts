/** Deterministic actual binary PDF corpus, not production assets.
 * Run: ./node_modules/.bin/tsx scripts/generate-pdf-mixed-masks-218.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mixedImagePdf218, type Mixed218Scenario } from "../tests/fixtures/pdf-mixed-masks-218";

const folder = resolve(import.meta.dirname, "../tests/fixtures/pdf-image-mixed-218");
await mkdir(folder, { recursive: true });
for (const scenario of ["safe", "smask", "multiply", "form", "indexed", "bomb", "uniform"] as const satisfies readonly Mixed218Scenario[]) {
  const bytes = await mixedImagePdf218(scenario);
  await writeFile(resolve(folder, `${scenario}-mixed-218.pdf`), bytes);
  console.log(`${scenario}: ${bytes.byteLength} bytes`);
}
