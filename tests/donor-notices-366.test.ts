import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditDistributedNotices366,
  auditDonorNotices366,
  auditNoticeDirectory366,
  DONOR_NOTICES_366,
  verifyDonorNotices366,
} from "../scripts/donor-notices-366";

const root = resolve(import.meta.dirname, "..");

describe("#366 distributed donor notices", () => {
  it("ships every registered notice with pinned bytes in public/licenses", () => {
    expect(auditDonorNotices366(root)).toEqual([]);
    expect(DONOR_NOTICES_366.length).toBeGreaterThan(0);
  });

  it("proves the same notices reach the built artefact", () => {
    const dist = mkdtempSync(join(tmpdir(), "dist-366-"));
    mkdirSync(join(dist, "licenses"));
    expect(auditDistributedNotices366(dist)).toContain(
      "MISSING_NOTICE licenses/ipaddr-303-MIT.txt (ipaddr.js@2.5.0)",
    );
  });

  it("attributes the ipaddr.js donor adopted by #303", () => {
    const notice = DONOR_NOTICES_366.find((entry) => entry.packages.includes("ipaddr.js@2.5.0"));
    expect(notice).toMatchObject({ file: "ipaddr-303-MIT.txt", spdx: "MIT" });
  });
  it("ships byte-pinned MIT notices for the runtime packages found in the distributed bundle", () => {
    for (const [pkg, file] of [
      ["papaparse@5.7.0", "papaparse-126-MIT.txt"],
      ["hash-wasm@4.12.0", "hash-wasm-126-MIT.txt"],
    ]) {
      expect(DONOR_NOTICES_366.find((notice) => notice.packages.includes(pkg))).toMatchObject({
        file, spdx: "MIT",
      });
    }
    expect(auditDonorNotices366(root)).toEqual([]);
  });

  it("fails closed when a registered notice is absent from the build", () => {
    const empty = mkdtempSync(join(tmpdir(), "notices-366-"));
    mkdirSync(join(empty, "public", "licenses"), { recursive: true });
    expect(verifyDonorNotices366(empty)).toContain(
      "MISSING_NOTICE public/licenses/ipaddr-303-MIT.txt (ipaddr.js@2.5.0)",
    );
  });

  it("refuses byte drift and an unregistered licence file", () => {
    const drift = mkdtempSync(join(tmpdir(), "notices-366-"));
    mkdirSync(join(drift, "public", "licenses"), { recursive: true });
    writeFileSync(join(drift, "public", "licenses", "ipaddr-303-MIT.txt"), "MIT\n");
    expect(verifyDonorNotices366(drift)).toContain(
      "NOTICE_BYTES_CHANGED public/licenses/ipaddr-303-MIT.txt",
    );
    expect(auditNoticeDirectory366(drift)).toEqual([]);

    const extra = mkdtempSync(join(tmpdir(), "notices-366-"));
    mkdirSync(join(extra, "public", "licenses"), { recursive: true });
    writeFileSync(join(extra, "public", "licenses", "unattributed.txt"), "MIT\n");
    expect(auditNoticeDirectory366(extra)).toEqual([
      "UNREGISTERED_NOTICE public/licenses/unattributed.txt",
    ]);
  });
});
