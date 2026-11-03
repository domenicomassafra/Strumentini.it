import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

/**
 * Static transport for the compiled release acceptance runs.
 *
 * A real browser opens several parallel connections per page. The previous
 * transport for this matrix was a spawned `python3 -m http.server` child, which
 * reset connections (`net::ERR_CONNECTION_RESET`) while the browser fetched the
 * shell chunks: the island entry never loaded, hydration never happened and the
 * acceptance reported a browser failure that had nothing to do with the product.
 * This server keeps the same "plain static files, no cache" contract in process
 * with a listen backlog that survives that burst.
 */

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export interface DistServerOptions {
  readonly dist: string;
  readonly port?: number;
  readonly host?: string;
  readonly backlog?: number;
}

export interface RunningDistServer {
  readonly origin: string;
  readonly port: number;
  close(): Promise<void>;
}

export async function startDistServer(options: DistServerOptions): Promise<RunningDistServer> {
  const root = resolve(options.dist);
  const host = options.host ?? "127.0.0.1";
  const backlog = options.backlog ?? 511;

  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD", "content-length": "0", connection: "close" }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      // A compiled static site has no API: answer immediately instead of walking the
      // filesystem, so the browser closes the deliberately unread probe request and
      // Playwright's networkidle wait can settle.
      if (pathname.startsWith("/api/")) {
        response.writeHead(404, { "content-length": "0", "cache-control": "no-store", connection: "close" }).end();
        return;
      }
      const target = resolve(root, pathname.replace(/^\/+/, ""), pathname.endsWith("/") ? "index.html" : "");
      if (target !== root && !target.startsWith(root + sep)) {
        response.writeHead(403, { "content-length": "0", connection: "close" }).end();
        return;
      }
      const info = await stat(target);
      const file = info.isDirectory() ? resolve(target, "index.html") : target;
      const bytes = await readFile(file);
      response.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
        "content-length": String(bytes.byteLength),
        "cache-control": "no-store",
        // One request per connection, as the acceptance transport always did:
        // a kept-alive socket makes Playwright's networkidle wait never settle.
        connection: "close",
      });
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch {
      const body = "not found";
      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
        "content-length": String(body.length),
        "cache-control": "no-store",
        connection: "close",
      }).end(body);
    }
  });

  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen({ port: options.port ?? 0, host, backlog }, () => {
      server.removeListener("error", fail);
      done();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise<void>((done) => server.close(() => done()));
    throw new Error("static acceptance server did not bind a loopback port");
  }
  return {
    origin: `http://${host}:${String(address.port)}`,
    port: address.port,
    close: () => new Promise<void>((done) => { server.close(() => done()); }),
  };
}
