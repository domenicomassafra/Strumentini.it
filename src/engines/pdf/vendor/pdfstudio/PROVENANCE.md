pdfstudio@0.4.0, published npm tarball (`pdfstudio-0.4.0.tgz`), 2026-10-10.
Upstream: https://github.com/fayazara/pdfstudio (Apache-2.0).
Release tag `v0.4.0`: https://github.com/fayazara/pdfstudio/tree/v0.4.0, Git object `8839e020e361354e4305990ef7cb8dab2d6fd2db` (GitHub API, 2026-10-19).
Registry artifact: https://registry.npmjs.org/pdfstudio/-/pdfstudio-0.4.0.tgz; npm metadata integrity `sha512-yFHlp/VHxKmrYxYA45ACkh24c4mCBa/Al3EmajnlBnN9FzfynZz63sR2do2kBH34XoTAQSXy+ywijAcq0DUcSQ==`.
Tarball SHA-256: `4b8481ce55b5f29373baf1a4a10361d7facdd5ec074b7c7daf101431d931c97a`.
Embedded `wasm/qpdf.wasm` SHA-256: `48a6044e2b5abb32295fa1682e26f20338181bb2423b2ab6e8456b7c4a8c9756`.
Packaged dist JS, d.ts, WASM, and LICENSE copied without changes.
Upstream credits qpdf (Apache-2.0), zlib (zlib license), libjpeg (IJG license).
2026-10-19 STR-294 independent `npm pack pdfstudio@0.4.0` reproduced the recorded tarball SHA-256 and local WASM SHA-256. The npm tarball includes `package/LICENSE`, but **no separate QPDF/zlib/libjpeg NOTICE or LICENSE files**. The exact embedded QPDF build revision, source/build chain and redistributable notices remain unattested: **NO_GO for a new compression adoption** pending #126; hashes alone do not clear embedded code rights.
Loaded lazily on password-assisted action; no remote CDN/runtime upload.
