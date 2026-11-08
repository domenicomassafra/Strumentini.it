import securityHeaderPolicy from "../public/_headers";

// Cloudflare applies public/_headers to assets, but not Worker-generated API responses.
// The file also carries per-path cache rules, so only the global `/*` block is inherited here.
const SECURITY_HEADERS = new Headers();
let inGlobalBlock = false;
for (const line of securityHeaderPolicy.split("\n")) {
  if (/^\S/u.test(line)) {
    inGlobalBlock = line.trim() === "/*";
    continue;
  }
  if (!inGlobalBlock) continue;
  const header = /^\s+([^:]+):\s*(.+)$/u.exec(line);
  if (header !== null) SECURITY_HEADERS.set(header[1]!, header[2]!);
}

export function secureApiResponse(response: Response): Response {
  for (const [name, value] of SECURITY_HEADERS) response.headers.set(name, value);
  return response;
}
