/** #366 distributed donor notices.
 *
 * Every licence file shipped under `public/licenses` is registered here with
 * the donor package(s) it attributes, its SPDX identifier and the SHA-256 of
 * the exact shipped bytes. This is an inventory and byte check: it proves that
 * an attribution reaches the static build, not that every transitive
 * dependency is legally cleared. Legal obligations stay with #126.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type DonorNotice366 = {
  readonly file: string;
  readonly packages: readonly string[];
  readonly spdx: string;
  readonly upstream: string;
  readonly sha256: string;
  readonly marker: string;
};

export const DONOR_NOTICES_366: readonly DonorNotice366[] = [
  {
    file: "ipaddr-303-MIT.txt",
    packages: ["ipaddr.js@2.5.0"],
    spdx: "MIT",
    upstream: "https://github.com/whitequark/ipaddr.js",
    sha256: "62568a2d1337b77171ecca9db10579163446de1ba6151678e81f06cdc199971b",
    marker: "whitequark",
  },
  {
    file: "bowser-281-MIT.txt",
    packages: ["bowser@2.14.1"],
    spdx: "MIT",
    upstream: "https://github.com/lancedikson/bowser",
    sha256: "dfde54fedc270c2a305d9a9f993d93f706d34624455a2fd2d2a05ca34d8ae8c3",
    marker: "Dustin Diaz",
  },
  {
    file: "slugify-305-MIT.txt",
    packages: ["@sindresorhus/slugify@3.0.1"],
    spdx: "MIT",
    upstream: "https://github.com/sindresorhus/slugify",
    sha256: "5c932d88256b4ab958f64a856fa48e8bd1f55bc1d96b8149c65689e0c61789d3",
    marker: "Sindre Sorhus",
  },
  {
    file: "smol-toml-277-BSD-3-Clause.txt",
    packages: ["smol-toml@1.9.1"],
    spdx: "BSD-3-Clause",
    upstream: "https://github.com/squirrelchat/smol-toml",
    sha256: "fa5659948374d4f555594f47f6da073b40dc503e921aeeece30df4362b3051a5",
    marker: "Squirrel Chat",
  },
  {
    file: "vat-validation-287-MIT.txt",
    packages: ["vat-validation@3.0.0"],
    spdx: "MIT",
    upstream: "https://github.com/alexeykarpoff/vat-validation",
    sha256: "c2fa5905c37c55f61d6755625d7209597747d176479108a235a76e8300e36d40",
    marker: "Alexey Karpov",
  },
  {
    file: "zxing-279-browser-MIT.txt",
    packages: ["@zxing/browser@0.2.1"],
    spdx: "MIT",
    upstream: "https://github.com/zxing-js/browser",
    sha256: "4c26c3077daa7ce4d56ad91f279fafc395bf33c3a0f1ba9ab8cf511bad148ea5",
    marker: "ZXing for JS",
  },
  {
    file: "zxing-279-library-Apache-2.0.txt",
    packages: ["@zxing/library@0.23.0"],
    spdx: "Apache-2.0",
    upstream: "https://github.com/zxing-js/library",
    sha256: "849b3ff4527ff587eecc78736b5685bbba7a44b071f3b944da914e832292f6c0",
    marker: "Apache License",
  },
  {
    file: "zxing-279-text-encoding-DUAL.txt",
    packages: ["@zxing/text-encoding@0.9.0"],
    spdx: "(Unlicense OR Apache-2.0)",
    upstream: "https://github.com/zxing-js/text-encoding",
    sha256: "d1c15dc8470e037b82da06a95b1a91558414a83625549c47dc3997a9985efa17",
    marker: "Encoding Standard",
  },
  {
    file: "zxing-279-ts-custom-error-MIT.txt",
    packages: ["ts-custom-error@3.3.1"],
    spdx: "MIT",
    upstream: "https://github.com/adriengibrat/ts-custom-error",
    sha256: "659b010fe62ce794cf25e1e36c2d739db17ea10a159f9a46ba2293e1f26d31c7",
    marker: "Adrien Gibrat",
  },
  {
    file: "qrcode-278-MIT.txt",
    packages: ["qrcode@1.5.4"],
    spdx: "MIT",
    upstream: "https://github.com/soldair/node-qrcode",
    sha256: "8df47c6ad9ac2c41eb9b2a72def9908959da0ede8dadd56c7b249c1bdb0c5ce6",
    marker: "Ryan Day",
  },
  {
    file: "dijkstrajs-278-MIT.txt",
    packages: ["dijkstrajs@1.0.3"],
    spdx: "MIT",
    upstream: "https://github.com/tcort/dijkstrajs",
    sha256: "c46324e45a005413535a6fb7a97e9eacd3cc6bf30335b7d5c10b8ee3af9e60c2",
    marker: "Wyatt Baldwin",
  },
  {
    file: "pngjs-278-MIT.txt",
    packages: ["pngjs@5.0.0"],
    spdx: "MIT",
    upstream: "https://github.com/pngjs/pngjs",
    sha256: "176b07a18c0bb3836aaeb61088fd0bf11a38f66e6f15e3fbda85faa225250d6e",
    marker: "Luke Page",
  },
  {
    file: "transformers-274-Apache-2.0.txt",
    packages: ["@huggingface/transformers@4.3.1"],
    spdx: "Apache-2.0",
    upstream: "https://github.com/huggingface/transformers.js/tree/4.3.1",
    sha256: "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
    marker: "Apache License",
  },
  {
    file: "onnxruntime-web-274-MIT.txt",
    packages: ["onnxruntime-web@1.31.0-dev.20260914-8d85527a0"],
    spdx: "MIT",
    upstream: "https://github.com/microsoft/onnxruntime/tree/8d85527a0",
    sha256: "2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c",
    marker: "Microsoft Corporation",
  },
  {
    file: "portrait-modnet-274-LICENSE.txt",
    packages: ["MODNet (ZHKKKe/MODNet) released checkpoints", "Xenova/modnet"],
    spdx: "Apache-2.0",
    upstream: "https://github.com/ZHKKKe/MODNet/tree/28165a451e4610c9d77cfdf925a94610bb2810fb",
    sha256: "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4",
    marker: "Apache License",
  },
  {
    file: "portrait-modnet-274-ATTRIBUTION.txt",
    packages: ["MODNet (ZHKKKe/MODNet) released checkpoints", "Xenova/modnet"],
    spdx: "Apache-2.0",
    upstream: "https://huggingface.co/Xenova/modnet/tree/fa2fa546052fba4c08921230a26cc69a333fca12",
    sha256: "1e9d82b10bab525fd9c813de659e00c33c043b6fbd2cc120c7f5e605b5bfef61",
    marker: "MODNet",
  },
];

const SOURCE_NOTICE_DIR = "public/licenses";
const BUILT_NOTICE_DIR = "licenses";

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Byte and attribution check for the `public/licenses` tree or a built `dist`. */
export function verifyDonorNotices366(
  root: string,
  notices: readonly DonorNotice366[] = DONOR_NOTICES_366,
  noticeDir: string = SOURCE_NOTICE_DIR,
): string[] {
  const failures: string[] = [];
  const directory = resolve(root, noticeDir);
  for (const notice of notices) {
    const path = resolve(directory, notice.file);
    if (!existsSync(path)) {
      failures.push(`MISSING_NOTICE ${noticeDir}/${notice.file} (${notice.packages.join(", ")})`);
      continue;
    }
    const bytes = readFileSync(path);
    if (sha256(bytes) !== notice.sha256) {
      failures.push(`NOTICE_BYTES_CHANGED ${noticeDir}/${notice.file}`);
    }
    if (!bytes.toString("utf8").toLowerCase().includes(notice.marker.toLowerCase())) {
      failures.push(`NOTICE_ATTRIBUTION_ABSENT ${noticeDir}/${notice.file}`);
    }
    if (!/^[A-Za-z0-9.()\- +]+$/u.test(notice.spdx)) {
      failures.push(`NOTICE_SPDX_INVALID ${noticeDir}/${notice.file}`);
    }
  }
  return failures;
}

/** Fail-closed the other way: an unregistered licence file cannot be shipped. */
export function auditNoticeDirectory366(
  root: string,
  notices: readonly DonorNotice366[] = DONOR_NOTICES_366,
  noticeDir: string = SOURCE_NOTICE_DIR,
): string[] {
  const directory = resolve(root, noticeDir);
  if (!existsSync(directory)) return [`MISSING_NOTICE_DIR ${noticeDir}`];
  const registered = new Set(notices.map((notice) => notice.file));
  return readdirSync(directory)
    .filter((file) => !registered.has(file))
    .map((file) => `UNREGISTERED_NOTICE ${noticeDir}/${file}`);
}

export function auditDonorNotices366(
  root: string,
  notices: readonly DonorNotice366[] = DONOR_NOTICES_366,
  noticeDir: string = SOURCE_NOTICE_DIR,
): string[] {
  return [
    ...verifyDonorNotices366(root, notices, noticeDir),
    ...auditNoticeDirectory366(root, notices, noticeDir),
  ];
}

/** Post-build gate: the same notices must exist inside the static artefact. */
export function auditDistributedNotices366(
  distRoot: string,
  notices: readonly DonorNotice366[] = DONOR_NOTICES_366,
): string[] {
  return auditDonorNotices366(distRoot, notices, BUILT_NOTICE_DIR);
}
