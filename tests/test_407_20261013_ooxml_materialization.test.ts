/** #407 — raw OOXML consumers must refuse malicious central-directory metadata
 * before fflate materializes archive entries. The constructed files are real ZIPs.
 */
import { describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { analyzeOoxmlPackage, OoxmlPackageError } from "../src/engines/ooxml/package";
import { rebuildOoxmlPackage } from "../src/engines/ooxml/package-codec";
import { checkZipEntryType407, checkZipPath407 } from "../src/runtime/file-threat-gate-407";

const core: Zippable = {
  "[Content_Types].xml": strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
  "_rels/.rels": strToU8("<Relationships/>"),
  "word/document.xml": strToU8("<w:document/>"),
};

const makeDocx = (extra: Zippable = {}) => zipSync({ ...core, ...extra }, { level: 6 });

describe("#407 OOXML direct raw archive pre-materialization barrier", () => {
  it.each([
    ["NFKC fullwidth dot-dot escapes the member parent", "word/．．/outside.xml"],
    ["Windows console device under document tree", "word/CONOUT$.txt"],
    ["NFKC encoded separator changes the member path", "word／outside.xml"],
  ])("refuses %s before direct OOXML engine ZIP materialization", async (_, name) => {
    const bytes = makeDocx({ [name]: strToU8("danger") });
    expect(Object.hasOwn(unzipSync(bytes), name)).toBe(true);
    expect(checkZipPath407(name)).not.toBeNull();
    expect(() => analyzeOoxmlPackage(bytes)).toThrowError(
      expect.objectContaining<Partial<OoxmlPackageError>>({ code: "UNSAFE_PACKAGE_PATH" }),
    );
    await expect(rebuildOoxmlPackage(bytes)).rejects.toMatchObject({ code: "UNSAFE_PACKAGE_PATH" });
  });

  it("refuses two distinct ZIP entries mapping to the same normalized filename", () => {
    const bytes = makeDocx({
      "word/report.xml": strToU8("ordinary"),
      "word/ｒｅｐｏｒｔ.xml": strToU8("shadow"),
    });
    const names = Object.keys(unzipSync(bytes));
    expect(names).toContain("word/report.xml");
    expect(names).toContain("word/ｒｅｐｏｒｔ.xml");
    expect(names.filter((name) => name.normalize("NFKC").toLowerCase() === "word/report.xml")).toHaveLength(2);
    expect(() => analyzeOoxmlPackage(bytes)).toThrowError(
      expect.objectContaining<Partial<OoxmlPackageError>>({ code: "CORRUPT_PACKAGE" }),
    );
  });

  it("refuses a regular ZIP member masking its own descendant package directory", () => {
    const bytes = makeDocx({ "word": strToU8("this is a regular file, not the parent directory") });
    const members = unzipSync(bytes);
    expect(members.word).toEqual(strToU8("this is a regular file, not the parent directory"));
    expect(members["word/document.xml"]).toBeDefined();
    expect(() => analyzeOoxmlPackage(bytes)).toThrowError(
      expect.objectContaining<Partial<OoxmlPackageError>>({ code: "UNSAFE_PACKAGE_PATH" }),
    );
  });

  it("refuses real UNIX symbolic link attributes before expanding any OOXML member", async () => {
    const name = "word/media/asset.dat";
    const unixSymlink: [Uint8Array, { os: 3; attrs: number; level: 6 }] = [
      strToU8("../../../../private-file"), { os: 3, attrs: (0o120777 << 16) >>> 0, level: 6 },
    ];
    const bytes = makeDocx({ [name]: unixSymlink });
    expect(unzipSync(bytes)[name]).toEqual(strToU8("../../../../private-file"));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocd = bytes.length - 22;
    let cursor = view.getUint32(eocd + 16, true);
    let found = false;
    for (let i = 0; i < view.getUint16(eocd + 10, true); i++) {
      const nameSize = view.getUint16(cursor + 28, true);
      const centralName = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameSize));
      if (centralName === name) {
        found = true;
        expect(checkZipEntryType407(view.getUint16(cursor + 4, true), view.getUint32(cursor + 38, true), name))
          .toMatchObject({ reason: "UNSUPPORTED" });
        break;
      }
      cursor += 46 + nameSize + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    }
    expect(found).toBe(true);
    expect(() => analyzeOoxmlPackage(bytes)).toThrowError(
      expect.objectContaining<Partial<OoxmlPackageError>>({ code: "UNSAFE_PACKAGE_PATH" }),
    );
    await expect(rebuildOoxmlPackage(bytes)).rejects.toMatchObject({ code: "UNSAFE_PACKAGE_PATH" });
  });

  it("keeps safe real DOCX content accepted and preserves exact bytes through the unchanged rebuild consumer", async () => {
    const bytes = makeDocx({ "word/media/picture.bin": strToU8("safe media") });
    expect(analyzeOoxmlPackage(bytes)).toMatchObject({ kind: "docx", entryCount: 4 });
    const rebuilt = await rebuildOoxmlPackage(bytes);
    expect(unzipSync(new Uint8Array(rebuilt.bytes))["word/media/picture.bin"]).toEqual(strToU8("safe media"));
  });
});
