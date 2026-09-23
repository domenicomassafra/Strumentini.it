# Architecture hypothesis

## Goal

Keep marginal cost and operational burden extremely low.

## Client

- static web app / PWA;
- TypeScript;
- browser APIs first;
- Web Workers for CPU-heavy work;
- WASM only where native browser capability is insufficient;
- lazy-load heavy runtimes;
- IndexedDB / OPFS for optional local state;
- local processing for sensitive files.

## Account and sync

Authentication should be optional for initial usage.

If Google sign-in or another provider is introduced, remote state should stay tiny:
- identity;
- installed tool IDs;
- layout;
- pack selection;
- safe profile defaults;
- UI preferences.

User documents/files should not be uploaded merely because the user is signed in.

## Profile model

Potential safe reusable values:
- country / locale;
- currency;
- timezone;
- date/number format;
- working hours and days;
- optional hourly/day rate;
- preferred image/file defaults;
- optional business identity fields only where explicitly needed.

Every reused value should be visible and overridable.

## Tool contract

Each utility should eventually be a small module with metadata such as:
- id;
- name;
- category;
- pack membership;
- input types;
- profile fields used;
- runtime requirements;
- privacy classification;
- version;
- offline capability.

The shell discovers/searches/renders tools without becoming a general orchestration framework.

## Dynamic infrastructure

Keep dynamic infrastructure limited to authentication, tiny configuration sync, optional analytics and possibly a small registry if static manifests become insufficient.

No per-use LLM call for ordinary deterministic tools.

## AI policy

AI may be useful for free-text onboarding, tool/pack suggestions and selected inherently semantic tools. Do not insert AI into deterministic conversions or calculations just because it is available.
