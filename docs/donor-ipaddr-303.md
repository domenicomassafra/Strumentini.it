# #303 — CIDR parser donor provenance and rollback (2026-10-19)

## Source, permission, integrity

- **Package:** `ipaddr.js@2.5.0`, MIT. Upstream: https://github.com/whitequark/ipaddr.js; npm: https://www.npmjs.com/package/ipaddr.js/v/2.5.0.
- **Commit:** [`dc55282780d8702bac31ef012ca52e4a77fbca1f`](https://github.com/whitequark/ipaddr.js/commit/dc55282780d8702bac31ef012ca52e4a77fbca1f), `gitHead` in the published npm metadata, committed 2026-08-04. No upstream `v2.5.0` GitHub tag is published; pin the exact npm version and archive, not an assumed tag. Repository last pushed 2026-09-27.
- **npm integrity (from registry and `package-lock.json`):** `sha512-aq+t5NAc+cS6rZQQVWC2x98CPqGtKKTMDd4Gaodv0wShnItdKg/51djkGJ1hqH+Oy0ivDftCbSLCQob8zso01w==`.
- **Tarball SHA-256 (`shasum -a 256 ipaddr.js-2.5.0.tgz`):** `586f7ae92cc869bf61612f0d2765a02d98f813c7d1fff461745b93178da626c3`.
- **Notices/assets:** MIT license is in `node_modules/ipaddr.js/LICENSE` and upstream `LICENSE`, retained by npm distribution. Direct dependencies: none; no indirect dependencies introduced; package ships JS, TypeScript declarations and README, no other binary, font, model or WASM assets. Preserve the package MIT license when redistributing. Product-level donor/asset gate [#126](https://github.com/domenicomassafra/strumentini-it/issues/126) remains independent and unresolved.

## Runtime and semantics

- Offline and client-side: npm module loaded with `import("./cidr-ipaddr")` only for the CIDR operation, resolved by the app bundler to local same-origin JavaScript. No fetch, network requests, server use, storage, or telemetry in this adapter. Works in modern browser JavaScript and Cloudflare Worker module runtime with BigInt; browser support is verified separately.
- `ipaddr.parse` determines the address family and binary bytes. A small local input guard is necessary because upstream deliberately accepts legacy short/octal IPv4 and IPv6 zone IDs, which the existing CIDR tool refuses. Leading zero octets remain **decimal** as in the old tool. Embedded dotted IPv4 is expanded to hextets before donor parse to preserve this behavior.
- Existing `BigInt` host mask, network/broadcast, IPv4 RFC 3021 `/31`, `/32`, IPv6 `/127`, `/128`, RFC 5952 compression, privacy and typed error policy are preserved. Cancellation is checked before/after dynamic import and computation. Version remains `developer-web-v1` because the consumer output contract is unchanged.
- Rollback: revert the #303 merge commit (restores the old `network-numeric.ts` CIDR parser and its synchronous caller/tests), remove the pinned dependency and new adapter/test/document; rebuild the generated catalog. No persistent data migration or external installation is involved.

## Verification

- Differential reference: original parser from `origin/main`, compared against this adapter on 318 cases including varied IPv4/IPv6 ranges, embedded IPv4, leading zeroes, malformed prefixes and zone IDs: **318 equal / 0 differences**, eight identical `INVALID_INPUT` rejections.
- Independent oracle: `tests/cidr-ipaddr-303.test.ts` invokes Python stdlib `ipaddress.ip_network(strict=False)` on boundary and nontrivial networks; separate tests assert the donor permissiveness guards, RFC 5952 formatting and abort behavior.
- Local Node **26.10.0** microbenchmark (`--expose-gc`, four representative CIDRs, 24,000 operations per implementation, same process): old parser **880.7 ms / 36.70 µs per operation**, donor **951.0 ms / 39.63 µs** (~8% slower in this run). Sampled heap peak: **9.53 MiB old**, **11.68 MiB donor** (+2.15 MiB), with explicit GC before each run. Results are indicative and subject to system contention; this is not a cold-browser load or mobile memory measurement. The donor trades some runtime overhead for a verified MIT parser.
- Source parser deleted from `network-numeric.ts` (164 lines of parser/formatter/calculation) and replaced with lazy adapter (~5.8 KB source), plus `ipaddr.js` parser (~38 KB uncompressed JS, isolated in the CIDR chunk); no claim that the total transfer size shrinks.
- No production deployment is part of this adoption; live production still follows the separate release acceptance process. This document records a code adoption, not a Gold or physical device certificate.
