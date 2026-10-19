import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const comparator = "scripts/check-office-rich-reopen-368.py";
const corpus = "tests/ooxml-68-corpus";

describe("#368 independent rich OOXML archive readback", () => {
  it.each(["docx", "xlsx", "pptx"] as const)(
    "accepts identical rich %s bytes with charts, media, layout and font parts",
    (extension) => {
      const fixture = `${corpus}/complex.${extension}`;
      const output = execFileSync("python3", [comparator, fixture, fixture], { encoding: "utf8" });
      expect(output).toContain("OFFICE368_REOPEN_PASS");
      expect(output).toContain('"allPartsByteIdentical": true');
      expect(output).toContain('"visualPageFidelity": "NOT_RENDERED"');
    },
  );

  it("rejects a valid repack that silently changes an embedded DOCX image", () => {
    const directory = mkdtempSync(join(tmpdir(), "office368-compare-negative-"));
    const original = `${corpus}/complex.docx`;
    const changed = join(directory, "changed.docx");
    try {
      // Python's independent ZIP writer updates CRC and preserves the other
      // entries: a zip-valid output must still fail the fidelity comparator.
      execFileSync("python3", ["-c", String.raw`
import sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as src, zipfile.ZipFile(sys.argv[2], 'w', compression=zipfile.ZIP_DEFLATED) as dst:
    for part in src.infolist():
        payload=src.read(part.filename)
        if part.filename=='word/media/image1.png':
            payload=payload[:-1] + bytes([payload[-1] ^ 1])
        dst.writestr(part, payload)
`, original, changed]);
      const result = spawnSync("python3", [comparator, original, changed], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("OFFICE368_PART_CHANGED:word/media/image1.png");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
