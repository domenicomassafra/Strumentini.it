# #366 — Installed runtime licenses, asset provenance and donor pinning

Evidence time: 2026-10-11 Europe/Rome. **Feasibility only; NO_ADOPT and NO_GO for any unknown source/license.** The current lockfile and checked-in binaries are not substitutes for authorization to redistribute a third-party dependency or model. No dependency was installed for this audit.

## Machine-checkable inventory

Run `./node_modules/.bin/tsx scripts/donor-provenance-366.ts --check` to examine **every** non-dev lockfile package (including nested/optional platform packages), check root direct dependency metadata and transitive edges, SHA-512 SRI shapes and exact registry tarball URLs, check all 46 checked-in assets against independent SHA-256 pins, and classify all eight donor package snapshots. An unchanged lockfile is **metadata evidence**, not an independently downloaded npm tarball checksum. A passing metadata check is **not** a rights or adoption decision. The scripts intentionally require exact SHA and block any newly introduced unpinned vendored file.

The local audit snapshots from 2026-10-10 are [npm metadata](audit-2026-10-10/donor-packages.json), [authenticated repository metadata](audit-2026-10-10/donor-metadata-authenticated.json), and [candidate WASM inventory](audit-2026-10-10/donor-wasm-sizes.json). They are historical captures and contain no independent downloaded-tarball hashes for the candidate WASM files; file sizes and registry-declared `dist.integrity` are **not** proof that extracted WASM bytes match a deployed asset. The checker therefore never approves installing the candidates on the strength of these snapshots alone.

Production direct package pins (versions determined from the current lockfile, not package.json semver ranges):

| Package | Version | Declared SPDX | Directly installed? | Primary metadata |
| --- | --- | --- | --- | --- |
| @astrojs/preact | 6.0.5 | MIT | yes | https://registry.npmjs.org/@astrojs/preact/6.0.5 |
| @noble/hashes | 2.4.0 | MIT | yes | https://registry.npmjs.org/@noble/hashes/2.4.0 |
| astro | 7.3.4 | MIT | yes | https://registry.npmjs.org/astro/7.3.4 |
| css-tree | 3.2.1 | MIT | yes | https://registry.npmjs.org/css-tree/3.2.1 |
| fflate | 0.8.3 | MIT | yes | https://registry.npmjs.org/fflate/0.8.3 |
| heic-to | 1.6.5 | LGPL-3.0 | yes | https://registry.npmjs.org/heic-to/1.6.5 |
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
| [heic-to](https://www.npmjs.com/package/heic-to/v/1.6.5) | 1.6.5 | LGPL-3.0 | already installed; related upstream GitHub license NOASSERTION; codec redistribution/rights review | **NO_ADOPT** new donor |
| [svgo](https://www.npmjs.com/package/svgo/v/4.1.0) | 4.1.0 | MIT | already installed; seven runtime dependencies checked by package-lock closure | **NO_ADOPT** new donor |
| [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist/v/6.4.299) | 6.4.299 | Apache-2.0 | already installed; bundled PDF assets need independent license inventory | **NO_ADOPT** new donor |
| [mupdf](https://www.npmjs.com/package/mupdf/v/1.28.1) | 1.28.1 | AGPL-3.0-or-later | no local package; AGPL/commercial decision outstanding | **NO_ADOPT** |

Snapshot source: npm `dist.tarball`, `dist.integrity`, declared `license`, `dependencies` and [prior authenticated repository metadata](audit-2026-10-10/donor-metadata-authenticated.json). Fresh check during #366: `npm view @jsquash/oxipng@2.3.0 license dist.integrity --json` returned Apache-2.0 and the same `sha512-aQ8wi... ` integrity from historical snapshot (2026-10-11). Primary repository reference: [jSquash](https://github.com/jamsinclair/jSquash), [SVGO](https://github.com/svg/svgo), [PDF.js](https://github.com/mozilla/pdf.js), [MuPDF](https://mupdf.com/licensing/), [heic-to](https://github.com/hoppergee/heic-to). Rights remain subject to original license files and any bundled native codecs.

## Checked-in binary/source asset inventory

Complete checked-in asset scope: `public/ocr-246`, `public/fonts`, `src/engines/video/vendor`, `src/engines/pdf/vendor`. The exact 46 checked-in files below are pinned to their current SHA-256 to expose drift, removal or previously undocumented additions. **These pins are local observations, not independent source attestations.** The `UNKNOWN` fields are deliberate refusals, including fonts with no corresponding checked-in upstream license/provenance ledger. OCR core package version and complete corpus chain of custody remain unverified. Some .d.ts files are locally authored and require separate authored provenance, not donor redistribution claims.

File register format: `path<TAB>sha256<TAB>SPDX-or-LOCAL_AUTHORED<TAB>version-or-GIT<TAB>source`. For third-party assets source is a canonical npm tarball URL if recorded; `UNKNOWN` means missing proof. Exactly four authored Strumentini notes/declarations are `LOCAL_AUTHORED GIT git:<commit-sha1>:<blob-sha1>` with immutable per-path Git source pins, verified against the on-disk Git blob and SHA-256. This claim never extends to adjacent donor payloads. See [pdfstudio provenance](../src/engines/pdf/vendor/pdfstudio/PROVENANCE.md), [Mediabunny provenance](../src/engines/video/vendor/mediabunny-mpl-1.61.3/README.md) and [gifenc provenance](../src/engines/video/vendor/gifenc-mit-1.0.3/README.md).

<!-- ASSET-PINS-366-BEGIN -->
public/fonts/archivo-latin-ext.woff2	a999e009fdcd0f939c138e04043b3b2ad083b26252b644e8f94c083d48b77af0	UNKNOWN	UNKNOWN	UNKNOWN
public/fonts/archivo-latin.woff2	7150c0ec5ad356453013d11affec1fbab95de0dd2dcecb043b4f1cb7f87c4ba4	UNKNOWN	UNKNOWN	UNKNOWN
public/fonts/inter-latin-ext.woff2	a28eb6d3ccb534ae0c94ca999371df024aab60b08c3c8a5720ee9e32fa0faaa2	UNKNOWN	UNKNOWN	UNKNOWN
public/fonts/inter-latin.woff2	c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4	UNKNOWN	UNKNOWN	UNKNOWN
public/fonts/roboto-mono-latin-ext.woff2	2cb74c78294bf69bb4c40e56d703014eecb0776df9a23418be836392fc7fdf89	UNKNOWN	UNKNOWN	UNKNOWN
public/fonts/roboto-mono-latin.woff2	2ed6ac9efae6d21f51b2946176a0eef79a4043d643f9ac976e66d7fc4d57803a	UNKNOWN	UNKNOWN	UNKNOWN
public/fonts/source-sans-3-latin-ext.woff2	ed3571ea9ff752f1c846f1c9ad2b0006de42f478a2db9163a74db0729a4eb281	UNKNOWN	UNKNOWN	UNKNOWN
public/fonts/source-sans-3-latin.woff2	ac057a5593cbe3df0d2585da5dd5f33b8efa84aa30550c710fe061b37fc5c54b	UNKNOWN	UNKNOWN	UNKNOWN
public/ocr-246/core/tesseract-core-APACHE-2.0.LICENSE	c6596eb7be8581c18be736c846fb9173b69eccf6ef94c5135893ec56bd92ba08	Apache-2.0	UNKNOWN	UNKNOWN
public/ocr-246/core/tesseract-core-lstm.wasm	66b17df6e20c5329a17ffa9c202a47eaa3e32500b253d4c7f38e7f2bc01457c3	Apache-2.0	UNKNOWN	UNKNOWN
public/ocr-246/core/tesseract-core-lstm.wasm.js	eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680	Apache-2.0	UNKNOWN	UNKNOWN
public/ocr-246/core/tesseract-core-relaxedsimd-lstm.wasm	7985c92d4c64e7267d24cadffe1b2a1da6bf8aa55fdcaf953fe94fe122a24545	Apache-2.0	UNKNOWN	UNKNOWN
public/ocr-246/core/tesseract-core-relaxedsimd-lstm.wasm.js	861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3	Apache-2.0	UNKNOWN	UNKNOWN
public/ocr-246/core/tesseract-core-simd-lstm.wasm	34e8d50cac216427d86bf397d610fdd9f49492539bbcdfbfccc4eda20c810bea	Apache-2.0	UNKNOWN	UNKNOWN
public/ocr-246/core/tesseract-core-simd-lstm.wasm.js	c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38	Apache-2.0	UNKNOWN	UNKNOWN
public/ocr-246/lang/NPM-PACKAGE-MIT.LICENSE	b05785f9f18e6716bab63424b11454513b9943a222595b70411009202fc592b5	UNKNOWN	1.0.0	https://registry.npmjs.org/@tesseract.js-data/ita/-/ita-1.0.0.tgz
public/ocr-246/lang/UPSTREAM-APACHE-2.0.LICENSE	c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4	UNKNOWN	1.0.0	https://registry.npmjs.org/@tesseract.js-data/ita/-/ita-1.0.0.tgz
public/ocr-246/lang/ita.traineddata.gz	21c1bfde62571d76b923e270bb2cde583ccc18fa8bfd83454c021b28d8b5cb5a	UNKNOWN	1.0.0	https://registry.npmjs.org/@tesseract.js-data/ita/-/ita-1.0.0.tgz
public/ocr-246/vendor/tesseract-js-APACHE-2.0.LICENSE	b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
public/ocr-246/vendor/tesseract.esm.min.js	64871d76c75609fd5413b88a8171e2ef40deedd77d5875ba23df104b2d05eb29	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
public/ocr-246/vendor/tesseract.min.js.LICENSE.txt	cdf963ced7d25a0f98901a547647b4d6e2dbe0197fd78c87a059a87b0e542fe2	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
public/ocr-246/vendor/worker.min.js	576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
public/ocr-246/vendor/worker.min.js.LICENSE.txt	45f54171aeaa1d10c0c1a66f374b7bba1f02472b1487fbe892eec04f840002ac	Apache-2.0	7.0.0	https://registry.npmjs.org/tesseract.js/-/tesseract.js-7.0.0.tgz
src/engines/pdf/vendor/pdfstudio/LICENSE	cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/PROVENANCE.md	1066bdef0bda479ef70feeb432377c5cd3e7bbca0f2724a40e5359316a294093	LOCAL_AUTHORED	GIT	git:c0f099557839b377471f4321edd0f87106a66c9d:4bb455d6cb1ebca50a06d7f65a37ba2711e894e7
src/engines/pdf/vendor/pdfstudio/errors.d.ts	ecbb9f74423c378e351d57a12b4d9666a47e981a75f5798ac903f18ff7eb113a	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/errors.js	2e34b66ad9b645f488cf89c6b49b5c8b64a8f567f9c7a4d61f327aadce146383	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/images.d.ts	04a9a2f49fc32dfbccd3813e48a6aadcd80d0eb6c59391e9df6ec099b58803e6	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/images.js	03d5afd36e1049c6bed3fe2db01b4f4fa05c5ad4b5149b50b85fe2622cbd5141	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/index.d.ts	e766f92d6fd17c7da7ce6b4c6b530638e0be78a5bff8b11a902f88a755db7b44	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/index.js	c0cd1c3b3a63b580a3d60fa2a3b858b7c49ba7afc897ea2795273bdd16095195	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/runner.d.ts	c387c5f0a541d8f41baa4eb5abd6d3943cfa48aada26fe73224aadff476c1015	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/runner.js	8563a6419093beaddb579bf41fc213d87874a180a7cc1aeea8c879ed7859ed66	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/types.d.ts	4e50dece060b8c971b3a44a21132848b3185b8d5664193a26933ecbc78f66c73	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/types.js	8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/wasm/qpdf.d.ts	d4110a11d0bcf3bbd2d6160c01e33c54add84b3cd1b39ae63f41ed04bd7a7b4e	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/wasm/qpdf.js	30f0a3407e6f6058def17d6080f94a797a53c03afd6b93f2e9ebf29881dce037	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/pdf/vendor/pdfstudio/wasm/qpdf.wasm	48a6044e2b5abb32295fa1682e26f20338181bb2423b2ab6e8456b7c4a8c9756	Apache-2.0	0.4.0	https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz
src/engines/video/vendor/gifenc-mit-1.0.3/LICENSE.md	1610b01533a777ff952669a7d4fcb1e03b0d088c3409fd606d130f2d97cb017f	MIT	1.0.3	https://registry.npmjs.org/gifenc/-/gifenc-1.0.3.tgz
src/engines/video/vendor/gifenc-mit-1.0.3/README.md	021ac8f1473bfd69396de7fe8d7707a4b61c19af336606ee94f6d2946121d512	LOCAL_AUTHORED	GIT	git:9b394fdfbf4d37bf54678bba762b79e7c66b3304:06cac3d38f9646465516b05b18a572d57a67c39b
src/engines/video/vendor/gifenc-mit-1.0.3/index.d.mts	1cf412cc89e9a70fe682e2f63aa5f33e44d7d68984616ef1a2dba05c755c8581	LOCAL_AUTHORED	GIT	git:9b394fdfbf4d37bf54678bba762b79e7c66b3304:e11bd8fec69d3067fc6edec7a9a95e5607387628
src/engines/video/vendor/gifenc-mit-1.0.3/index.mjs	217761244379253ba5815510d3048a4fb1f4c4dbe9fb51a5cfbfe26f34eec093	MIT	1.0.3	https://registry.npmjs.org/gifenc/-/gifenc-1.0.3.tgz
src/engines/video/vendor/mediabunny-mpl-1.61.3/LICENSE	3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04	MPL-2.0	1.61.3	https://registry.npmjs.org/mediabunny/-/mediabunny-1.61.3.tgz
src/engines/video/vendor/mediabunny-mpl-1.61.3/README.md	70677829c34cc3684b67a2a918dfff5b7bc509fed83067147adaedbd521fb254	LOCAL_AUTHORED	GIT	git:d1be7c10122c8103bcbba9e179eda3640b1b2d04:15d62331471498f7bd3f3674682d04195c6e2c58
src/engines/video/vendor/mediabunny-mpl-1.61.3/index.d.mts	34a6fe8a7df0db2609da691ef40fe7f8bfce6f04f0d8284aba0de9f0a3baae42	MPL-2.0	1.61.3	https://registry.npmjs.org/mediabunny/-/mediabunny-1.61.3.tgz
src/engines/video/vendor/mediabunny-mpl-1.61.3/index.mjs	d7b3a90e82158a7022729cbd4f861daf73cbb4f69d23349d2aefc9c8281cf70c	MPL-2.0	1.61.3	https://registry.npmjs.org/mediabunny/-/mediabunny-1.61.3.tgz
<!-- ASSET-PINS-366-END -->

Current source-bound usage, unresolved real distribution rights, and the
2026-10-18 fake npm-origin regression are recorded separately in
[the current active dependency and asset audit](donor-provenance-366-active-2026-10-18.md).

## Blocking evidence / recovery

1. **NO_GO**: recover official upstream license and exact npm/Git artifact identity for all 8 font binaries; pin matching distribution bytes and notices. Check OCR core version, model rights and package SHA against authentic upstream archives. The seven runtime-to-`devOptional` metadata false refusals are corrected, but that is not tarball/rights clearance.
2. **NO_ADOPT**: for each potential jSquash and MuPDF candidate, retrieve official tarball, verify SHA-512 against registry `dist.integrity`, enumerate all transitive dependencies, inspect each codec/WASM licensing notice, and independently compare embedded artifact SHA-256 before reconsidering integration. The existing 2026-10-10 `donor-wasm-sizes.json` contains sizes, not hashes.
3. **REVIEW REQUIRED**: independently review installed LGPL/MPL/AGPL/copyleft requirements, PDFStudio/QPDF additional licenses, bundled notices and corresponding-source fulfillment in the actual distributed assets. No trademark, sublicensing or commercial-use approval is inferred.
4. **Rollback**: do not install/rewrite donors during feasibility. Any future change must keep the current engine and original bytes until it has passed public output, offline/privacy, memory/mobile and cancellation checks. Re-run `--check` before release and ensure receipts are retained.

Ticket #366 remains open wherever independent source and rights evidence are missing, even though the inventory/automatic refusal implementation is testable. AC-366.1–3 must not be checked solely on this evidence.
