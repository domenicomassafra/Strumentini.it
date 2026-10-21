# #366 — Installed runtime licenses, asset provenance and donor pinning

Evidence time: 2026-10-11 Europe/Rome. **Feasibility only; NO_ADOPT and NO_GO for any unknown source/license.** The current lockfile and checked-in binaries are not substitutes for authorization to redistribute a third-party dependency or model. No dependency was installed for this audit.

## Machine-checkable inventory

Run `./node_modules/.bin/tsx scripts/donor-provenance-366.ts --check` to examine **every** non-dev lockfile package (including nested/optional platform packages), check root direct dependency metadata and transitive edges, SHA-512 SRI shapes and exact registry tarball URLs, check all 33 retained checked-in assets against independent SHA-256 pins, and classify all eight donor package snapshots. An unchanged lockfile is **metadata evidence**, not an independently downloaded npm tarball checksum. A passing metadata check is **not** a rights or adoption decision. The scripts intentionally require exact SHA and block any newly introduced unpinned vendored file.

The local audit snapshots from 2026-10-10 are [npm metadata](audit-2026-10-10/donor-packages.json), [authenticated repository metadata](audit-2026-10-10/donor-metadata-authenticated.json), and [candidate WASM inventory](audit-2026-10-10/donor-wasm-sizes.json). They are historical captures and contain no independent downloaded-tarball hashes for the candidate WASM files; file sizes and registry-declared `dist.integrity` are **not** proof that extracted WASM bytes match a deployed asset. The checker therefore never approves installing the candidates on the strength of these snapshots alone.

Production direct package pins (versions determined from the current lockfile, not package.json semver ranges):

| Package | Version | Declared SPDX | Directly installed? | Primary metadata |
| --- | --- | --- | --- | --- |
| @astrojs/preact | 6.0.5 | MIT | yes | https://registry.npmjs.org/@astrojs/preact/6.0.5 |
| @noble/hashes | 2.4.0 | MIT | yes | https://registry.npmjs.org/@noble/hashes/2.4.0 |
| astro | 7.3.4 | MIT | yes | https://registry.npmjs.org/astro/7.3.4 |
| css-tree | 3.2.1 | MIT | yes | https://registry.npmjs.org/css-tree/3.2.1 |
| fflate | 0.8.3 | MIT | yes | https://registry.npmjs.org/fflate/0.8.3 |
| parse5 | 8.0.0 | MIT | yes | https://registry.npmjs.org/parse5/8.0.0 |
| pdfjs-dist | 6.4.299 | Apache-2.0 | yes | https://registry.npmjs.org/pdfjs-dist/6.4.299 |
| preact | 10.29.8 | MIT | yes | https://registry.npmjs.org/preact/10.29.8 |
| read-excel-file | 9.3.10 | MIT | yes | https://registry.npmjs.org/read-excel-file/9.3.10 |
| svgo | 4.1.0 | MIT | yes | https://registry.npmjs.org/svgo/4.1.0 |
| write-excel-file | 4.1.1 | MIT | yes | https://registry.npmjs.org/write-excel-file/4.1.1 |

The transitive matrix is generated from the checked-in lockfile by `auditLockedPackages366`, and the exact 367 production entries on `origin/main` of 2026-10-18 (name, version, license, integrity and primary npm tarball URL) are available through `--matrix`, together with a **separate 13-entry installed optional-runtime matrix**. The checker tests metadata completeness and dependency references; it does **not** perform legal compatibility analysis, verify built notices, authenticate fetched tarballs or grant redistribution rights. `heic-to` and transitive packages declare LGPL-3.0 or LGPL-3.0-or-later; MPL-2.0 and other licenses also need bundle-specific review. Seven historical `devOptional` lock edges were incorrectly refused as dev-only; corrected #366 checks the actual installed optional tree and its dependencies. See [current evidence](donor-provenance-366-active-2026-10-18.md).

## Donor candidates and third-party codec decisions

| Candidate | Exact captured version | Snapshot license | Dependency / embedded asset evidence | Decision |
| --- | --- | --- | --- | --- |
| [@jsquash/jpeg](https://www.npmjs.com/package/@jsquash/jpeg/v/1.6.0) | 1.6.0 | Apache-2.0 | no npm deps; 2 .wasm, package and codec licenses listed, no independently checked embedded-byte hashes | **NO_ADOPT** |
| [@jsquash/webp](https://www.npmjs.com/package/@jsquash/webp/v/1.5.0) | 1.5.0 | Apache-2.0 | `wasm-feature-detect ^1.2.11` unpinned closure; 3 .wasm and codec license; no independently checked hashes | **NO_ADOPT** |
| [@jsquash/avif](https://www.npmjs.com/package/@jsquash/avif/v/2.1.1) | 2.1.1 | Apache-2.0 | `wasm-feature-detect ^1.2.11` unpinned closure; 3 .wasm; bundled codec license unverified | **NO_ADOPT** |
| [@jsquash/oxipng](https://www.npmjs.com/package/@jsquash/oxipng/v/2.3.0) | 2.3.0 | Apache-2.0 | `wasm-feature-detect ^1.2.11` unpinned closure; 2 .wasm and codec license | **NO_ADOPT** |
| [heic-to](https://www.npmjs.com/package/heic-to/v/1.6.5) | 1.6.5 | LGPL-3.0 | removed in #126 option B; historical snapshot preserved | **NO_ADOPT** |
| [svgo](https://www.npmjs.com/package/svgo/v/4.1.0) | 4.1.0 | MIT | already installed; seven runtime dependencies checked by package-lock closure | **NO_ADOPT** new donor |
| [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist/v/6.4.299) | 6.4.299 | Apache-2.0 | already installed; bundled PDF assets need independent license inventory | **NO_ADOPT** new donor |
| [mupdf](https://www.npmjs.com/package/mupdf/v/1.28.1) | 1.28.1 | AGPL-3.0-or-later | no local package; AGPL/commercial decision outstanding | **NO_ADOPT** |

Snapshot source: npm `dist.tarball`, `dist.integrity`, declared `license`, `dependencies` and [prior authenticated repository metadata](audit-2026-10-10/donor-metadata-authenticated.json). Fresh check during #366: `npm view @jsquash/oxipng@2.3.0 license dist.integrity --json` returned Apache-2.0 and the same `sha512-aQ8wi... ` integrity from historical snapshot (2026-10-11). Primary repository reference: [jSquash](https://github.com/jamsinclair/jSquash), [SVGO](https://github.com/svg/svgo), [PDF.js](https://github.com/mozilla/pdf.js), [MuPDF](https://mupdf.com/licensing/), [heic-to](https://github.com/hoppergee/heic-to). Rights remain subject to original license files and any bundled native codecs.

## Checked-in binary/source asset inventory

Complete checked-in asset scope: `public/ocr-246`, `public/fonts`, `src/engines/video/vendor`, `src/engines/pdf/vendor`. The exact 30 retained checked-in files below are pinned to their SHA-256 to expose drift or undocumented additions. **These pins alone remain local observations.** Independent upstream tarball/CDN-byte comparisons and immutable OFL/Apache references for 8 fonts, 4 OFL texts and 14 OCR files are recorded separately in [primary-source-366-2026-10-18.md](primary-source-366-2026-10-18.md). On 19/10 the decompressed Italian model matched historical `tesseract-ocr/tessdata` commit `c2b2e0df86272ce11be323f23f96cf656565ed41` exactly, establishing Apache-2.0 source provenance; the unattributed MIT template was removed. Redistribution obligations for other runtime libraries remain NO_GO. Some .d.ts files are locally authored and require separate authored provenance.

File register: `path<TAB>sha256<TAB>SPDX-or-LOCAL_AUTHORED<TAB>version-or-GIT<TAB>source`. Font source is exact versioned Google Fonts CDN, and four OFL notices use immutable Google Git. Other third-party assets retain canonical npm tarballs where known; `UNKNOWN` remains a refusal. Four Strumentini-authored files retain `LOCAL_AUTHORED GIT git:<commit-sha1>:<blob-sha1>` for source-bound local identity. These and the registered font licenses are byte checks, not legal clearance. See the linked PDFStudio, Mediabunny, gifenc provenance documents and independent primary-source supplement.

<!-- ASSET-PINS-366-BEGIN -->
public/fonts/archivo-latin-ext.woff2	a999e009fdcd0f939c138e04043b3b2ad083b26252b644e8f94c083d48b77af0	OFL-1.1	gfonts-v25	https://fonts.gstatic.com/s/archivo/v25/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLyTOxKsv4RnUPU.woff2
public/fonts/archivo-latin.woff2	7150c0ec5ad356453013d11affec1fbab95de0dd2dcecb043b4f1cb7f87c4ba4	OFL-1.1	gfonts-v25	https://fonts.gstatic.com/s/archivo/v25/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLydOxKsv4Rn.woff2
public/fonts/archivo-OFL-1.1.txt	108b4e57c9c796d3d38d0428ca7ee39de47ad93187302718d9b2d8864b9b716b	OFL-1.1	git-47d54ca1ebb14fd864695f1d39dc734f39017c33	https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/archivo/OFL.txt
public/fonts/inter-latin-ext.woff2	a28eb6d3ccb534ae0c94ca999371df024aab60b08c3c8a5720ee9e32fa0faaa2	OFL-1.1	gfonts-v20	https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7W0Q5n-wU.woff2
public/fonts/inter-latin.woff2	c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4	OFL-1.1	gfonts-v20	https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2
public/fonts/inter-OFL-1.1.txt	5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57	OFL-1.1	git-47d54ca1ebb14fd864695f1d39dc734f39017c33	https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/inter/OFL.txt
public/fonts/roboto-mono-latin-ext.woff2	2cb74c78294bf69bb4c40e56d703014eecb0776df9a23418be836392fc7fdf89	OFL-1.1	gfonts-v31	https://fonts.gstatic.com/s/robotomono/v31/L0x5DF4xlVMF-BfR8bXMIjhFq3-cXbKDO1w.woff2
public/fonts/roboto-mono-latin.woff2	2ed6ac9efae6d21f51b2946176a0eef79a4043d643f9ac976e66d7fc4d57803a	OFL-1.1	gfonts-v31	https://fonts.gstatic.com/s/robotomono/v31/L0x5DF4xlVMF-BfR8bXMIjhLq3-cXbKD.woff2
public/fonts/robotomono-OFL-1.1.txt	50ab8dd54680d3473f649c9db86fece88434d097c7834475c1c72d2f8c429215	OFL-1.1	git-47d54ca1ebb14fd864695f1d39dc734f39017c33	https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/robotomono/OFL.txt
public/fonts/source-sans-3-latin-ext.woff2	ed3571ea9ff752f1c846f1c9ad2b0006de42f478a2db9163a74db0729a4eb281	OFL-1.1	gfonts-v19	https://fonts.gstatic.com/s/sourcesans3/v19/nwpStKy2OAdR1K-IwhWudF-R3wEaZejf5HdF8Q.woff2
public/fonts/source-sans-3-latin.woff2	ac057a5593cbe3df0d2585da5dd5f33b8efa84aa30550c710fe061b37fc5c54b	OFL-1.1	gfonts-v19	https://fonts.gstatic.com/s/sourcesans3/v19/nwpStKy2OAdR1K-IwhWudF-R3w8aZejf5Hc.woff2
public/fonts/sourcesans3-OFL-1.1.txt	09746787287a289323b0ec3cff4d1a4a801331b82b7207c1e186f5d26619a392	OFL-1.1	git-47d54ca1ebb14fd864695f1d39dc734f39017c33	https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/sourcesans3/OFL.txt
public/ocr-246/core/tesseract-core-APACHE-2.0.LICENSE	c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-7.0.0.tgz
public/ocr-246/core/tesseract-core-lstm.wasm	66b17df6e20c5329a17ffa9c202a47eaa3e32500b253d4c7f38e7f2bc01457c3	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-7.0.0.tgz
public/ocr-246/core/tesseract-core-lstm.wasm.js	eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-7.0.0.tgz
public/ocr-246/core/tesseract-core-relaxedsimd-lstm.wasm	7985c92d4c64e7267d24cadffe1b2a1da6bf8aa55fdcaf953fe94fe122a24545	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-7.0.0.tgz
public/ocr-246/core/tesseract-core-relaxedsimd-lstm.wasm.js	861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-7.0.0.tgz
public/ocr-246/core/tesseract-core-simd-lstm.wasm	34e8d50cac216427d86bf397d610fdd9f49492539bbcdfbfccc4eda20c810bea	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-7.0.0.tgz
public/ocr-246/core/tesseract-core-simd-lstm.wasm.js	c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-7.0.0.tgz
public/ocr-246/lang/UPSTREAM-APACHE-2.0.LICENSE	c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4	Apache-2.0	1.0.0	https://registry.npmjs.org/@tesseract.js-data/ita/-/ita-1.0.0.tgz
public/ocr-246/lang/ita.traineddata.gz	21c1bfde62571d76b923e270bb2cde583ccc18fa8bfd83454c021b28d8b5cb5a	Apache-2.0	1.0.0	https://registry.npmjs.org/@tesseract.js-data/ita/-/ita-1.0.0.tgz
public/ocr-246/vendor/tesseract-js-APACHE-2.0.LICENSE	b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
public/ocr-246/vendor/tesseract.esm.min.js	64871d76c75609fd5413b88a8171e2ef40deedd77d5875ba23df104b2d05eb29	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
public/ocr-246/vendor/tesseract.min.js.LICENSE.txt	cdf963ced7d25a0f98901a547647b4d6e2dbe0197fd78c87a059a87b0e542fe2	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
public/ocr-246/vendor/worker.min.js	576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
public/ocr-246/vendor/worker.min.js.LICENSE.txt	45f54171aeaa1d10c0c1a66f374b7bba1f02472b1487fbe892eec04f840002ac	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
src/engines/video/vendor/gifenc-mit-1.0.3/LICENSE.md	1610b01533a777ff952669a7d4fcb1e03b0d088c3409fd606d130f2d97cb017f	MIT	1.0.3	https://registry.npmjs.org/gifenc/-/gifenc-1.0.3.tgz
src/engines/video/vendor/gifenc-mit-1.0.3/README.md	021ac8f1473bfd69396de7fe8d7707a4b61c19af336606ee94f6d2946121d512	LOCAL_AUTHORED	GIT	git:9b394fdfbf4d37bf54678bba762b79e7c66b3304:06cac3d38f9646465516b05b18a572d57a67c39b
src/engines/video/vendor/gifenc-mit-1.0.3/index.d.mts	1cf412cc89e9a70fe682e2f63aa5f33e44d7d68984616ef1a2dba05c755c8581	LOCAL_AUTHORED	GIT	git:9b394fdfbf4d37bf54678bba762b79e7c66b3304:e11bd8fec69d3067fc6edec7a9a95e5607387628
src/engines/video/vendor/gifenc-mit-1.0.3/index.mjs	217761244379253ba5815510d3048a4fb1f4c4dbe9fb51a5cfbfe26f34eec093	MIT	1.0.3	https://registry.npmjs.org/gifenc/-/gifenc-1.0.3.tgz
public/models/portrait-modnet/config.json	e144d8af9b1f09649785c77f592a76bbc69504ae02e43700663b2a9f00d9c8a2	Apache-2.0	fa2fa546052fba4c08921230a26cc69a333fca12	https://huggingface.co/Xenova/modnet/resolve/fa2fa546052fba4c08921230a26cc69a333fca12/config.json
public/models/portrait-modnet/preprocessor_config.json	07d83634b1fdd20142ca6e3fe55ab92b558f56d1b0f005ff3a7926f1c9e1165d	Apache-2.0	fa2fa546052fba4c08921230a26cc69a333fca12	https://huggingface.co/Xenova/modnet/resolve/fa2fa546052fba4c08921230a26cc69a333fca12/preprocessor_config.json
public/models/portrait-modnet/onnx/model_quantized.onnx	92e49898c3e05a6d7a944fc67a8cb87c4aad754ffb6ebd949528c7d1105fee3a	Apache-2.0	fa2fa546052fba4c08921230a26cc69a333fca12	https://huggingface.co/Xenova/modnet/resolve/fa2fa546052fba4c08921230a26cc69a333fca12/onnx/model_quantized.onnx
<!-- ASSET-PINS-366-END -->

Current source-bound usage, unresolved real distribution rights, and the
2026-10-18 fake npm-origin regression are recorded separately in
[the current active dependency and asset audit](donor-provenance-366-active-2026-10-18.md).

## Blocking evidence / recovery

1. **NO_GO**: primary CDN/npm/Git byte identity is recorded for 8 fonts, 4 OFL notices and 14 OCR assets. The Italian model is independently tied to the original historical `tesseract-ocr/tessdata` bytes under Apache-2.0; the unlicensed MIT template has been removed. The full build-wide LGPL/MPL/QPDF notice/source obligations remain to be independently verified and satisfied. The seven `devOptional` false refusals were corrected in PR #222 and are no longer a blocker.
2. **NO_ADOPT**: for each potential jSquash and MuPDF candidate, retrieve official tarball, verify SHA-512 against registry `dist.integrity`, enumerate all transitive dependencies, inspect each codec/WASM licensing notice, and independently compare embedded artifact SHA-256 before reconsidering integration. The existing 2026-10-10 `donor-wasm-sizes.json` contains sizes, not hashes.
3. **REVIEW REQUIRED**: independently review installed LGPL/MPL/AGPL/copyleft requirements, PDFStudio/QPDF additional licenses, bundled notices and corresponding-source fulfillment in the actual distributed assets. No trademark, sublicensing or commercial-use approval is inferred.
4. **Rollback**: do not install/rewrite donors during feasibility. Any future change must keep the current engine and original bytes until it has passed public output, offline/privacy, memory/mobile and cancellation checks. Re-run `--check` before release and ensure receipts are retained.

Ticket #366 remains open wherever independent source and rights evidence are missing, even though the inventory/automatic refusal implementation is testable. AC-366.1–3 must not be checked solely on this evidence.
