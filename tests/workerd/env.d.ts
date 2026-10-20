/// <reference types="@cloudflare/vitest-plugin/types" />
import type { D1Migration } from "cloudflare:test";
import type { Env as WorkerEnv } from "../../worker/index";

declare module "cloudflare:workers" {
  interface ProvidedEnv extends WorkerEnv {
    readonly TEST_MIGRATIONS: D1Migration[];
  }
  export const env: ProvidedEnv;
  export const exports: { default: { fetch(request: Request): Promise<Response> } };
}
