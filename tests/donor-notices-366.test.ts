import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditBundleNoticeCoverage366,
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
    ] as const) {
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

  it("reports a bundled npm module without a shipped license notice", () => {
    const packages = [{
      name: "example", version: "1.2.3", license: "MIT",
      source: "https://registry.npmjs.org/example/-/example-1.2.3.tgz",
      integrity: "sha512-pinned",
    }];
    const notice = [{
      file: "example-MIT.txt", packages: ["example@1.2.3"], spdx: "MIT",
      upstream: "https://github.com/example/example", sha256: "a".repeat(64), marker: "Example",
    }];
    const missing = auditBundleNoticeCoverage366(["example@1.2.3"], packages, []);
    expect(missing[0]).toMatchObject({ status: "NO_GO", failures: ["MISSING_BUNDLED_NOTICE"] });
    const covered = auditBundleNoticeCoverage366(["example@1.2.3"], packages, notice);
    expect(covered[0]).toMatchObject({
      status: "NOTICE_REGISTERED", source: packages[0]?.source, integrity: packages[0]?.integrity,
      notices: [{ file: "example-MIT.txt", sha256: "a".repeat(64) }], failures: [],
    });
    expect(auditBundleNoticeCoverage366(["example@1.2.3"], packages,
      [{ ...notice[0]!, spdx: "Apache-2.0" }])[0]?.failures).toContain("NOTICE_SPDX_MISMATCH");
  });

  it("keeps LGPL/MPL bundled sources in NO_GO until corresponding-source review", () => {
    const packages = [
      { name: "example-lgpl", version: "2.0.0", license: "LGPL-3.0-only", source: "https://registry.npmjs.org/example-lgpl/-/example-lgpl-2.0.0.tgz", integrity: "sha512-pinned" },
      { name: "example-mpl", version: "1.0.0", license: "MPL-2.0", source: "https://registry.npmjs.org/example-mpl/-/example-mpl-1.0.0.tgz", integrity: "sha512-pinned" },
    ];
    const notices = packages.map(({ name, version, license }) => ({
      file: name + ".txt", packages: [name + "@" + version], spdx: license,
      upstream: "https://github.com/example/" + name, sha256: "b".repeat(64), marker: "Example",
    }));
    const coverage = auditBundleNoticeCoverage366(packages.map(({ name, version }) => name + "@" + version), packages, notices);
    expect(coverage.map(({ status }) => status)).toEqual(["NO_GO", "NO_GO"]);
    expect(coverage.every(({ failures }) => failures.includes("CORRESPONDING_SOURCE_REVIEW_REQUIRED"))).toBe(true);
    expect(auditBundleNoticeCoverage366(["unmapped@9.9.9"], packages, notices)[0]?.failures)
      .toContain("MISSING_BUNDLED_LOCK_METADATA");
    const dual = [{ ...packages[0]!, name: "dual", license: "(MIT OR GPL-3.0-or-later)" }];
    expect(auditBundleNoticeCoverage366(["dual@2.0.0"], dual, [    {
      ...notices[0]!, packages: ["dual@2.0.0"], spdx: "(MIT OR GPL-3.0-or-later)",
    }])[0]?.failures).toEqual(["LICENSE_CHOICE_REVIEW_REQUIRED"]);
  });

});
