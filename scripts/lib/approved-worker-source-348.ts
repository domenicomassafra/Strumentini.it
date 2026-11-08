// #348 exact approved source snapshots; #573 entries are proposals until independently reviewed.
export const WORKER_SOURCE_SHA256: Readonly<Record<string, string>> = Object.freeze({
  // 2026-10-15 #328 candidate reviewed in source: internal-only Durable Object
  // 600k PBKDF2 with no credential persistence and no auth route. Unit/mock
  // coverage + Wrangler dry-run do NOT prove the actual Free plan CPU budget,
  // quota or AC328.1–.3; serverMode remains NO_GO until live staging proof.
  "worker/auth.ts": "d6417e29feec2be74b7768e6f35e871bc68099ddc19cc7bcd4beb3a35ed17141",
  "worker/bindings.d.ts": "6728f6a0b231d4b1b390434cf79d21d827f84116a5a55bd70a8322c6479c7e4d",
  // #332 independently reviewed: account-pinned favorite writes carry durable
  // operation identifiers for loss-of-ACK recovery, without new public routes.
  // #482: DELETE RETURNING id fixes cascaded-row accounting; same CAS/live-session predicate.
  "worker/db.ts": "0e5fc207e2f2b33a2b224989b1464e528fcdbeba9559d44444796bb6bd64e93e",
  "worker/favorite-sync-change.ts": "89f17d0d7b495c75fb6983334151ad883edb158c53e30be609b050f217ccccaa",
  "worker/google.ts": "6f9c7095714b197cc7e5a83833efa7098128f3883bba1b5a8423e2760c75f1c9",
  // #470 source-reviewed: all 19 existing routes are unchanged. The JSON
  // request decoder reads at most 4096 UTF-8 bytes and stops oversized streams.
  // #573 proposed source pin: one policy from public/_headers for existing
  // API responses, with no new route, provider, storage or network transport.
  // Exact-head independent security/deploy review is still required pre-merge.
  "worker/index.ts": "55edb293d41102fac49737132197157e5fa43d78029ec33e95ed14c8bbf0de2e",
  "worker/json-request-body.ts": "5d548896c9eb60c15f290ddec8d86142937feec6fe7b63179bb5eae0d0fea74c",
  "worker/kdf-client.ts": "d2aa12fce473bbbc598eedc7c957a4f67c5484ce9a03afabafea62e59b4cf539",
  "worker/migrations/0001_init.sql": "5402f41511baf4b74f4bf6b8bb46621d663a00d8352746c6acd1089c4c3f7417",
  "worker/migrations/0002_google_auth.sql": "80f0a007030410b018863ec36ca31fc6dff99ce52762979a071bc4c9af1fa6b9",
  "worker/migrations/0003_favorite_sync.sql": "b9e02301f5b76766039487dab65c57bf06b3c982c23cac3bcfc48dfa1747b6ea",
  "worker/migrations/0004_favorite_operation_ids.sql": "19c9a58d9f5e6deb5fab6dafe671fd1a8a9d0c0ad653c285fedbfbc3b8ed1aad",
  "worker/password-kdf.ts": "871aaa3142cbe2f51925105fcf99fd65f1d8a1a743c4535ae94bd3b0934e2f54",
  "worker/security-headers.ts": "f126c251284fd8ea8c0a026a671daedef532dfd4ecb2887c6bf17686119326f1",
  "worker/turnstile.ts": "bd7434f8233b9fe0e99fc42bdc5a4b11f919649364b58258b6ae77f0fcf32124",
  "worker/validation.ts": "8bdffe2dcc64ab1793b605e08c18920c54bb4f4128e77ef287f7ae3dc731e808",
  // #554: VIES accepts only SOAP 1.1 checkVatResponse with exact namespace,
  // Italian country/VAT echo and unambiguous validity; no new routes or writes.
  "worker/vies.ts": "c1c4c1cf56e4c418abfec76de2bc58d0ab64957f6111839a68a24db84dce82ab",
  // A second, explicitly nonproduction Wrangler file is itself executable
  // deployment policy. Exact bytes are pinned so routes, assets or D1 cannot
  // silently acquire production resources under a harmless config filename.
  "worker/wrangler.staging.jsonc": "d3a651888913200a85aa4ddc851042f6d559433b8934aad0b33bc9d92654b878",
});
