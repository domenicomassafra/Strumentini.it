# Donor notices must reach the distributed build (#126, #303)

**2026-10-21.** Observed defect: adopted donor code was compiled into the static
site while its licence notice existed only in `docs/licenses/` or not at all.
The 20/10/2026 review of STR-REUSE-TEXT recorded it precisely for
`ipaddr.js@2.5.0`: `dist/_astro/cidr-ipaddr.*.js` shipped no licence string and
`dist/licenses/` contained none of its MIT notice.

## What changed

- `public/licenses/ipaddr-303-MIT.txt` now ships the verbatim upstream MIT text.
- `scripts/donor-notices-366.ts` is the register of every distributed notice:
  file, attributed package(s), SPDX identifier, upstream URL, SHA-256 of the
  exact bytes and an attribution marker. It refuses a missing file, changed
  bytes, an absent attribution marker and an unregistered file placed in
  `public/licenses/`.
- `tests/donor-notices-366.test.ts` proves the source tree satisfies the
  register and that a missing or drifted notice fails closed.
- `scripts/inspect-build.ts` (run by `npm run build`) audits `dist/licenses/`
  with the same register, so a build that loses a notice fails instead of
  publishing silently.

## `ipaddr.js@2.5.0` rights chain

| Element | Pinned value |
| --- | --- |
| Upstream | https://github.com/whitequark/ipaddr.js |
| Commit | `dc55282780d8702bac31ef012ca52e4a77fbca1f` (2026-08-04) |
| npm tarball | https://registry.npmjs.org/ipaddr.js/-/ipaddr.js-2.5.0.tgz |
| npm SRI (`package-lock.json`) | `sha512-aq+t5NAc+cS6rZQQVWC2x98CPqGtKKTMDd4Gaodv0wShnItdKg/51djkGJ1hqH+Oy0ivDftCbSLCQob8zso01w==` |
| `LICENSE` SHA-256 | `62568a2d1337b77171ecca9db10579163446de1ba6151678e81f06cdc199971b` |
| Shipped notice | `public/licenses/ipaddr-303-MIT.txt`, same bytes as upstream and npm tarball |
| Declared dependencies | none |

The MIT text, the npm integrity and the upstream commit hash are primary
evidence for the redistributed JavaScript. They do not convert into a blanket
legal opinion for the whole dependency graph.

## Verified here

- `npx vitest run tests/donor-notices-366.test.ts --maxWorkers=1` → **5/5 PASS**
  (register complete, ipaddr attribution present, missing notice refused, byte
  drift refused, dist-level missing notice refused).
- Build-level proof of `dist/licenses/` presence is the `inspect-build` gate;
  the local MiniPC attempt was not used as evidence because the disk was at
  100% (`ENOSPC` during `npm ci`), so the compiled-artefact claim rests on the
  CI build of this branch, read back from the workflow run.

## Limits

This is an inventory and byte-attribution check, not legal clearance; #126 stays
open for owner-level redistribution decisions, transitive obligations and any
asset whose rights chain is not independently attested. No Gold, release
admission or production deploy follows from it.
