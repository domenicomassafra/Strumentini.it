import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { rebuildOoxmlPackage } from "../src/engines/ooxml/package-codec";
import { generateDocxFromSemanticText } from "../src/engines/ooxml/office-semantics";

const execFileAsync = promisify(execFile);
const fixtures = ["sample.xlsx", "sample.docx", "sample.pptx"] as const;
const richFixtures = ["complex.docx", "complex.xlsx", "complex.pptx"] as const;
const directory = await mkdtemp(join(tmpdir(), "strumentini-ooxml-reopen-"));

try {
  for (const fixture of fixtures) {
    const source = await readFile(`spikes/heavy-local-feasibility/public/corpus/${fixture}`);
    const input = new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
    const rebuilt = await rebuildOoxmlPackage(input);
    const outputPath = join(directory, fixture);
    await writeFile(outputPath, new Uint8Array(rebuilt.bytes));
    const unzip = await execFileAsync("unzip", ["-t", outputPath]);
    if (!/No errors detected in compressed data/u.test(unzip.stdout)) throw new Error(`${fixture}: independent unzip validation did not pass.`);
    const zipinfo = await execFileAsync("zipinfo", ["-v", outputPath]);
    const methods = [...zipinfo.stdout.matchAll(/compression method:\s+([^\r\n]+)/gu)].map((match) => match[1]?.trim());
    if (methods.length !== rebuilt.output.entryCount || methods.some((method) => method !== "deflated")) {
      throw new Error(`${fixture}: independent zipinfo did not report every member as deflated.`);
    }
    console.log(`${fixture}: PASS ${rebuilt.inputByteLength} -> ${rebuilt.byteLength} (${rebuilt.sizeOutcome}), ${methods.length} DEFLATE members`);
  }
  // #368: import and export authentic rich Office packages without flattening
  // their layout, font declarations, tables, images, charts or relationships.
  // Python's standard-library ZIP and XML readers independently reopen both
  // physical archives and compare *every* member (including embedded media).
  for (const fixture of richFixtures) {
    const sourcePath = `tests/ooxml-68-corpus/${fixture}`;
    const source = await readFile(sourcePath);
    const rebuilt = await rebuildOoxmlPackage(new Uint8Array(source));
    const outputPath = join(directory, `rich-${fixture}`);
    await writeFile(outputPath, new Uint8Array(rebuilt.bytes));
    const { stdout } = await execFileAsync("python3", ["scripts/check-office-rich-reopen-368.py", sourcePath, outputPath]);
    console.log(stdout.trim());
  }
  const generated = await generateDocxFromSemanticText("# Generated\n\n- one\n\n| id | value |\n| --- | --- |\n| 001 | ok |", "markdown");
  const generatedPath = join(directory, "generated-semantic.docx");
  await writeFile(generatedPath, new Uint8Array(generated.bytes));
  const generatedUnzip = await execFileAsync("unzip", ["-t", generatedPath]);
  if (!/No errors detected in compressed data/u.test(generatedUnzip.stdout)) throw new Error("generated-semantic.docx: independent unzip validation did not pass.");
  if (!generated.reopened.text.includes("Generated") || !generated.reopened.text.includes("001\tok")) throw new Error("generated-semantic.docx: semantic reopen did not preserve expected content.");
  console.log(`generated-semantic.docx: PASS ${generated.byteLength} bytes, independent unzip + semantic reopen`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
