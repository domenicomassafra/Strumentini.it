import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readConfig(name: string): Record<string, unknown> {
  // Both maintained Wrangler configs use only full-line JSONC comments.
  const raw = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
  return JSON.parse(raw.replace(/^\s*\/\/[^\n]*(?:\n|$)/gmu, "")) as Record<string, unknown>;
}

describe("#328 dedicated Cloudflare staging boundaries", () => {
  const prod = readConfig("wrangler.jsonc");
  const stage = readConfig("wrangler.staging.jsonc");

  it("never publishes staging to the production route or Worker", () => {
    expect(stage.name).toBe("strumentini-328-staging-20261015");
    expect(stage.name).not.toEqual(prod.name);
    expect(stage.routes).toEqual([]);
    expect(stage.workers_dev).toBe(true);
    expect(stage.main).toBe(prod.main);
  });

  it("has an independently provisioned D1 binding", () => {
    const prodD1 = (prod.d1_databases as Array<Record<string, string>>)[0]!;
    const stagingD1 = (stage.d1_databases as Array<Record<string, string>>)[0]!;
    expect(stagingD1.binding).toBe("AUTH_DB");
    expect(stagingD1.database_name).toBe("strumentini-328-staging-20261015");
    expect(stagingD1.database_name).not.toEqual(prodD1.database_name);
    expect(stagingD1.database_id).not.toEqual(prodD1.database_id);
    expect(stagingD1.migrations_dir).toBe(prodD1.migrations_dir);
    expect((stage.assets as Record<string, string>).directory).toBe("./dist");
  });

  it("does not store credentials in the staging configuration", () => {
    const source = readFileSync(new URL("../wrangler.staging.jsonc", import.meta.url), "utf8");
    expect(source).not.toMatch(/TURNSTILE_SECRET|API_TOKEN|SECRET_KEY|BEGIN PRIVATE KEY/u);
  });
});
