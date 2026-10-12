import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import {
  createHeavyLocalJobRunner,
  type HeavyLocalJobRuntimePolicy,
  type HeavyWorkerPort,
  type HeavyWorkerResponse,
  type HeavyWorkerStartMessage,
} from "../src/runtime/heavy-local-job";

type Request = { readonly marker: string; readonly bytes: Uint8Array };
type Result = { readonly marker: string };

const limits: HeavyLocalJobRuntimePolicy = {
  capabilities: { worker: "required" },
  limits: {
    softInputBytes: 512 * 1024,
    hardInputBytes: 2 * 1024 * 1024,
    softWorkingSetBytes: 2 * 1024 * 1024,
    hardWorkingSetBytes: 4 * 1024 * 1024,
  },
};
const capabilities = { worker: true, wasm: true, "image-decode": true };

class SyntheticWorker implements HeavyWorkerPort<Request, Result> {
  onmessage: ((event: MessageEvent<HeavyWorkerResponse<Result>>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly messages: HeavyWorkerStartMessage<Request>[] = [];
  terminated = 0;

  postMessage(message: HeavyWorkerStartMessage<Request>) { this.messages.push(message); }
  terminate() { this.terminated++; }
  respond(message: HeavyWorkerResponse<Result>) {
    this.onmessage?.({ data: message } as MessageEvent<HeavyWorkerResponse<Result>>);
  }
}

const workload = (marker: string, kib: number) => ({
  request: { marker, bytes: new Uint8Array(kib * 1024) },
  input: { inputBytes: kib * 1024, estimatedWorkingSetBytes: kib * 2048 },
});

describe("#363 wave21 heavy local resource-lifetime boundaries", () => {
  it("keeps a valid S job running when an L candidate is rejected, then resumes with M", async () => {
    const workers: SyntheticWorker[] = [];
    const runner = createHeavyLocalJobRunner<Request, Result>({
      policy: limits, detectCapabilities: () => capabilities,
      createWorker: () => { const worker = new SyntheticWorker(); workers.push(worker); return { worker }; },
    });
    const small = runner.start(workload("S", 16));
    expect(workers).toHaveLength(1);
    expect(() => runner.start(workload("L-over-hard", 2049))).toThrow(
      expect.objectContaining({ code: "PREFLIGHT_REJECTED" }),
    );
    // A refused replacement cannot destroy valid in-flight work.
    expect(runner.activeJobId).toBe(small.jobId);
    expect(workers[0]?.terminated).toBe(0);
    workers[0]?.respond({ type: "success", jobId: small.jobId, result: { marker: "verified-S" } });
    await expect(small.promise).resolves.toMatchObject({ value: { marker: "verified-S" } });

    const medium = runner.start(workload("M", 256));
    workers[1]?.respond({ type: "resource", jobId: medium.jobId, action: "reserve", resourceId: "image-frame", bytes: 384 * 1024 });
    workers[1]?.respond({ type: "success", jobId: medium.jobId, result: { marker: "verified-M" } });
    const value = await medium.promise;
    expect(value.value.marker).toBe("verified-M");
    expect(value.metrics.peakAccountedWorkingSetBytes).toBe(640 * 1024);
    expect(value.metrics.finalAccountedWorkingSetBytes).toBe(0);
    expect(workers.map((worker) => worker.terminated)).toEqual([1, 1]);
    runner.dispose();
  });

  it("releases a pre-aborted L preview/bitmap before worker creation", () => {
    const workers: SyntheticWorker[] = [];
    let released = 0;
    const controller = new AbortController();
    controller.abort();
    const runner = createHeavyLocalJobRunner<Request, Result>({
      policy: limits, detectCapabilities: () => capabilities,
      createWorker: () => { const worker = new SyntheticWorker(); workers.push(worker); return { worker }; },
    });
    expect(() => runner.start({
      ...workload("L", 1024), signal: controller.signal,
      ownedResources: [
        { id: "bitmap-preview", bytes: 2 * 1024 * 1024, release: () => { released++; } },
        { id: "blob-url", release: () => { released++; } },
      ],
    })).toThrow(expect.objectContaining({ name: "AbortError" }));
    expect(released).toBe(2);
    expect(workers).toHaveLength(0);
    runner.dispose();
  });

  it("fail-closes a cancel fired during M worker construction, never posting stale work or success", async () => {
    const workers: SyntheticWorker[] = [];
    let released = 0;
    const controller = new AbortController();
    let constructorAborts = true;
    const runner = createHeavyLocalJobRunner<Request, Result>({
      policy: limits, detectCapabilities: () => capabilities,
      createWorker: () => {
        const worker = new SyntheticWorker(); workers.push(worker);
        if (constructorAborts) controller.abort();
        return { worker };
      },
    });
    const first = runner.start({
      ...workload("M aborted", 256), signal: controller.signal,
      ownedResources: [{ id: "allocated-input", bytes: 256 * 1024, release: () => { released++; } }],
    });
    // The old implementation misses this abort because its listener is attached too late.
    const oldCallback = workers[0]?.onmessage;
    await expect(first.promise).rejects.toMatchObject({ name: "AbortError" });
    expect(workers[0]?.messages).toHaveLength(0);
    expect(workers[0]?.terminated).toBe(1);
    expect(released).toBe(1);
    expect(runner.activeJobId).toBeNull();

    constructorAborts = false;
    const retry = runner.start(workload("M retry", 256));
    const stale: HeavyWorkerResponse<Result> = { type: "success", jobId: first.jobId, result: { marker: "STALE" } };
    oldCallback?.({ data: stale } as MessageEvent<HeavyWorkerResponse<Result>>);
    expect(runner.activeJobId).toBe(retry.jobId);
    workers[1]?.respond({ type: "success", jobId: retry.jobId, result: { marker: "verified-retry" } });
    const completion = await retry.promise;
    expect(completion.value.marker).toBe("verified-retry");
    expect(completion.metrics.finalAccountedWorkingSetBytes).toBe(0);
    expect(workers[1]?.terminated).toBe(1);
    runner.dispose();
  });

  it("releases caller-owned resources when S input metadata is malformed before preflight", () => {
    let released = 0;
    let workers = 0;
    const runner = createHeavyLocalJobRunner<Request, Result>({
      policy: limits, detectCapabilities: () => capabilities,
      createWorker: () => { workers++; return { worker: new SyntheticWorker() }; },
    });
    expect(() => runner.start({
      ...workload("invalid", 16), input: { inputBytes: Number.NaN, estimatedWorkingSetBytes: 32 * 1024 },
      ownedResources: [{ id: "captured-object-url", release: () => { released++; } }],
    })).toThrow(/inputBytes/u);
    expect(released).toBe(1);
    expect(workers).toBe(0);
    runner.dispose();
  });

  // Opt-in: launching a real desktop browser is useful evidence but must not
  // add device-dependent runtime to every deterministic CI test suite.
  it.skipIf(process.env.RUN_CHROME_HEAVY_363 !== "1"
    || !existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"))(
    "measures bounded S/M/L synthetic jobs in installed desktop Chrome Worker without claiming device memory",
    async () => {
      const bundled = await build({
        entryPoints: ["src/runtime/heavy-local-job.ts"],
        bundle: true, platform: "browser", format: "esm", write: false, logLevel: "silent",
      });
      console.info("#363 desktop Chrome synthetic: ES module built");
      const moduleSource = bundled.outputFiles[0]?.text;
      if (moduleSource === undefined || moduleSource.length === 0) {
        throw new Error("Heavy local runner browser bundle is missing");
      }
      const server = createServer((_req, response) => response.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><html><title>synthetic local job</title></html>"));
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (typeof address !== "object" || address === null) throw Error("No loopback listener");
      let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
      try {
        browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
        console.info("#363 desktop Chrome synthetic: launched");
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });
        page.on("pageerror", (error) => console.info("#363 desktop Chrome pageerror:", error.message));
        console.info("#363 desktop Chrome synthetic: evaluating 3 real Workers");
        const readout = await page.evaluate(async (source) => {
          const modUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
          const workerSource = `self.onmessage=(event)=>{
            const {jobId,payload}=event.data;
            const frame=new Uint8Array(payload.bytes.length);
            frame[0]=payload.bytes[0];
            self.postMessage({type:"resource",jobId,action:"reserve",resourceId:"frame",bytes:frame.byteLength});
            self.postMessage({type:"success",jobId,result:{first:frame[0],length:frame.length}});
          };`;
          try {
            // Keep native browser import: Vitest transforms direct import()
            // inside page.evaluate into a Node-only SSR helper.
            const loadModule = new Function("url", "return import(url)") as (url: string) => Promise<{ createHeavyLocalJobRunner: (...args: any[]) => any }>;
            const { createHeavyLocalJobRunner } = await loadModule(modUrl);
            const policy = {
              capabilities: { worker: "required" },
              limits: { hardInputBytes: 2 * 1024 * 1024, hardWorkingSetBytes: 4 * 1024 * 1024 },
            };
            const runner = createHeavyLocalJobRunner({
              policy,
              detectCapabilities: () => ({ worker: true, wasm: true, "image-decode": true }),
              createWorker: () => {
                const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
                return { worker: new Worker(url), cleanup: () => URL.revokeObjectURL(url) };
              },
            });
            let lastVerified: { first: number; length: number } | undefined;
            const runs = [];
            for (const [name, kib] of [["S", 16], ["M", 256], ["L", 1024]] as const) {
              const bytes = new Uint8Array(kib * 1024);
              bytes[0] = kib % 251;
              const job = runner.start({
                request: { bytes },
                input: { inputBytes: bytes.byteLength, estimatedWorkingSetBytes: bytes.byteLength * 2 },
              });
              const completed = await Promise.race([
                job.promise,
                new Promise<never>((_resolve, reject) => setTimeout(() => reject(Error(`Real Worker ${name} did not complete within 4s`)), 4000)),
              ]);
              if (completed.value.first !== bytes[0] || completed.value.length !== bytes.length) throw Error(`Bad real Worker ${name} result`);
              if (completed.metrics.finalAccountedWorkingSetBytes !== 0 || completed.metrics.peakAccountedWorkingSetBytes !== bytes.byteLength * 2) throw Error(`Accounted resource leak for ${name}`);
              lastVerified = completed.value;
              runs.push({ name, inputKiB: kib, durationMs: completed.metrics.durationMs,
                peakAccountedKiB: completed.metrics.peakAccountedWorkingSetBytes / 1024,
                afterCleanupKiB: completed.metrics.finalAccountedWorkingSetBytes / 1024 });
            }
            const beforeAbort = lastVerified;
            const controller = new AbortController();
            controller.abort();
            let aborted = false;
            try {
              runner.start({ request: { bytes: new Uint8Array(1024) },
                input: { inputBytes: 1024, estimatedWorkingSetBytes: 2048 }, signal: controller.signal });
            } catch (error) { aborted = error instanceof Error && error.name === "AbortError"; }
            if (!aborted || lastVerified !== beforeAbort || runner.activeJobId !== null) throw Error("Cancelled job corrupted last verified result");
            runner.dispose();
            return { runs, cancelled: aborted, pageHeapBytesHint: (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize ?? null };
          } finally { URL.revokeObjectURL(modUrl); }
        }, moduleSource);
        expect(readout.runs).toHaveLength(3);
        expect(readout.cancelled).toBe(true);
        console.info("#363 CHROME DESKTOP SYNTHETIC S/M/L ONLY (not physical/device peak memory):", JSON.stringify(readout));
        await page.close();
        console.info("#363 desktop Chrome synthetic: closed page");
      } finally {
        await browser?.close();
        console.info("#363 desktop Chrome synthetic: closed browser");
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }, 40_000,
  );
});
