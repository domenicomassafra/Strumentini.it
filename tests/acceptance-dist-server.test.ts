import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDistServer } from "../scripts/acceptance/dist-server";

interface DistServer {
  readonly origin: string;
  close(): Promise<void>;
}

let root = "";
let dist = "";
let server: DistServer;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "strumentini-dist-server-"));
  dist = join(root, "dist");
  await mkdir(join(dist, "tools", "business-day"), { recursive: true });
  await mkdir(join(dist, "_astro"), { recursive: true });
  await writeFile(join(dist, "index.html"), "<!doctype html><title>home</title>");
  await writeFile(join(dist, "tools", "business-day", "index.html"), "<!doctype html><title>business day</title>");
  await writeFile(join(dist, "_astro", "entry.js"), "export const value = 1;\n");
  await writeFile(join(dist, "_astro", "font.woff2"), Buffer.from([0x77, 0x4f, 0x46, 0x32]));
  server = await startDistServer({ dist }) as DistServer;
});

afterAll(async () => {
  await server?.close();
  if (root !== "") await rm(root, { recursive: true, force: true });
});

describe("release acceptance static server", () => {
  it("serves a directory route through its index.html without cache", async () => {
    const response = await fetch(`${server.origin}/tools/business-day/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("business day");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports the compiled asset content types a browser needs", async () => {
    const script = await fetch(`${server.origin}/_astro/entry.js`);
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("javascript");
    const font = await fetch(`${server.origin}/_astro/font.woff2`);
    expect(font.status).toBe(200);
    expect(font.headers.get("content-type")).toContain("font/woff2");
  });

  it("answers a missing file with 404 instead of a hang", async () => {
    const response = await fetch(`${server.origin}/_astro/missing.js`);
    expect(response.status).toBe(404);
  });

  it("refuses a path that escapes the compiled directory", async () => {
    const response = await fetch(`${server.origin}/../package.json`);
    expect([403, 404]).toContain(response.status);
  });

  // A real browser opens several parallel connections per page; the previous
  // python -m http.server transport reset them under that burst and the app
  // island never hydrated, which is what the release gate reported.
  it("answers a burst of parallel asset requests without a single reset", async () => {
    const responses = await Promise.all(Array.from({ length: 64 }, () => fetch(`${server.origin}/_astro/entry.js`)));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(responses.map((response) => response.headers.get("content-type")).every((value) => value?.includes("javascript"))).toBe(true);
  });
});
