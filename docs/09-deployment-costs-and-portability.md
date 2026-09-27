# Deployment, cost guardrails, and hosting portability

## Current default

StrumentiUtili.it builds to a static `dist/` directory. Normal deterministic tools execute in the browser and do not require SSR, an application server, a database, or a paid Worker invocation.

Cloudflare Workers Static Assets is the default deployment target because it provides a global static cache, custom-domain support, versioned deployments, and a simple CLI release path while keeping ordinary static asset delivery outside Worker compute.

`wrangler` is only the Cloudflare deployment CLI. It is not a runtime dependency of the browser application and it does not make `dist/` Cloudflare-specific.

## Portability requirement

The built product must remain deployable as ordinary static files. A release must not depend on:

- Cloudflare Worker code for normal page or tool execution;
- server-side rendering;
- a provider-specific application runtime;
- a database for anonymous tool use;
- an origin URL ending in `workers.dev` or `pages.dev`;
- local developer filesystem paths.

Run:

```sh
npm run build
npm run deploy:check:portable
```

The portable check validates the built artifact independently of Cloudflare. The Cloudflare-specific dry run remains available as:

```sh
npm run deploy:check:cloudflare
```

`npm run deploy:check` runs both gates.

## Supported deployment shapes

### 1. Cloudflare Workers Static Assets — default

Best fit while the product is static-first. Buy the domain separately, point it at Cloudflare, and serve `dist/` from the edge. No VPS administration is required.

### 2. Generic static host/CDN

Any platform that can publish the contents of `dist/` with HTTPS, a custom domain, a working `/404.html`, and directory-style routes can host the product. The application itself does not require Cloudflare APIs.

### 3. Self-hosted VPS

A small Caddy or Nginx server can serve `dist/`. This is useful when infrastructure ownership or colocating future services matters, but it adds patching, TLS/reverse-proxy configuration, monitoring, backups, firewalling, and availability work that the current static product does not otherwise need.

## Cost policy

Until a real dynamic requirement appears, the infrastructure target is **zero recurring application-hosting cost excluding the domain**. Do not introduce a paid server merely to serve the static product.

Paid infrastructure becomes justified only when a feature genuinely needs a server-side capability such as accounts/sync, durable shared state, a private API, scheduled jobs, or a service that cannot execute safely in the browser.

When that happens, keep the static frontend independent from the backend so the public site can continue to use cheap/free static delivery while only the dynamic portion incurs compute cost.
