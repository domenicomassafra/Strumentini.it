# STR-421 — EML/MSG local parser donors (2026-10-19)

Issue: https://github.com/domenicomassafra/strumentini-it/issues/174

## Selected sources and licensing

- [postalsys/postal-mime](https://github.com/postalsys/postal-mime), npm 4.0.11, MIT-0, last update 2026-10-18. Master commit [ac3cc43ca4f0175ab3f8f32876f2e84f7eb2de7c](https://github.com/postalsys/postal-mime/commit/ac3cc43ca4f0175ab3f8f32876f2e84f7eb2de7c). Adopted for browser MIME and nested multipart, with configurable size and depth limits.
- [HiraokaHyperTools/msgreader](https://github.com/HiraokaHyperTools/msgreader), npm @kenjiuno/msgreader 1.29.0, Apache-2.0, last update 2026-10-14. Master commit [77b6ee07b2f96f39f8757525ae6f9f2ce1152458](https://github.com/HiraokaHyperTools/msgreader/commit/77b6ee07b2f96f39f8757525ae6f9f2ce1152458). Adopted to decode Outlook Compound File messages.
- Alternative forks checked: [ykarpovich/msg.reader](https://github.com/ykarpovich/msg.reader) Apache-2.0, last push 2021-05-05; [FreiraumIO/msgreader](https://github.com/FreiraumIO/msgreader) archived, license unclear, last push 2021-08-10. Neither was adopted.
- Locked indirect dependencies: @kenjiuno/decompressrtf 0.1.4 (BSD-2-Clause), iconv-lite 0.6.3 (MIT). Browser Buffer polyfill buffer 6.0.3 is MIT with transitive base64-js (MIT) and ieee754 (BSD-3-Clause). No copyleft added by this change.

Standards: [RFC 5322](https://www.rfc-editor.org/rfc/rfc5322), [RFC 2045](https://www.rfc-editor.org/rfc/rfc2045), [RFC 2046](https://www.rfc-editor.org/rfc/rfc2046), [MS-OXMSG](https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxmsg/).

New application code only handles local integration, resource bounds, fail-closed cases, safe filenames, text-only HTML preview, and inert downloads. The two upstream parsers implement format decoding; a home-grown MIME/MSG decoder would add security risks and duplicate maintained code.

## Pinned independent MSG corpus

Files come from the Apache-2.0 upstream repository at the commit above:

- [test/Simple.msg](https://github.com/HiraokaHyperTools/msgreader/blob/77b6ee07b2f96f39f8757525ae6f9f2ce1152458/test/Simple.msg) — SHA-256 78e7b635ed7429f303f468b66b78394d8ed1d28362ea609883ef191051b64d18, 20,480 bytes.
- [test/attachmentFiles.msg](https://github.com/HiraokaHyperTools/msgreader/blob/77b6ee07b2f96f39f8757525ae6f9f2ce1152458/test/attachmentFiles.msg) — SHA-256 8643045fd94c3f06df7bf147d1b95db07ff016cd0d52eacceaa15c74a2c9c3c7, 23,552 bytes.

Independent Unix file identification reports CDFV2 Microsoft Outlook Message for both files. Byte SHA-256 values were checked locally against the pinned upstream URLs; parsing yields subjects Simple and attachmentFiles with three JPG/PNG/TIF attachments in the latter. EML fixtures are synthetic, authored for this project. Test vectors include hostile HTML, active attachments, traversal, damaged MIME and cancellation.

Verification is recorded in tests/regroom-str-421.test.ts. Candidate oracle cand-271 is new without Gold receipt; broader device and MSG formats remain unverified. A public release is separate and requires approval of the owner.
