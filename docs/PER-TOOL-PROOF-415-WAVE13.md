# #415 — Wave 13: manifest identity must match current route source

**Recorded 2026-10-11 (Europe/Rome), source HEAD cb575662f18a7eac2b7fd841bf39af545447ccab.** Scope: source-local read-only auditor and two local producer/consumer samples. Not a Gold certification, public release, new receipt, 269-route runtime certification, or device/browser E2E run. Original ticket **OPEN**.

## Confirmed adversarial defect, RED → GREEN

The previous scripts/audit-per-tool-proof-415.ts verified a candidate receipt's exact JSON SHA-256, tool ID, schema, GOLD flag, revision, global sourceFingerprint, runtime/oracle/fixture declarations, and merely the **presence** of arbitrary identities. It did **not compare** receipt identities.manifestSha256 with bytes of the **current tool route manifest**. Therefore a receipt with an apparently matching global fingerprint/revision and internally consistent content hash could be incorrectly marked VERIFIED despite claiming a different route job/runtime manifest. A global fingerprint is not a substitute for the specific route identity declared in a receipt.

New adversarial test uses two distinct **synthetic source manifests** (different declared jobs), a complete receipt with old manifest SHA-256 but otherwise correct identity/revision/fingerprint and a recalculated SHA-256 of the receipt bytes. Expected false; formerly observed **true (RED)**. The same receipt with its manifest SHA corrected to the actual synthetic current manifest tests **true (GREEN)**, while omission of the current manifest digest tests **false**. This is a verification of parser/gate behavior, not a claim that a historical receipt was malicious or currently verifies.

**Minimal fix:** auditCurrentProofMap415 independently SHA-256-hashes each actual src/tools/{tool-id}/manifest.ts during its existing read-only pass. It passes that digest to probeReceipt415, which now requires a 64-hex current manifest digest and exact equality with the receipt's identities.manifestSha256. A missing source, omitted identity, malformed/mismatching identity or missing digest fails closed to PENDING. No change to Gold producer, release validation, generated catalog/quality index, or stored receipts.

## Independent local output sampling (not Gold)

Both operations use the installed production engine src/engines/file-privacy/index.ts and only constructed bytes in memory, not private documents. Reproducible by running tests/per-tool-proof-415.test.ts; test asserts concrete decoded bytes rather than merely an output object.

| Tool/route | Original fixture bytes | Independently checked output | Outcome |
|---|---|---|---|
| batch-checksum-manifest, /tools/batch-checksum-manifest | known.txt = UTF-8 abc (3 B); rows.csv = UTF-8 a,b newline 1,2 newline (8 B) | SHA-256 against Node crypto: known.txt = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad; rows.csv = 492d5ea496056f1a6a6592241032fab764c321596317930b4fa0e1e8bc3b7470. Actual manifest equals the two exact file entries plus a trailing newline | PASS_LOCAL_SAMPLE |
| zip-creator, /tools/zip-creator | Same two named source files, total 11 original bytes | Real 219-byte ZIP output (SHA-256 9266d22459e2fa3fb36d46102dd0dbd1c3599d21961854dc32e80341bd46e4ad) reopened with **independent fflate unzipSync** and both payloads byte-compared to originals | PASS_LOCAL_SAMPLE |

These are output-format and local-engine samples only; neither proves the public browser route, 269/269 jobs, every limit/timeout/cancellation/error edge, physical mobile devices, or authorization to promote Gold.

## Read-only inventory and checks

Run from repository root:

    ./node_modules/.bin/vitest run tests/per-tool-proof-415.test.ts
    ./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --skipLibCheck --target es2023 --module esnext --moduleResolution bundler --types node,vitest/globals scripts/audit-per-tool-proof-415.ts tests/per-tool-proof-415.test.ts
    ./node_modules/.bin/tsx scripts/audit-per-tool-proof-415.ts
    ./node_modules/.bin/tsx scripts/audit-per-tool-proof-415.ts --json

- **RED**: newly added stale-manifest receipt test failed before the source-identity check (expected false, received true).
- **GREEN**: scoped Vitest **5/5 PASS**, including two real local output checks and existing adversarial/pending tests; scoped strict TypeScript **PASS**.
- **Repeatability note:** One later default 5,000 ms Vitest run timed out during the read-only 269-route filesystem scan under shared-host contention (the other four cases passed). Unchanged assertions rerun with command ./node_modules/.bin/vitest run tests/per-tool-proof-415.test.ts --testTimeout=20000 — **5/5 PASS**, scan 11.6 s; scoped strict TypeScript also passed. No timeout threshold was lowered inside the test source.
- Source-local inventory: **269 / 269 route entries**, **269 / 269 sources existing and matching historical digests**, **269 / 269 oracle/fixture registrations**, **43** with declared handoff limits, **226** still lacking runtime limit attestations in this projection, **0 current VERIFIED / 269 PENDING**. No Gold receipts were created/promoted.

## Outstanding NO_GO

All 269 independent route-level runtime results remain **PENDING**; present 43 handoff maxBytes are not equal to executable per-job limits. Other receipt identity fields (engines, fixtures, worker/deployment), their independent byte bindings, device-specific verification, and complete per-route negative/oversize/abort cases require separately scoped proof. Do not close #415, declare a production runtime Gold state, infer all-source byte attestation from this targeted manifest gate, or change the release/certification authority.
