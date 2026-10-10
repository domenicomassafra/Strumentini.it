# Mediabunny 1.61.3 donor attribution

This folder contains **unmodified distribution files** extracted from the
official `mediabunny@1.61.3` npm package, published by Vanilagy and
contributors under **MPL-2.0**. The `LICENSE` file is distributed alongside.

- Original project and corresponding source: https://github.com/Vanilagy/mediabunny
- Exact published package: https://www.npmjs.com/package/mediabunny/v/1.61.3
- Upstream source archive: https://registry.npmjs.org/mediabunny/-/mediabunny-1.61.3.tgz
- Package tarball SHA-256: `507e6f75def0ba3748b3b52e4a8ed2937cf311897f4984b90510b56b279bc3d1`
- `index.mjs`: `package/dist/bundles/mediabunny.min.mjs`, SHA-256 `d7b3a90e82158a7022729cbd4f861daf73cbb4f69d23349d2aefc9c8281cf70c`
- `index.d.mts`: `package/dist/mediabunny.d.ts`, SHA-256 `34a6fe8a7df0db2609da691ef40fe7f8bfce6f04f0d8284aba0de9f0a3baae42`

No FFmpeg WASM runtime, compiled codecs or GPL build is bundled. All
consumer-specific logic is in adjacent Strumentini `video-transform-234`
files; Mediabunny's vendor distribution is unchanged. This source package is
provided for reproducibility and MPL source access; include this notice and
`LICENSE` in redistributed compiled artifacts.
